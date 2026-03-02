/**
 * MayorDashboardPage — role-specific dashboard for the Executive Mayor.
 *
 * Sections:
 * 1. Organizational Scorecard (3 summary cards: overall %, KPI distribution, total KPIs)
 * 2. SDBIP Scorecards table with Approve SDBIP action for draft scorecards
 *    - Confirmation dialog (inline modal, no page navigation)
 *    - POST /api/v1/role-dashboards/mayor/approve-sdbip on confirm
 *
 * Data source: GET /api/v1/role-dashboards/mayor
 * Decision: CSS variables, no Tailwind (Phase 27-03 lock)
 * Decision: Simple state-driven modal (no external library)
 * Decision: Manual refresh button
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchMayorDashboard, approveSdbip } from '../services/api';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';
import { TrafficLightBadge } from '../components/pms/TrafficLightBadge';
import { useNavigate } from 'react-router-dom';

function achievementStatus(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

export function MayorDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SDBIP approval dialog state
  const [approving, setApproving] = useState<string | null>(null); // scorecard_id or null
  const [approveComment, setApproveComment] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMayorDashboard(session.access_token);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load Mayor dashboard');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApproveClick = (scorecardId: string) => {
    setApproving(scorecardId);
    setApproveComment('');
    setApproveError(null);
  };

  const handleApproveCancel = () => {
    setApproving(null);
    setApproveComment('');
    setApproveError(null);
  };

  const handleApproveConfirm = async () => {
    if (!session?.access_token || !approving) return;
    setApproveLoading(true);
    setApproveError(null);
    try {
      await approveSdbip(session.access_token, approving, approveComment || undefined);
      setApproveSuccess(`SDBIP scorecard approved successfully.`);
      setApproving(null);
      setApproveComment('');
      // Refresh dashboard data after approval
      await loadData();
    } catch (err: any) {
      setApproveError(err.message || 'Approval failed. Please try again.');
    } finally {
      setApproveLoading(false);
    }
  };

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Executive Mayor Dashboard</h1>
        </div>
        <SkeletonTheme>
          <div style={styles.summaryGrid}>
            {[1, 2, 3].map((i) => (
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
        </SkeletonTheme>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Executive Mayor Dashboard</h1>
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

  const scorecard = data?.organizational_scorecard ?? {};
  const sdbipScorecards: any[] = data?.sdbip_scorecards ?? [];
  const overallPct = Number(scorecard.overall_achievement_pct ?? 0);
  const totalKpis = Number(scorecard.total_kpis ?? 0);
  const green = Number(scorecard.green ?? 0);
  const amber = Number(scorecard.amber ?? 0);
  const red = Number(scorecard.red ?? 0);

  // ---- Empty state ----
  if (!data || (totalKpis === 0 && sdbipScorecards.length === 0)) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Executive Mayor Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
        <GlassCard style={styles.emptyCard}>
          <p style={styles.emptyText}>
            No SDBIP data available. SDBIP scorecards must be created and submitted for mayoral
            approval in the PMS Hub.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/pms')}>
            Go to PMS Hub
          </Button>
        </GlassCard>
      </div>
    );
  }

  // Find the scorecard being approved (for dialog text)
  const approvingScorecard = sdbipScorecards.find((s) => s.id === approving);

  return (
    <div style={styles.container}>
      {/* Page header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Executive Mayor Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={loadData}>
          Refresh
        </Button>
      </div>

      {/* Success banner */}
      {approveSuccess && (
        <div style={styles.successBanner}>
          {approveSuccess}
          <button
            onClick={() => setApproveSuccess(null)}
            style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Organizational Scorecard */}
      <div style={styles.summaryGrid}>
        <GlassCard style={styles.summaryCard}>
          <div
            style={{
              ...styles.summaryValue,
              color:
                achievementStatus(overallPct) === 'green'
                  ? 'var(--color-teal)'
                  : achievementStatus(overallPct) === 'amber'
                  ? 'var(--color-gold)'
                  : 'var(--color-coral)',
            }}
          >
            {overallPct.toFixed(1)}%
          </div>
          <div style={styles.summaryLabel}>Overall Achievement</div>
          <TrafficLightBadge status={achievementStatus(overallPct)} pct={overallPct} />
        </GlassCard>

        <GlassCard style={styles.summaryCard}>
          <div style={styles.distributionRow}>
            <span style={{ ...styles.distributionBadge, color: 'var(--color-teal)', background: 'rgba(0,191,165,0.15)' }}>
              {green} Green
            </span>
            <span style={{ ...styles.distributionBadge, color: 'var(--color-gold)', background: 'rgba(255,213,79,0.15)' }}>
              {amber} Amber
            </span>
            <span style={{ ...styles.distributionBadge, color: 'var(--color-coral)', background: 'rgba(249,115,22,0.15)' }}>
              {red} Red
            </span>
          </div>
          <div style={styles.summaryLabel}>KPI Distribution</div>
        </GlassCard>

        <GlassCard style={styles.summaryCard}>
          <div style={styles.summaryValue}>{totalKpis}</div>
          <div style={styles.summaryLabel}>Total KPIs</div>
        </GlassCard>
      </div>

      {/* SDBIP Scorecards Table */}
      {sdbipScorecards.length > 0 && (
        <GlassCard style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>SDBIP Scorecards</h2>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Financial Year</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>KPIs</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sdbipScorecards.map((sc: any, idx: number) => (
                  <tr key={idx} style={{ ...styles.tr, cursor: 'default' }}>
                    <td style={styles.td}>{sc.financial_year ?? '—'}</td>
                    <td style={styles.td}>
                      <span style={scorecardStatusBadge(sc.status)}>
                        {sc.status?.replace(/_/g, ' ') ?? 'unknown'}
                      </span>
                    </td>
                    <td style={styles.td}>{sc.kpi_count ?? '—'}</td>
                    <td style={styles.td}>
                      {sc.status === 'draft' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApproveClick(sc.id)}
                        >
                          Approve SDBIP
                        </Button>
                      ) : (
                        <span style={styles.noAction}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* SDBIP Approval Confirmation Dialog */}
      {approving && (
        <div style={styles.modalOverlay} onClick={handleApproveCancel}>
          <div
            style={styles.modalPanel}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="approve-dialog-title"
          >
            <h2 id="approve-dialog-title" style={styles.modalTitle}>
              Approve SDBIP{approvingScorecard?.financial_year ? ` ${approvingScorecard.financial_year}` : ''}?
            </h2>
            <p style={styles.modalBody}>
              {approvingScorecard?.financial_year && (
                <>Financial Year: <strong>{approvingScorecard.financial_year}</strong><br /></>
              )}
              {approvingScorecard?.kpi_count !== undefined && (
                <>KPIs in scorecard: <strong>{approvingScorecard.kpi_count}</strong><br /></>
              )}
              This action will formally approve the SDBIP scorecard. This action is recorded in
              the audit log and cannot be undone.
            </p>

            {/* Optional comment */}
            <label style={styles.commentLabel} htmlFor="approve-comment">
              Approval comment (optional)
            </label>
            <textarea
              id="approve-comment"
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Add a comment for the record..."
              rows={3}
              style={styles.commentTextarea}
            />

            {approveError && (
              <div style={styles.dialogError}>{approveError}</div>
            )}

            <div style={styles.modalActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleApproveCancel}
                disabled={approveLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveConfirm}
                loading={approveLoading}
                disabled={approveLoading}
              >
                Confirm Approval
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function scorecardStatusBadge(status: string): React.CSSProperties {
  let color = 'var(--text-secondary)';
  let bg = 'rgba(255,255,255,0.05)';
  if (status === 'approved') {
    color = 'var(--color-teal)';
    bg = 'rgba(0,191,165,0.15)';
  } else if (status === 'draft') {
    color = 'var(--color-gold)';
    bg = 'rgba(255,213,79,0.15)';
  } else if (status === 'submitted') {
    color = '#3b82f6';
    bg = 'rgba(59,130,246,0.15)';
  } else if (status === 'rejected') {
    color = 'var(--color-coral)';
    bg = 'rgba(249,115,22,0.15)';
  }
  return {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    background: bg,
    color,
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    textTransform: 'capitalize',
  };
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
  distributionRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '0.25rem',
  },
  distributionBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
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
    transition: 'background 0.15s',
  },
  noAction: {
    color: 'var(--text-muted)',
    fontSize: 'var(--text-sm)',
  },
  // Approval modal overlay
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modalPanel: {
    background: 'var(--glass-white-frost, rgba(255,255,255,0.08))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.15))',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-xl, 2rem)',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '1rem',
  },
  modalBody: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    lineHeight: 1.6,
    marginBottom: '1.25rem',
  },
  commentLabel: {
    display: 'block',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    marginBottom: '0.5rem',
    fontWeight: 500,
  },
  commentTextarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    padding: '0.75rem',
    resize: 'vertical',
    marginBottom: '1rem',
    boxSizing: 'border-box',
    outline: 'none',
  },
  dialogError: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-coral)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    marginBottom: '1rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
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
  successBanner: {
    background: 'rgba(0, 191, 165, 0.15)',
    border: '1px solid rgba(0, 191, 165, 0.4)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1.25rem',
    color: 'var(--color-teal)',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    marginBottom: '1.5rem',
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
