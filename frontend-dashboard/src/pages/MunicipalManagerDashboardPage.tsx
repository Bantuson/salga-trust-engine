/**
 * MunicipalManagerDashboardPage — role-specific dashboard for the Municipal Manager.
 *
 * Sections:
 * 1. Summary cards: Total Departments, Total KPIs, Overall Achievement %, Red Departments
 * 2. All-Department Performance Overview table
 *    - Sorted ascending by avg achievement (struggling departments at top)
 *    - Click row navigates to /pms?view=sdbip with department filter
 *
 * Data source: GET /api/v1/role-dashboards/municipal-manager
 * Decision: CSS variables, no Tailwind (Phase 27-03 lock)
 * Decision: Manual refresh button (no auto-polling)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchMMDashboard, fetchRiskRegister } from '../services/api';
import { mockMMDashboard, mockRiskRegister } from '../mocks/mockRoleDashboards';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';
import { TrafficLightBadge } from '../components/pms/TrafficLightBadge';

function achievementStatus(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function riskRatingColor(rating: string): string {
  switch (rating) {
    case 'critical': return 'var(--color-coral)';
    case 'high': return '#e67e22';
    case 'medium': return 'var(--color-gold)';
    case 'low': return 'var(--color-teal)';
    default: return 'var(--text-secondary)';
  }
}

export function MunicipalManagerDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskData, setRiskData] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMMDashboard(session.access_token);
      setData(result);
    } catch {
      // Rich mock fallback — show demo data when backend unavailable
      setData(mockMMDashboard);
    } finally {
      setLoading(false);
    }
    // Load risk register separately — non-blocking, falls back to mock
    try {
      const risks = await fetchRiskRegister(session.access_token);
      setRiskData(Array.isArray(risks) ? risks : []);
    } catch {
      setRiskData(mockRiskRegister);
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
          <h1 style={styles.title}>Municipal Manager Dashboard</h1>
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
            <Skeleton height={280} />
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
          <h1 style={styles.title}>Municipal Manager Dashboard</h1>
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

  const departments: any[] = data?.departments ?? [];

  // ---- Empty state ----
  if (departments.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Municipal Manager Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
        <GlassCard style={styles.emptyCard}>
          <p style={styles.emptyText}>
            No department data available. Ensure departments are configured and SDBIP scorecards
            have been created in the PMS Hub.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/pms')}>
            Go to PMS Hub
          </Button>
        </GlassCard>
      </div>
    );
  }

  // Sort ascending by avg_achievement_pct (struggling departments first)
  const sorted = [...departments].sort(
    (a, b) => Number(a.avg_achievement_pct ?? 0) - Number(b.avg_achievement_pct ?? 0)
  );

  // Compute summary metrics
  const totalKpis = departments.reduce((sum, d) => sum + (d.kpi_count ?? 0), 0);
  const overallPct =
    departments.length > 0
      ? departments.reduce((sum, d) => sum + Number(d.avg_achievement_pct ?? 0), 0) /
        departments.length
      : 0;
  const redDepts = departments.filter((d) => Number(d.avg_achievement_pct ?? 0) < 50).length;

  return (
    <div style={styles.container}>
      {/* Page header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Municipal Manager Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={loadData}>
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <GlassCard style={styles.summaryCard}>
          <div style={styles.summaryValue}>{departments.length}</div>
          <div style={styles.summaryLabel}>Total Departments</div>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <div style={styles.summaryValue}>{totalKpis}</div>
          <div style={styles.summaryLabel}>Total KPIs</div>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <div style={{ ...styles.summaryValue, color: overallPct >= 80 ? 'var(--color-teal)' : overallPct >= 50 ? 'var(--color-gold)' : 'var(--color-coral)' }}>
            {overallPct.toFixed(1)}%
          </div>
          <div style={styles.summaryLabel}>Overall Achievement</div>
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: redDepts > 0 ? 'var(--color-coral)44' : undefined }}>
          <div style={{ ...styles.summaryValue, color: redDepts > 0 ? 'var(--color-coral)' : 'var(--text-primary)' }}>
            {redDepts}
          </div>
          <div style={styles.summaryLabel}>Departments Needing Attention</div>
        </GlassCard>
      </div>

      {/* All-Department Performance Table */}
      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>All-Department Performance Overview</h2>
        <p style={styles.sectionNote}>
          Sorted by average achievement (lowest first) — departments needing attention appear at top.
        </p>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Department Name</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>KPIs</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Green</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Amber</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Red</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Avg Achievement</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((dept: any, idx: number) => {
                const pct = Number(dept.avg_achievement_pct ?? 0);
                const status = achievementStatus(pct);
                const cellBg =
                  status === 'green'
                    ? 'rgba(0,191,165,0.15)'
                    : status === 'amber'
                    ? 'rgba(255,213,79,0.15)'
                    : 'rgba(249,115,22,0.15)';
                return (
                  <tr
                    key={idx}
                    style={styles.tr}
                    onClick={() =>
                      navigate(
                        dept.scorecard_id
                          ? `/pms/sdbip/${dept.scorecard_id}/kpis${dept.dept_id ? `?dept=${dept.dept_id}` : ''}`
                          : '/pms?view=sdbip'
                      )
                    }
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        'rgba(255,255,255,0.05)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                    }}
                  >
                    <td style={styles.td}>{dept.department_name}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{dept.kpi_count ?? 0}</td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--color-teal)' }}>
                      {dept.green ?? 0}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--color-gold)' }}>
                      {dept.amber ?? 0}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--color-coral)' }}>
                      {dept.red ?? 0}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', background: cellBg }}>
                      <TrafficLightBadge status={status} pct={pct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Risk Register Section */}
      {!loading && (
        <GlassCard style={styles.tableCard}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Risk Register
          </h2>
          {riskData.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
              No risk items registered. Risks are auto-flagged when KPIs turn red.
            </p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Risk</th>
                    <th style={styles.th}>Rating</th>
                    <th style={styles.th}>L x I</th>
                    <th style={styles.th}>Auto-Flagged</th>
                    <th style={styles.th}>Mitigations</th>
                  </tr>
                </thead>
                <tbody>
                  {riskData.map((item: any) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          {item.description?.slice(0, 80)}{item.description?.length > 80 ? '...' : ''}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          color: '#fff',
                          backgroundColor: riskRatingColor(item.risk_rating),
                        }}>
                          {item.risk_rating}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {item.likelihood} x {item.impact}
                      </td>
                      <td style={styles.td}>
                        {item.is_auto_flagged ? (
                          <span style={{ color: 'var(--color-coral)', fontWeight: 600 }}>Yes</span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>No</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {item.mitigations?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      )}
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
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '0.25rem',
  },
  sectionNote: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-body)',
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
  emptyCard: {
    padding: 'var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'center',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    maxWidth: '480px',
    lineHeight: 1.6,
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
