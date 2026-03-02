/**
 * SALGAAdminDashboardPage — SALGA Admin cross-municipality benchmarking dashboard.
 *
 * Sections:
 * 1. Page header with Refresh + Export CSV buttons
 * 2. Summary cards: Total Municipalities, Avg KPI Achievement, Avg Ticket Resolution, Avg SLA Compliance
 * 3. Municipality Performance Ranking table (ranked, clickable drill-down)
 * 4. Inline municipality detail panel (expands below clicked row)
 *
 * Data source: GET /api/v1/role-dashboards/salga-admin
 * CSV export: GET /api/v1/role-dashboards/salga-admin/export-csv (fetch-blob pattern)
 * Decision: CSS variables, no Tailwind (Phase 27-03 lock)
 * Decision: Click row expands inline detail panel (same pattern as Internal Auditor)
 * Requirement: DASH-11
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchSALGAAdminDashboard, exportSALGABenchmarkingCSV } from '../services/api';
import { mockSALGAAdminDashboard } from '../mocks/mockRoleDashboards';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';

// Helper: derive traffic light status from achievement percentage
function achievementStatus(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

// Helper: traffic light color CSS variable
function trafficLightColor(status: 'green' | 'amber' | 'red'): string {
  if (status === 'green') return 'var(--color-teal)';
  if (status === 'amber') return 'var(--color-gold)';
  return 'var(--color-coral)';
}

export function SALGAAdminDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMunicipality, setExpandedMunicipality] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSALGAAdminDashboard(session.access_token);
      setData(result);
    } catch {
      // Rich mock fallback — show demo data when backend unavailable
      setData(mockSALGAAdminDashboard);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCSV = async () => {
    if (!session?.access_token) return;
    setExporting(true);
    try {
      await exportSALGABenchmarkingCSV(session.access_token);
    } catch (err: any) {
      setError('CSV export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const handleRowClick = (municipalityId: string) => {
    setExpandedMunicipality(expandedMunicipality === municipalityId ? null : municipalityId);
  };

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>SALGA Admin — Cross-Municipality Benchmarking</h1>
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
            <Skeleton height={24} width="50%" style={{ marginBottom: '1rem' }} />
            <Skeleton height={280} />
          </div>
        </SkeletonTheme>
      </div>
    );
  }

  // ---- Error state ----
  if (error && !data) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>SALGA Admin — Cross-Municipality Benchmarking</h1>
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

  const municipalities: any[] = data?.municipalities ?? [];

  // ---- Empty state ----
  if (municipalities.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>SALGA Admin — Cross-Municipality Benchmarking</h1>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
        <GlassCard style={styles.emptyCard}>
          <p style={styles.emptyText}>
            No municipality data available. Municipalities must configure PMS to appear here.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/settings')}>
            Go to System Settings
          </Button>
        </GlassCard>
      </div>
    );
  }

  // ---- Compute summary averages ----
  const totalMunicipalities = municipalities.length;
  const avgKpiAchievement =
    municipalities.reduce((sum: number, m: any) => sum + (Number(m.kpi_achievement_avg) || 0), 0) /
    totalMunicipalities;
  const avgTicketResolution =
    municipalities.reduce((sum: number, m: any) => sum + (Number(m.ticket_resolution_rate) || 0), 0) /
    totalMunicipalities;
  const avgSlaCompliance =
    municipalities.reduce((sum: number, m: any) => sum + (Number(m.sla_compliance) || 0), 0) /
    totalMunicipalities;

  return (
    <div style={styles.container}>
      {/* Page header */}
      <div style={styles.header}>
        <h1 style={styles.title}>SALGA Admin — Cross-Municipality Benchmarking</h1>
        <div style={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            style={{ marginLeft: '0.5rem' }}
          >
            {exporting ? 'Downloading...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Error banner (non-blocking — shown alongside data if export fails) */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            style={{ marginLeft: '1rem' }}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <GlassCard style={styles.summaryCard}>
          <div style={styles.summaryValue}>{totalMunicipalities}</div>
          <div style={styles.summaryLabel}>Total Municipalities</div>
        </GlassCard>
        <GlassCard
          style={{
            ...styles.summaryCard,
            borderColor: `${trafficLightColor(achievementStatus(avgKpiAchievement))}44`,
          }}
        >
          <div
            style={{
              ...styles.summaryValue,
              color: trafficLightColor(achievementStatus(avgKpiAchievement)),
            }}
          >
            {avgKpiAchievement.toFixed(1)}%
          </div>
          <div style={styles.summaryLabel}>Avg KPI Achievement</div>
        </GlassCard>
        <GlassCard
          style={{
            ...styles.summaryCard,
            borderColor: `${trafficLightColor(achievementStatus(avgTicketResolution))}44`,
          }}
        >
          <div
            style={{
              ...styles.summaryValue,
              color: trafficLightColor(achievementStatus(avgTicketResolution)),
            }}
          >
            {avgTicketResolution.toFixed(1)}%
          </div>
          <div style={styles.summaryLabel}>Avg Ticket Resolution</div>
        </GlassCard>
        <GlassCard
          style={{
            ...styles.summaryCard,
            borderColor: `${trafficLightColor(achievementStatus(avgSlaCompliance))}44`,
          }}
        >
          <div
            style={{
              ...styles.summaryValue,
              color: trafficLightColor(achievementStatus(avgSlaCompliance)),
            }}
          >
            {avgSlaCompliance.toFixed(1)}%
          </div>
          <div style={styles.summaryLabel}>Avg SLA Compliance</div>
        </GlassCard>
      </div>

      {/* Municipality Performance Ranking Table */}
      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Municipality Performance Ranking</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '48px' }}>Rank</th>
                <th style={styles.th}>Municipality</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Province</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>KPI Achievement %</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Ticket Resolution %</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>SLA Compliance %</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>KPIs</th>
              </tr>
            </thead>
            <tbody>
              {municipalities.map((m: any, idx: number) => {
                const kpiPct = Number(m.kpi_achievement_avg ?? 0);
                const kpiStatus = achievementStatus(kpiPct);
                const kpiColor = trafficLightColor(kpiStatus);
                const isExpanded = expandedMunicipality === m.id;

                return (
                  <>
                    <tr
                      key={`row-${m.id}`}
                      style={{
                        ...styles.tr,
                        background: isExpanded ? 'rgba(255,255,255,0.06)' : 'transparent',
                      }}
                      onClick={() => handleRowClick(m.id)}
                      onMouseEnter={(e) => {
                        if (!isExpanded) {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            'rgba(255,255,255,0.04)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) {
                          (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
                        }
                      }}
                    >
                      <td style={{ ...styles.td, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.muniName}>{m.name}</span>
                      </td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>
                        {m.category ?? '—'}
                      </td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>
                        {m.province ?? '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: `${kpiColor}22`,
                            border: `1px solid ${kpiColor}66`,
                            color: kpiColor,
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {kpiPct.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-primary)' }}>
                        {Number(m.ticket_resolution_rate ?? 0).toFixed(1)}%
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: 'var(--text-primary)' }}>
                        {Number(m.sla_compliance ?? 0).toFixed(1)}%
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <span style={styles.kpiDots}>
                          <span style={{ color: 'var(--color-teal)', fontWeight: 700 }}>
                            {m.green_count ?? 0}G
                          </span>
                          {' '}
                          <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>
                            {m.amber_count ?? 0}A
                          </span>
                          {' '}
                          <span style={{ color: 'var(--color-coral)', fontWeight: 700 }}>
                            {m.red_count ?? 0}R
                          </span>
                        </span>
                      </td>
                    </tr>

                    {/* Inline detail panel */}
                    {isExpanded && (
                      <tr key={`detail-${m.id}`}>
                        <td colSpan={8} style={styles.detailCell}>
                          <div style={styles.detailPanel}>
                            <div style={styles.detailHeader}>
                              <div>
                                <span style={styles.detailMuniName}>{m.name}</span>
                                {m.category && (
                                  <span style={styles.detailBadge}>{m.category}</span>
                                )}
                                {m.province && (
                                  <span style={{ ...styles.detailBadge, marginLeft: '0.25rem' }}>
                                    {m.province}
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedMunicipality(null)}
                              >
                                Close
                              </Button>
                            </div>
                            <div style={styles.detailContent}>
                              {/* Left: KPI Performance Summary */}
                              <div style={styles.detailSection}>
                                <h4 style={styles.detailSectionTitle}>KPI Performance Summary</h4>
                                <div style={styles.detailRow}>
                                  <span style={styles.detailLabel}>Total KPIs</span>
                                  <span style={styles.detailValue}>{m.total_kpis ?? 0}</span>
                                </div>
                                <div style={styles.detailRow}>
                                  <span style={styles.detailLabel}>On Track (Green)</span>
                                  <span style={{ ...styles.detailValue, color: 'var(--color-teal)' }}>
                                    {m.green_count ?? 0}
                                  </span>
                                </div>
                                <div style={styles.detailRow}>
                                  <span style={styles.detailLabel}>At Risk (Amber)</span>
                                  <span style={{ ...styles.detailValue, color: 'var(--color-gold)' }}>
                                    {m.amber_count ?? 0}
                                  </span>
                                </div>
                                <div style={styles.detailRow}>
                                  <span style={styles.detailLabel}>Off Track (Red)</span>
                                  <span style={{ ...styles.detailValue, color: 'var(--color-coral)' }}>
                                    {m.red_count ?? 0}
                                  </span>
                                </div>
                                <div style={{ ...styles.detailRow, marginTop: '0.5rem' }}>
                                  <span style={styles.detailLabel}>Overall Achievement</span>
                                  <span
                                    style={{
                                      ...styles.detailValue,
                                      color: trafficLightColor(achievementStatus(kpiPct)),
                                      fontWeight: 700,
                                    }}
                                  >
                                    {kpiPct.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Right: Service Delivery Summary */}
                              <div style={styles.detailSection}>
                                <h4 style={styles.detailSectionTitle}>Service Delivery Summary</h4>
                                <div style={styles.detailRow}>
                                  <span style={styles.detailLabel}>Ticket Resolution Rate</span>
                                  <span style={styles.detailValue}>
                                    {Number(m.ticket_resolution_rate ?? 0).toFixed(1)}%
                                  </span>
                                </div>
                                <div style={styles.detailRow}>
                                  <span style={styles.detailLabel}>SLA Compliance</span>
                                  <span style={styles.detailValue}>
                                    {Number(m.sla_compliance ?? 0).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
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
  muniName: {
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  kpiDots: {
    display: 'inline-flex',
    gap: '0.35rem',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-body)',
  },
  detailCell: {
    padding: 0,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  detailPanel: {
    background: 'rgba(255,255,255,0.04)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '1.25rem 1.5rem',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  detailMuniName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginRight: '0.5rem',
  },
  detailBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    fontFamily: 'var(--font-body)',
  },
  detailContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  detailSectionTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
  detailValue: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
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
    marginBottom: '1.5rem',
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
