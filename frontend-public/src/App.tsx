import { LenisProvider } from './providers/LenisProvider';
import { LandingPage } from './pages/LandingPage';
import { PublicDashboardPage } from './pages/PublicDashboardPage';
import '@shared/design-tokens.css';
import '@shared/animations.css';
import './App.css';

/**
 * Public transparency dashboard - scroll storytelling landing + live dashboard.
 *
 * CRITICAL:
 * - NO authentication
 * - NO FastAPI dependency
 * - Direct Supabase queries via anon key
 * - GBV exclusion enforced by RLS views
 */
function App() {
  return (
    <LenisProvider>
      <div className="App">
        <LandingPage />
        <section id="dashboard" className="dashboard-section">
          <PublicDashboardPage />
        </section>
        <footer className="site-footer">
          <p>SALGA Trust Engine — Transparent municipal service delivery</p>
          <p className="privacy-notice">
            GBV and sensitive reports are excluded from all public statistics.
          </p>
        </footer>
      </div>
    </LenisProvider>
  );
}

export default App;
