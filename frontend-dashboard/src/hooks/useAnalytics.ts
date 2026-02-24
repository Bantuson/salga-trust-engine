/**
 * useAnalytics — data fetching hook for the Analytics page.
 *
 * Manages:
 * - Time range state (preset: 7d/30d/90d/6mo/1yr or custom date range)
 * - Data fetching via fetchAnalyticsData from api.ts
 * - Ward councillor filtering via optional wardId param
 * - Re-fetch on time range or ward ID change
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchAnalyticsData } from '../services/api';
import type { TimeRange, AnalyticsData } from '../types/analytics';

interface UseAnalyticsOptions {
  wardId?: string;
}

interface UseAnalyticsReturn {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  customStart: string;
  setCustomStart: (date: string) => void;
  customEnd: string;
  setCustomEnd: (date: string) => void;
  refreshData: () => void;
}

/**
 * Convert a TimeRange preset to ISO date strings {start, end}.
 */
function getDateRange(
  timeRange: TimeRange,
  customStart: string,
  customEnd: string
): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10); // YYYY-MM-DD

  if (timeRange === 'custom') {
    return { start: customStart || end, end: customEnd || end };
  }

  const daysBack: Record<Exclude<TimeRange, 'custom'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '6mo': 180,
    '1yr': 365,
  };

  const days = daysBack[timeRange] ?? 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().slice(0, 10);

  return { start, end };
}

export function useAnalytics({ wardId }: UseAnalyticsOptions = {}): UseAnalyticsReturn {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { start, end } = getDateRange(timeRange, customStart, customEnd);
      const result = await fetchAnalyticsData(start, end, wardId);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics data';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, customStart, customEnd, wardId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    timeRange,
    setTimeRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    refreshData: fetchData,
  };
}
