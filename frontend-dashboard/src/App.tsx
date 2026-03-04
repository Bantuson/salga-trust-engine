/**
 * Main App component with React Router authentication.
 *
 * Enforces authentication for all dashboard pages.
 * Uses React Router for navigation.
 * Wrapped in LenisProvider for smooth scroll.
 * PageTransition provides coral/navy gradient overlay sweep on route changes.
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ViewRoleProvider, useViewRole } from './contexts/ViewRoleContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RequestAccessPage } from './pages/RequestAccessPage';
import { OnboardingWizardPage } from './pages/OnboardingWizardPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { TeamsPage } from './pages/TeamsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SAPSReportsPage } from './pages/SAPSReportsPage';
import { FieldWorkerTicketsPage } from './pages/FieldWorkerTicketsPage';
import { FieldWorkerTeamPage } from './pages/FieldWorkerTeamPage';
import { CompletedTicketsPage } from './pages/CompletedTicketsPage';
import { PmsSetupWizardPage } from './pages/PmsSetupWizardPage';
import { OrganogramPage } from './pages/OrganogramPage';
import { PmsHubPage } from './pages/PmsHubPage';
import { IdpDetailPage } from './pages/IdpDetailPage';
import { SdbipKpiPage } from './pages/SdbipKpiPage';
import { ActualsPage } from './pages/ActualsPage';
import { EvidencePage } from './pages/EvidencePage';
import { ReportForm } from './components/ReportForm';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { CFODashboardPage } from './pages/CFODashboardPage';
import { MunicipalManagerDashboardPage } from './pages/MunicipalManagerDashboardPage';
import { MayorDashboardPage } from './pages/MayorDashboardPage';
import { OversightDashboardPage } from './pages/OversightDashboardPage';
import { SALGAAdminDashboardPage } from './pages/SALGAAdminDashboardPage';
import { Section56DirectorDashboardPage } from './pages/Section56DirectorDashboardPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { RoleApprovalsPage } from './pages/RoleApprovalsPage';
import { MunicipalitiesPage } from './pages/MunicipalitiesPage';
import { AccessRequestsPage } from './pages/AccessRequestsPage';
import { GoldenThreadPage } from './pages/GoldenThreadPage';
import { IdpPage } from './pages/IdpPage';
import { SdbipPage } from './pages/SdbipPage';
import { PerformanceAgreementsPage } from './pages/PerformanceAgreementsPage';
import { StatutoryReportsPage } from './pages/StatutoryReportsPage';
import { LenisProvider } from './providers/LenisProvider';
import { PageTransition } from './components/PageTransition';
import { usePageHeader } from './hooks/usePageHeader';
import '@shared/design-tokens.css';
import '@shared/animations.css';
import './App.css';

/**
 * SystemPlaceholderPage — mock system health page for platform admin / SALGA Admin.
 * Shows system status metrics. Full implementation deferred.
 */
