/**
 * API service for SALGA Trust Engine backend communication.
 *
 * Provides functions for:
 * - Presigned upload URL generation
 * - Direct S3 uploads
 * - Upload confirmation
 * - Report submission
 * - Report tracking
 */

import axios, { AxiosError } from 'axios';

// API base URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

/**
 * Get authentication headers with Bearer token.
 * Token is stored in localStorage after login.
 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('Not authenticated. Please log in.');
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Request presigned URL for file upload.
 */
export async function requestPresignedUrl(
  filename: string,
  contentType: string,
  fileSize: number,
  purpose: 'evidence' | 'proof_of_residence'
): Promise<{ url: string; fields: Record<string, string>; file_id: string }> {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/uploads/presigned`,
      {
        filename,
        content_type: contentType,
        file_size: fileSize,
        purpose,
      },
      {
        headers: getAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Failed to request presigned URL');
    }
    throw error;
  }
}

/**
 * Upload file to S3 using presigned POST.
 */
export async function uploadToS3(
  presignedUrl: string,
  fields: Record<string, string>,
  file: File
): Promise<void> {
  try {
    const formData = new FormData();

    // Add all presigned fields first
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // Add file last
    formData.append('file', file);

    // Upload to S3 (no auth headers needed - presigned URL handles auth)
    await axios.post(presignedUrl, formData, {
      headers: {
        // Let browser set Content-Type with boundary for multipart/form-data
      },
    });
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error('Failed to upload file to S3');
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
    const response = await axios.post(
      `${API_BASE_URL}/uploads/confirm`,
      null,
      {
        params: { file_id: fileId, purpose },
        headers: getAuthHeaders(),
      }
    );

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
    const response = await axios.post(
      `${API_BASE_URL}/reports/submit`,
      data,
      {
        headers: getAuthHeaders(),
      }
    );

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
    const response = await axios.get(
      `${API_BASE_URL}/reports/my`,
      {
        params: { limit, offset },
        headers: getAuthHeaders(),
      }
    );

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
    const response = await axios.get(
      `${API_BASE_URL}/reports/${trackingNumber}`,
      {
        headers: getAuthHeaders(),
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.detail || 'Report not found');
    }
    throw error;
  }
}
