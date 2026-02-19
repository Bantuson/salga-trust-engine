/**
 * TypeScript type definitions for Settings management.
 *
 * Matches backend API schemas from:
 * - src/api/v1/settings.py
 * - src/models/sla_config.py
 * - src/models/municipality.py
 */

export interface SLAConfig {
  category: string | null;
  response_hours: number;
  resolution_hours: number;
  warning_threshold_pct: number;
  is_active: boolean;
}

export interface MunicipalityProfile {
  id: string;
  name: string;
  code: string;
  province: string;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
}

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  user_id: string | null;
  operation: string;
  table_name: string;
  record_id: string;
  changes: string | null;
  timestamp: string;
}

export interface PaginatedAuditLogs {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
}
