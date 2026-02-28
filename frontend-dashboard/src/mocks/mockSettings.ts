/**
 * Mock settings data for municipal dashboard fallback rendering.
 * Includes SLA configs for all service categories and Emthanjeni municipality profile.
 */

import type { SLAConfig, MunicipalityProfile } from '../types/settings';

// ─── SLA Configurations ───────────────────────────────────────────────────
// One config per category + a default fallback config
export const mockSLAConfigs: SLAConfig[] = [
  {
    category: 'water',
    response_hours: 4,
    resolution_hours: 48,
    warning_threshold_pct: 80,
    is_active: true,
  },
  {
    category: 'electricity',
    response_hours: 2,
    resolution_hours: 24,
    warning_threshold_pct: 80,
    is_active: true,
  },
  {
    category: 'roads',
    response_hours: 8,
    resolution_hours: 72,
    warning_threshold_pct: 80,
    is_active: true,
  },
  {
    category: 'waste',
    response_hours: 4,
    resolution_hours: 48,
    warning_threshold_pct: 80,
    is_active: true,
  },
  {
    category: 'sanitation',
    response_hours: 4,
    resolution_hours: 48,
    warning_threshold_pct: 80,
    is_active: true,
  },
  {
    category: 'other',
    response_hours: 8,
    resolution_hours: 72,
    warning_threshold_pct: 80,
    is_active: true,
  },
  {
    // Default SLA config (null category = applies to everything without a specific config)
    category: null,
    response_hours: 4,
    resolution_hours: 48,
    warning_threshold_pct: 80,
    is_active: true,
  },
];

// ─── Municipality Profile ──────────────────────────────────────────────────
export const mockMunicipalityProfile: MunicipalityProfile = {
  id: 'muni-emt-001',
  name: 'Emthanjeni Local Municipality',
  code: 'EMT',
  province: 'Northern Cape',
  contact_email: 'info@emthanjeni.gov.za',
  contact_phone: '051-753-0777',
  logo_url: null,
};
