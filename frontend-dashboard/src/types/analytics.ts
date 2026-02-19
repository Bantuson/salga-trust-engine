/**
 * TypeScript type definitions for Analytics data.
 *
 * Matches backend API schemas from:
 * - src/api/v1/dashboard.py
 * - src/services/dashboard_service.py
 */

export type TimeRange = '7d' | '30d' | '90d' | '6mo' | '1yr' | 'custom';

export interface AnalyticsData {
  metrics: {
    total_open: number;
    total_resolved: number;
    sla_compliance_percent: number;
    avg_response_hours: number;
    sla_breaches: number;
  };
  volume: Array<{ category: string; open: number; resolved: number }>;
  sla: {
    response_compliance_percent: number;
    resolution_compliance_percent: number;
    total_with_sla: number;
    response_breaches: number;
    resolution_breaches: number;
  };
  workload: Array<{
    team_id: string;
    team_name: string;
    open_count: number;
    total_count: number;
  }>;
}

export interface KPIMetric {
  label: string;
  value: number;
  unit?: string;
  trend?: number[];
  trendDirection?: 'up' | 'down' | 'neutral';
  color: string;
}
