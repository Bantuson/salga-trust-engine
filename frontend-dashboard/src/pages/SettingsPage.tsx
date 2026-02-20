/**
 * SettingsPage — Municipal settings management.
 *
 * Single scrollable page with 8 clearly separated sections.
 * Anchor navigation at top with smooth scroll + active section tracking.
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
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

export function SettingsPage() {
  const { getUserRole } = useAuth();
  const role = getUserRole();
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || role === 'admin';

  const { slaConfigs, municipalityProfile, isLoading, updateSLA, updateProfile } = useSettings();

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
          // Use the first visible section
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

  return (
    <div>
      {/* Anchor navigation — full width, flush at top */}
      <nav style={styles.anchorNav} aria-label="Settings sections">
        <div style={styles.navInner}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={styles.navSkeleton} />
              ))
            : navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    ...styles.navLink,
                    ...(activeSection === item.id ? styles.navLinkActive : {}),
                  }}
                >
                  {item.label}
                </button>
              ))}
        </div>
      </nav>

      {/* Sections */}
      <div style={styles.container}>
      <div style={styles.sections}>
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
  anchorNav: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    backgroundColor: 'rgba(205, 94, 129, 0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--glass-border)',
    marginTop: 'calc(-1 * var(--space-2xl))',
    marginLeft: 'calc(-1 * var(--space-2xl))',
    marginRight: 'calc(-1 * var(--space-2xl))',
    paddingLeft: 'var(--space-2xl)',
    paddingRight: 'var(--space-2xl)',
    marginBottom: 'var(--space-lg)',
  },
  navInner: {
    display: 'flex',
    gap: '0.25rem',
    overflowX: 'auto',
    padding: '0.625rem 0',
  },
  navLink: {
    padding: '0.4rem 0.875rem',
    borderRadius: '999px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'var(--transition-fast)',
    fontFamily: 'var(--font-body)',
  },
  navLinkActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    color: 'var(--text-primary)',
  },
  navSkeleton: {
    width: '80px',
    height: '30px',
    borderRadius: '999px',
    backgroundColor: 'var(--skeleton-base)',
    flexShrink: 0,
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
