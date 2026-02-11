/**
 * Role-based navigation hook for municipal dashboard.
 *
 * Returns navigation items based on user role:
 * - Platform Admin: All system-level features
 * - Manager/Admin: Full municipality management
 * - Ward Councillor: Ward-specific views
 * - Field Worker: Assigned tickets and reporting
 * - SAPS Liaison: GBV cases only
 */

import { useMemo } from 'react';

// Icon type — each nav item has an icon name and component renders the SVG
interface NavItem {
  label: string;
  path: string;
  icon: string;  // Icon identifier: 'home', 'ticket', 'users', 'chart', 'settings', 'shield', 'building', 'upload'
}

type UserRole = 'platform_admin' | 'manager' | 'admin' | 'ward_councillor' | 'field_worker' | 'saps_liaison' | 'citizen';

export function useRoleBasedNav(role: UserRole | string): NavItem[] {
  return useMemo(() => {
    const base: NavItem[] = [
      { label: 'Dashboard', path: '/', icon: 'home' },
    ];

    switch (role) {
      case 'platform_admin':
        return [...base,
          { label: 'Municipalities', path: '/municipalities', icon: 'building' },
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'System', path: '/system', icon: 'settings' },
        ];
      case 'manager':
      case 'admin':
        return [...base,
          { label: 'Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Teams', path: '/teams', icon: 'users' },
          { label: 'Analytics', path: '/analytics', icon: 'chart' },
          { label: 'Settings', path: '/settings', icon: 'settings' },
        ];
      case 'ward_councillor':
        return [...base,
          { label: 'My Ward Tickets', path: '/tickets', icon: 'ticket' },
          { label: 'Ward Analytics', path: '/analytics', icon: 'chart' },
        ];
      case 'field_worker':
        return [
          { label: 'My Tickets', path: '/', icon: 'ticket' },
          { label: 'Submit Report', path: '/report', icon: 'upload' },
        ];
      case 'saps_liaison':
        return [
          { label: 'GBV Cases', path: '/', icon: 'shield' },
          { label: 'Reports', path: '/reports', icon: 'chart' },
        ];
      default:
        return base;
    }
  }, [role]);
}
