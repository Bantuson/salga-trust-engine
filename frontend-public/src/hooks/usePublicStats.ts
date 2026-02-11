import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Municipality,
  ResponseTimeData,
  ResolutionRateData,
  HeatmapPoint,
  SystemSummary,
  PublicTicketStatsRow,
  PublicMunicipalityRow,
  PublicHeatmapRow,
} from '../types/public';

/**
 * Custom hooks for querying Supabase public views directly.
 * NO FastAPI dependency - fully serverless.
 */

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

        setMunicipalities((data as PublicMunicipalityRow[]) || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching municipalities:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchMunicipalities();
  }, []);

  return { municipalities, isLoading, error };
}

export function useResponseTimes(municipalityId?: string) {
  const [data, setData] = useState<ResponseTimeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResponseTimes() {
      try {
        setIsLoading(true);

        let query = supabase
          .from('public_ticket_stats')
          .select('municipality_id, municipality_name, response_hours')
          .not('response_hours', 'is', null);

        if (municipalityId) {
          query = query.eq('municipality_id', municipalityId);
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

        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error fetching response times:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchResponseTimes();
  }, [municipalityId]);

  return { data, isLoading, error };
}

export function useResolutionRates(municipalityId?: string, months = 6) {
  const [data, setData] = useState<ResolutionRateData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResolutionRates() {
      try {
        setIsLoading(true);

        // Calculate date cutoff for trend (last N months)
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        const cutoffString = cutoffDate.toISOString().split('T')[0];

        let query = supabase
          .from('public_ticket_stats')
          .select('municipality_id, municipality_name, status, report_date')
          .gte('report_date', cutoffString);

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

        setData(result);
        setError(null);
      } catch (err) {
        console.error('Error fetching resolution rates:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchResolutionRates();
  }, [municipalityId, months]);

  return { data, isLoading, error };
}

export function useHeatmapData(municipalityId?: string) {
  const [data, setData] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHeatmap() {
      try {
        setIsLoading(true);

        let query = supabase
          .from('public_heatmap')
          .select('lat, lng, intensity');

        if (municipalityId) {
          query = query.eq('municipality_id', municipalityId);
        }

        const { data: rows, error: queryError } = await query;

        if (queryError) throw queryError;

        setData((rows as PublicHeatmapRow[]) || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching heatmap data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchHeatmap();
  }, [municipalityId]);

  return { data, isLoading, error };
}

export function useSystemSummary() {
  const [summary, setSummary] = useState<SystemSummary>({
    total_municipalities: 0,
    total_tickets: 0,
    total_sensitive_tickets: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        setIsLoading(true);

        // Count municipalities from public_municipalities view
        const { count: muniCount, error: muniError } = await supabase
          .from('public_municipalities')
          .select('*', { count: 'exact', head: true });

        if (muniError) throw muniError;

        // Count tickets from public_ticket_stats (non-GBV only)
        const { count: ticketCount, error: ticketError } = await supabase
          .from('public_ticket_stats')
          .select('*', { count: 'exact', head: true });

        if (ticketError) throw ticketError;

        // Sensitive ticket count: This is system-wide (not per-municipality per TRNS-05)
        // We can't query tickets table directly (anon role has no access), so we'll return 0
        // In production, this would be provided by a separate aggregated view if needed
        const sensitiveCount = 0;

        setSummary({
          total_municipalities: muniCount || 0,
          total_tickets: ticketCount || 0,
          total_sensitive_tickets: sensitiveCount,
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching system summary:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSummary();
  }, []);

  return { summary, isLoading, error };
}
