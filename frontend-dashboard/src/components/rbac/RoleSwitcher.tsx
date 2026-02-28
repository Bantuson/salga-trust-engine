/**
 * RoleSwitcher — navbar role switcher for multi-role users.
 *
 * Displays a "View as:" dropdown in the navbar when the authenticated user
 * holds multiple roles. Switches dashboard view context WITHOUT re-login.
 * The JWT permissions remain governed by the effective role in the token.
 *
 * Single-role users see nothing (component returns null) — cleaner nav.
 *
 * Usage:
 *   <RoleSwitcher
 *     allRoles={user.allRoles}
 *     activeRole={viewRole}
 *     onRoleSwitch={(role) => setViewRole(role)}
 *   />
 */

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
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
      <span className="text-xs text-gray-400 whitespace-nowrap font-medium">
        View as:
      </span>
      <select
        value={activeRole}
        onChange={(e) => onRoleSwitch(e.target.value)}
        className="text-sm bg-transparent border-none outline-none cursor-pointer text-white font-medium"
        aria-label="Switch dashboard view role"
      >
        {allRoles.map((role) => (
          <option key={role} value={role} className="text-gray-900 bg-white">
            {ROLE_LABELS[role] ?? role}
          </option>
        ))}
      </select>
    </div>
  );
}
