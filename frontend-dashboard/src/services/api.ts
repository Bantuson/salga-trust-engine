/**
 * API service for SALGA Trust Engine backend communication.
 *
 * Uses Supabase Auth JWT for all authenticated requests to FastAPI.
 */

import axios, { AxiosError } from 'axios';
import { supabase } from '../lib/supabase';
import type { TicketFilters, PaginatedTicketResponse, DashboardMetrics, CategoryVolume, SLACompliance, TeamWorkload } from '../types/dashboard';

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
