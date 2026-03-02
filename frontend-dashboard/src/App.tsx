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

/**
 * MunicipalitiesPlaceholderPage — mock municipalities list for SALGA Admin.
 * Shows realistic municipality data. Full implementation deferred to Phase 32+.
 */
function MunicipalitiesPlaceholderPage() {
  const municipalities = [
    { name: 'eThekwini Metropolitan', province: 'KwaZulu-Natal', category: 'A', status: 'Active', population: '3.9M' },
    { name: 'City of Tshwane', province: 'Gauteng', category: 'A', status: 'Active', population: '3.3M' },
    { name: 'Mangaung Metropolitan', province: 'Free State', category: 'A', status: 'Active', population: '787K' },
    { name: 'Nelson Mandela Bay', province: 'Eastern Cape', category: 'A', status: 'Active', population: '1.3M' },
    { name: 'Buffalo City Metropolitan', province: 'Eastern Cape', category: 'A', status: 'Active', population: '834K' },
    { name: 'Sol Plaatje Local', province: 'Northern Cape', category: 'B', status: 'Onboarding', population: '255K' },
  ];

  return (
    <div style={{ padding: 'var(--space-lg)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-lg)' }}>
        Municipalities
      </h1>
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              {['Municipality', 'Province', 'Category', 'Status', 'Population'].map(h => (
                <th key={h} style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  textAlign: 'left' as const,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {municipalities.map((m, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid var(--glass-border)',
                cursor: 'pointer',
              }}>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)' }}>{m.province}</td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)' }}>{m.category}</td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    background: m.status === 'Active' ? 'rgba(45, 212, 191, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                    color: m.status === 'Active' ? 'var(--color-teal)' : 'var(--color-gold)',
                    border: `1px solid ${m.status === 'Active' ? 'rgba(45, 212, 191, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
                  }}>{m.status}</span>
                </td>
                <td style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--text-secondary)' }}>{m.population}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        Showing {municipalities.length} onboarded municipalities. Full management interface available in a future release.
      </p>
    </div>
  );
}

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

  return (
    <div style={{ padding: 'var(--space-lg)' }}>
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-lg)' }}>
        System Health
      </h1>
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
        <Route path="/municipalities" element={<DashboardLayout><MunicipalitiesPlaceholderPage /></DashboardLayout>} />
        <Route path="/teams" element={<DashboardLayout><TeamsPage /></DashboardLayout>} />
        <Route path="/analytics" element={<DashboardLayout><AnalyticsPage /></DashboardLayout>} />
        <Route path="/settings" element={<DashboardLayout><SettingsPage /></DashboardLayout>} />
        <Route path="/system" element={<DashboardLayout><SystemPlaceholderPage /></DashboardLayout>} />
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
