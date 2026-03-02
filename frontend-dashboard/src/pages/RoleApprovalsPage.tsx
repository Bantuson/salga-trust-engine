/**
 * RoleApprovalsPage — Tier 1 role approval management for SALGA Admin.
 *
 * Fetches GET /api/v1/roles/approvals/pending and lets SALGA Admin
 * approve or reject each pending request inline.
 *
 * Approve: POST /api/v1/roles/approvals/{id}/decide with { approved: true, reason: "Approved" }
 * Reject:  POST /api/v1/roles/approvals/{id}/decide with { approved: false, reason: <prompt> }
 *
 * Optimistic update: removes the decided request from the list immediately.
 *
 * Styling: CSS variables only (Phase 27-03 lock — no Tailwind classes).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';

interface Tier1ApprovalRequest {
  id: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  requested_role: string;
  requested_at: string;
  status: string;
}

export function RoleApprovalsPage() {
  const { session } = useAuth();
  const [requests, setRequests] = useState<Tier1ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null); // id of request being decided

  const token = session?.access_token;

  const fetchPendingApprovals = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/roles/approvals/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : (data.requests ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleDecide = async (id: string, approved: boolean) => {
    if (!token) return;

    let reason = approved ? 'Approved' : null;
    if (!approved) {
      reason = window.prompt('Reason for rejection (optional):') ?? 'Rejected';
    }

    setDeciding(id);
    try {
      const res = await fetch(`/api/v1/roles/approvals/${id}/decide`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved, reason: reason || 'Rejected' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      // Optimistic update — remove the decided request from the list
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process decision');
    } finally {
      setDeciding(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-ZA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  };

  const formatRole = (role: string) =>
    role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
        Loading pending approvals...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--space-lg)' }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-md)',
          color: 'var(--color-coral)',
        }}>
          Failed to load approvals: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-lg)', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '48px',
        padding: 'var(--space-md) 0',
        marginBottom: 'var(--space-lg)',
      }}>
        <h1 style={{
          fontSize: 'var(--text-2xl)',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          Role Approval Requests
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          marginTop: 'var(--space-xs)',
        }}>
          Pending Tier 1 executive role assignments awaiting SALGA Admin approval
        </p>
      </div>

      {/* Approvals list */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {requests.length === 0 ? (
          <div style={{
            padding: 'var(--space-xl)',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}>
            No pending approvals. All Tier 1 role requests have been processed.
          </div>
        ) : (
          <>
            <div style={{
              padding: 'var(--space-sm) var(--space-md)',
              borderBottom: '1px solid var(--glass-border)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr auto',
              gap: 'var(--space-md)',
            }}>
              {['Requesting User', 'Requested Role', 'Requested At', 'Actions'].map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em',
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {requests.map((req) => (
              <div
                key={req.id}
                style={{
                  padding: 'var(--space-md)',
                  borderBottom: '1px solid var(--glass-border)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: 'var(--space-md)',
                  alignItems: 'center',
                }}
              >
                {/* User info */}
                <div>
                  {req.user_name && (
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                      {req.user_name}
                    </div>
                  )}
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                    {req.user_email}
                  </div>
                </div>

                {/* Requested role */}
                <div>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    background: 'rgba(251, 191, 36, 0.15)',
                    color: 'var(--color-gold)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                  }}>
                    {formatRole(req.requested_role)}
                  </span>
                </div>

                {/* Timestamp */}
                <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                  {formatDate(req.requested_at)}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <button
                    disabled={deciding === req.id}
                    onClick={() => handleDecide(req.id, true)}
                    style={{
                      padding: '4px 14px',
                      background: deciding === req.id ? 'rgba(45, 212, 191, 0.2)' : 'rgba(45, 212, 191, 0.15)',
                      border: '1px solid rgba(45, 212, 191, 0.4)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-teal)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      cursor: deciding === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    disabled={deciding === req.id}
                    onClick={() => handleDecide(req.id, false)}
                    style={{
                      padding: '4px 14px',
                      background: deciding === req.id ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-coral)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      cursor: deciding === req.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Count */}
      {requests.length > 0 && (
        <p style={{
          marginTop: 'var(--space-sm)',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
        }}>
          {requests.length} pending request{requests.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
