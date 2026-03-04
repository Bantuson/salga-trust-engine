/**
 * Dashboard Layout Component
 *
 * Wraps authenticated pages with:
 * - Icon sidebar navigation (fixed position)
 * - Top header bar with notification bell
 * - Main content area (with margin for sidebar)
 * - Responsive mobile support
 * - RoleSwitcher for multi-role users (switches view context)
 */

import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../../hooks/useAuth';
import { useViewRole } from '../../contexts/ViewRoleContext';
import { LayoutHeaderProvider, useLayoutHeader } from '../../contexts/LayoutHeaderContext';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <LayoutHeaderProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </LayoutHeaderProvider>
  );
}

function DashboardLayoutInner({ children }: DashboardLayoutProps) {
  const { user, signOut, getAllRoles } = useAuth();

  const allRoles = getAllRoles();
  const { viewRole, setViewRole } = useViewRole();
  const { headerContent, hideDefaultBell } = useLayoutHeader();

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

      {/* Top header bar with notification bell */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: '64px',
          right: 0,
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-xl, 24px)',
          background: 'transparent',
          zIndex: 100,
        }}
      >
        {/* Left slot: page header content injected via LayoutHeaderContext */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, paddingLeft: 'var(--space-md)' }}>{headerContent}</div>

        {/* Default Notification Bell — hidden when page provides its own */}
        {!hideDefaultBell && <NotificationBell />}
      </header>

      <main className="dashboard-main" style={{ paddingTop: '48px' }}>
        {children}
      </main>
    </div>
  );
}
