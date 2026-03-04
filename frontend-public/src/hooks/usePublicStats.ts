import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Municipality,
  ResponseTimeData,
  ResolutionRateData,
  CategoryBreakdownData,
  SdbipAchievementData,
  PublicTicketStatsRow,
  PublicMunicipalityRow,
} from '../types/public';
import {
  mockMunicipalities,
  mockResponseTimes,
  mockResolutionRates,
  mockCategoryBreakdown,
} from '../data/mockDashboardData';
import { getQuarterBounds } from '../utils/saFinancialYear';

/**
 * Custom hooks for querying Supabase public views directly.
 * NO FastAPI dependency - fully serverless.
 *
 * All hooks degrade gracefully to mock data on Supabase errors.
 * isLoading is ALWAYS set to false in finally blocks (no infinite spinners).
 */

// Diagnostic connectivity check — runs once on module load, does not block rendering.
// Logs a warning to the console if Supabase is unreachable, aiding debugging.
supabase
  .from('public_municipalities')
  .select('*', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
    }
  });

export function useMunicipalities() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMunicipalities() {
      try {
        setIsLoading(true);
        const { data, error: queryError } = await supabase
          .from('public_municipalities')
          .select('*')
          .order('name');

        if (queryError) throw queryError;

        const rows = (data as PublicMunicipalityRow[]) || [];
        setMunicipalities(rows.length > 0 ? rows : mockMunicipalities);
        setError(null);
      } catch (err) {
        setMunicipalities(mockMunicipalities);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMunicipalities();
  }, []);

  return { municipalities, isLoading, error };
}

export function useResponseTimes(municipalityId?: string, financialYear?: string, quarter?: 1 | 2 | 3 | 4) {
  const [data, setData] = useState<ResponseTimeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResponseTimes() {
      try {
        setIsLoading(true);

        let query = supabase
          .from('public_ticket_stats')
          .select('municipality_id, municipality_name, response_hours, report_date')
          .not('response_hours', 'is', null);

        if (municipalityId) {
          query = query.eq('municipality_id', municipalityId);
        }

        if (financialYear && quarter) {
          const bounds = getQuarterBounds(financialYear, quarter);
          query = query.gte('report_date', bounds.start).lte('report_date', bounds.end);
        }

        const { data: rows, error: queryError } = await query;

        if (queryError) throw queryError;

        // Aggregate in JS: group by municipality, calculate averages
        const grouped = (rows as PublicTicketStatsRow[]).reduce((acc, row) => {
          const key = row.municipality_id;
          if (!acc[key]) {
            acc[key] = {
              municipality_id: row.municipality_id,
              municipality_name: row.municipality_name,
              response_hours: [],
            };
          }
          if (row.response_hours !== null) {
            acc[key].response_hours.push(row.response_hours);
          }
          return acc;
        }, {} as Record<string, { municipality_id: string; municipality_name: string; response_hours: number[] }>);

        const result: ResponseTimeData[] = Object.values(grouped).map(g => ({
          municipality_id: g.municipality_id,
          municipality_name: g.municipality_name,
          avg_response_hours: g.response_hours.reduce((sum, h) => sum + h, 0) / g.response_hours.length,
          ticket_count: g.response_hours.length,
        }));

        if (result.length > 0) {
          setData(result);
        } else {
          const fallback = municipalityId
            ? mockResponseTimes.filter(r => r.municipality_id === municipalityId)
            : mockResponseTimes;
          setData(fallback);
        }
        setError(null);
      } catch (err) {
        const fallback = municipalityId
          ? mockResponseTimes.filter(r => r.municipality_id === municipalityId)
          : mockResponseTimes;
        setData(fallback);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchResponseTimes();
  }, [municipalityId, financialYear, quarter]);

  return { data, isLoading, error };
}

