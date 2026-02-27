/**
 * Mock analytics data for municipal dashboard fallback rendering.
 * Shows a positive improvement arc over 30 days — resolution going up,
 * response time going down, SLA compliance climbing.
 */

import type { AnalyticsData, KPIMetric } from '../types/analytics';
import type { DashboardMetrics, CategoryVolume, SLACompliance, TeamWorkload } from '../types/dashboard';

// ─── Dashboard Metrics (KPI cards on home page) ────────────────────────────
export const mockDashboardMetrics: DashboardMetrics = {
  total_open: 18,
  total_resolved: 62,
  sla_compliance_percent: 87,
  avg_response_hours: 14.2,
  sla_breaches: 4,
};

// ─── Volume by Category ────────────────────────────────────────────────────
export const mockVolumeData: CategoryVolume[] = [
  { category: 'water',       open: 6,  resolved: 14 },
  { category: 'electricity', open: 4,  resolved: 12 },
  { category: 'roads',       open: 5,  resolved: 18 },
  { category: 'waste',       open: 2,  resolved: 10 },
  { category: 'sanitation',  open: 1,  resolved: 5  },
  { category: 'other',       open: 0,  resolved: 3  },
];

// ─── SLA Compliance ────────────────────────────────────────────────────────
export const mockSLAData: SLACompliance = {
  response_compliance_percent: 91,
  resolution_compliance_percent: 83,
  total_with_sla: 76,
  response_breaches: 2,
  resolution_breaches: 5,
};

// ─── Team Workload ─────────────────────────────────────────────────────────
export const mockWorkloadData: TeamWorkload[] = [
  { team_id: 'team-001-water',       team_name: 'Water & Sanitation',    open_count: 5,  total_count: 19 },
  { team_id: 'team-002-electricity', team_name: 'Electricity Services',  open_count: 4,  total_count: 16 },
  { team_id: 'team-003-roads',       team_name: 'Roads & Infrastructure', open_count: 6,  total_count: 24 },
  { team_id: 'team-004-waste',       team_name: 'Waste Management',      open_count: 3,  total_count: 13 },
  { team_id: 'team-005-general',     team_name: 'General Services',      open_count: 2,  total_count: 6  },
];

// ─── Composed AnalyticsData (used by useAnalytics hook) ───────────────────
export const mockAnalyticsData: AnalyticsData = {
  metrics: {
    total_open: mockDashboardMetrics.total_open,
    total_resolved: mockDashboardMetrics.total_resolved,
    sla_compliance_percent: mockDashboardMetrics.sla_compliance_percent,
    avg_response_hours: mockDashboardMetrics.avg_response_hours,
    sla_breaches: mockDashboardMetrics.sla_breaches,
  },
  volume: mockVolumeData,
  sla: mockSLAData,
  workload: mockWorkloadData,
};

// ─── KPI Sparkline Metrics (improvement arc over 7 days) ──────────────────
// Trends: resolution going UP, response time going DOWN, SLA compliance climbing
export const mockKPIMetrics: KPIMetric[] = [
  {
    label: 'Open Tickets',
    value: 18,
    unit: '',
    // slight decline = fewer open = good
    trend: [26, 24, 22, 21, 20, 19, 18],
    trendDirection: 'down',
    color: 'var(--color-teal)',
  },
  {
    label: 'Resolved (30d)',
    value: 62,
    unit: '',
    // increasing resolved count = good
    trend: [38, 43, 47, 51, 55, 58, 62],
    trendDirection: 'up',
    color: '#60a5fa',
  },
  {
    label: 'SLA Compliance',
    value: 87,
    unit: '%',
    // climbing SLA compliance = good
    trend: [74, 76, 79, 81, 83, 85, 87],
    trendDirection: 'up',
    color: '#34d399',
  },
  {
    label: 'Avg Response',
    value: 14.2,
    unit: 'hrs',
    // decreasing response time = good
    trend: [21.4, 19.8, 18.6, 17.1, 16.0, 15.3, 14.2],
    trendDirection: 'down',
    color: 'var(--color-accent-gold)',
  },
];
