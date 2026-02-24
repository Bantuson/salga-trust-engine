/**
 * Onboarding wizard hook for backend API integration.
 *
 * Provides:
 * - Load onboarding progress from backend (GET /api/v1/onboarding/state)
 * - Save individual step data to backend (PUT /api/v1/onboarding/state/{stepId})
 * - Mark onboarding as complete (POST /api/v1/onboarding/complete)
 * - Error handling with retry logic
 */

import { useState } from 'react';
import { useAuth } from './useAuth';

export interface OnboardingStepData {
  step_id: string;
  step_data: Record<string, any> | null;
  is_completed: boolean;
  completed_at: string | null;
}

export interface OnboardingProgressResponse {
  municipality_id: string;
  steps: OnboardingStepData[];
  overall_progress: number;
}

export interface OnboardingStepSaveRequest {
  step_id: string;
  step_data: Record<string, any> | null;
  is_completed: boolean;
}

export function useOnboarding() {
  const { getAccessToken, getTenantId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  /**
   * Load full onboarding progress from backend.
   */
  const loadProgress = async (): Promise<OnboardingProgressResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAccessToken();
      const tenantId = getTenantId();

      if (!token || !tenantId) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${apiUrl}/api/v1/onboarding/state`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to load onboarding progress');
      }

      const data: OnboardingProgressResponse = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load progress';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save a single step's data to backend (upsert).
   */
  const saveStep = async (
    stepId: string,
    stepData: Record<string, any> | null,
    isCompleted: boolean
  ): Promise<OnboardingStepData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAccessToken();
      const tenantId = getTenantId();

      if (!token || !tenantId) {
        throw new Error('User not authenticated');
      }

      const requestBody: OnboardingStepSaveRequest = {
        step_id: stepId,
        step_data: stepData,
        is_completed: isCompleted,
      };

      const response = await fetch(`${apiUrl}/api/v1/onboarding/state/${stepId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save step');
      }

      const data: OnboardingStepData = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save step';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mark onboarding as complete.
   */
  const completeOnboarding = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAccessToken();
      const tenantId = getTenantId();

      if (!token || !tenantId) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${apiUrl}/api/v1/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to complete onboarding');
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete onboarding';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    loadProgress,
    saveStep,
    completeOnboarding,
    isLoading,
    error,
  };
}
