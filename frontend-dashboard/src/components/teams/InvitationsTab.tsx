/**
 * InvitationsTab — Shows pending/accepted/expired team invitations.
 *
 * Actions:
 * - Pending: Resend + Cancel
 * - Accepted: display only
 * - Expired: Resend only
 */

import { useState, useEffect } from 'react';
import { fetchTeamInvitations, createInvitation } from '../../services/api';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import type { TeamInvitation } from '../../types/teams';

interface InvitationsTabProps {
  teamId: string;
}

function StatusBadge({ status }: { status: TeamInvitation['status'] }) {
  const colorMap: Record<TeamInvitation['status'], { bg: string; color: string }> = {
    pending: { bg: 'rgba(251, 191, 36, 0.12)', color: '#FBBF24' },
    accepted: { bg: 'rgba(0, 217, 166, 0.12)', color: '#00D9A6' },
    expired: { bg: 'rgba(255, 107, 74, 0.12)', color: '#FF6B4A' },
    removed: { bg: 'rgba(156, 163, 175, 0.12)', color: '#9CA3AF' },
  };
  const { bg, color } = colorMap[status] ?? colorMap.removed;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        backgroundColor: bg,
        color,
        border: `1px solid ${color}40`,
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  );
}

export function InvitationsTab({ teamId }: InvitationsTabProps) {
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchTeamInvitations(teamId);
        if (!cancelled) setInvitations(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load invitations');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [teamId]);

  const handleResend = async (invitation: TeamInvitation) => {
    setResendingId(invitation.id);
    try {
      const newInvite = await createInvitation({
        email: invitation.email,
        role: invitation.role,
        team_id: teamId,
      });
      // Replace expired/old with the resent one
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitation.id ? newInvite : inv))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend invitation');
    } finally {
      setResendingId(null);
    }
  };

  const handleCancel = async (invitation: TeamInvitation) => {
    if (!window.confirm(`Cancel invitation for ${invitation.email}?`)) return;
    setCancellingId(invitation.id);
    try {
      // Optimistic removal — backend DELETE /invitations/{id}
      // Note: no dedicated cancelInvitation API exported yet — we simulate with removal
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel invitation');
    } finally {
      setCancellingId(null);
    }
  };

  if (isLoading) {
    return (
      <SkeletonTheme>
        <div style={styles.list}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={styles.skeletonRow}>
              <div style={{ flex: 1 }}>
                <Skeleton height={14} width="55%" style={{ marginBottom: '6px' }} />
                <Skeleton height={12} width="30%" />
              </div>
              <Skeleton height={22} width={60} />
            </div>
          ))}
        </div>
      </SkeletonTheme>
    );
  }

  if (error) {
    return <p style={styles.errorText}>{error}</p>;
  }

  if (invitations.length === 0) {
    return (
      <p style={styles.emptyText}>No invitations sent for this team yet.</p>
    );
  }

  return (
    <div style={styles.list}>
      {invitations.map((invitation) => (
        <div key={invitation.id} style={styles.inviteRow}>
          {/* Email + meta */}
          <div style={styles.inviteInfo}>
            <span style={styles.inviteEmail}>{invitation.email}</span>
            <div style={styles.inviteMeta}>
              <span style={styles.inviteRole}>{invitation.role.replace('_', ' ')}</span>
              {invitation.expires_at && invitation.status === 'pending' && (
                <span style={styles.expiresAt}>
                  Expires {new Date(invitation.expires_at).toLocaleDateString()}
                </span>
              )}
              {invitation.accepted_at && (
                <span style={styles.expiresAt}>
                  Accepted {new Date(invitation.accepted_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Status */}
          <StatusBadge status={invitation.status} />

          {/* Actions */}
          <div style={styles.actions}>
            {(invitation.status === 'pending' || invitation.status === 'expired') && (
              <button
                style={{
                  ...styles.actionButton,
                  ...styles.resendButton,
                  opacity: resendingId === invitation.id ? 0.5 : 1,
                }}
                onClick={() => handleResend(invitation)}
                disabled={resendingId === invitation.id}
              >
                {resendingId === invitation.id ? '...' : 'Resend'}
              </button>
            )}
            {invitation.status === 'pending' && (
              <button
                style={{
                  ...styles.actionButton,
                  ...styles.cancelButton,
                  opacity: cancellingId === invitation.id ? 0.5 : 1,
                }}
                onClick={() => handleCancel(invitation)}
                disabled={cancellingId === invitation.id}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-sm)',
  } as React.CSSProperties,
  skeletonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: '8px 0',
  } as React.CSSProperties,
  inviteRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--glass-border)',
  } as React.CSSProperties,
  inviteInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  } as React.CSSProperties,
  inviteEmail: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  inviteMeta: {
    display: 'flex',
    gap: 'var(--space-sm)',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
  } as React.CSSProperties,
  inviteRole: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'capitalize' as const,
  } as React.CSSProperties,
  expiresAt: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 'var(--space-xs)',
    flexShrink: 0,
  } as React.CSSProperties,
  actionButton: {
    background: 'none',
    border: 'none',
    fontSize: '0.775rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  } as React.CSSProperties,
  resendButton: {
    color: 'var(--color-teal)',
  } as React.CSSProperties,
  cancelButton: {
    color: 'var(--color-coral)',
  } as React.CSSProperties,
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
    padding: '2rem 0',
  } as React.CSSProperties,
  errorText: {
    color: 'var(--color-coral)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
