/**
 * Role-based navigation hook for municipal dashboard.
 *
 * Returns navigation items based on user role:
 * - Platform Admin: All system-level features
 * - Executive (executive_mayor, municipal_manager): Full authority + PMS
 * - CFO: Financial + PMS
 * - Speaker: Reports
 * - Admin: Full municipality management + PMS
 * - SALGA Admin: Cross-municipality management + PMS
 * - Section 56 Director / Department Manager: Department + PMS
 * - PMS Officer: Departments + PMS + Analytics
 * - Audit roles (audit_committee_member, internal_auditor, mpac_member): Performance (PMS) + Statutory Reports (SEC-05: no /reports GBV link)
 * - Ward Councillor: Ward tickets + Performance (PMS) + Statutory Reports (v2 nav)
 * - Field Worker: Assigned tickets and reporting
 * - SAPS Liaison: GBV cases only
 * - Citizen: Home only
 *
 * Phase 28: PMS views (IDP, SDBIP, Golden Thread, Setup) consolidated into
 * single /pms hub page with in-page dropdown selector.
 */

import { useMemo } from 'react';

// Icon type — each nav item has an icon name and component renders the SVG
interface NavItem {
  label: string;
  path: string;
  icon: string;  // Icon identifier: 'home', 'ticket', 'users', 'chart', 'settings', 'shield', 'building', 'upload', 'target', 'link'
  section?: string; // Optional section header for grouping
}

// Single PMS sidebar entry — all sub-views accessed via in-page dropdown
const pmsNavItem: NavItem = {
  label: 'Performance', path: '/pms', icon: 'target',
};

// All 18 roles from the UserRole enum (Phase 27 18-role 4-tier hierarchy)
type UserRole =
  // Tier 1 — Executive
  | 'executive_mayor'
  | 'municipal_manager'
  | 'cfo'
  | 'speaker'
  | 'admin'
  | 'salga_admin'
  // Tier 2 — Directors
  | 'section56_director'
  | 'ward_councillor'
  | 'chief_whip'
  // Tier 3 — Operational
  | 'department_manager'
  | 'pms_officer'
  | 'audit_committee_member'
  | 'internal_auditor'
  | 'mpac_member'
  | 'saps_liaison'
  | 'manager'
  // Tier 4 — Frontline
  | 'field_worker'
  | 'citizen'
  // Legacy alias (kept for backward compatibility)
  | 'platform_admin';

export function useRoleBasedNav(role: UserRole | string): NavItem[] {
  return useMemo(() => {
    const base: NavItem[] = [
      { label: 'Dashboard', path: '/', icon: 'home' },
    ];

    switch (role) {
      // -----------------------------------------------------------------------
      // Legacy / platform-level
      // -----------------------------------------------------------------------
      case 'platform_admin':
        return [...base,
          { label: 'Municipalities', path: '/municipalities', icon: 'building' },
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'System', path: '/system', icon: 'settings' },
        ];

      // -----------------------------------------------------------------------
      // Tier 1 — Executive (full authority + PMS)
      // -----------------------------------------------------------------------
      case 'executive_mayor':
      case 'municipal_manager':
        return [...base,
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Departments', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/departments/organogram', icon: 'organogram' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          pmsNavItem,
          { label: 'Settings', path: '/settings', icon: 'settings' },
        ];

      case 'cfo':
        return [...base,
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Departments', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/departments/organogram', icon: 'organogram' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          pmsNavItem,
        ];

      case 'speaker':
        return [...base,
          { label: 'Reports', path: '/reports', icon: 'chart' },
        ];

      case 'manager':
      case 'admin':
        return [...base,
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Teams', path: '/teams', icon: 'users' },
          { label: 'Organogram', path: '/departments/organogram', icon: 'organogram' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          pmsNavItem,
          { label: 'Settings', path: '/settings', icon: 'settings' },
        ];

      case 'salga_admin':
        return [...base,
          { label: 'Municipalities', path: '/municipalities', icon: 'building' },
          { label: 'Access Requests', path: '/access-requests', icon: 'inbox' },
          { label: 'Role Approvals', path: '/role-approvals', icon: 'users' },
          pmsNavItem,
          { label: 'System', path: '/system', icon: 'settings' },
        ];

      // -----------------------------------------------------------------------
      // Tier 2 — Directors
      // -----------------------------------------------------------------------
      case 'section56_director':
      case 'department_manager':
        return [...base,
          { label: 'My Department', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/departments/organogram', icon: 'organogram' },
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          pmsNavItem,
        ];

      case 'ward_councillor':
      case 'chief_whip':
        return [...base,
          { label: 'My Ward Tickets', path: '/tickets', icon: 'ticket' },
          pmsNavItem,
          { label: 'Statutory Reports', path: '/pms?view=statutory-reports', icon: 'chart' },
        ];

      // -----------------------------------------------------------------------
      // Tier 3 — Operational
      // -----------------------------------------------------------------------
      case 'pms_officer':
        return [...base,
          { label: 'Departments', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/departments/organogram', icon: 'organogram' },
          pmsNavItem,
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
        ];

      case 'audit_committee_member':
      case 'internal_auditor':
      case 'mpac_member':
        return [...base,
          pmsNavItem,
          { label: 'Statutory Reports', path: '/pms?view=statutory-reports', icon: 'chart' },
        ];

      case 'saps_liaison':
        return [
          { label: 'GBV Cases', path: '/', icon: 'shield' },
          { label: 'Reports', path: '/reports', icon: 'chart' },
        ];

      // -----------------------------------------------------------------------
      // Tier 4 — Frontline
      // -----------------------------------------------------------------------
      case 'field_worker':
        return [
          { label: 'My Tickets', path: '/', icon: 'ticket' },
          { label: 'Team', path: '/field-worker/team', icon: 'users' },
          { label: 'Completed', path: '/completed', icon: 'chart' },
        ];

      case 'citizen':
      default:
        return base;
    }
  }, [role]);
}
