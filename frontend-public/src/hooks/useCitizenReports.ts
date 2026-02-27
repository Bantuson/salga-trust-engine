import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEMO_TICKETS, DEMO_STATS } from '../data/mockCitizenTickets';

/**
 * Custom hook for fetching citizen's personal reports and stats from backend API.
 *
 * Fetches from:
 * - GET /api/v1/citizen/my-reports — citizen's tickets (GBV privacy applied server-side)
 * - GET /api/v1/citizen/stats — personal analytics
 *
 * IMPORTANT: This hook requires authentication. If no session exists, shows demo mode.
 */

export interface CitizenTicket {
  tracking_number: string;
  category?: string;
  status: string;
  created_at?: string;
  address?: string | null;
  severity?: string;
  assigned_to_name?: string | null;
  assigned_team_name?: string | null;
  media_count?: number;
  is_sensitive: boolean;
  // GBV-specific fields (only present when is_sensitive=true)
  assigned_officer_name?: string | null;
  station_name?: string | null;
  station_phone?: string | null;
}

export interface CitizenStats {
  total_reports: number;
  resolved_count: number;
  avg_resolution_days: number | null;
  municipality_avg_resolution_days: number | null;
}

interface CitizenReportsResponse {
  tickets: CitizenTicket[];
  total: number;
}

export function useCitizenReports(statusFilter?: string) {
  const [reports, setReports] = useState<CitizenTicket[]>([]);
  const [stats, setStats] = useState<CitizenStats | null>(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    async function fetchCitizenData() {
      try {
        setIsLoading(true);
        setError(null);

        // Check for Supabase auth session
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // No auth session - use demo mode for UI testing
          setIsDemoMode(true);
          setReports(DEMO_TICKETS);
          setStats(DEMO_STATS);
          setTotal(DEMO_TICKETS.length);
          setIsLoading(false);
          return;
        }

        setIsDemoMode(false);

        // Get auth token for API calls
        const token = session.access_token;
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        // Fetch reports from backend
        const reportsUrl = new URL('/api/v1/citizen/my-reports', apiUrl);
        if (statusFilter) {
          reportsUrl.searchParams.append('status_filter', statusFilter);
        }

        const reportsResponse = await fetch(reportsUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!reportsResponse.ok) {
          throw new Error(`Failed to fetch reports: ${reportsResponse.statusText}`);
        }

        const reportsData: CitizenReportsResponse = await reportsResponse.json();

        // Fetch stats from backend
        const statsUrl = new URL('/api/v1/citizen/stats', apiUrl);
        const statsResponse = await fetch(statsUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!statsResponse.ok) {
          throw new Error(`Failed to fetch stats: ${statsResponse.statusText}`);
        }

        const statsData: CitizenStats = await statsResponse.json();

        setReports(reportsData.tickets);
        setTotal(reportsData.total);
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        // On error, don't show demo mode - show error state instead
      } finally {
        setIsLoading(false);
      }
    }

    fetchCitizenData();
  }, [statusFilter]);

  const refetch = () => {
    setIsLoading(true);
    setError(null);
    // Trigger re-fetch by resetting state
    const timer = setTimeout(() => {
      // Re-run the effect
      setIsLoading(true);
    }, 0);
    return () => clearTimeout(timer);
  };

  return {
    reports,
    stats,
    total,
    isLoading,
    error,
    isDemoMode,
    refetch,
  };
}
