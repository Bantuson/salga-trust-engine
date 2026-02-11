import { PublicDashboardPage } from './pages/PublicDashboardPage';

/**
 * Public transparency dashboard - single-page app (no routing).
 *
 * CRITICAL:
 * - NO authentication
 * - NO FastAPI dependency
 * - Direct Supabase queries via anon key
 * - GBV exclusion enforced by RLS views
 */
function App() {
  return <PublicDashboardPage />;
}

export default App;
