/**
 * Main App component with authentication routing.
 *
 * Enforces authentication for all dashboard pages.
 * Uses hash-based routing for simplicity.
 * Wrapped in LenisProvider for smooth scroll.
 * PageTransition provides coral/navy gradient overlay sweep on route changes.
 */

import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { ReportForm } from './components/ReportForm';
import { LenisProvider } from './providers/LenisProvider';
import { PageTransition } from './components/PageTransition';
import '@shared/design-tokens.css';
import '@shared/animations.css';
import './App.css';

function App() {
  const { session, user, loading, signOut, getUserRole } = useAuth();
  const [currentPage, setCurrentPage] = useState(window.location.hash || '#dashboard');

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(window.location.hash || '#dashboard');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const role = getUserRole();

  return (
    <LenisProvider>
      <div className="App">
        <nav style={styles.nav}>
          <div style={styles.navLeft}>
            <span style={styles.logo}>SALGA Trust Engine</span>
            <a
              href="#dashboard"
              className={currentPage === '#dashboard' ? 'active' : ''}
              style={styles.navLink}
            >
              Dashboard
            </a>
            <a
              href="#tickets"
              className={currentPage === '#tickets' ? 'active' : ''}
              style={styles.navLink}
            >
              Tickets
            </a>
            <a
              href="#report"
              className={currentPage === '#report' ? 'active' : ''}
              style={styles.navLink}
            >
              Report Issue
            </a>
          </div>
          <div style={styles.navRight}>
            <span style={styles.userInfo}>
              {user?.email || user?.phone} ({role})
            </span>
            <button
              onClick={() => signOut()}
              style={styles.logoutButton}
            >
              Logout
            </button>
          </div>
        </nav>

        <PageTransition routeKey={currentPage}>
          <main style={styles.main}>
            {currentPage === '#dashboard' && <DashboardPage />}
            {currentPage === '#tickets' && <TicketListPage />}
            {currentPage === '#report' && <ReportForm />}
            {!['#dashboard', '#tickets', '#report'].includes(currentPage) && <DashboardPage />}
          </main>
        </PageTransition>
      </div>
    </LenisProvider>
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
  nav: {
    // Styles are in App.css
  } as React.CSSProperties,
  navLeft: {
    display: 'flex',
    gap: '2rem',
    alignItems: 'center',
  } as React.CSSProperties,
  navRight: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  } as React.CSSProperties,
  logo: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  navLink: {
    // Styles are in App.css
  } as React.CSSProperties,
  userInfo: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--color-coral)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  } as React.CSSProperties,
  main: {
    minHeight: 'calc(100vh - 60px)',
    padding: 'var(--space-2xl)',
  } as React.CSSProperties,
};

export default App;
