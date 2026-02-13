/**
 * Protected route wrapper for citizen-gated pages.
 *
 * Redirects unauthenticated users to /login with return URL preserved.
 * Auth gate happens once per session - after login, citizens navigate freely.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0A0E1A 0%, #1a1f35 100%)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(20, 184, 166, 0.2)',
            borderTop: '4px solid rgb(20, 184, 166)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    // Store return URL in both sessionStorage and React Router state
    // sessionStorage survives page refreshes, state is lost on refresh
    sessionStorage.setItem('returnUrl', location.pathname + location.search);

    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render protected content
  return <>{children}</>;
}
