import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LenisProvider } from './providers/LenisProvider';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { TransparencyDashboardPage } from './pages/TransparencyDashboardPage';
import { AboutPage } from './pages/AboutPage';
import { CitizenLoginPage } from './pages/CitizenLoginPage';
import { CitizenRegisterPage } from './pages/CitizenRegisterPage';
import { CitizenPortalPage } from './pages/CitizenPortalPage';
import { ReportIssuePage } from './pages/ReportIssuePage';
import { ProfilePage } from './pages/ProfilePage';
import { PublicHeader } from './components/layout/PublicHeader';
import { PublicFooter } from './components/layout/PublicFooter';
import '@shared/design-tokens.css';
import '@shared/animations.css';
import './App.css';

/**
 * ScrollToTop component - scrolls window to top on route change
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Public transparency dashboard with citizen authentication.
 *
 * Architecture:
 * - AuthProvider wraps entire app, providing session state via Supabase
 * - Public pages (/, /dashboard, /about) - NO authentication required
 * - Auth pages (/login, /register) - publicly accessible
 * - Protected pages (/my-reports, /report, /profile) - require citizen login via ProtectedRoute
 * - Header and Footer render on ALL pages (including auth pages)
 *
 * CRITICAL:
 * - NO FastAPI dependency for public pages
 * - Direct Supabase queries via anon key for public data
 * - GBV exclusion enforced by RLS views
 * - Dual-purpose Supabase client: anon queries + authenticated sessions
 */
function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <LenisProvider>
          <div className="App">
            <PublicHeader />
            <main>
              <Routes>
                {/* Public pages - always accessible */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<TransparencyDashboardPage />} />
                <Route path="/about" element={<AboutPage />} />

                {/* Auth pages - accessible without login */}
                <Route path="/login" element={<CitizenLoginPage />} />
                <Route path="/register" element={<CitizenRegisterPage />} />

                {/* Protected pages - require citizen login */}
                <Route path="/my-reports" element={
                  <ProtectedRoute><CitizenPortalPage /></ProtectedRoute>
                } />
                <Route path="/report" element={
                  <ProtectedRoute><ReportIssuePage /></ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute><ProfilePage /></ProtectedRoute>
                } />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <PublicFooter />
          </div>
        </LenisProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
