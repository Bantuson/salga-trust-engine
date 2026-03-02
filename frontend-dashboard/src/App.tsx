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
import { LenisProvider } from './providers/LenisProvider';
import { PageTransition } from './components/PageTransition';
import '@shared/design-tokens.css';
import '@shared/animations.css';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <LenisProvider>
        <AppRoutes />
      </LenisProvider>
    </BrowserRouter>
  );
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

        {/* Dashboard routes (wrapped in DashboardLayout) */}
        <Route path="/" element={<DashboardLayout><RoleBasedDashboard /></DashboardLayout>} />
        <Route path="/tickets" element={<DashboardLayout><TicketListPage /></DashboardLayout>} />
        <Route path="/report" element={<DashboardLayout><ReportForm /></DashboardLayout>} />
        <Route path="/departments/organogram" element={<DashboardLayout><OrganogramPage /></DashboardLayout>} />
        <Route path="/municipalities" element={<DashboardLayout><div style={styles.placeholder}>Municipalities (Coming Soon)</div></DashboardLayout>} />
        <Route path="/teams" element={<DashboardLayout><TeamsPage /></DashboardLayout>} />
        <Route path="/analytics" element={<DashboardLayout><AnalyticsPage /></DashboardLayout>} />
        <Route path="/settings" element={<DashboardLayout><SettingsPage /></DashboardLayout>} />
        <Route path="/system" element={<DashboardLayout><div style={styles.placeholder}>System (Coming Soon)</div></DashboardLayout>} />
        <Route path="/reports" element={<DashboardLayout><SAPSReportsPage /></DashboardLayout>} />
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
