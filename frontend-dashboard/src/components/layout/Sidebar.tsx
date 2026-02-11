/**
 * Icon-only sidebar navigation with hover expansion.
 *
 * Features:
 * - 64px collapsed, 240px expanded on hover
 * - Role-adaptive navigation items
 * - Active state highlighting with coral left border
 * - Mobile hamburger menu with glassmorphism overlay
 * - User profile section at bottom
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useRoleBasedNav } from '../../hooks/useRoleBasedNav';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import { Badge } from '@shared/components/ui/Badge';
import './Sidebar.css';

interface SidebarProps {
  userEmail?: string;
  userPhone?: string;
  userRole: string;
  onSignOut: () => void;
}

// Icon SVG components
const icons = {
  home: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  ticket: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  chart: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-6.364 0L3.636 18.364m12.728 0l-4.243-4.243m-6.364 0L3.636 5.636" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  building: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  upload: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  menu: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

export function Sidebar({ userEmail, userPhone, userRole, onSignOut }: SidebarProps) {
  const navItems = useRoleBasedNav(userRole);
  const prefersReducedMotion = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [window.location.pathname]);

  const userDisplay = userEmail || userPhone || 'User';
  const userInitials = userDisplay
    .split(/[@\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  const roleLabel = userRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const sidebarContent = (
    <>
      {/* Navigation Items */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''} ${prefersReducedMotion ? 'no-motion' : ''}`
            }
            onClick={() => isMobile && setMobileOpen(false)}
          >
            <span className="sidebar-icon">
              {icons[item.icon as keyof typeof icons] || icons.home}
            </span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile Section */}
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {userInitials}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{userDisplay}</div>
          <Badge variant="default" size="sm" className="sidebar-user-role">
            {roleLabel}
          </Badge>
        </div>
        <button
          onClick={onSignOut}
          className="sidebar-logout"
          aria-label="Sign out"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Hamburger Button */}
        <button
          className="sidebar-hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? icons.close : icons.menu}
        </button>

        {/* Mobile Overlay */}
        {mobileOpen && (
          <>
            <div
              className="sidebar-overlay"
              onClick={() => setMobileOpen(false)}
            />
            <aside className={`sidebar sidebar-mobile ${prefersReducedMotion ? 'no-motion' : ''}`}>
              {sidebarContent}
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className={`sidebar sidebar-desktop ${prefersReducedMotion ? 'no-motion' : ''}`}>
      {sidebarContent}
    </aside>
  );
}
