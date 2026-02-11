/**
 * Main App component with authentication routing.
 *
 * Enforces authentication for all dashboard pages.
 * Uses hash-based routing for simplicity.
 */

import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { ReportForm } from './components/ReportForm';
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
    <div className="App">
      <nav style={styles.nav}>
        <div style={styles.navLeft}>
          <span style={styles.logo}>SALGA Trust Engine</span>
          <a
            href="#dashboard"
            style={{
              ...styles.navLink,
              fontWeight: currentPage === '#dashboard' ? 'bold' : 'normal',
            }}
          >
            Dashboard
          </a>
          <a
            href="#tickets"
            style={{
              ...styles.navLink,
              fontWeight: currentPage === '#tickets' ? 'bold' : 'normal',
            }}
          >
            Tickets
          </a>
          <a
            href="#report"
            style={{
              ...styles.navLink,
              fontWeight: currentPage === '#report' ? 'bold' : 'normal',
            }}
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

      <main style={styles.main}>
        {currentPage === '#dashboard' && <DashboardPage />}
        {currentPage === '#tickets' && <TicketListPage />}
        {currentPage === '#report' && <ReportForm />}
        {!['#dashboard', '#tickets', '#report'].includes(currentPage) && <DashboardPage />}
      </main>
    </div>
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
  } as React.CSSProperties,
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f4f6',
    borderTop: '4px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,
  nav: {
    padding: '1rem 2rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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
    color: '#111827',
  } as React.CSSProperties,
  navLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  userInfo: {
    fontSize: '0.875rem',
    color: '#6b7280',
  } as React.CSSProperties,
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  } as React.CSSProperties,
  main: {
    minHeight: 'calc(100vh - 60px)',
  } as React.CSSProperties,
};

export default App;
