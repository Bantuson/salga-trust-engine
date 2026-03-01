/**
 * PMS Hub Page — single entry point for all Performance Management views.
 *
 * Dropdown selector switches between:
 *  - IDP Management (cycles, goals, objectives)
 *  - SDBIP Scorecards (KPIs, quarterly targets)
 *  - Golden Thread (IDP -> Goals -> Objectives -> KPIs tree)
 *  - PMS Setup (department wizard — admin/executive only)
 *
 * Route: /pms
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { useAuth } from '../hooks/useAuth';
import { IdpPage } from './IdpPage';
import { SdbipPage } from './SdbipPage';
import { GoldenThreadPage } from './GoldenThreadPage';
import { PmsSetupWizardPage } from './PmsSetupWizardPage';

type PmsView = 'idp' | 'sdbip' | 'golden-thread' | 'setup';

interface ViewOption {
  value: PmsView;
  label: string;
  description: string;
  adminOnly?: boolean;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'idp', label: 'IDP Management', description: '5-year cycles, strategic goals, objectives' },
  { value: 'sdbip', label: 'SDBIP Scorecards', description: 'KPIs, quarterly targets, actuals' },
  { value: 'golden-thread', label: 'Golden Thread', description: 'IDP to KPI traceability tree' },
  { value: 'setup', label: 'PMS Setup', description: 'Department & organogram configuration', adminOnly: true },
];

const ADMIN_ROLES = ['admin', 'manager', 'executive_mayor', 'municipal_manager', 'salga_admin'];

export function PmsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getUserRole } = useAuth();
  const role = getUserRole();
  const isAdmin = ADMIN_ROLES.includes(role);

  const initialView = (searchParams.get('view') as PmsView) || 'idp';
  const [activeView, setActiveView] = useState<PmsView>(initialView);

  // Sync URL param with state
  useEffect(() => {
    const urlView = searchParams.get('view') as PmsView;
    if (urlView && urlView !== activeView) {
      setActiveView(urlView);
    }
  }, [searchParams]);

  const handleViewChange = (view: PmsView) => {
    setActiveView(view);
    setSearchParams({ view });
  };

  const availableViews = VIEW_OPTIONS.filter(v => !v.adminOnly || isAdmin);
  const currentOption = availableViews.find(v => v.value === activeView) || availableViews[0];

  return (
    <div style={styles.container}>
      {/* Header with dropdown selector */}
      <div style={styles.header}>
        <h1 style={styles.title}>Performance Management</h1>
        <div style={styles.selectorRow}>
          <div style={styles.selectWrapper}>
            <select
              value={activeView}
              onChange={(e) => handleViewChange(e.target.value as PmsView)}
              style={styles.select}
              aria-label="Select PMS view"
            >
              {availableViews.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span style={styles.selectChevron}>&#9662;</span>
          </div>
          <span style={styles.description}>{currentOption.description}</span>
        </div>
      </div>

      {/* Active view content */}
      <div style={styles.content}>
        {activeView === 'idp' && <IdpPage />}
        {activeView === 'sdbip' && <SdbipPage />}
        {activeView === 'golden-thread' && <GoldenThreadPage />}
        {activeView === 'setup' && isAdmin && <PmsSetupWizardPage />}
        {activeView === 'setup' && !isAdmin && (
          <GlassCard>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
              PMS Setup is available to administrators only.
            </p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)',
    width: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-sm)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  selectorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    flexWrap: 'wrap' as const,
  },
  selectWrapper: {
    position: 'relative' as const,
    display: 'inline-block',
  },
  select: {
    appearance: 'none' as const,
    background: 'var(--surface-elevated)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    padding: '10px 40px 10px 16px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: '200px',
    backdropFilter: 'blur(8px)',
  },
  selectChevron: {
    position: 'absolute' as const,
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none' as const,
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
  },
  description: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  },
  content: {
    width: '100%',
  },
};
