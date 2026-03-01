/**
 * Dashboard Layout Component
 *
 * Wraps authenticated pages with:
 * - Icon sidebar navigation (fixed position)
 * - Main content area (with margin for sidebar)
 * - Responsive mobile support
 * - RoleSwitcher for multi-role users (switches view context)
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, getUserRole, getAllRoles } = useAuth();

  const jwtRole = getUserRole();
  const allRoles = getAllRoles();
  const [viewRole, setViewRole] = useState(jwtRole);

  // Sync viewRole when auth loads (jwtRole starts as 'citizen' during loading)
  useEffect(() => {
    setViewRole(jwtRole);
  }, [jwtRole]);

  return (
    <div className="dashboard-layout">
      <Sidebar
        userEmail={user?.email}
        userPhone={user?.phone}
        userRole={viewRole}
        allRoles={allRoles}
        onRoleSwitch={setViewRole}
        onSignOut={signOut}
      />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
