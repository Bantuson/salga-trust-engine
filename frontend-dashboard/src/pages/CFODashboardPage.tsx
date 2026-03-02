/**
 * CFODashboardPage — role-specific dashboard for the Chief Financial Officer.
 *
 * Sections:
 * 1. Variance Alerts banner (conditional — only when budget_execution has outliers)
 * 2. SDBIP Achievement Summary (4 KPI cards: total, green, amber, red)
 * 3. Budget Execution Table (performance by vote — proxy for expenditure)
 * 4. Service Delivery Correlation Table (KPI achievement vs ticket resolution)
 * 5. Statutory Reporting Calendar (sorted deadline list)
 *
 * Data source: GET /api/v1/role-dashboards/cfo
 * Decision: CSS variables, no Tailwind (Phase 27-03 lock)
 * Decision: Manual refresh button (no auto-polling on this page)
 * Decision: Click row in budget table navigates to /pms?view=sdbip (drill-down)
 * Decision: Click row in statutory table navigates to /pms?view=statutory-reports
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchCFODashboard, fetchRiskRegister } from '../services/api';
import { mockCFODashboard, mockRiskRegister } from '../mocks/mockRoleDashboards';
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

// Helper: color for status badge text/background
function statusColor(status: string): string {
  if (status === 'submitted' || status === 'tabled') return 'var(--color-teal)';
  if (status === 'in_progress' || status === 'in progress') return 'var(--color-gold)';
  return 'var(--color-coral)';
}

// Helper: background color for risk rating badge
function riskRatingColor(rating: string): string {
  switch (rating) {
    case 'critical': return 'var(--color-coral)';
    case 'high': return '#e67e22';
    case 'medium': return 'var(--color-gold)';
    case 'low': return 'var(--color-teal)';
    default: return 'var(--text-secondary)';
  }
}

export function CFODashboardPage() {
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
      const result = await fetchCFODashboard(session.access_token);
      setData(result);
    } catch {
      // Rich mock fallback — show demo data when backend unavailable
      setData(mockCFODashboard);
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
          <h1 style={styles.title}>CFO Dashboard</h1>
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
            <Skeleton height={200} />
          </div>
          <div style={styles.skeletonTable}>
            <Skeleton height={24} width="40%" style={{ marginBottom: '1rem' }} />
            <Skeleton height={160} />
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
          <h1 style={styles.title}>CFO Dashboard</h1>
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

  // ---- Empty state ----
  const hasData =
    data &&
    ((data.budget_execution && data.budget_execution.length > 0) ||
      (data.sdbip_achievement_summary && data.sdbip_achievement_summary.total > 0));

  if (!hasData) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>CFO Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
        <GlassCard style={styles.emptyCard}>
          <p style={styles.emptyText}>
            No SDBIP data available. Create your first SDBIP scorecard in the PMS Hub to begin
            tracking budget execution and service delivery performance.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/pms')}>
            Go to PMS Hub
          </Button>
        </GlassCard>
      </div>
    );
  }

  const summary = data.sdbip_achievement_summary || {};
  const budgetVotes = data.budget_execution || [];
  const correlation = data.service_delivery_correlation || [];
  const deadlines = data.statutory_deadlines || [];
  const varianceAlerts = (data.budget_execution || []).filter((v: any) => v.variance_alert);

  return (
    <div style={styles.container}>
      {/* Page header */}
      <div style={styles.header}>
        <h1 style={styles.title}>CFO Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={loadData}>
          Refresh
        </Button>
      </div>

      {/* Variance Alerts Banner */}
      {varianceAlerts.length > 0 && (
        <div style={styles.varianceBanner}>
          <strong>Variance Alert</strong>
          {varianceAlerts.map((alert: any, idx: number) => (
            <span key={idx} style={{ marginLeft: '0.5rem' }}>
              {alert.vote_name} at {Number(alert.achievement_pct).toFixed(1)}% — exceeds pace
              threshold{idx < varianceAlerts.length - 1 ? ';' : ''}
            </span>
          ))}
        </div>
      )}

      {/* SDBIP Achievement Summary Cards */}
      <div style={styles.summaryGrid}>
        <GlassCard style={styles.summaryCard}>
          <div style={styles.summaryValue}>{summary.total ?? 0}</div>
          <div style={styles.summaryLabel}>Total KPIs</div>
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'var(--color-teal)44' }}>
          <div style={{ ...styles.summaryValue, color: 'var(--color-teal)' }}>
            {summary.green ?? 0}
          </div>
          <div style={styles.summaryLabel}>On Track (≥80%)</div>
          <TrafficLightBadge status="green" pct={summary.total > 0 ? (summary.green / summary.total) * 100 : 0} />
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'var(--color-gold)44' }}>
          <div style={{ ...styles.summaryValue, color: 'var(--color-gold)' }}>
            {summary.amber ?? 0}
          </div>
          <div style={styles.summaryLabel}>At Risk (50–79%)</div>
          <TrafficLightBadge status="amber" pct={summary.total > 0 ? (summary.amber / summary.total) * 100 : 0} />
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'var(--color-coral)44' }}>
          <div style={{ ...styles.summaryValue, color: 'var(--color-coral)' }}>
            {summary.red ?? 0}
          </div>
          <div style={styles.summaryLabel}>Off Track (&lt;50%)</div>
          <TrafficLightBadge status="red" pct={summary.total > 0 ? (summary.red / summary.total) * 100 : 0} />
        </GlassCard>
      </div>

      {/* Budget Execution Table */}
      {budgetVotes.length > 0 && (
        <GlassCard style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Performance by Vote (Annual Target vs Year-to-Date Actual)</h2>
          <p style={styles.sectionNote}>
            Performance proxy — connect financial system for actual expenditure data.
          </p>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Vote Name</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Annual Target</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>YTD Actual</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Achievement %</th>
                  <th style={{ ...styles.th, minWidth: '120px' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {budgetVotes.map((vote: any, idx: number) => {
                  const pct = Number(vote.achievement_pct ?? 0);
                  const status = achievementStatus(pct);
                  const barColor =
                    status === 'green'
                      ? 'var(--color-teal)'
                      : status === 'amber'
                      ? 'var(--color-gold)'
                      : 'var(--color-coral)';
                  return (
                    <tr
                      key={idx}
                      style={styles.tr}
                      onClick={() => navigate('/pms?view=sdbip')}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      <td style={styles.td}>{vote.vote_name}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {Number(vote.annual_target ?? 0).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {Number(vote.ytd_actual ?? 0).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <TrafficLightBadge status={status} pct={pct} />
                      </td>
                      <td style={styles.td}>
                        <div style={styles.progressTrack}>
                          <div
                            style={{
                              ...styles.progressBar,
                              width: `${Math.min(pct, 100)}%`,
                              background: barColor,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Service Delivery Correlation Table */}
      {correlation.length > 0 && (
        <GlassCard style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Service Delivery Correlation</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>KPI Name</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>KPI Achievement %</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Tickets Resolved</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Resolution Rate %</th>
                </tr>
              </thead>
              <tbody>
                {correlation.map((row: any, idx: number) => {
                  const kpiPct = Number(row.kpi_achievement_pct ?? 0);
                  const resPct = Number(row.resolution_rate_pct ?? 0);
                  return (
                    <tr key={idx} style={styles.tr}>
                      <td style={styles.td}>{row.kpi_name}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <TrafficLightBadge status={achievementStatus(kpiPct)} pct={kpiPct} />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {Number(row.tickets_resolved ?? 0).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {resPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Statutory Reporting Calendar */}
      {deadlines.length > 0 && (
        <GlassCard style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Statutory Reporting Calendar</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Due Date</th>
                  <th style={styles.th}>Report Type</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {deadlines.map((deadline: any, idx: number) => {
                  const color = statusColor(deadline.status ?? '');
                  return (
                    <tr
                      key={idx}
                      style={{ ...styles.tr, cursor: 'pointer' }}
                      onClick={() => navigate('/pms?view=statutory-reports')}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          'rgba(255,255,255,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                      }}
                    >
                      <td style={styles.td}>
                        {deadline.due_date
                          ? new Date(deadline.due_date).toLocaleDateString('en-ZA')
                          : '—'}
                      </td>
                      <td style={styles.td}>{deadline.report_type}</td>
                      <td style={styles.td}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            background: `${color}22`,
                            border: `1px solid ${color}66`,
                            color,
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {deadline.status?.replace(/_/g, ' ') ?? 'unknown'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

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
  varianceBanner: {
    background: 'rgba(249, 115, 22, 0.15)',
    border: '1px solid rgba(249, 115, 22, 0.4)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1.25rem',
    marginBottom: '1.5rem',
    color: 'var(--color-coral)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
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
  progressTrack: {
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
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
