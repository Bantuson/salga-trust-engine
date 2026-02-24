/**
 * Role and permission constants for SALGA Trust Engine.
 *
 * Defines the 6 system roles and permission matrix used by:
 * - Settings > Team Management permission grid
 * - Route guards in DashboardLayout
 * - Sidebar navigation filtering
 */

/**
 * All 6 system roles (matches backend UserRole enum).
 */
export const ROLES = [
  'admin',
  'manager',
  'field_worker',
  'ward_councillor',
  'saps_liaison',
  'citizen',
] as const;

export type SystemRole = typeof ROLES[number];

/**
 * Human-readable display labels for each role.
 */
export const ROLE_LABELS: Record<SystemRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  field_worker: 'Field Worker',
  ward_councillor: 'Ward Councillor',
  saps_liaison: 'SAPS Liaison',
  citizen: 'Citizen',
};

/**
 * Capability keys and their display labels.
 */
export interface Capability {
  key: string;
  label: string;
}

export const CAPABILITIES: Capability[] = [
  { key: 'view_tickets', label: 'View Tickets' },
  { key: 'assign_tickets', label: 'Assign Tickets' },
  { key: 'export_data', label: 'Export Data' },
  { key: 'manage_teams', label: 'Manage Teams' },
  { key: 'invite_members', label: 'Invite Members' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'manage_settings', label: 'Manage Settings' },
  { key: 'view_gbv_cases', label: 'View GBV Cases' },
];

/**
 * Permission matrix: which capabilities each role has.
 *
 * Security note: This is UI-only. Backend enforces actual permissions
 * via RLS policies and FastAPI dependency guards.
 */
export const PERMISSION_MATRIX: Record<SystemRole, string[]> = {
  admin: [
    'view_tickets',
    'assign_tickets',
    'export_data',
    'manage_teams',
    'invite_members',
    'view_analytics',
    'manage_settings',
    'view_gbv_cases',
  ],
  manager: [
    'view_tickets',
    'assign_tickets',
    'export_data',
    'manage_teams',
    'invite_members',
    'view_analytics',
  ],
  field_worker: [
    'view_tickets',
    'update_ticket_status',
    'add_feedback',
    'escalate_ticket',
  ],
  ward_councillor: [
    'view_tickets',
    'view_analytics',
  ],
  saps_liaison: [
    'view_tickets',
    'view_gbv_cases',
  ],
  citizen: [
    'view_tickets',
  ],
};

/**
 * Check if a role has a specific capability.
 */
export function hasCapability(role: SystemRole, capability: string): boolean {
  return PERMISSION_MATRIX[role]?.includes(capability) ?? false;
}
