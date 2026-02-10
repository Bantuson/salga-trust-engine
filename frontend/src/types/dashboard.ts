/**
 * Dashboard TypeScript type definitions.
 *
 * Matches backend API response schemas from:
 * - src/api/v1/dashboard.py
 * - src/services/dashboard_service.py
 */

/**
 * Individual ticket data.
 */
export interface Ticket {
  id: string;
  tracking_number: string;
  category: string;
  description: string;
  status: string;
  severity: string;
  language: string;
  address: string | null;
  user_id: string;
  is_sensitive: boolean;
  created_at: string;
  assigned_team_id: string | null;
  assigned_to: string | null;
  escalated_at: string | null;
  first_responded_at: string | null;
  sla_response_deadline: string | null;
  sla_resolution_deadline: string | null;
}

/**
 * Paginated ticket list response.
 */
export interface PaginatedTicketResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  page_size: number;
  page_count: number;
}

/**
 * Ticket filter parameters.
 */
export interface TicketFilters {
  status?: string;
  category?: string;
  search?: string;
  ward_id?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

/**
 * Overall dashboard metrics.
 */
export interface DashboardMetrics {
  total_open: number;
  total_resolved: number;
  sla_compliance_percent: number;
  avg_response_hours: number;
  sla_breaches: number;
}

/**
 * Ticket volume per category.
 */
export interface CategoryVolume {
  category: string;
  open: number;
  resolved: number;
}

/**
 * SLA compliance breakdown.
 */
export interface SLACompliance {
  response_compliance_percent: number;
  resolution_compliance_percent: number;
  total_with_sla: number;
  response_breaches: number;
  resolution_breaches: number;
}

/**
 * Team workload data.
 */
export interface TeamWorkload {
  team_id: string;
  team_name: string;
  open_count: number;
  total_count: number;
}

/**
 * Real-time dashboard event.
 */
export interface DashboardEvent {
  type: string;
  data: Record<string, unknown>;
  ward_id?: string;
}
