/**
 * RoleSwitcher — navbar role switcher for multi-role users.
 *
 * Displays a "View as:" dropdown in the navbar when the authenticated user
 * holds multiple roles. Switches dashboard view context WITHOUT re-login.
 * The JWT permissions remain governed by the effective role in the token.
 *
 * Single-role users see nothing (component returns null) — cleaner nav.
 *
 * Styling: uses CSS variables from @shared/design-tokens.css (no Tailwind).
 *
 * Usage:
 *   <RoleSwitcher
 *     allRoles={user.allRoles}
 *     activeRole={viewRole}
 *     onRoleSwitch={(role) => setViewRole(role)}
 *   />
 */

import React from 'react';

/** Human-readable labels for all 18 roles in the RBAC hierarchy. */
const ROLE_LABELS: Record<string, string> = {
  executive_mayor: 'Executive Mayor',
  municipal_manager: 'Municipal Manager',
  cfo: 'Chief Financial Officer',
  speaker: 'Speaker',
  admin: 'Administrator',
  salga_admin: 'SALGA Admin',
  section56_director: 'Section 56 Director',
  ward_councillor: 'Ward Councillor',
  chief_whip: 'Chief Whip',
  department_manager: 'Department Manager',
  pms_officer: 'PMS Officer',
  audit_committee_member: 'Audit Committee',
  internal_auditor: 'Internal Auditor',
  mpac_member: 'MPAC Member',
  saps_liaison: 'SAPS Liaison',
  manager: 'Manager',
  field_worker: 'Field Worker',
  citizen: 'Citizen',
  // Legacy alias
  platform_admin: 'Platform Admin',
};

interface RoleSwitcherProps {
  /** All roles held by the current user (from JWT all_roles claim). */
  allRoles: string[];
  /** Currently active view role. */
  activeRole: string;
  /** Called with the newly selected role when user changes the dropdown. */
  onRoleSwitch: (role: string) => void;
}

/**
 * RoleSwitcher renders a compact role dropdown in the navbar.
 *
 * Returns null for single-role users (no dropdown shown — cleaner nav).
 * Does NOT trigger re-authentication; only switches the view context in
 * the frontend. Backend authorization still enforces the JWT effective role.
 */
export function RoleSwitcher({ allRoles, activeRole, onRoleSwitch }: RoleSwitcherProps) {
  // Hidden for single-role users — no visual clutter
  if (allRoles.length <= 1) return null;

  return (
    <div style={styles.container}>
      <span style={styles.label}>View as:</span>
      <select
        value={activeRole}
        onChange={(e) => onRoleSwitch(e.target.value)}
        style={styles.select}
        aria-label="Switch dashboard view role"
      >
        {allRoles.map((role) => (
          <option key={role} value={role} style={styles.option}>
            {ROLE_LABELS[role] ?? role}
          </option>
        ))}
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-elevated)',
    backdropFilter: 'blur(var(--glass-blur-subtle))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    border: '1px solid var(--border-subtle)',
  },
  label: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },
  select: {
    fontSize: 'var(--text-sm)',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
  },
  option: {
    background: 'var(--color-rose-deep)',
    color: 'var(--text-primary)',
  },
};
