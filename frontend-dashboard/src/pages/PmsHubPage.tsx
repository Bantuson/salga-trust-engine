/**
 * PMS Hub Page — single entry point for all Performance Management views.
 *
 * Dropdown selector switches between:
 *  - IDP Management (cycles, goals, objectives)
 *  - SDBIP Scorecards (KPIs, quarterly targets)
 *  - Golden Thread (IDP -> Goals -> Objectives -> KPIs tree)
 *  - PMS Setup (department wizard — admin/executive only)
 *
 * Create actions open modal dialogs (not inline card expand).
 *
 * Route: /pms
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
import { useAuth } from '../hooks/useAuth';
import { IdpPage } from './IdpPage';
import { SdbipPage } from './SdbipPage';
import { GoldenThreadPage } from './GoldenThreadPage';
import { PmsSetupWizardPage } from './PmsSetupWizardPage';
import { PerformanceAgreementsPage } from './PerformanceAgreementsPage';
import { StatutoryReportsPage } from './StatutoryReportsPage';
import { CreateIdpModal } from '../components/pms/CreateIdpModal';
import { CreateSdbipModal } from '../components/pms/CreateSdbipModal';
import { CreatePaModal } from '../components/pms/CreatePaModal';

type PmsView = 'idp' | 'sdbip' | 'golden-thread' | 'performance-agreements' | 'statutory-reports' | 'setup';

interface ViewOption {
  value: PmsView;
  label: string;
  createLabel?: string;
  adminOnly?: boolean;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'idp', label: 'IDP Management', createLabel: '+ Create IDP Cycle' },
  { value: 'sdbip', label: 'SDBIP Scorecards', createLabel: '+ Create Scorecard' },
  { value: 'golden-thread', label: 'Golden Thread' },
  { value: 'performance-agreements', label: 'Performance Agreements', createLabel: '+ Create Agreement' },
  { value: 'statutory-reports', label: 'Statutory Reports' },
  { value: 'setup', label: 'PMS Setup', adminOnly: true },
];

const ADMIN_ROLES = ['admin', 'manager', 'executive_mayor', 'municipal_manager', 'salga_admin'];

// Roles that can VIEW PMS data but NOT create/edit
const READ_ONLY_ROLES = [
  'salga_admin',
  'audit_committee_member',
  'internal_auditor',
  'mpac_member',
  'ward_councillor',
  'chief_whip',
  'speaker',
  'citizen',
];

export function PmsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getUserRole } = useAuth();
  const role = getUserRole();
  const isAdmin = ADMIN_ROLES.includes(role);
  const isReadOnly = READ_ONLY_ROLES.includes(role);

  const initialView = (searchParams.get('view') as PmsView) || 'idp';
  const [activeView, setActiveView] = useState<PmsView>(initialView);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Sync URL param with state
  useEffect(() => {
    const urlView = searchParams.get('view') as PmsView;
    if (urlView && urlView !== activeView) {
      setActiveView(urlView);
    }
  }, [searchParams]);

  const handleViewChange = (view: PmsView) => {
    setActiveView(view);
    setShowCreateModal(false);
    setSearchParams({ view });
  };

  const availableViews = VIEW_OPTIONS.filter(v => !v.adminOnly || isAdmin);
  const currentOption = availableViews.find(v => v.value === activeView) || availableViews[0];

  const handleModalCreated = () => {
    setShowCreateModal(false);
  };

  return (
    <div style={styles.container}>
      {/* Toolbar: dropdown (left) + create button (right) */}
      <div style={styles.toolbar}>
        <Select
          options={availableViews.map(opt => ({ value: opt.value, label: opt.label }))}
          value={activeView}
          onChange={(v) => handleViewChange(v as PmsView)}
          fullWidth={false}
        />

        {currentOption.createLabel && !isReadOnly && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            style={{ background: 'var(--color-coral)', borderColor: 'var(--color-coral)' }}
          >
            {currentOption.createLabel}
          </Button>
        )}
      </div>

      {/* Active view content */}
      <div style={styles.content}>
        {activeView === 'idp' && (
          <IdpPage
            embedded
          />
        )}
        {activeView === 'sdbip' && (
          <SdbipPage
            embedded
          />
        )}
        {activeView === 'golden-thread' && <GoldenThreadPage embedded />}
        {activeView === 'performance-agreements' && (
          <PerformanceAgreementsPage
            embedded
          />
        )}
        {activeView === 'statutory-reports' && (
          <StatutoryReportsPage
            showForm={false}
            onCloseForm={() => {}}
          />
        )}
        {activeView === 'setup' && isAdmin && <PmsSetupWizardPage />}
        {activeView === 'setup' && !isAdmin && (
          <GlassCard>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-2xl)' }}>
              PMS Setup is available to administrators only.
            </p>
          </GlassCard>
        )}
      </div>

      {/* Modal dialogs for create actions */}
      {showCreateModal && activeView === 'idp' && (
        <CreateIdpModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleModalCreated}
        />
      )}
      {showCreateModal && activeView === 'sdbip' && (
        <CreateSdbipModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleModalCreated}
        />
      )}
      {showCreateModal && activeView === 'performance-agreements' && (
        <CreatePaModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleModalCreated}
        />
      )}
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-md)',
    flexWrap: 'wrap' as const,
  },
  content: {
    width: '100%',
  },
};
