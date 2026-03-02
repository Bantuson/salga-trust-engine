/**
 * ViewRoleContext — bridges DashboardLayout's role switcher to RoleBasedDashboard.
 *
 * Problem: DashboardLayout manages viewRole state (from RoleSwitcher), but
 * RoleBasedDashboard is rendered as ReactNode children and cannot receive props.
 *
 * Solution: Lift viewRole into a context so any descendant can read/update it.
 * DashboardLayout uses useViewRole() to drive Sidebar + propagate changes.
 * RoleBasedDashboard uses useViewRole() to select the correct page component.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ViewRoleContextType {
  viewRole: string;
  setViewRole: (role: string) => void;
}

const ViewRoleContext = createContext<ViewRoleContextType>({
  viewRole: 'citizen',
  setViewRole: () => {},
});

export function ViewRoleProvider({ children }: { children: React.ReactNode }) {
  const { getUserRole } = useAuth();
  const jwtRole = getUserRole();
  const [viewRole, setViewRole] = useState(jwtRole);

  // Sync when auth loads (jwtRole starts as 'citizen' during loading)
  useEffect(() => {
    setViewRole(jwtRole);
  }, [jwtRole]);

  return (
    <ViewRoleContext.Provider value={{ viewRole, setViewRole }}>
      {children}
    </ViewRoleContext.Provider>
  );
}

export function useViewRole() {
  return useContext(ViewRoleContext);
}
