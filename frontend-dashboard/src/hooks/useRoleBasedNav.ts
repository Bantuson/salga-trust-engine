/**
 * Role-based navigation hook for municipal dashboard.
 *
 * Returns navigation items based on user role:
 * - Platform Admin: All system-level features
 * - Executive (executive_mayor, municipal_manager): Full authority + PMS
 * - CFO: Financial + PMS
 * - Speaker: Organogram + Reports
 * - Admin: Full municipality management + PMS
 * - SALGA Admin: Cross-municipality management + PMS
 * - Section 56 Director: Department + Organogram + PMS
 * - Department Manager: Department + PMS (no Organogram — Tier 3)
 * - PMS Officer: Departments + PMS + Analytics (no Organogram — Tier 3)
 * - Audit roles (audit_committee_member, internal_auditor, mpac_member): Performance (PMS) + Statutory Reports (SEC-05: no /reports GBV link)
 * - Ward Councillor / Chief Whip: Ward tickets + Organogram + PMS + Statutory Reports
 * - Field Worker: Assigned tickets and reporting
 * - SAPS Liaison: GBV cases only
 * - Citizen: Home only
 *
 * Organogram: Top-level route /organogram visible only to Tier 1 & Tier 2
 * municipal roles. Tier 3 operational roles (manager, department_manager,
 * pms_officer) do NOT see it. salga_admin accesses organograms only through
 * municipality onboarding workflows.
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
          { label: 'Departments', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/organogram', icon: 'organogram' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
          { label: 'Golden Thread', path: '/golden-thread', icon: 'link' },
          { label: 'Perf Agreements', path: '/performance-agreements', icon: 'users' },
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
          { label: 'Settings', path: '/settings', icon: 'settings' },
        ];

      case 'cfo':
        return [...base,
          { label: 'Departments', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/organogram', icon: 'organogram' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
          { label: 'Golden Thread', path: '/golden-thread', icon: 'link' },
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
        ];

      case 'speaker':
        return [...base,
          { label: 'Organogram', path: '/organogram', icon: 'organogram' },
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
        ];

      case 'admin':
        return [...base,
          { label: 'Teams', path: '/teams', icon: 'users' },
          { label: 'Organogram', path: '/organogram', icon: 'organogram' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'IDP Management', path: '/idp-management', icon: 'building' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
          { label: 'Golden Thread', path: '/golden-thread', icon: 'link' },
          { label: 'Perf Agreements', path: '/performance-agreements', icon: 'users' },
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
          { label: 'PMS Setup', path: '/pms-setup', icon: 'settings' },
          { label: 'Settings', path: '/settings', icon: 'settings' },
        ];

      case 'manager':
        return [...base,
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Teams', path: '/teams', icon: 'users' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
          { label: 'Settings', path: '/settings', icon: 'settings' },
        ];

      case 'salga_admin':
        return [...base,
          { label: 'Municipalities', path: '/municipalities', icon: 'building' },
          { label: 'Access Requests', path: '/access-requests', icon: 'inbox' },
          { label: 'Role Approvals', path: '/role-approvals', icon: 'users' },
          { label: 'System', path: '/system', icon: 'settings' },
        ];

      // -----------------------------------------------------------------------
      // Tier 2 — Directors
      // -----------------------------------------------------------------------
      case 'section56_director':
        return [...base,
          { label: 'My Department', path: '/departments', icon: 'building' },
          { label: 'Organogram', path: '/organogram', icon: 'organogram' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
          { label: 'Perf Agreements', path: '/performance-agreements', icon: 'users' },
        ];

      case 'department_manager':
        return [...base,
          { label: 'My Department', path: '/departments', icon: 'building' },
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
        ];

      case 'ward_councillor':
      case 'chief_whip':
        return [...base,
          { label: 'Organogram', path: '/organogram', icon: 'organogram' },
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
        ];

      // -----------------------------------------------------------------------
      // Tier 3 — Operational
      // -----------------------------------------------------------------------
      case 'pms_officer':
        return [...base,
          { label: 'Departments', path: '/departments', icon: 'building' },
          { label: 'IDP Management', path: '/idp-management', icon: 'building' },
          { label: 'SDBIP', path: '/sdbip', icon: 'target' },
          { label: 'Golden Thread', path: '/golden-thread', icon: 'link' },
          { label: 'Perf Agreements', path: '/performance-agreements', icon: 'users' },
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
        ];

      case 'audit_committee_member':
      case 'internal_auditor':
      case 'mpac_member':
        return [...base,
          { label: 'Statutory Reports', path: '/statutory-reports', icon: 'chart' },
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
