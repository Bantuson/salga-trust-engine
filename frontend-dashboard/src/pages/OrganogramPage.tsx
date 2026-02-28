/**
 * OrganogramPage -- standalone page for viewing the department organogram.
 *
 * Route: /departments/organogram
 *
 * Fetches the organogram tree from GET /api/v1/departments/organogram and
 * renders it inside OrganogramTree. Wrapped in DashboardLayout via App.tsx.
 *
 * Accessibility:
 * - Page has a descriptive heading (h1) for screen reader navigation.
 * - Loading and error states are announced via aria-live region.
 * - OrganogramTree nodes are interactive (click to collapse/expand).
 *
 * Styling: CSS variables from @shared/design-tokens.css (no Tailwind).
 */

import { useEffect, useState, useCallback } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { useAuth } from '../hooks/useAuth';
import { OrganogramTree } from '../components/organogram/OrganogramTree';
import type { OrgNode } from '../components/organogram/OrganogramTree';

export function OrganogramPage() {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<OrgNode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganogram = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const response = await fetch('/api/v1/departments/organogram', {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(typeof body.detail === 'string' ? body.detail : 'Failed to load organogram');
      }

      const orgData = await response.json();

      // Transform API response to OrgNode shape matching OrganogramTree
      function toOrgNode(node: {
        name: string;
        director_name?: string | null;
        director_role?: string | null;
        children?: unknown[];
      }): OrgNode {
        return {
          name: node.name,
          attributes: {
            ...(node.director_name ? { director: node.director_name } : {}),
            ...(node.director_role ? { role: node.director_role } : {}),
          },
          children: node.children
            ? (node.children as Parameters<typeof toOrgNode>[0][]).map(toOrgNode)
            : [],
        };
      }

      const roots = Array.isArray(orgData) ? orgData : [orgData];
      const rootNode: OrgNode =
        roots.length === 1
          ? toOrgNode(roots[0])
          : {
              name: 'Municipality',
              attributes: {},
              children: roots.map(toOrgNode),
            };

      setData(rootNode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organogram');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchOrganogram();
  }, [fetchOrganogram]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Department Organogram</h1>
        <p style={styles.subtitle}>
          Interactive view of your municipality's department hierarchy and director assignments.
        </p>
      </header>

      <GlassCard style={styles.card}>
        <div aria-live="polite">
          {isLoading && (
            <div style={styles.statusBox}>
              <div style={styles.spinner} />
              <span style={styles.statusText}>Loading organogram...</span>
            </div>
          )}

          {error && !isLoading && (
            <div style={styles.errorBox}>
              <p style={styles.errorText}>{error}</p>
              <button onClick={fetchOrganogram} style={styles.retryButton}>
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && !data && (
            <div style={styles.statusBox}>
              <span style={styles.statusText}>
                No departments found. Set up departments via the PMS Setup wizard.
              </span>
            </div>
          )}
        </div>

        {!isLoading && !error && data && (
          <OrganogramTree data={data} />
        )}
      </GlassCard>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  },
  header: {
    marginBottom: 'var(--space-xl)',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    margin: '0 0 8px 0',
    fontFamily: 'var(--font-display)',
  },
  subtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 'var(--leading-relaxed)',
  },
  card: {
    padding: 'var(--space-lg)',
  },
  statusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-md)',
    minHeight: '300px',
  },
  statusText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--surface-higher)',
    borderTop: '3px solid var(--color-teal)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-md)',
    minHeight: '300px',
    padding: 'var(--space-xl)',
  },
  errorText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-coral)',
    textAlign: 'center',
    margin: 0,
  },
  retryButton: {
    padding: '8px 20px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--color-teal)',
    background: 'rgba(0, 191, 165, 0.1)',
    border: '1px solid rgba(0, 191, 165, 0.25)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
};
