import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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

const DEMO_TICKETS: CitizenTicket[] = [
  {
    tracking_number: 'TKT-20260211-DEMO01',
    category: 'potholes',
    status: 'in_progress',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    address: '123 Main St, Demo City',
    severity: 'medium',
    assigned_to_name: 'John Demo',
    assigned_team_name: 'Road Maintenance Team',
    media_count: 2,
    is_sensitive: false,
  },
  {
    tracking_number: 'TKT-20260209-DEMO02',
    status: 'open',
    is_sensitive: true,
    assigned_officer_name: 'Officer Demo',
    station_name: 'Demo SAPS Station',
    station_phone: '012-345-6789',
  },
  {
    tracking_number: 'TKT-20260205-DEMO03',
    category: 'water',
    status: 'resolved',
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    address: '456 Oak Ave, Demo City',
    severity: 'high',
    assigned_to_name: 'Jane Demo',
    assigned_team_name: 'Water Services Team',
    media_count: 1,
    is_sensitive: false,
  },
];

const DEMO_STATS: CitizenStats = {
  total_reports: 3,
  resolved_count: 1,
  avg_resolution_days: 2.3,
  municipality_avg_resolution_days: 3.1,
};

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
