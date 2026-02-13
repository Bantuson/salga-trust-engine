/**
 * Authentication hook re-export.
 *
 * This is a thin wrapper that re-exports useAuth from AuthContext,
 * allowing components to import from hooks/ (consistent with dashboard pattern)
 * while the implementation lives in contexts/.
 */

export { useAuth } from '../contexts/AuthContext';
