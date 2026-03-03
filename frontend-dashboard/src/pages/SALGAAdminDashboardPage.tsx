/**
 * SALGAAdminDashboardPage — SALGA Admin cross-municipality benchmarking dashboard.
 *
 * Sections:
 * 1. Page header with Refresh + Export CSV buttons
 * 2. Summary cards: Total Municipalities, Avg KPI Achievement, Avg Ticket Resolution, Avg SLA Compliance
 * 3. Municipality Performance Ranking table (ranked, clickable — opens detail modal)
 * 4. MunicipalityDetailModal for drill-down (replaces inline row expand)
 *
 * Data source: GET /api/v1/role-dashboards/salga-admin
 * CSV export: GET /api/v1/role-dashboards/salga-admin/export-csv (fetch-blob pattern)
 * Decision: CSS variables, no Tailwind (Phase 27-03 lock)
 * Decision: Click row opens MunicipalityDetailModal (Phase 34-02 change — was inline expand)
 * Requirement: DASH-11
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePageHeader } from '../hooks/usePageHeader';
import { fetchSALGAAdminDashboard, exportSALGABenchmarkingCSV } from '../services/api';
import { mockSALGAAdminDashboard } from '../mocks/mockRoleDashboards';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';
import { MunicipalityDetailModal, type MunicipalityData } from '../components/salga/MunicipalityDetailModal';

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
  const [selectedMunicipality, setSelectedMunicipality] = useState<MunicipalityData | null>(null);
  const [exporting, setExporting] = useState(false);
  // Pending approvals count — fetched separately, non-blocking
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number | null>(null);

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

  // Non-blocking: fetch pending approval count for summary card
  useEffect(() => {
    if (!session?.access_token) return;
    const fetchPendingCount = async () => {
      try {
        const res = await fetch('/api/v1/auth/tier1-approvals', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : (data.requests ?? []);
        setPendingApprovalCount(list.filter((r: any) => r.status === 'pending').length);
      } catch {
        // Non-blocking: ignore failures, show null count
      }
    };
    fetchPendingCount();
  }, [session?.access_token]);

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

  const handleRowClick = (municipality: any) => {
    setSelectedMunicipality(municipality as MunicipalityData);
  };

  // Layout header — title + action buttons rendered in DashboardLayout header bar
  const headerActions = useMemo(() => (
    <>
      <Button variant="ghost" size="sm" onClick={loadData}>
        Refresh
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleExportCSV}
        disabled={exporting}
      >
        {exporting ? 'Downloading...' : 'Export CSV'}
      </Button>
    </>
  ), [exporting, loadData, handleExportCSV]);
  usePageHeader('SALGA Admin — Cross-Municipality Benchmarking', headerActions);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div style={styles.container}>
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
        {/* Role Approvals summary — links to /role-approvals for full action queue
            Purpose separation: this card shows a COUNT only; the full queue is on /role-approvals */}
        <GlassCard
          style={{
            ...styles.summaryCard,
            borderColor: pendingApprovalCount && pendingApprovalCount > 0
              ? 'rgba(251, 191, 36, 0.4)'
              : undefined,
          }}
        >
          <div
            style={{
              ...styles.summaryValue,
              color: pendingApprovalCount && pendingApprovalCount > 0
                ? 'var(--color-gold)'
                : 'var(--text-primary)',
            }}
          >
            {pendingApprovalCount ?? '—'}
          </div>
          <div style={styles.summaryLabel}>Pending Role Approvals</div>
          <Link
            to="/role-approvals"
            style={{
              marginTop: '0.5rem',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-teal)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            View All →
          </Link>
        </GlassCard>
      </div>

      {/* Municipality Performance Ranking Table */}
      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Municipality Performance Ranking</h2>
        <p style={styles.tableHint}>Click a row to view municipality detail</p>
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

                return (
                  <tr
                    key={m.id}
                    style={styles.tr}
                    onClick={() => handleRowClick(m)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        'rgba(255,255,255,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'transparent';
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
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Municipality detail modal */}
      {selectedMunicipality && (
        <MunicipalityDetailModal
          municipality={selectedMunicipality}
          onClose={() => setSelectedMunicipality(null)}
        />
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
    marginBottom: '0.25rem',
  },
  tableHint: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-body)',
    marginBottom: '1rem',
    fontStyle: 'italic',
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
    background: 'transparent',
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
