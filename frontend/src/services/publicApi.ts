import type {
  Municipality,
  ResponseTimeData,
  ResolutionRateData,
  HeatmapPoint,
  SystemSummary,
} from '../types/public';

const BASE_URL = '/api/v1/public';

/**
 * Public API client for transparency dashboard.
 * CRITICAL: NO Authorization header - these are unauthenticated requests (TRNS-04).
 */

export async function getMunicipalities(): Promise<Municipality[]> {
  try {
    const response = await fetch(`${BASE_URL}/municipalities`);
    if (!response.ok) {
      console.error('Failed to fetch municipalities:', response.statusText);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching municipalities:', error);
    return [];
  }
}

export async function getResponseTimes(
  municipalityId?: string
): Promise<ResponseTimeData[]> {
  try {
    const url = municipalityId
      ? `${BASE_URL}/response-times?municipality_id=${municipalityId}`
      : `${BASE_URL}/response-times`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch response times:', response.statusText);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching response times:', error);
    return [];
  }
}

export async function getResolutionRates(
  municipalityId?: string,
  months?: number
): Promise<ResolutionRateData[]> {
  try {
    const params = new URLSearchParams();
    if (municipalityId) params.set('municipality_id', municipalityId);
    if (months) params.set('months', months.toString());

    const url = `${BASE_URL}/resolution-rates${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch resolution rates:', response.statusText);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching resolution rates:', error);
    return [];
  }
}

export async function getHeatmapData(
  municipalityId?: string
): Promise<HeatmapPoint[]> {
  try {
    const url = municipalityId
      ? `${BASE_URL}/heatmap?municipality_id=${municipalityId}`
      : `${BASE_URL}/heatmap`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch heatmap data:', response.statusText);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    return [];
  }
}

export async function getSystemSummary(): Promise<SystemSummary> {
  try {
    const response = await fetch(`${BASE_URL}/summary`);
    if (!response.ok) {
      console.error('Failed to fetch system summary:', response.statusText);
      return {
        total_municipalities: 0,
        total_tickets: 0,
        total_sensitive_tickets: 0,
      };
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching system summary:', error);
    return {
      total_municipalities: 0,
      total_tickets: 0,
      total_sensitive_tickets: 0,
    };
  }
}