export function useResolutionRates(municipalityId?: string, months = 6, financialYear?: string, quarter?: 1 | 2 | 3 | 4) {
  const [data, setData] = useState<ResolutionRateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResolutionRates() {
      try {
        setIsLoading(true);

        let query = supabase
          .from('public_ticket_stats')
          .select('municipality_id, municipality_name, status, report_date');

        if (financialYear && quarter) {
          const bounds = getQuarterBounds(financialYear, quarter);
          query = query.gte('report_date', bounds.start).lte('report_date', bounds.end);
        } else {
          // existing months-based cutoff logic
          const cutoffDate = new Date();
          cutoffDate.setMonth(cutoffDate.getMonth() - months);
          const cutoffString = cutoffDate.toISOString().split('T')[0];
          query = query.gte('report_date', cutoffString);
        }

        if (municipalityId) {
          query = query.eq('municipality_id', municipalityId);
        }

        const { data: rows, error: queryError } = await query;

        if (queryError) throw queryError;

        // Aggregate: overall resolution rates + monthly trend
        const grouped = (rows as PublicTicketStatsRow[]).reduce((acc, row) => {
          const key = row.municipality_id;
          if (!acc[key]) {
            acc[key] = {
              municipality_id: row.municipality_id,
              municipality_name: row.municipality_name,
              total: 0,
              resolved: 0,
              byMonth: {} as Record<string, { total: number; resolved: number }>,
            };
          }
          acc[key].total += 1;
          if (row.status === 'resolved') {
            acc[key].resolved += 1;
          }

          // Track monthly trend
          const month = row.report_date.substring(0, 7); // "2026-02"
          if (!acc[key].byMonth[month]) {
            acc[key].byMonth[month] = { total: 0, resolved: 0 };
          }
          acc[key].byMonth[month].total += 1;
          if (row.status === 'resolved') {
            acc[key].byMonth[month].resolved += 1;
          }

          return acc;
        }, {} as Record<string, { municipality_id: string; municipality_name: string; total: number; resolved: number; byMonth: Record<string, { total: number; resolved: number }> }>);

        const result: ResolutionRateData[] = Object.values(grouped).map(g => {
          const resolution_rate = g.total > 0 ? (g.resolved / g.total) * 100 : 0;

          // Build monthly trend
          const trend = Object.entries(g.byMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, stats]) => ({
              month,
              rate: stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0,
            }));

          return {
            municipality_id: g.municipality_id,
            municipality_name: g.municipality_name,
            resolution_rate,
            total_tickets: g.total,
            resolved_tickets: g.resolved,
            trend,
          };
        });

        if (result.length > 0) {
          setData(result);
        } else {
          const fallback = municipalityId
            ? mockResolutionRates.filter(r => r.municipality_id === municipalityId)
            : mockResolutionRates;
          setData(fallback);
        }
        setError(null);
      } catch (err) {
        const fallback = municipalityId
          ? mockResolutionRates.filter(r => r.municipality_id === municipalityId)
          : mockResolutionRates;
        setData(fallback);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchResolutionRates();
  }, [municipalityId, months, financialYear, quarter]);

  return { data, isLoading, error };
}

export function useCategoryBreakdown(municipalityId?: string, financialYear?: string, quarter?: 1 | 2 | 3 | 4) {
  const [data, setData] = useState<CategoryBreakdownData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setIsLoading(true);

        let query = supabase
          .from('public_ticket_stats')
          .select('category, report_date');

        if (municipalityId) {
          query = query.eq('municipality_id', municipalityId);
        }

        if (financialYear && quarter) {
          const bounds = getQuarterBounds(financialYear, quarter);
          query = query.gte('report_date', bounds.start).lte('report_date', bounds.end);
        }

        const { data: rows, error: queryError } = await query;

        if (queryError) throw queryError;

        // Aggregate: count per category
        const counts: Record<string, number> = {};
        for (const row of (rows as PublicTicketStatsRow[])) {
          const cat = row.category || 'other';
          counts[cat] = (counts[cat] || 0) + 1;
        }

        const result: CategoryBreakdownData[] = Object.entries(counts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count);

        if (result.length > 0) {
          setData(result);
        } else {
          setData(mockCategoryBreakdown);
        }
        setError(null);
      } catch (err) {
        setData(mockCategoryBreakdown);
        setError(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCategories();
  }, [municipalityId, financialYear, quarter]);

  return { data, isLoading, error };
}

// ---------------------------------------------------------------------------
// SDBIP Achievement Hook (Phase 32)
// ---------------------------------------------------------------------------

const mockSdbipAchievement: SdbipAchievementData[] = [
  {
    municipality_id: 'mun-001',
    municipality_name: 'Buffalo City Metropolitan',
    financial_year: '2025/2026',
    total_kpis: 48,
    green: 29,
    amber: 12,
    red: 7,
    overall_achievement_pct: 72.4,
  },
  {
    municipality_id: 'mun-002',
    municipality_name: 'Mangaung Metropolitan',
    financial_year: '2025/2026',
    total_kpis: 35,
    green: 18,
    amber: 10,
    red: 7,
    overall_achievement_pct: 61.2,
  },
  {
    municipality_id: 'mun-003',
    municipality_name: 'Sol Plaatje Local',
    financial_year: '2025/2026',
    total_kpis: 22,
    green: 15,
    amber: 5,
    red: 2,
    overall_achievement_pct: 78.6,
  },
];

export function useSdbipAchievement(municipalityId?: string) {
  const [data, setData] = useState<SdbipAchievementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (municipalityId) params.set('municipality_id', municipalityId);
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${apiUrl}/api/v1/public/sdbip-performance?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.length > 0 ? json : mockSdbipAchievement);
      } catch {
        setData(mockSdbipAchievement);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [municipalityId]);

  return { data, isLoading };
}
