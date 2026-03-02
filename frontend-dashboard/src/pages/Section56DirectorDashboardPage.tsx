/**
 * Section56DirectorDashboardPage — Section 56 Director department-scoped KPI dashboard.
 *
 * Sections:
 * 1. Page header: "{Department Name} — Director Dashboard" + Refresh button
 * 2. Empty state (when no department assigned): full-page centered message with PMS Hub link
 * 3. Traffic Light Summary cards: Green | Amber | Red | Overall Achievement %
 * 4. KPI Detail Table: sorted by achievement ascending (worst-performing KPIs first)
 * 5. Action Links: Upload Evidence, Submit Quarterly Actuals, View Full PMS Hub
 *
 * Data source: GET /api/v1/role-dashboards/section56-director
 * Decision: CSS variables, no Tailwind (Phase 27-03 lock)
 * Decision: View-only dashboard + PMS Hub for edits (locked)
 * Decision: Click KPI row navigates to /pms/kpis/{kpiId}/actuals (drill-down)
 * Decision: Empty state replaces normal content entirely (not a banner)
 * Requirement: DASH-12
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchSection56DirectorDashboard } from '../services/api';
import { mockSection56Dashboard } from '../mocks/mockRoleDashboards';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';
import { TrafficLightBadge } from '../components/pms/TrafficLightBadge';

// Helper: derive traffic light status from achievement percentage
function achievementStatus(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

// Simple building/org SVG icon for empty state
function BuildingIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}
    >
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </svg>
  );
}

export function Section56DirectorDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSection56DirectorDashboard(session.access_token);
      setData(result);
    } catch {
      // Rich mock fallback — show demo data when backend unavailable
      setData(mockSection56Dashboard);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Director Dashboard</h1>
        </div>
        <SkeletonTheme>
          <div style={styles.summaryGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={styles.skeletonCard}>
                <Skeleton height={24} width="60%" style={{ marginBottom: '0.5rem' }} />
                <Skeleton height={48} width="40%" />
              </div>
            ))}
          </div>
          <div style={styles.skeletonTable}>
            <Skeleton height={24} width="40%" style={{ marginBottom: '1rem' }} />
            <Skeleton height={240} />
          </div>
        </SkeletonTheme>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Director Dashboard</h1>
        </div>
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={loadData} style={{ marginLeft: '1rem' }}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ---- Empty state (no department assigned) ----
  if (data?.empty_state) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Director Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
        <div style={styles.emptyStateWrapper}>
          <BuildingIcon />
          <h2 style={styles.emptyStateTitle}>No Department Assigned</h2>
          <p style={styles.emptyStateMessage}>
            {data.message ||
              'No department assigned to your account. Contact your administrator to assign you as a department director.'}
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/pms')}>
            Go to PMS Hub
          </Button>
        </div>
      </div>
    );
  }

  // ---- Normal content ----
  const departmentName: string = data?.department_name ?? 'Department';
  const kpiCount: number = data?.kpi_count ?? 0;
  const greenCount: number = data?.green_count ?? 0;
  const amberCount: number = data?.amber_count ?? 0;
  const redCount: number = data?.red_count ?? 0;
  const totalAchievementPct: number = Number(data?.total_achievement_pct ?? 0);

  // Sort KPI details by achievement ascending (worst-performing first)
  const kpiDetails: any[] = [...(data?.kpi_details ?? [])].sort(
    (a: any, b: any) => Number(a.achievement_pct ?? 0) - Number(b.achievement_pct ?? 0)
  );

  return (
    <div style={styles.container}>
      {/* Page header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{departmentName} — Director Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={loadData}>
          Refresh
        </Button>
      </div>

      {/* Traffic Light Summary Cards */}
      <div style={styles.summaryGrid}>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'var(--color-teal)44' }}>
          <div style={{ ...styles.summaryValue, color: 'var(--color-teal)' }}>{greenCount}</div>
          <div style={styles.summaryLabel}>On Track (&#x2265;80%)</div>
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'var(--color-gold)44' }}>
          <div style={{ ...styles.summaryValue, color: 'var(--color-gold)' }}>{amberCount}</div>
          <div style={styles.summaryLabel}>Needs Attention (50-79%)</div>
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'var(--color-coral)44' }}>
          <div style={{ ...styles.summaryValue, color: 'var(--color-coral)' }}>{redCount}</div>
          <div style={styles.summaryLabel}>At Risk (&lt;50%)</div>
        </GlassCard>
        <GlassCard
          style={{
            ...styles.summaryCard,
            borderColor: `${totalAchievementPct >= 80 ? 'var(--color-teal)' : totalAchievementPct >= 50 ? 'var(--color-gold)' : 'var(--color-coral)'}44`,
          }}
        >
          <div
            style={{
              ...styles.summaryValue,
              color:
                totalAchievementPct >= 80
                  ? 'var(--color-teal)'
                  : totalAchievementPct >= 50
                  ? 'var(--color-gold)'
                  : 'var(--color-coral)',
            }}
          >
            {totalAchievementPct.toFixed(1)}%
          </div>
          <div style={styles.summaryLabel}>
            Overall Achievement ({kpiCount} KPI{kpiCount !== 1 ? 's' : ''})
          </div>
        </GlassCard>
      </div>

      {/* KPI Detail Table */}
      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Departmental KPIs</h2>
        {kpiDetails.length === 0 ? (
          <p style={styles.emptyTableText}>
            No KPI data available for this department. Add KPIs in the PMS Hub.
          </p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>KPI Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Annual Target</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Latest Actual</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Achievement %</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Quarter</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {kpiDetails.map((kpi: any, idx: number) => {
                  const pct = Number(kpi.achievement_pct ?? 0);
                  const status = (kpi.traffic_light as 'green' | 'amber' | 'red') ??
                    achievementStatus(pct);
                  return (
                    <tr
                      key={kpi.kpi_id ?? idx}
                      style={styles.tr}
                      onClick={() => navigate(`/pms/kpis/${kpi.kpi_id}/actuals`)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      <td style={{ ...styles.td, maxWidth: '320px' }}>
                        <span style={styles.kpiDescription}>{kpi.description ?? '—'}</span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {kpi.annual_target !== null && kpi.annual_target !== undefined
                          ? Number(kpi.annual_target).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {kpi.latest_actual !== null && kpi.latest_actual !== undefined
                          ? Number(kpi.latest_actual).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <TrafficLightBadge status={status} pct={pct} />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {kpi.quarter ?? '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <TrafficLightBadge status={status} pct={pct} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Action Links */}
      <GlassCard style={styles.actionCard}>
        <h2 style={styles.sectionTitle}>Actions</h2>
        <div style={styles.actionLinks}>
          <Button variant="ghost" size="sm" onClick={() => navigate('/pms?view=evidence')}>
            Upload Evidence
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/pms?view=actuals')}>
            Submit Quarterly Actuals
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/pms')}>
            View Full PMS Hub
          </Button>
        </div>
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '48px',
    padding: 'var(--space-md) 0',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: 'var(--space-lg)',
  },
  summaryValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    fontFamily: 'var(--font-display)',
    color: 'var(--text-primary)',
    lineHeight: 1,
  },
  summaryLabel: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
  tableCard: {
    marginBottom: '1.5rem',
    padding: 'var(--space-lg)',
  },
  actionCard: {
    marginBottom: '1.5rem',
    padding: 'var(--space-lg)',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '1rem',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
  },
  th: {
    padding: '0.75rem 1rem',
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.75rem 1rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  kpiDescription: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: 1.4,
  } as React.CSSProperties,
  emptyTableText: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    padding: '1rem 0',
  },
  actionLinks: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  emptyStateWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5rem 2rem',
    textAlign: 'center',
  },
  emptyStateTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '0.75rem',
  },
  emptyStateMessage: {
    fontSize: 'var(--text-base)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    maxWidth: '480px',
    lineHeight: 1.6,
    marginBottom: '1.5rem',
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1.25rem',
    color: 'var(--color-coral)',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
  },
  skeletonCard: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-lg)',
  },
  skeletonTable: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-lg)',
    marginBottom: '1.5rem',
  },
};
