/**
 * SettingsPage — Municipal settings management.
 *
 * Single scrollable page with 8 clearly separated sections.
 * Pink pill-tab navigation embedded in the layout header bar.
 * Role-gated visibility: admin-only sections hidden from managers.
 * beforeunload warning when any section has unsaved changes.
 *
 * Section order:
 *   1. Municipality Profile (manager + admin)
 *   2. SLA Targets (manager + admin)
 *   3. Notifications (manager + admin)
 *   4. Team Defaults (manager + admin)
 *   5. Ward Boundaries (manager + admin)
 *   6. Branding (admin-only)
 *   7. Data Export (manager + admin)
 *   8. Audit Log (admin-only)
 */

import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react';
import { useAuth } from '../hooks/useAuth';
import { usePageHeader } from '../hooks/usePageHeader';
import { useLayoutHeader } from '../contexts/LayoutHeaderContext';
import { useSettings } from '../hooks/useSettings';
import { NotificationBell } from '../components/layout/NotificationBell';
import { MunicipalityProfile } from '../components/settings/MunicipalityProfile';
import { SLATargetsSection } from '../components/settings/SLATargetsSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { TeamDefaultsSection } from '../components/settings/TeamDefaultsSection';
import { WardBoundariesSection } from '../components/settings/WardBoundariesSection';
import { BrandingSection } from '../components/settings/BrandingSection';
import { DataExportSection } from '../components/settings/DataExportSection';
import { AuditLogSection } from '../components/settings/AuditLogSection';

interface NavItem {
  id: string;
  label: string;
  adminOnly?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { id: 'municipality-profile', label: 'Profile' },
  { id: 'sla-targets', label: 'SLA Targets' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'team-defaults', label: 'Team Defaults' },
  { id: 'ward-boundaries', label: 'Ward Boundaries' },
  { id: 'branding', label: 'Branding', adminOnly: true },
  { id: 'data-export', label: 'Data Export' },
  { id: 'audit-log', label: 'Audit Log', adminOnly: true },
];

const navLinkStyle: React.CSSProperties = {
  padding: '0.4rem 0.875rem',
  borderRadius: '999px',
  border: '1px solid transparent',
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.75)',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'var(--transition-fast)',
  fontFamily: 'var(--font-body)',
};

const navLinkActiveStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  borderColor: 'rgba(255, 255, 255, 0.35)',
  color: '#ffffff',
};

