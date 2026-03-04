export interface Municipality {
  id: string;
  name: string;
  code: string;
  province: string;
}

export interface ResponseTimeData {
  municipality_id: string;
  municipality_name: string;
  avg_response_hours: number;
  ticket_count: number;
}

export interface MonthlyTrend {
  month: string;  // "2026-01"
  rate: number;
}

export interface ResolutionRateData {
  municipality_id: string;
  municipality_name: string;
  resolution_rate: number;
  total_tickets: number;
  resolved_tickets: number;
  trend: MonthlyTrend[];
}

export interface CategoryBreakdownData {
  category: string;
  count: number;
}

export interface SdbipAchievementData {
  municipality_id: string;
  municipality_name: string;
  financial_year: string;
  total_kpis: number;
  green: number;
  amber: number;
  red: number;
  overall_achievement_pct: number;
}

export interface LeaderboardEntry {
  municipality_id: string;
  municipality_name: string;
  resolution_rate: number;
  avg_response_hours: number;
  sdbip_achievement_pct: number;
  total_tickets: number;
  current_rank: number;
  previous_rank: number | null;
  rank_delta: number | null;  // positive = improved (moved up), negative = dropped
}

/**
 * Supabase database types for public views
 */

export interface PublicTicketStatsRow {
  municipality_id: string;
  municipality_name: string;
  category: string;
  status: string;
  report_date: string;
  response_hours: number | null;
  resolution_hours: number | null;
}

export interface PublicMunicipalityRow {
  id: string;
  name: string;
  code: string;
  province: string;
}