function SystemPlaceholderPage() {
  const metrics = [
    { label: 'API Status', value: 'Healthy', color: 'var(--color-teal)' },
    { label: 'Database', value: 'Connected', color: 'var(--color-teal)' },
    { label: 'Redis Cache', value: 'Connected', color: 'var(--color-teal)' },
    { label: 'Celery Workers', value: '2 Active', color: 'var(--color-teal)' },
    { label: 'Storage', value: '12.4 GB Used', color: 'var(--color-gold)' },
    { label: 'Last Backup', value: '2026-03-01 02:00', color: 'var(--text-secondary)' },
  ];

  usePageHeader('System Health');

  return (
    <div style={{ padding: 'var(--space-lg)' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)',
      }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
          }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 'var(--space-xs)' }}>
              {m.label}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: m.color }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
      }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-md)' }}>
          Configuration
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
          {[
            ['Platform Version', 'v2.0.0-beta'],
            ['Tenant Mode', 'Multi-tenant (RLS)'],
            ['Auth Provider', 'Supabase Auth'],
            ['AI Engine', 'CrewAI + DeepSeek'],
            ['Timezone', 'Africa/Johannesburg (SAST)'],
            ['PMS Module', 'Enabled'],
          ].map(([k, v], i) => (
            <div key={i} style={{ padding: 'var(--space-xs) 0', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{k}: </span>
              <span style={{ color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        Full system management interface available in a future release.
      </p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LenisProvider>
        <AppRoutes />
      </LenisProvider>
    </BrowserRouter>
  );
}

/**
 * SEC-05: SAPS Reports route guard — GBV reports only visible to saps_liaison and admin.
 */
function SAPSReportsGuard() {
  const { viewRole } = useViewRole();
  const ALLOWED_GBV_ROLES = ['saps_liaison', 'admin', 'salga_admin'];
  if (!ALLOWED_GBV_ROLES.includes(viewRole)) {
    return <Navigate to="/" replace />;
  }
  return <SAPSReportsPage />;
}

function AppRoutes() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Unauthenticated routes
  if (!session) {
    return (
      <PageTransition routeKey={location.pathname}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/request-access" element={<RequestAccessPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </PageTransition>
    );
  }

  // Authenticated routes
  return (
    <ViewRoleProvider>
    <PageTransition routeKey={location.pathname}>
      <Routes>
        {/* Onboarding wizard (full-screen, no layout) */}
        <Route path="/onboarding" element={<OnboardingWizardPage />} />

        {/* ---------------------------------------------------------------
         * PAGE DEDUPLICATION MAP (34-04)
         * Each route has a UNIQUE purpose — no two pages show the same data.
         * ---------------------------------------------------------------
         * /               Role-based dashboard: executive KPI summary (role-specific)
         * /tickets        Service delivery ticket queue (citizen-reported issues)
         * /report         Ticket submission form
         * /departments    Department management: CRUD, activation gates, director assignment
         * /organogram              Org chart — top-level route (Tier 1 & 2 sidebar link)
         * /departments/organogram  Org chart — legacy alias (backward compatibility)
         * /role-approvals SALGA Admin action queue: approve/reject Tier 1 role requests (action-oriented)
         * /pms            PMS Hub: IDP, SDBIP, actuals, evidence, agreements, statutory reports
         * /pms-setup      Initial PMS configuration wizard (setup flow, not viewing data)
         * /municipalities SALGA Admin municipality registry: onboarding status list
         * /teams          Field team management: create teams, manage field workers
         * /analytics      Operational analytics: ticket trends, resolution stats
         * /settings       Municipality configuration: SLA, wards, branding
         * /system         Platform admin infrastructure: system health, config
         * /reports        SAPS GBV liaison reports (saps_liaison role only)
         * /completed      Completed tickets archive
         * /field-worker   Field worker active ticket queue
         * /field-worker/team  Field worker's team roster
         * --------------------------------------------------------------- */}

        {/* Dashboard routes (wrapped in DashboardLayout) */}
        <Route path="/" element={<DashboardLayout><RoleBasedDashboard /></DashboardLayout>} />
        <Route path="/tickets" element={<DashboardLayout><TicketListPage /></DashboardLayout>} />
        <Route path="/report" element={<DashboardLayout><ReportForm /></DashboardLayout>} />
        <Route path="/organogram" element={<DashboardLayout><OrganogramPage /></DashboardLayout>} />
        {/* Legacy route — kept for backward compatibility */}
        <Route path="/departments/organogram" element={<DashboardLayout><OrganogramPage /></DashboardLayout>} />
        {/* Department management — CRUD, activation gates, director assignment (34-04) */}
        <Route path="/departments" element={<DashboardLayout><DepartmentsPage /></DashboardLayout>} />
        {/* Role approval action queue — SALGA Admin only, approve/reject Tier 1 requests (34-04) */}
        <Route path="/role-approvals" element={<DashboardLayout><RoleApprovalsPage /></DashboardLayout>} />
        {/* BUG-4: PMS setup as standalone route — was only accessible via ?view=setup in PmsHub */}
        <Route path="/pms-setup" element={<DashboardLayout><PmsSetupWizardPage /></DashboardLayout>} />
        <Route path="/municipalities" element={<DashboardLayout><MunicipalitiesPage /></DashboardLayout>} />
        <Route path="/access-requests" element={<DashboardLayout><AccessRequestsPage /></DashboardLayout>} />
        <Route path="/teams" element={<DashboardLayout><TeamsPage /></DashboardLayout>} />
        <Route path="/analytics" element={<DashboardLayout><AnalyticsPage /></DashboardLayout>} />
        <Route path="/settings" element={<DashboardLayout><SettingsPage /></DashboardLayout>} />
        <Route path="/system" element={<DashboardLayout><SystemPlaceholderPage /></DashboardLayout>} />
        {/* SEC-05: SAPS GBV reports — restricted to saps_liaison and admin only */}
        <Route path="/reports" element={<DashboardLayout><SAPSReportsGuard /></DashboardLayout>} />
        <Route path="/completed" element={<DashboardLayout><CompletedTicketsPage /></DashboardLayout>} />
        <Route path="/field-worker" element={<DashboardLayout><FieldWorkerTicketsPage /></DashboardLayout>} />
        <Route path="/field-worker/team" element={<DashboardLayout><FieldWorkerTeamPage /></DashboardLayout>} />

        {/* PMS hub — consolidated Performance Management with in-page view selector */}
        <Route path="/pms" element={<DashboardLayout><PmsHubPage /></DashboardLayout>} />
        {/* PMS detail routes — drill-down from hub list views */}
        <Route path="/pms/idp/:cycleId" element={<DashboardLayout><IdpDetailPage /></DashboardLayout>} />
        <Route path="/pms/sdbip/:scorecardId/kpis" element={<DashboardLayout><SdbipKpiPage /></DashboardLayout>} />
        <Route path="/pms/kpis/:kpiId/actuals" element={<DashboardLayout><ActualsPage /></DashboardLayout>} />
        <Route path="/pms/actuals/:actualId/evidence" element={<DashboardLayout><EvidencePage /></DashboardLayout>} />
        {/* IDP-04: Golden thread standalone route — page exists but had no route */}
        <Route path="/pms/golden-thread" element={<DashboardLayout><GoldenThreadPage /></DashboardLayout>} />

        {/* Wave 2: Standalone PMS sub-page routes — sidebar links per role */}
        <Route path="/sdbip" element={<DashboardLayout><SdbipPage /></DashboardLayout>} />
        <Route path="/golden-thread" element={<DashboardLayout><GoldenThreadPage /></DashboardLayout>} />
        <Route path="/performance-agreements" element={<DashboardLayout><PerformanceAgreementsPage /></DashboardLayout>} />
        <Route path="/statutory-reports" element={<DashboardLayout><StatutoryReportsPage showForm={false} onCloseForm={() => {}} /></DashboardLayout>} />
        <Route path="/idp-management" element={<DashboardLayout><IdpPage /></DashboardLayout>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
    </ViewRoleProvider>
  );
}

/**
 * Role-based dashboard: renders the correct dashboard page based on viewRole.
 *
 * viewRole comes from ViewRoleContext (updated by RoleSwitcher in Sidebar).
 * This replaces the previous useAuth().getUserRole() pattern so that
 * switching roles via the RoleSwitcher changes the page without a reload.
 */
function RoleBasedDashboard() {
  const { viewRole } = useViewRole();

  if (viewRole === 'field_worker') return <FieldWorkerTicketsPage />;
  if (viewRole === 'saps_liaison') return <SAPSReportsPage />;

  // Phase 31 role-specific dashboards
  if (viewRole === 'cfo') return <CFODashboardPage />;
  if (viewRole === 'municipal_manager') return <MunicipalManagerDashboardPage />;
  if (viewRole === 'executive_mayor') return <MayorDashboardPage />;
  if (viewRole === 'audit_committee_member') return <OversightDashboardPage role="audit_committee" />;
  if (viewRole === 'internal_auditor') return <OversightDashboardPage role="internal_auditor" />;
  if (viewRole === 'mpac_member') return <OversightDashboardPage role="mpac" />;
  if (viewRole === 'ward_councillor') return <OversightDashboardPage role="councillor" />;
  if (viewRole === 'councillor') return <OversightDashboardPage role="councillor" />;
  if (viewRole === 'salga_admin') return <SALGAAdminDashboardPage />;
  if (viewRole === 'section56_director') return <Section56DirectorDashboardPage />;

  // Fallback: admin, manager, pms_officer, speaker, department_manager, chief_whip, citizen
  return <DashboardPage />;
}

const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
    background: 'var(--surface-base)',
  } as React.CSSProperties,
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--surface-higher)',
    borderTop: '4px solid var(--color-teal)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,
  placeholder: {
    padding: 'var(--space-2xl)',
    textAlign: 'center' as const,
    color: 'var(--text-secondary)',
    fontSize: '1.25rem',
  } as React.CSSProperties,
};

export default App;
