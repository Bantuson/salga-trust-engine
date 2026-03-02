/**
 * RoleApprovalsPage — SALGA Admin Tier 1 role approval action queue.
 *
 * Unique purpose: Focused action queue for SALGA Admin to approve/reject
 * Tier 1 role assignment requests across all municipalities.
 *   - This page does NOT duplicate SALGAAdminDashboardPage (benchmarking)
 *   - SALGAAdminDashboardPage shows a summary card linking HERE for full queue
 *
 * Filter bar: Role, Municipality, Status, Date range, Clear Filters
 * Approval table: Requester Name, Requested Role, Municipality, Date, Status, Actions
 * Actions: Approve (green) / Reject (red) on pending rows; badges on decided rows
 * Pagination: simple prev/next at 20 items per page
 *
 * Error fallback: mock data (3 pending, 2 approved, 1 rejected) with banner
 * Empty state: "No pending requests" message
 *
 * API endpoints:
 *   GET  /api/v1/auth/tier1-approvals
 *   POST /api/v1/auth/tier1-approvals/{id}/approve
 *   POST /api/v1/auth/tier1-approvals/{id}/reject
 *
 * Styling: CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name?: string | null;
  requested_role: string;
  municipality_name?: string | null;
  municipality_id?: string | null;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_at?: string | null;
  decided_by?: string | null;
}

// ---------------------------------------------------------------------------
// Mock fallback data
// ---------------------------------------------------------------------------

const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: 'mock-1',
    user_id: 'u1',
    user_email: 'thabo.nkosi@ethekwini.gov.za',
    user_name: 'Thabo Nkosi',
    requested_role: 'executive_mayor',
    municipality_name: 'eThekwini Metropolitan',
    municipality_id: 'muni-1',
    requested_at: '2026-02-28T09:15:00Z',
    status: 'pending',
  },
  {
    id: 'mock-2',
    user_id: 'u2',
    user_email: 'zanele.dlamini@tshwane.gov.za',
    user_name: 'Zanele Dlamini',
    requested_role: 'cfo',
    municipality_name: 'City of Tshwane',
    municipality_id: 'muni-2',
    requested_at: '2026-03-01T14:30:00Z',
    status: 'pending',
  },
  {
    id: 'mock-3',
    user_id: 'u3',
    user_email: 'sipho.mokoena@mangaung.gov.za',
    user_name: 'Sipho Mokoena',
    requested_role: 'municipal_manager',
    municipality_name: 'Mangaung Metropolitan',
    municipality_id: 'muni-3',
    requested_at: '2026-03-02T08:00:00Z',
    status: 'pending',
  },
  {
    id: 'mock-4',
    user_id: 'u4',
    user_email: 'nomsa.khumalo@nmbm.gov.za',
    user_name: 'Nomsa Khumalo',
    requested_role: 'speaker',
    municipality_name: 'Nelson Mandela Bay',
    municipality_id: 'muni-4',
    requested_at: '2026-02-20T11:00:00Z',
    status: 'approved',
    decided_at: '2026-02-21T09:00:00Z',
    decided_by: 'salga.admin@salga.org.za',
  },
  {
    id: 'mock-5',
    user_id: 'u5',
    user_email: 'lungelo.ntuli@bufcity.gov.za',
    user_name: 'Lungelo Ntuli',
    requested_role: 'executive_mayor',
    municipality_name: 'Buffalo City Metropolitan',
    municipality_id: 'muni-5',
    requested_at: '2026-02-18T16:00:00Z',
    status: 'approved',
    decided_at: '2026-02-19T10:30:00Z',
    decided_by: 'salga.admin@salga.org.za',
  },
  {
    id: 'mock-6',
    user_id: 'u6',
    user_email: 'pieter.van.der.berg@solplaatje.gov.za',
    user_name: 'Pieter van der Berg',
    requested_role: 'municipal_manager',
    municipality_name: 'Sol Plaatje Local',
    municipality_id: 'muni-6',
    requested_at: '2026-02-15T12:00:00Z',
    status: 'rejected',
    decided_at: '2026-02-16T14:00:00Z',
    decided_by: 'salga.admin@salga.org.za',
  },
];

const TIER1_ROLES = [
  { value: 'executive_mayor', label: 'Executive Mayor' },
  { value: 'municipal_manager', label: 'Municipal Manager' },
  { value: 'cfo', label: 'CFO' },
  { value: 'speaker', label: 'Speaker' },
];

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const config = {
    pending: {
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.3)',
      color: 'var(--color-gold)',
      label: 'Pending',
    },
    approved: {
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.3)',
      color: '#22c55e',
      label: 'Approved',
    },
    rejected: {
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      color: 'var(--color-coral)',
      label: 'Rejected',
    },
  }[status];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoleApprovalsPage() {
  const { session, getTenantId } = useAuth();

  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);

  // Filter state
  const [filterRole, setFilterRole] = useState('');
  const [filterMunicipality, setFilterMunicipality] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'pending' | 'approved' | 'rejected'>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);

  const token = session?.access_token;
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchApprovals = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setUsingMockData(false);

    try {
      const tenantId = getTenantId();
      const res = await fetch(`${apiUrl}/api/v1/auth/tier1-approvals`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      const list: ApprovalRequest[] = Array.isArray(data) ? data : (data.requests ?? []);
      setRequests(list);
    } catch (err) {
      // Error fallback — show mock data with banner
      setError(err instanceof Error ? err.message : 'Failed to load approval requests');
      setRequests(MOCK_APPROVALS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [token, apiUrl, getTenantId]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // ---------------------------------------------------------------------------
  // Approve / Reject
  // ---------------------------------------------------------------------------

  const handleApprove = async (id: string) => {
    if (!token) return;
    setDeciding(id);
    try {
      const tenantId = getTenantId();
      const res = await fetch(`${apiUrl}/api/v1/auth/tier1-approvals/${id}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      // Optimistic update — mark as approved in local state
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setDeciding(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    setDeciding(id);
    try {
      const tenantId = getTenantId();
      const res = await fetch(`${apiUrl}/api/v1/auth/tier1-approvals/${id}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      // Optimistic update — mark as rejected in local state
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'rejected' as const } : r))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setDeciding(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Filtering and pagination
  // ---------------------------------------------------------------------------

  const municipalities = useMemo(() => {
    const names = requests
      .map((r) => r.municipality_name)
      .filter((n): n is string => !!n);
    return [...new Set(names)].sort();
  }, [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterRole && r.requested_role !== filterRole) return false;
      if (filterMunicipality && r.municipality_name !== filterMunicipality) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterDateFrom) {
        const from = new Date(filterDateFrom).getTime();
        const reqDate = new Date(r.requested_at).getTime();
        if (reqDate < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo).getTime() + 86400000; // inclusive end of day
        const reqDate = new Date(r.requested_at).getTime();
        if (reqDate > to) return false;
      }
      return true;
    });
  }, [requests, filterRole, filterMunicipality, filterStatus, filterDateFrom, filterDateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleClearFilters = () => {
    setFilterRole('');
    setFilterMunicipality('');
    setFilterStatus('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(0);
  };

  const hasActiveFilters =
    filterRole || filterMunicipality || filterStatus || filterDateFrom || filterDateTo;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: 'var(--space-lg)', maxWidth: '1200px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          minHeight: '48px',
          padding: 'var(--space-md) 0',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Role Approval Queue
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              marginTop: 'var(--space-xs)',
              marginBottom: 0,
            }}
          >
            Manage Tier 1 role assignment requests across all municipalities
          </p>
        </div>
        <button
          onClick={fetchApprovals}
          style={{
            padding: 'var(--space-xs) var(--space-md)',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Mock data warning banner */}
      {usingMockData && (
        <div
          style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm) var(--space-md)',
            marginBottom: 'var(--space-lg)',
            color: 'var(--color-gold)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>API unavailable</strong> — Displaying sample data (3 pending, 2 approved, 1 rejected).
            {error && <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>({error})</span>}
          </span>
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          alignItems: 'flex-end',
        }}
      >
        {/* Role filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px', flex: '1 1 160px' }}>
          <label style={styles.filterLabel}>Role</label>
          <select
            value={filterRole}
            onChange={(e) => { setFilterRole(e.target.value); setPage(0); }}
            style={styles.filterSelect}
          >
            <option value="">All Roles</option>
            {TIER1_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Municipality filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px', flex: '2 1 200px' }}>
          <label style={styles.filterLabel}>Municipality</label>
          <select
            value={filterMunicipality}
            onChange={(e) => { setFilterMunicipality(e.target.value); setPage(0); }}
            style={styles.filterSelect}
          >
            <option value="">All Municipalities</option>
            {municipalities.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px', flex: '1 1 140px' }}>
          <label style={styles.filterLabel}>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as '' | 'pending' | 'approved' | 'rejected'); setPage(0); }}
            style={styles.filterSelect}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Date from */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px', flex: '1 1 140px' }}>
          <label style={styles.filterLabel}>From Date</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(0); }}
            style={styles.filterInput}
          />
        </div>

        {/* Date to */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '140px', flex: '1 1 140px' }}>
          <label style={styles.filterLabel}>To Date</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(0); }}
            style={styles.filterInput}
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            style={{
              alignSelf: 'flex-end',
              padding: '0.4rem 1rem',
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        {loading ? 'Loading...' : `${filtered.length} request${filtered.length !== 1 ? 's' : ''}${hasActiveFilters ? ' (filtered)' : ''}`}
      </div>

      {/* Approval table */}
      <div
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {!loading && filtered.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-2xl)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}
          >
            {hasActiveFilters
              ? 'No requests match the current filters. Clear filters to see all requests.'
              : 'No pending role approval requests. New requests will appear here when municipalities submit Tier 1 role assignments.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Requester', 'Requested Role', 'Municipality', 'Requested Date', 'Status', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: 'var(--space-sm) var(--space-md)',
                          textAlign: 'left' as const,
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase' as const,
                          letterSpacing: '0.05em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3].map((i) => (
                      <tr key={i}>
                        {[180, 140, 160, 140, 90, 120].map((w, j) => (
                          <td key={j} style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                            <div
                              style={{
                                height: '14px',
                                width: `${w}px`,
                                maxWidth: '100%',
                                background: 'rgba(255,255,255,0.06)',
                                borderRadius: '4px',
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : paginated.map((req) => (
                      <tr
                        key={req.id}
                        style={{ borderBottom: '1px solid var(--glass-border)' }}
                      >
                        {/* Requester */}
                        <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                          {req.user_name && (
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                fontSize: 'var(--text-sm)',
                              }}
                            >
                              {req.user_name}
                            </div>
                          )}
                          <div
                            style={{
                              color: 'var(--text-muted)',
                              fontSize: 'var(--text-xs)',
                            }}
                          >
                            {req.user_email}
                          </div>
                        </td>

                        {/* Requested Role */}
                        <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '12px',
                              fontSize: 'var(--text-xs)',
                              fontWeight: 600,
                              background: 'rgba(251, 191, 36, 0.12)',
                              color: 'var(--color-gold)',
                              border: '1px solid rgba(251, 191, 36, 0.3)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatRole(req.requested_role)}
                          </span>
                        </td>

                        {/* Municipality */}
                        <td
                          style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          {req.municipality_name ?? '—'}
                        </td>

                        {/* Requested Date */}
                        <td
                          style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            color: 'var(--text-muted)',
                            fontSize: 'var(--text-sm)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDate(req.requested_at)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                          <StatusBadge status={req.status} />
                        </td>

                        {/* Actions */}
                        <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                              <button
                                disabled={deciding === req.id}
                                onClick={() => handleApprove(req.id)}
                                style={{
                                  padding: '3px 12px',
                                  background:
                                    deciding === req.id
                                      ? 'rgba(34, 197, 94, 0.1)'
                                      : 'rgba(34, 197, 94, 0.12)',
                                  border: '1px solid rgba(34, 197, 94, 0.3)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: '#22c55e',
                                  fontSize: 'var(--text-xs)',
                                  fontWeight: 600,
                                  cursor: deciding === req.id ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Approve
                              </button>
                              <button
                                disabled={deciding === req.id}
                                onClick={() => handleReject(req.id)}
                                style={{
                                  padding: '3px 12px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: 'var(--radius-sm)',
                                  color: 'var(--color-coral)',
                                  fontSize: 'var(--text-xs)',
                                  fontWeight: 600,
                                  cursor: deciding === req.id ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'var(--space-md)',
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: page === 0 ? 'not-allowed' : 'pointer',
              opacity: page === 0 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              color: page >= totalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages - 1 ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  filterLabel: {
    fontSize: '0.72rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  filterSelect: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.4rem 0.6rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    cursor: 'pointer',
  },
  filterInput: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.4rem 0.6rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  },
};
