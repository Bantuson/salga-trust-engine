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

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
}

export interface SystemSummary {
  total_municipalities: number;
  total_tickets: number;
  total_sensitive_tickets: number;
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

export interface PublicHeatmapRow {
  lat: number;
  lng: number;
  intensity: number;
  municipality_id: string;
}
