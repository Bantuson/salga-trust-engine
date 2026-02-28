/**
 * API service for SALGA Trust Engine backend communication.
 *
 * Uses Supabase Auth JWT for all authenticated requests to FastAPI.
 */

import axios, { AxiosError } from 'axios';
import { supabase } from '../lib/supabase';
import type { TicketFilters, PaginatedTicketResponse, DashboardMetrics, CategoryVolume, SLACompliance, TeamWorkload, TicketDetailResponse, HistoryEntry } from '../types/dashboard';
import type { Team, TeamCreate, TeamMember, TeamInvitation, InvitationCreate, BulkInvitationCreate, TeamSchedule, TeamReview, TicketRoleAssignment } from '../types/teams';
import type { AnalyticsData } from '../types/analytics';
import type { SLAConfig, MunicipalityProfile, PaginatedAuditLogs } from '../types/settings';

// API base URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add Supabase JWT to all requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ---------------------------------------------------------------------------
// 401 Response Interceptor — token refresh with request retry
// ---------------------------------------------------------------------------
// Track whether a refresh is already in progress to prevent concurrent refreshes
let isRefreshing = false;
// Queue of failed requests waiting for the new token
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

/**
 * Flush the failed queue: resolve each with the new token or reject all on error.
 */
const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // Handle 401 (Unauthorized) — attempt token refresh once
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another refresh is in flight — queue this request and wait
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !session) {
          // Session truly expired — flush queue with error and redirect to login
          processQueue(refreshError ?? new Error('Session expired'), null);
          window.location.href = '/login';
          return Promise.reject(refreshError ?? new Error('Session expired'));
        }

        const newToken = session.access_token;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Request upload info for Supabase Storage.
 */
