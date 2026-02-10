import { useState, useEffect } from 'react';
import './App.css';
import { DashboardPage } from './pages/DashboardPage';
import { TicketListPage } from './pages/TicketListPage';
import { ReportForm } from './components/ReportForm';
import { PublicDashboardPage } from './pages/PublicDashboardPage';

function App() {
  const [currentPage, setCurrentPage] = useState(window.location.hash || '#dashboard');

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(window.location.hash || '#dashboard');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="App">
      <nav style={styles.nav}>
        <a
          href="#public"
          style={{
            ...styles.navLink,
            fontWeight: currentPage === '#public' ? 'bold' : 'normal',
          }}
        >
          Public Dashboard
        </a>
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
      </nav>

      <main style={styles.main}>
        {currentPage === '#public' && <PublicDashboardPage />}
        {currentPage === '#dashboard' && <DashboardPage />}
        {currentPage === '#tickets' && <TicketListPage />}
        {currentPage === '#report' && <ReportForm />}
        {!['#public', '#dashboard', '#tickets', '#report'].includes(currentPage) && <PublicDashboardPage />}
      </main>
    </div>
  );
}

const styles = {
  nav: {
    padding: '1rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    gap: '1rem',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,
  navLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  main: {
    minHeight: 'calc(100vh - 60px)',
  } as React.CSSProperties,
};

export default App;
