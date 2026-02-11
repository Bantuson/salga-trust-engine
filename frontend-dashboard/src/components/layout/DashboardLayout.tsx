/**
 * Dashboard Layout Component
 *
 * Wraps authenticated pages with:
 * - Icon sidebar navigation (fixed position)
 * - Main content area (with margin for sidebar)
 * - Responsive mobile support
 */

import { Sidebar } from './Sidebar';
import { useAuth } from '../../hooks/useAuth';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, signOut, getUserRole } = useAuth();

  const role = getUserRole();

  return (
    <div className="dashboard-layout">
      <Sidebar
        userEmail={user?.email}
        userPhone={user?.phone}
        userRole={role}
        onSignOut={signOut}
      />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