function SettingsHeaderNav({
  navItems,
  activeSection,
  isLoading,
  onScrollTo,
}: {
  navItems: NavItem[];
  activeSection: string;
  isLoading: boolean;
  onScrollTo: (id: string) => void;
}): ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: '64px',
        right: 0,
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(205, 94, 129, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '0 var(--space-xl)',
        gap: '0.25rem',
        zIndex: 101,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          overflowX: 'auto',
          flex: 1,
          minWidth: 0,
        }}
      >
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '80px',
                  height: '30px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--skeleton-base)',
                  flexShrink: 0,
                }}
              />
            ))
          : navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onScrollTo(item.id)}
                style={{
                  ...navLinkStyle,
                  ...(activeSection === item.id ? navLinkActiveStyle : {}),
                }}
              >
                {item.label}
              </button>
            ))}
      </div>
      <div style={{ flexShrink: 0, marginLeft: '0.5rem' }}>
        <NotificationBell />
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { getUserRole } = useAuth();
  const role = getUserRole();

  const ADMIN_ROLES = ['admin', 'salga_admin'];
  const MANAGER_ROLES = [
    'admin', 'salga_admin', 'manager', 'municipal_manager',
    'executive_mayor', 'cfo', 'speaker', 'pms_officer',
    'section56_director', 'department_manager',
  ];
  const isAdmin = ADMIN_ROLES.includes(role);
  const isManager = MANAGER_ROLES.includes(role);

  const { slaConfigs, municipalityProfile, isLoading, error: settingsError, updateSLA, updateProfile } = useSettings();

  const loadError = settingsError;

  // Active anchor tracking via IntersectionObserver
  const [activeSection, setActiveSection] = useState<string>('municipality-profile');

  // Dirty state tracking across sections (for beforeunload)
  const [globalDirty, setGlobalDirty] = useState(false);

  // Track dirty per section
  const dirtyRef = useRef<Set<string>>(new Set());
  const markDirty = useCallback((sectionId: string, dirty: boolean) => {
    if (dirty) {
      dirtyRef.current.add(sectionId);
    } else {
      dirtyRef.current.delete(sectionId);
    }
    setGlobalDirty(dirtyRef.current.size > 0);
  }, []);

  // Visible nav items (filtered by role)
  const navItems = ALL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  // Smooth scroll to section
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // IntersectionObserver for active section tracking
  useEffect(() => {
    const sectionIds = navItems.map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      {
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // beforeunload warning for unsaved changes
  useEffect(() => {
    if (!globalDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [globalDirty]);

  // Wrapped save handlers that track dirty state
  const handleSaveProfile = useCallback(
    async (data: Parameters<typeof updateProfile>[0]) => {
      await updateProfile(data);
      markDirty('municipality-profile', false);
    },
    [updateProfile, markDirty]
  );

  const handleSaveSLA = useCallback(
    async (...args: Parameters<typeof updateSLA>) => {
      await updateSLA(...args);
    },
    [updateSLA]
  );

  // Hide the default bell in DashboardLayout — we embed our own
  const { setHideDefaultBell } = useLayoutHeader();
  useEffect(() => {
    setHideDefaultBell(true);
    return () => setHideDefaultBell(false);
  }, [setHideDefaultBell]);

  // No usePageHeader — we render the pink bar directly as a fixed element
  const { setHeaderContent } = useLayoutHeader();
  useEffect(() => {
    setHeaderContent(null);
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  return (
    <div>
      {/* Fixed pink header bar — spans full header area */}
      <SettingsHeaderNav
        navItems={navItems}
        activeSection={activeSection}
        isLoading={isLoading}
        onScrollTo={scrollToSection}
      />
      {/* Sections */}
      <div style={styles.container}>
      <div style={styles.sections}>
        {/* Error banner — shown when settings API calls fail */}
        {loadError && (
          <div style={{
            padding: 'var(--space-md)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-lg)',
          }}>
            Some settings could not be loaded. Displaying available configuration.
          </div>
        )}

        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={styles.sectionSkeleton}>
              <div style={{ ...styles.skeletonLine, width: '200px', height: '24px' }} />
              <div style={{ ...styles.skeletonLine, width: '100%', height: '80px', marginTop: '1rem' }} />
            </div>
          ))
        ) : (
          <>
            {/* 1. Municipality Profile — manager + admin */}
            {isManager && (
              <MunicipalityProfile
                profile={municipalityProfile}
                onSave={handleSaveProfile}
              />
            )}

            {/* 2. SLA Targets — manager + admin */}
            {isManager && (
              <SLATargetsSection
                slaConfigs={slaConfigs}
                onSave={handleSaveSLA}
              />
            )}

            {/* 3. Notifications — manager + admin */}
            {isManager && <NotificationsSection />}

            {/* 4. Team Defaults — manager + admin */}
            {isManager && <TeamDefaultsSection />}

            {/* 5. Ward Boundaries — manager + admin */}
            {isManager && <WardBoundariesSection profile={municipalityProfile} />}

            {/* 6. Branding — admin-only */}
            {isAdmin && <BrandingSection profile={municipalityProfile} />}

            {/* 7. Data Export — manager + admin */}
            {isManager && <DataExportSection />}

            {/* 8. Audit Log — admin-only */}
            {isAdmin && <AuditLogSection />}
          </>
        )}
      </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 2rem 2rem 2rem',
  },
  sections: {
    maxWidth: '960px',
  },
  sectionSkeleton: {
    padding: 'var(--space-lg)',
    marginBottom: 'var(--space-2xl)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
  },
  skeletonLine: {
    borderRadius: '4px',
    backgroundColor: 'var(--skeleton-base)',
  },
};
