import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LenisProvider } from './providers/LenisProvider';
import { LandingPage } from './pages/LandingPage';
import { TransparencyDashboardPage } from './pages/TransparencyDashboardPage';
import { ReportRedirectPage } from './pages/ReportRedirectPage';
import { AboutPage } from './pages/AboutPage';
import { PublicHeader } from './components/layout/PublicHeader';
import { PublicFooter } from './components/layout/PublicFooter';
import '@shared/design-tokens.css';
import '@shared/animations.css';
import './App.css';

/**
 * Public transparency dashboard - 4-page application with React Router.
 *
 * CRITICAL:
 * - NO authentication
 * - NO FastAPI dependency
 * - Direct Supabase queries via anon key
 * - GBV exclusion enforced by RLS views
 */
function App() {
  return (
    <BrowserRouter>
      <LenisProvider>
        <div className="App">
          <PublicHeader />
          <main>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<TransparencyDashboardPage />} />
              <Route path="/report" element={<ReportRedirectPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <PublicFooter />
        </div>
      </LenisProvider>
    </BrowserRouter>
  );
}

export default App;