export async function requestPresignedUrl(
  filename: string,
  contentType: string,
  fileSize: number,
  purpose: 'evidence' | 'proof_of_residence'
): Promise<{ bucket: string; path: string; file_id: string }> {
  try {
    const response = await api.post('/uploads/presigned', {
      filename,
      content_type: contentType,
      file_size: fileSize,
      purpose,
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to request upload URL');
    }
    throw error;
  }
}

/**
 * Confirm upload completion and create MediaAttachment record.
 */
export async function confirmUpload(
  fileId: string,
  purpose: 'evidence' | 'proof_of_residence'
): Promise<{ id: string; file_id: string; filename: string }> {
  try {
    const response = await api.post('/uploads/confirm', null, {
      params: { file_id: fileId, purpose },
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to confirm upload');
    }
    throw error;
  }
}

/**
 * Submit report via web portal.
 */
export async function submitReport(data: {
  description: string;
  category?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    source: string;
  };
  manual_address?: string;
  media_file_ids: string[];
  language: string;
  is_gbv: boolean;
}): Promise<{
  ticket_id: string;
  tracking_number: string;
  category: string;
  status: string;
  message: string;
  media_count: number;
}> {
  try {
    const response = await api.post('/reports/submit', data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to submit report');
    }
    throw error;
  }
}

/**
 * Get user's reports (paginated).
 */
export async function getMyReports(
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  try {
    const response = await api.get('/reports/my', {
      params: { limit, offset },
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch reports');
    }
    throw error;
  }
}

/**
 * Get report details by tracking number.
 */
export async function getReportByTracking(
  trackingNumber: string
): Promise<any> {
  try {
    const response = await api.get(`/reports/${trackingNumber}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Report not found');
    }
    throw error;
  }
}

/**
 * Fetch paginated tickets with filters (for dashboard).
 */
export async function fetchTickets(filters: TicketFilters): Promise<PaginatedTicketResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.ward_id) params.set('ward_id', filters.ward_id);
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.sort_order) params.set('sort_order', filters.sort_order);
  params.set('page', String(filters.page ?? 0));
  params.set('page_size', String(filters.page_size ?? 50));

  const response = await api.get(`/tickets?${params}`);
  return response.data;
}

/**
 * Fetch dashboard metrics.
 */
export async function fetchDashboardMetrics(wardId?: string): Promise<DashboardMetrics> {
  const params = wardId ? `?ward_id=${wardId}` : '';
  const response = await api.get(`/dashboard/metrics${params}`);
  return response.data;
}

/**
 * Fetch ticket volume by category.
 */
export async function fetchVolumeByCategory(wardId?: string): Promise<CategoryVolume[]> {
  const params = wardId ? `?ward_id=${wardId}` : '';
  const response = await api.get(`/dashboard/volume${params}`);
  return response.data;
}

/**
 * Fetch SLA compliance data.
 */
export async function fetchSLACompliance(wardId?: string): Promise<SLACompliance> {
  const params = wardId ? `?ward_id=${wardId}` : '';
  const response = await api.get(`/dashboard/sla${params}`);
  return response.data;
}

/**
 * Fetch team workload data.
 */
export async function fetchTeamWorkload(wardId?: string): Promise<TeamWorkload[]> {
  const params = wardId ? `?ward_id=${wardId}` : '';
  const response = await api.get(`/dashboard/workload${params}`);
  return response.data;
}

/**
 * Export tickets to CSV (returns blob for download).
 */
export async function exportTicketsCSV(filters: TicketFilters): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.ward_id) params.set('ward_id', filters.ward_id);

  const response = await api.get(`/export/tickets/csv?${params}`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Export tickets to Excel (returns blob for download).
 */
export async function exportTicketsExcel(filters: TicketFilters): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.ward_id) params.set('ward_id', filters.ward_id);

  const response = await api.get(`/export/tickets/excel?${params}`, {
    responseType: 'blob',
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Teams API
// ---------------------------------------------------------------------------

/**
 * Fetch all teams for the current municipality.
 */
export async function fetchTeams(): Promise<Team[]> {
  try {
    const response = await api.get('/teams');
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch teams');
    }
    throw error;
  }
}

/**
 * Create a new team.
 */
export async function createTeam(data: TeamCreate): Promise<Team> {
  try {
    const response = await api.post('/teams', data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to create team');
    }
    throw error;
  }
}

/**
 * Fetch a single team by ID.
 */
export async function fetchTeamDetail(teamId: string): Promise<Team> {
  try {
    const response = await api.get(`/teams/${teamId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch team');
    }
    throw error;
  }
}

/**
 * Update a team (partial update).
 */
export async function updateTeam(teamId: string, data: Partial<TeamCreate>): Promise<Team> {
  try {
    const response = await api.patch(`/teams/${teamId}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to update team');
    }
    throw error;
  }
}

/**
 * Fetch all members of a team.
 */
export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const response = await api.get(`/teams/${teamId}/members`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch team members');
    }
    throw error;
  }
}

/**
 * Remove a member from a team (by invitation ID).
 */
export async function removeTeamMember(teamId: string, invitationId: string): Promise<void> {
  try {
    await api.delete(`/teams/${teamId}/members/${invitationId}`);
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to remove team member');
    }
    throw error;
  }
}

/**
 * Fetch all pending/active invitations for a team.
 */
export async function fetchTeamInvitations(teamId: string): Promise<TeamInvitation[]> {
  try {
    const response = await api.get(`/teams/${teamId}/invitations`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch team invitations');
    }
    throw error;
  }
}

/**
 * Create a single invitation (for a team or municipality-wide).
 */
export async function createInvitation(data: InvitationCreate): Promise<TeamInvitation> {
  try {
    const response = await api.post('/invitations/', data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to create invitation');
    }
    throw error;
  }
}

/**
 * Create multiple invitations in bulk (for onboarding wizard).
 */
export async function createBulkInvitations(data: BulkInvitationCreate): Promise<TeamInvitation[]> {
  try {
    const response = await api.post('/invitations/bulk', data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to create bulk invitations');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Settings / SLA API
// ---------------------------------------------------------------------------

/**
 * Fetch all SLA configurations for the current municipality.
 */
export async function fetchSLAConfigs(): Promise<SLAConfig[]> {
  try {
    const response = await api.get('/settings/sla');
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch SLA configs');
    }
    throw error;
  }
}

/**
 * Update SLA configuration for a specific category.
 */
export async function updateSLAConfig(
  category: string,
  data: { response_hours: number; resolution_hours: number; warning_threshold_pct: number }
): Promise<SLAConfig> {
  try {
    const response = await api.put(`/settings/sla/${category}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to update SLA config');
    }
    throw error;
  }
}

/**
 * Fetch current municipality profile.
 */
export async function fetchMunicipalityProfile(): Promise<MunicipalityProfile> {
  try {
    const response = await api.get('/settings/municipality');
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch municipality profile');
    }
    throw error;
  }
}

/**
 * Update municipality profile (partial update).
 */
export async function updateMunicipalityProfile(
  data: Partial<MunicipalityProfile>
): Promise<MunicipalityProfile> {
  try {
    const response = await api.put('/settings/municipality', data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to update municipality profile');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Audit Logs API
// ---------------------------------------------------------------------------

/**
 * Fetch paginated audit logs with optional filters.
 */
export async function fetchAuditLogs(params: {
  page?: number;
  page_size?: number;
  table_name?: string;
  operation?: string;
}): Promise<PaginatedAuditLogs> {
  try {
    const response = await api.get('/audit-logs', { params });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch audit logs');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Ticket Actions API
// ---------------------------------------------------------------------------

/**
 * Fetch ticket detail with SLA status and assignment history.
 */
export async function fetchTicketDetail(id: string): Promise<TicketDetailResponse> {
  try {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch ticket detail');
    }
    throw error;
  }
}

/**
 * Assign ticket to team/user.
 */
export async function assignTicket(
  id: string,
  data: { team_id?: string; assigned_to?: string; reason?: string }
): Promise<TicketDetailResponse> {
  try {
    const response = await api.post(`/tickets/${id}/assign`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to assign ticket');
    }
    throw error;
  }
}

/**
 * Update ticket status.
 */
export async function updateTicketStatus(id: string, newStatus: string): Promise<TicketDetailResponse> {
  try {
    const response = await api.patch(`/tickets/${id}/status`, { status: newStatus });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to update ticket status');
    }
    throw error;
  }
}

/**
 * Escalate a ticket with a reason.
 */
export async function escalateTicket(id: string, reason: string): Promise<TicketDetailResponse> {
  try {
    const response = await api.post(`/tickets/${id}/escalate`, { reason });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to escalate ticket');
    }
    throw error;
  }
}

/**
 * Add a note to a ticket.
 */
export async function addTicketNote(id: string, content: string): Promise<void> {
  try {
    await api.post(`/tickets/${id}/notes`, { content });
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to add note');
    }
    throw error;
  }
}

/**
 * Fetch ticket history (assignments + audit logs).
 */
export async function fetchTicketHistory(id: string): Promise<HistoryEntry[]> {
  try {
    const response = await api.get(`/tickets/${id}/history`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch ticket history');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Analytics API (extended)
// ---------------------------------------------------------------------------

/**
 * Fetch combined analytics data for a date range.
 *
 * Calls all 4 dashboard endpoints in parallel and merges results
 * into a single AnalyticsData object for the Analytics page.
 */
export async function fetchAnalyticsData(
  startDate: string,
  endDate: string,
  wardId?: string
): Promise<AnalyticsData> {
  const baseParams = new URLSearchParams();
  baseParams.set('start_date', startDate);
  baseParams.set('end_date', endDate);
  if (wardId) baseParams.set('ward_id', wardId);

  const qs = `?${baseParams}`;

  try {
    const [metricsRes, volumeRes, slaRes, workloadRes] = await Promise.all([
      api.get(`/dashboard/metrics${qs}`),
      api.get(`/dashboard/volume${qs}`),
      api.get(`/dashboard/sla${qs}`),
      api.get(`/dashboard/workload${qs}`),
    ]);

    return {
      metrics: metricsRes.data as AnalyticsData['metrics'],
      volume: volumeRes.data as AnalyticsData['volume'],
      sla: slaRes.data as AnalyticsData['sla'],
      workload: workloadRes.data as AnalyticsData['workload'],
    };
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch analytics data');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Supervisor / Team Management API
// ---------------------------------------------------------------------------

/**
 * Fetch team schedules.
 */
export async function fetchTeamSchedules(teamId: string): Promise<TeamSchedule[]> {
  try {
    const response = await api.get(`/teams/${teamId}/schedules`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch schedules');
    }
    throw error;
  }
}

/**
 * Create a team schedule entry.
 */
export async function createTeamSchedule(
  teamId: string,
  data: Omit<TeamSchedule, 'id'>
): Promise<TeamSchedule> {
  try {
    const response = await api.post(`/teams/${teamId}/schedules`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to create schedule');
    }
    throw error;
  }
}

/**
 * Update a team schedule entry.
 */
export async function updateTeamSchedule(
  teamId: string,
  scheduleId: string,
  data: Partial<TeamSchedule>
): Promise<TeamSchedule> {
  try {
    const response = await api.patch(`/teams/${teamId}/schedules/${scheduleId}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to update schedule');
    }
    throw error;
  }
}

/**
 * Fetch team reviews.
 */
export async function fetchTeamReviews(teamId: string): Promise<TeamReview[]> {
  try {
    const response = await api.get(`/teams/${teamId}/reviews`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch reviews');
    }
    throw error;
  }
}

/**
 * Create a team review.
 */
export async function createTeamReview(
  teamId: string,
  data: Omit<TeamReview, 'id'>
): Promise<TeamReview> {
  try {
    const response = await api.post(`/teams/${teamId}/reviews`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to create review');
    }
    throw error;
  }
}

/**
 * Fetch ticket role assignments for a team.
 */
export async function fetchTicketRoleAssignments(teamId: string): Promise<TicketRoleAssignment[]> {
  try {
    const response = await api.get(`/teams/${teamId}/assignments`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch assignments');
    }
    throw error;
  }
}

/**
 * Assign a role to a team member for a ticket.
 */
export async function assignTicketRole(
  teamId: string,
  data: Omit<TicketRoleAssignment, 'id' | 'assigned_at'>
): Promise<TicketRoleAssignment> {
  try {
    const response = await api.post(`/teams/${teamId}/assignments`, data);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to assign role');
    }
    throw error;
  }
}
