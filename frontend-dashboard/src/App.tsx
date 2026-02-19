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
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { RequestAccessPage } from './pages/RequestAccessPage';
import { OnboardingWizardPage } from './pages/OnboardingWizardPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { TeamsPage } from './pages/TeamsPage';
import { ReportForm } from './components/ReportForm';
import { DashboardLayout } from './components/layout/DashboardLayout';
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
    <PageTransition routeKey={location.pathname}>
      <Routes>
        {/* Onboarding wizard (full-screen, no layout) */}
        <Route path="/onboarding" element={<OnboardingWizardPage />} />

        {/* Dashboard routes (wrapped in DashboardLayout) */}
        <Route path="/" element={<DashboardLayout><DashboardPage /></DashboardLayout>} />
        <Route path="/tickets" element={<DashboardLayout><TicketListPage /></DashboardLayout>} />
        <Route path="/report" element={<DashboardLayout><ReportForm /></DashboardLayout>} />
        <Route path="/municipalities" element={<DashboardLayout><div style={styles.placeholder}>Municipalities (Coming Soon)</div></DashboardLayout>} />
        <Route path="/teams" element={<DashboardLayout><TeamsPage /></DashboardLayout>} />
        <Route path="/analytics" element={<DashboardLayout><div style={styles.placeholder}>Analytics (Coming Soon)</div></DashboardLayout>} />
        <Route path="/settings" element={<DashboardLayout><div style={styles.placeholder}>Settings (Coming Soon)</div></DashboardLayout>} />
        <Route path="/system" element={<DashboardLayout><div style={styles.placeholder}>System (Coming Soon)</div></DashboardLayout>} />
        <Route path="/reports" element={<DashboardLayout><div style={styles.placeholder}>Reports (Coming Soon)</div></DashboardLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PageTransition>
  );
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
