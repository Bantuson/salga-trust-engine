/**
 * OversightDashboardPage — single component serving 4 oversight roles.
 *
 * Roles handled via `role` prop:
 *   councillor        — DASH-07: Read-only SDBIP KPI list + statutory reports
 *   audit_committee   — DASH-08: All performance reports + PMS audit trail
 *   internal_auditor  — DASH-09: KPI verification workqueue with Verify/Insufficient actions
 *   mpac              — DASH-10: Statutory reports with investigation flagging + flagged sidebar
 *
 * Patterns:
 *   - CSS variables, no Tailwind (Phase 27-03 lock)
 *   - useAuth for session token
 *   - Skeleton loading, empty state with PMS Hub link, red error banner
 *   - Refresh button; re-fetch when role prop changes
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  fetchCouncillorDashboard,
  fetchAuditCommitteeDashboard,
  fetchInternalAuditorDashboard,
  fetchMPACDashboard,
  verifyEvidence,
  flagInvestigation,
} from '../services/api';
import { mockOversightData } from '../mocks/mockRoleDashboards';
import { DEMO_MODE } from '../lib/demoMode';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
import { TrafficLightBadge } from '../components/pms/TrafficLightBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OversightRole = 'councillor' | 'audit_committee' | 'internal_auditor' | 'mpac';

interface OversightDashboardProps {
  role: OversightRole;
}

// ---------------------------------------------------------------------------
// Role config map
// ---------------------------------------------------------------------------

const ROLE_CONFIG: Record<
  OversightRole,
  { title: string; fetch: (token: string) => Promise<any> }
> = {
  councillor: {
    title: 'Ward Councillor Dashboard',
    fetch: fetchCouncillorDashboard,
  },
  audit_committee: {
    title: 'Audit Committee Dashboard',
    fetch: fetchAuditCommitteeDashboard,
  },
  internal_auditor: {
    title: 'Internal Auditor Dashboard',
    fetch: fetchInternalAuditorDashboard,
  },
  mpac: {
    title: 'MPAC Dashboard',
    fetch: fetchMPACDashboard,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'submitted' || s === 'tabled') return 'var(--color-teal)';
  if (s === 'in_progress' || s === 'in progress') return 'var(--color-gold)';
  return 'var(--color-coral)';
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
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
        whiteSpace: 'nowrap',
      }}
    >
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  );
}

function investigationStatusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'resolved') return 'var(--color-teal)';
  if (s === 'acknowledged') return '#60a5fa'; // blue
  return 'var(--color-gold)'; // pending
}

// ---------------------------------------------------------------------------
// Councillor View
// ---------------------------------------------------------------------------

function CouncillorView({ data }: { data: any }) {
  const sdbip = data?.sdbip_summary ?? [];
  const reports = data?.statutory_reports ?? [];

  return (
    <>
      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>SDBIP KPI Summary</h2>
        <p style={styles.sectionNote}>Read-only view of SDBIP performance indicators.</p>
        {sdbip.length === 0 ? (
          <p style={styles.emptyText}>No KPI data available.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>KPI Description</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Annual Target</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Latest Actual</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Achievement %</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sdbip.map((kpi: any, idx: number) => {
                  const pct = Number(kpi.achievement_pct ?? 0);
                  const tlStatus: 'green' | 'amber' | 'red' =
                    kpi.traffic_light === 'green'
                      ? 'green'
                      : kpi.traffic_light === 'amber'
                      ? 'amber'
                      : 'red';
                  return (
                    <tr key={idx} style={{ ...styles.tr, cursor: 'default' }}>
                      <td style={styles.td}>{kpi.description}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {Number(kpi.annual_target ?? 0).toLocaleString()}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {kpi.latest_actual != null
                          ? Number(kpi.latest_actual).toLocaleString()
                          : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {pct.toFixed(1)}%
                      </td>
                      <td style={styles.td}>
                        <TrafficLightBadge status={tlStatus} pct={pct} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Statutory Reports</h2>
        {reports.length === 0 ? (
          <p style={styles.emptyText}>No statutory reports available.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Report Type</th>
                  <th style={styles.th}>Financial Year</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any, idx: number) => (
                  <tr key={idx} style={{ ...styles.tr, cursor: 'default' }}>
                    <td style={styles.td}>{r.report_type}</td>
                    <td style={styles.td}>{r.financial_year}</td>
                    <td style={styles.td}>
                      <StatusBadge status={r.status ?? 'unknown'} />
                    </td>
                    <td style={styles.td}>
                      {r.due_date
                        ? new Date(r.due_date).toLocaleDateString('en-ZA')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Audit Committee View
// ---------------------------------------------------------------------------

function AuditCommitteeView({ data }: { data: any }) {
  const reports = data?.performance_reports ?? [];
  const auditTrail = [...(data?.audit_trail ?? [])].sort(
    (a: any, b: any) =>
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  ).slice(0, 100);

  return (
    <>
      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Performance Reports</h2>
        {reports.length === 0 ? (
          <p style={styles.emptyText}>No performance reports available.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Report Type</th>
                  <th style={styles.th}>Financial Year</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any, idx: number) => (
                  <tr key={idx} style={{ ...styles.tr, cursor: 'default' }}>
                    <td style={styles.td}>{r.report_type}</td>
                    <td style={styles.td}>{r.financial_year}</td>
                    <td style={styles.td}>
                      <StatusBadge status={r.status ?? 'unknown'} />
                    </td>
                    <td style={styles.td}>
                      {r.due_date
                        ? new Date(r.due_date).toLocaleDateString('en-ZA')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard style={styles.tableCard}>
        <h2 style={styles.sectionTitle}>Audit Trail — PMS Activity</h2>
        <p style={styles.sectionNote}>
          Showing the most recent 100 entries, ordered by timestamp descending.
        </p>
        {auditTrail.length === 0 ? (
          <p style={styles.emptyText}>No audit trail entries available.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Timestamp</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Operation</th>
                  <th style={styles.th}>Table</th>
                  <th style={styles.th}>Record ID</th>
                  <th style={styles.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditTrail.map((entry: any, idx: number) => {
                  const details = typeof entry.changes === 'string'
                    ? entry.changes
                    : JSON.stringify(entry.changes ?? '');
                  const truncated =
                    details.length > 60 ? `${details.slice(0, 60)}…` : details;
                  return (
                    <tr key={idx} style={{ ...styles.tr, cursor: 'default' }}>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleString('en-ZA')
                          : '—'}
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {entry.user_id
                          ? String(entry.user_id).slice(0, 8) + '…'
                          : '—'}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.08)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {entry.operation ?? '—'}
                        </span>
                      </td>
                      <td style={styles.td}>{entry.table_name ?? '—'}</td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {entry.record_id
                          ? String(entry.record_id).slice(0, 8) + '…'
                          : '—'}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: '300px',
                        }}
                        title={details}
                      >
                        {truncated}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}

// ---------------------------------------------------------------------------
// Internal Auditor View
// ---------------------------------------------------------------------------

interface EvidenceItem {
  id: string;
  file_name: string;
  content_type: string;
  uploaded_at: string;
  actual_id: string;
  verification_status: string;
}

interface KpiGroup {
  kpi_id: string;
  kpi_description: string;
  evidence_items: EvidenceItem[];
}

function InternalAuditorView({
  data,
  token,
  onRefresh,
}: {
  data: any;
  token: string;
  onRefresh: () => void;
}) {
  const verificationQueue: KpiGroup[] = data?.verification_queue ?? [];

  const [expandedKpis, setExpandedKpis] = useState<Set<string>>(new Set());
  const [localData, setLocalData] = useState<KpiGroup[]>(verificationQueue);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Sync local data when parent data refreshes
  useEffect(() => {
    setLocalData(verificationQueue);
  }, [data]);

  const toggleKpi = (kpiId: string) => {
    setExpandedKpis((prev) => {
      const next = new Set(prev);
      if (next.has(kpiId)) next.delete(kpiId);
      else next.add(kpiId);
      return next;
    });
  };

  const handleVerify = async (
    kpiId: string,
    evidenceId: string,
    status: 'verified' | 'insufficient'
  ) => {
    setActionError(null);
    setActionLoading(evidenceId);
    // Optimistic update
    setLocalData((prev) =>
      prev.map((kpi) =>
        kpi.kpi_id === kpiId
          ? {
              ...kpi,
              evidence_items: kpi.evidence_items.map((ev) =>
                ev.id === evidenceId ? { ...ev, verification_status: status } : ev
              ),
            }
          : kpi
      )
    );
    try {
      await verifyEvidence(token, evidenceId, status);
      // Confirm with full refetch
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Verification action failed');
      // Revert optimistic update on error
      setLocalData(verificationQueue);
    } finally {
      setActionLoading(null);
    }
  };

  function evidenceStatusBadge(status: string) {
    const s = (status || '').toLowerCase();
    const color =
      s === 'verified'
        ? 'var(--color-teal)'
        : s === 'insufficient'
        ? 'var(--color-coral)'
        : 'var(--color-gold)';
    const label =
      s === 'verified' ? 'Verified' : s === 'insufficient' ? 'Insufficient' : 'Unverified';
    return (
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
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <GlassCard style={styles.tableCard}>
      <h2 style={styles.sectionTitle}>KPI Verification Workqueue</h2>
      <p style={styles.sectionNote}>
        Click a KPI to expand its evidence items. Use Verify or Insufficient to update each item.
      </p>

      {actionError && (
        <div style={{ ...styles.errorBanner, marginBottom: '1rem' }}>
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              marginLeft: '1rem',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {localData.length === 0 ? (
        <p style={styles.emptyText}>No evidence items pending verification.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {localData.map((kpi) => {
            const isExpanded = expandedKpis.has(kpi.kpi_id);
            const unverifiedCount = kpi.evidence_items.filter(
              (ev) => (ev.verification_status || '').toLowerCase() === 'unverified'
            ).length;
            return (
              <div
                key={kpi.kpi_id}
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                }}
              >
                {/* KPI Header */}
                <button
                  onClick={() => toggleKpi(kpi.kpi_id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.875rem 1rem',
                    background: isExpanded
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(255,255,255,0.02)',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      'rgba(255,255,255,0.07)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = isExpanded
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(255,255,255,0.02)';
                  }}
                >
                  <span
                    style={{
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  >
                    {kpi.kpi_description}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {unverifiedCount > 0 && (
                      <span
                        style={{
                          background: 'var(--color-gold)',
                          color: '#000',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        {unverifiedCount}
                      </span>
                    )}
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}
                    >
                      ▾
                    </span>
                  </div>
                </button>

                {/* Evidence items */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    {kpi.evidence_items.length === 0 ? (
                      <p
                        style={{
                          ...styles.emptyText,
                          padding: '0.75rem 1rem',
                          margin: 0,
                        }}
                      >
                        No evidence items for this KPI.
                      </p>
                    ) : (
                      <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>File Name</th>
                              <th style={styles.th}>Content Type</th>
                              <th style={styles.th}>Uploaded</th>
                              <th style={styles.th}>Status</th>
                              <th style={styles.th}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {kpi.evidence_items.map((ev) => {
                              const isUnverified =
                                (ev.verification_status || '').toLowerCase() === 'unverified';
                              const isThisLoading = actionLoading === ev.id;
                              return (
                                <tr key={ev.id} style={{ ...styles.tr, cursor: 'default' }}>
                                  <td style={styles.td}>{ev.file_name}</td>
                                  <td style={{ ...styles.td, color: 'var(--text-secondary)' }}>
                                    {ev.content_type}
                                  </td>
                                  <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                    {ev.uploaded_at
                                      ? new Date(ev.uploaded_at).toLocaleDateString('en-ZA')
                                      : '—'}
                                  </td>
                                  <td style={styles.td}>
                                    {evidenceStatusBadge(ev.verification_status)}
                                  </td>
                                  <td style={styles.td}>
                                    {isUnverified ? (
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                          disabled={isThisLoading}
                                          onClick={() =>
                                            handleVerify(kpi.kpi_id, ev.id, 'verified')
                                          }
                                          style={{
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'transparent',
                                            border: '1px solid var(--color-teal)',
                                            color: 'var(--color-teal)',
                                            fontSize: 'var(--text-xs)',
                                            fontWeight: 600,
                                            cursor: isThisLoading ? 'not-allowed' : 'pointer',
                                            opacity: isThisLoading ? 0.5 : 1,
                                            fontFamily: 'var(--font-body)',
                                          }}
                                        >
                                          {isThisLoading ? '…' : 'Verified'}
                                        </button>
                                        <button
                                          disabled={isThisLoading}
                                          onClick={() =>
                                            handleVerify(kpi.kpi_id, ev.id, 'insufficient')
                                          }
                                          style={{
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'transparent',
                                            border: '1px solid var(--color-coral)',
                                            color: 'var(--color-coral)',
                                            fontSize: 'var(--text-xs)',
                                            fontWeight: 600,
                                            cursor: isThisLoading ? 'not-allowed' : 'pointer',
                                            opacity: isThisLoading ? 0.5 : 1,
                                            fontFamily: 'var(--font-body)',
                                          }}
                                        >
                                          {isThisLoading ? '…' : 'Insufficient'}
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                                        —
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// MPAC View
// ---------------------------------------------------------------------------

const INVESTIGATION_REASONS = [
  { value: 'performance_concern', label: 'Performance Concern' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'procurement_irregularity', label: 'Procurement Irregularity' },
  { value: 'other', label: 'Other' },
];

function MPACView({
  data,
  token,
  onRefresh,
}: {
  data: any;
  token: string;
  onRefresh: () => void;
}) {
  const reports: any[] = data?.statutory_reports ?? [];
  const investigationFlags: any[] = data?.investigation_flags ?? [];

  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [flagForm, setFlagForm] = useState<{ reason: string; notes: string }>({
    reason: INVESTIGATION_REASONS[0].value,
    notes: '',
  });
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSuccess, setFlagSuccess] = useState<string | null>(null);

  const handleFlagSubmit = async (reportId: string) => {
    if (!flagForm.reason) return;
    setFlagLoading(true);
    setFlagError(null);
    setFlagSuccess(null);
    try {
      await flagInvestigation(token, reportId, flagForm.reason, flagForm.notes);
      setFlagSuccess(reportId);
      setExpandedReportId(null);
      setFlagForm({ reason: INVESTIGATION_REASONS[0].value, notes: '' });
      onRefresh();
      // Clear success indicator after 3s
      setTimeout(() => setFlagSuccess(null), 3000);
    } catch (err: any) {
      setFlagError(err.message || 'Failed to flag investigation');
    } finally {
      setFlagLoading(false);
    }
  };

  // Build flagged items with status from investigation_flags (audit log entries)
  // investigation_flags shape: [{ id, record_id, changes (JSON string), created_at }]
  // Group by record_id, take latest entry for status
  const flaggedBySiblingId = new Map<string, any[]>();
  for (const flag of investigationFlags) {
    const key = flag.record_id ?? flag.id;
    const existing = flaggedBySiblingId.get(key) ?? [];
    existing.push(flag);
    flaggedBySiblingId.set(key, existing);
  }

  const flaggedItems = Array.from(flaggedBySiblingId.entries()).map(([recordId, entries]) => {
    const sorted = [...entries].sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    );
    const latest = sorted[0];
    let parsed: any = {};
    try {
      parsed = JSON.parse(latest.changes ?? '{}');
    } catch {
      parsed = {};
    }
    const status = parsed.status ?? 'pending';
    const reason = parsed.reason ?? '';
    const matchingReport = reports.find((r) => r.id === recordId);
    return {
      recordId,
      reportType: matchingReport?.report_type ?? '—',
      financialYear: matchingReport?.financial_year ?? '—',
      reason,
      status,
      createdAt: sorted[sorted.length - 1].created_at,
    };
  });

  return (
    <div style={styles.mpacLayout}>
      {/* Main: Statutory Reports */}
      <div style={styles.mpacMain}>
        <GlassCard style={styles.tableCard}>
          <h2 style={styles.sectionTitle}>Statutory Reports</h2>
          <p style={styles.sectionNote}>
            Click "Flag Investigation" to raise a concern about a specific report.
          </p>
          {reports.length === 0 ? (
            <p style={styles.emptyText}>No statutory reports available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {flagError && (
                <div style={{ ...styles.errorBanner, marginBottom: '0.75rem' }}>
                  <span>{flagError}</span>
                  <button
                    onClick={() => setFlagError(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                      marginLeft: '1rem',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Report Type</th>
                      <th style={styles.th}>Financial Year</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Due Date</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r: any, idx: number) => {
                      const isExpanded = expandedReportId === r.id;
                      const wasSuccessful = flagSuccess === r.id;
                      return (
                        <>
                          <tr key={r.id ?? idx} style={{ ...styles.tr, cursor: 'default' }}>
                            <td style={styles.td}>{r.report_type}</td>
                            <td style={styles.td}>{r.financial_year}</td>
                            <td style={styles.td}>
                              <StatusBadge status={r.status ?? 'unknown'} />
                            </td>
                            <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                              {r.due_date
                                ? new Date(r.due_date).toLocaleDateString('en-ZA')
                                : '—'}
                            </td>
                            <td style={styles.td}>
                              {wasSuccessful ? (
                                <span
                                  style={{
                                    color: 'var(--color-teal)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 600,
                                  }}
                                >
                                  Flagged
                                </span>
                              ) : (
                                <button
                                  onClick={() =>
                                    setExpandedReportId(isExpanded ? null : r.id)
                                  }
                                  style={{
                                    padding: '4px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'transparent',
                                    border: '1px solid #fb923c',
                                    color: '#fb923c',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-body)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isExpanded ? 'Cancel' : 'Flag Investigation'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`form-${r.id ?? idx}`}>
                              <td
                                colSpan={5}
                                style={{
                                  padding: '0.75rem 1rem 1rem',
                                  background: 'rgba(251,146,60,0.06)',
                                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem',
                                    maxWidth: '480px',
                                  }}
                                >
                                  <p
                                    style={{
                                      margin: 0,
                                      color: 'var(--text-secondary)',
                                      fontSize: 'var(--text-sm)',
                                      fontFamily: 'var(--font-body)',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Flag investigation for: {r.report_type} ({r.financial_year})
                                  </p>
                                  <div>
                                    <label
                                      style={{
                                        display: 'block',
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '0.25rem',
                                        fontFamily: 'var(--font-body)',
                                      }}
                                    >
                                      Reason
                                    </label>
                                    <Select
                                      value={flagForm.reason}
                                      onChange={(value) =>
                                        setFlagForm((f) => ({ ...f, reason: value }))
                                      }
                                      options={INVESTIGATION_REASONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                                      size="md"
                                    />
                                  </div>
                                  <div>
                                    <label
                                      style={{
                                        display: 'block',
                                        fontSize: 'var(--text-xs)',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '0.25rem',
                                        fontFamily: 'var(--font-body)',
                                      }}
                                    >
                                      Notes
                                    </label>
                                    <textarea
                                      rows={3}
                                      value={flagForm.notes}
                                      onChange={(e) =>
                                        setFlagForm((f) => ({ ...f, notes: e.target.value }))
                                      }
                                      placeholder="Add supporting notes..."
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem 0.75rem',
                                        background: 'var(--surface-elevated)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--text-sm)',
                                        fontFamily: 'var(--font-body)',
                                        resize: 'vertical',
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                      disabled={flagLoading}
                                      onClick={() => handleFlagSubmit(r.id)}
                                      style={{
                                        padding: '6px 16px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: flagLoading
                                          ? 'rgba(251,146,60,0.3)'
                                          : 'rgba(251,146,60,0.2)',
                                        border: '1px solid #fb923c',
                                        color: '#fb923c',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 600,
                                        cursor: flagLoading ? 'not-allowed' : 'pointer',
                                        fontFamily: 'var(--font-body)',
                                      }}
                                    >
                                      {flagLoading ? 'Submitting…' : 'Submit Flag'}
                                    </button>
                                    <button
                                      disabled={flagLoading}
                                      onClick={() => setExpandedReportId(null)}
                                      style={{
                                        padding: '6px 16px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        color: 'var(--text-secondary)',
                                        fontSize: 'var(--text-sm)',
                                        fontWeight: 600,
                                        cursor: flagLoading ? 'not-allowed' : 'pointer',
                                        fontFamily: 'var(--font-body)',
                                      }}
                                    >
                                      Cancel
                                    </button>
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
            </div>
          )}
        </GlassCard>
      </div>

      {/* Sidebar: Flagged Investigations */}
      <div style={styles.mpacSidebar}>
        <GlassCard style={{ ...styles.tableCard, padding: 'var(--space-lg)' }}>
          <h2 style={{ ...styles.sectionTitle, marginBottom: '1rem' }}>
            My Flagged Investigations
          </h2>
          {flaggedItems.length === 0 ? (
            <p style={{ ...styles.emptyText, textAlign: 'left' }}>
              No investigations flagged yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {flaggedItems.map((item) => {
                const statusColor_ = investigationStatusColor(item.status);
                return (
                  <div
                    key={item.recordId}
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {item.reportType}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-body)',
                      }}
                    >
                      {item.financialYear}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: '0.25rem',
                      }}
                    >
                      {item.reason && (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(251,146,60,0.12)',
                            border: '1px solid rgba(251,146,60,0.3)',
                            color: '#fb923c',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 600,
                          }}
                        >
                          {item.reason.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: `${statusColor_}18`,
                          border: `1px solid ${statusColor_}44`,
                          color: statusColor_,
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    {item.createdAt && (
                      <span
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        {new Date(item.createdAt).toLocaleDateString('en-ZA')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OversightDashboardPage
// ---------------------------------------------------------------------------

export function OversightDashboardPage({ role }: OversightDashboardProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = ROLE_CONFIG[role];

  const loadData = useCallback(async () => {
    if (DEMO_MODE) {
      setData(mockOversightData[role] || null);
      setLoading(false);
      return;
    }
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await config.fetch(session.access_token);
      setData(result);
    } catch {
      // Rich mock fallback — show demo data when backend unavailable
      setData(mockOversightData[role] || null);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{config.title}</h1>
        </div>
        <SkeletonTheme>
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
          <h1 style={styles.title}>{config.title}</h1>
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
  const hasData = data && (
    (role === 'councillor' &&
      ((data.sdbip_summary?.length ?? 0) > 0 ||
        (data.statutory_reports?.length ?? 0) > 0)) ||
    (role === 'audit_committee' &&
      ((data.performance_reports?.length ?? 0) > 0 ||
        (data.audit_trail?.length ?? 0) > 0)) ||
    (role === 'internal_auditor' &&
      (data.verification_queue?.length ?? 0) > 0) ||
    (role === 'mpac' &&
      ((data.statutory_reports?.length ?? 0) > 0 ||
        (data.investigation_flags?.length ?? 0) > 0))
  );

  if (!hasData) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{config.title}</h1>
          <Button variant="ghost" size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>
        <GlassCard style={styles.emptyCard}>
          <p style={styles.emptyText}>
            No data available for this dashboard. Set up PMS to get started.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/pms')}>
            Go to PMS Hub
          </Button>
        </GlassCard>
      </div>
    );
  }

  // ---- Content ----
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{config.title}</h1>
        <Button variant="ghost" size="sm" onClick={loadData}>
          Refresh
        </Button>
      </div>

      {role === 'councillor' && <CouncillorView data={data} />}

      {role === 'audit_committee' && <AuditCommitteeView data={data} />}

      {role === 'internal_auditor' && (
        <InternalAuditorView
          data={data}
          token={session!.access_token}
          onRefresh={loadData}
        />
      )}

      {role === 'mpac' && (
        <MPACView
          data={data}
          token={session!.access_token}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    textAlign: 'left' as const,
    color: 'var(--text-secondary)',
    fontWeight: 600,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '0.75rem 1rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle' as const,
  },
  tr: {
    transition: 'background 0.15s',
  },
  emptyCard: {
    padding: 'var(--space-2xl)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    textAlign: 'center' as const,
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
    maxWidth: '480px',
    lineHeight: 1.6,
    textAlign: 'center' as const,
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
  skeletonTable: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-lg)',
    marginBottom: '1.5rem',
  },
  // MPAC two-column layout
  mpacLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1.5rem',
    // Desktop: 70/30 split — applied via media-query equivalent via inline style
  },
  mpacMain: {
    minWidth: 0,
  },
  mpacSidebar: {
    minWidth: 0,
  },
};

// Apply 70/30 grid on wider viewports via a style tag injection
// (Inline styles cannot use media queries; we inject a small global rule once)
if (typeof document !== 'undefined') {
  const styleId = 'oversight-mpac-layout';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @media (min-width: 900px) {
        .oversight-mpac-grid {
          grid-template-columns: 70% 30% !important;
        }
      }
    `;
    document.head.appendChild(el);
  }
}
