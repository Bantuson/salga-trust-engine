/**
 * useSettings — Data fetching and mutation hook for the Settings page.
 *
 * Loads:
 * - slaConfigs from GET /settings/sla
 * - municipalityProfile from GET /settings/municipality
 *
 * Exposes update functions for optimistic UI + save operations.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchSLAConfigs,
  fetchMunicipalityProfile,
  updateSLAConfig,
  updateMunicipalityProfile,
} from '../services/api';
import type { SLAConfig, MunicipalityProfile } from '../types/settings';

export interface UseSettingsReturn {
  slaConfigs: SLAConfig[];
  municipalityProfile: MunicipalityProfile | null;
  isLoading: boolean;
  error: string | null;
  updateSLA: (
    category: string,
    data: { response_hours: number; resolution_hours: number; warning_threshold_pct: number }
  ) => Promise<void>;
  updateProfile: (data: Partial<MunicipalityProfile>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
  const [municipalityProfile, setMunicipalityProfile] = useState<MunicipalityProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch in parallel
      const [slaResult, profileResult] = await Promise.all([
        fetchSLAConfigs(),
        fetchMunicipalityProfile(),
      ]);
      setSlaConfigs(slaResult);
      setMunicipalityProfile(profileResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
      console.error('[useSettings] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /**
   * Update a specific SLA config. Optimistically updates local state,
   * then syncs to backend.
   */
  const updateSLA = useCallback(
    async (
      category: string,
      data: { response_hours: number; resolution_hours: number; warning_threshold_pct: number }
    ) => {
      // Optimistic update
      setSlaConfigs((prev) =>
        prev.map((cfg) =>
          (cfg.category === category || (category === 'default' && cfg.category === null))
            ? { ...cfg, ...data }
            : cfg
        )
      );

      // Backend sync
      const apiCategory = category === 'default' ? 'default' : category;
      await updateSLAConfig(apiCategory, data);
    },
    []
  );

  /**
   * Update municipality profile fields. Syncs to backend.
   */
  const updateProfile = useCallback(async (data: Partial<MunicipalityProfile>) => {
    const updated = await updateMunicipalityProfile(data);
    setMunicipalityProfile(updated);
  }, []);

  return {
    slaConfigs,
    municipalityProfile,
    isLoading,
    error,
    updateSLA,
    updateProfile,
    refreshSettings: loadSettings,
  };
}
