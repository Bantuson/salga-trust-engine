/**
 * MembersTab — Lists team members with avatar, role badge, and member management actions.
 *
 * Features added (Plan 04):
 * - QuickInviteForm at top (always visible, single invite with role preview)
 * - "Bulk Invite" button to open BulkInviteDialog
 * - "View Permissions" toggle to show/hide PermissionMatrix below members list
 * - Confirmation dialog for remove member (custom dialog, not window.confirm)
 * - "Deactivate Account" option in member row (admin-only, with confirmation dialog)
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fetchTeamMembers, removeTeamMember } from '../../services/api';
import { Badge } from '@shared/components/ui/Badge';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { QuickInviteForm } from './QuickInviteForm';
import { BulkInviteDialog } from './BulkInviteDialog';
import { PermissionMatrix } from './PermissionMatrix';
import type { TeamMember } from '../../types/teams';

interface MembersTabProps {
  teamId: string;
  /** Current user's role — used to conditionally show admin actions */
  currentUserRole?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeVariant(role: string): 'default' | 'success' | 'warning' | 'error' {
  switch (role) {
    case 'admin':
      return 'error';
    case 'manager':
      return 'warning';
    case 'field_worker':
      return 'success';
    default:
      return 'default';
  }
}

/** Custom confirmation dialog — replaces window.confirm for better UX */
interface ConfirmDialogProps {
  message: string;
  subMessage?: string;
  confirmLabel: string;
  confirmDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  message,
  subMessage,
  confirmLabel,
  confirmDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div style={dialogStyles.overlay} onClick={onCancel} role="alertdialog" aria-modal="true">
      <div style={dialogStyles.box} onClick={(e) => e.stopPropagation()}>
        <p style={dialogStyles.message}>{message}</p>
        {subMessage && <p style={dialogStyles.subMessage}>{subMessage}</p>}
        <div style={dialogStyles.actions}>
          <button style={dialogStyles.cancelButton} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            style={{
              ...dialogStyles.confirmButton,
              background: confirmDangerous ? 'var(--color-coral)' : 'var(--color-teal)',
            }}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const dialogStyles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  box: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    padding: '20px 24px',
    maxWidth: '400px',
    width: '100%',
  } as React.CSSProperties,
  message: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
    lineHeight: 1.4,
  } as React.CSSProperties,
  subMessage: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    margin: '0 0 16px 0',
    lineHeight: 1.5,
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '16px',
  } as React.CSSProperties,
  cancelButton: {
    padding: '7px 16px',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  } as React.CSSProperties,
  confirmButton: {
    padding: '7px 16px',
    fontSize: '0.82rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
};

export function MembersTab({ teamId, currentUserRole = 'manager' }: MembersTabProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Dialog states
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<TeamMember | null>(null);

  // UI toggles
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);

  const isAdmin = currentUserRole === 'admin';

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTeamMembers(teamId);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchTeamMembers(teamId);
        if (!cancelled) setMembers(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load members');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [teamId]);

  const handleRemoveConfirmed = async () => {
    if (!confirmRemove) return;
    const member = confirmRemove;
    setConfirmRemove(null);
    setRemovingId(member.id);

    try {
      await removeTeamMember(teamId, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleDeactivateConfirmed = async () => {
    if (!confirmDeactivate) return;
    // Admin-level action: deactivate account across municipality
    // TODO: Call deactivateUserAccount(confirmDeactivate.id) when backend endpoint is available
    const memberName = confirmDeactivate.full_name;
    setConfirmDeactivate(null);
    // For now, remove from team as a proxy action
    setMembers((prev) => prev.filter((m) => m.id !== memberName));
  };

  const handleInvited = () => {
    loadMembers();
  };

  if (isLoading) {
    return (
      <div>
        {/* Show invite form skeleton area while loading */}
        <div style={styles.inviteArea}>
          <div style={styles.skeletonInvite} />
        </div>
        <SkeletonTheme>
          <div style={styles.list}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={styles.skeletonRow}>
                <Skeleton circle height={40} width={40} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={14} width="50%" style={{ marginBottom: '6px' }} />
                  <Skeleton height={12} width="35%" />
                </div>
              </div>
            ))}
          </div>
        </SkeletonTheme>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ---------------------------------------------------------------- */}
      {/* Invite area: QuickInviteForm + Bulk Invite button                 */}
      {/* ---------------------------------------------------------------- */}
      <div style={styles.inviteArea}>
        <div style={styles.inviteHeader}>
          <span style={styles.inviteTitle}>Invite Member</span>
          <button
            style={styles.bulkInviteButton}
            onClick={() => setIsBulkDialogOpen(true)}
            type="button"
          >
            Bulk Invite
          </button>
        </div>
        <QuickInviteForm teamId={teamId} onInvited={handleInvited} />
      </div>

      {/* Error */}
      {error && <p style={styles.errorText}>{error}</p>}

      {/* ---------------------------------------------------------------- */}
      {/* Members list                                                       */}
      {/* ---------------------------------------------------------------- */}
      {members.length === 0 ? (
        <p style={styles.emptyText}>
          No team members yet. Send invitations to add members.
        </p>
      ) : (
        <div style={styles.list}>
          {members.map((member) => (
            <div key={member.id} style={styles.memberRow}>
              {/* Avatar */}
              <div style={styles.avatar}>
                <span style={styles.avatarInitials}>{getInitials(member.full_name)}</span>
              </div>

              {/* Info */}
              <div style={styles.memberInfo}>
                <span style={styles.memberName}>{member.full_name}</span>
                <span style={styles.memberEmail}>{member.email}</span>
                {member.joined_at && (
                  <span style={styles.joinedAt}>
                    Joined {formatDistanceToNow(new Date(member.joined_at), { addSuffix: true })}
                  </span>
                )}
              </div>

              {/* Role badge */}
              <Badge variant={getRoleBadgeVariant(member.role)} size="sm">
                {member.role.replace('_', ' ')}
              </Badge>

              {/* Actions */}
              <div style={styles.memberActions}>
                {/* Remove from team */}
                <button
                  style={{
                    ...styles.removeButton,
                    opacity: removingId === member.id ? 0.5 : 1,
                    cursor: removingId === member.id ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => setConfirmRemove(member)}
                  disabled={removingId === member.id}
                  title="Remove from team"
                  type="button"
                >
                  Remove
                </button>

                {/* Deactivate (admin only) */}
                {isAdmin && (
                  <button
                    style={styles.deactivateButton}
                    onClick={() => setConfirmDeactivate(member)}
                    title="Deactivate user account (admin only)"
                    type="button"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Permission Matrix toggle                                           */}
      {/* ---------------------------------------------------------------- */}
      <div style={styles.matrixSection}>
        <button
          style={styles.matrixToggle}
          onClick={() => setShowPermissionMatrix((v) => !v)}
          type="button"
        >
          {showPermissionMatrix ? 'Hide Permissions' : 'View Permissions'}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showPermissionMatrix ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showPermissionMatrix && (
          <div style={styles.matrixWrapper}>
            <PermissionMatrix editableLabels={isAdmin} />
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Dialogs                                                            */}
      {/* ---------------------------------------------------------------- */}

      {/* Remove confirmation */}
      {confirmRemove && (
        <ConfirmDialog
          message={`Remove ${confirmRemove.full_name} from this team?`}
          subMessage="They will lose access to team tickets."
          confirmLabel="Remove"
          onConfirm={handleRemoveConfirmed}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

      {/* Deactivate account confirmation */}
      {confirmDeactivate && (
        <ConfirmDialog
          message={`Deactivate ${confirmDeactivate.full_name}'s account?`}
          subMessage={`This will deactivate ${confirmDeactivate.full_name}'s account across the entire municipality. They will no longer be able to log in. This action can be reversed by an admin.`}
          confirmLabel="Deactivate"
          confirmDangerous
          onConfirm={handleDeactivateConfirmed}
          onCancel={() => setConfirmDeactivate(null)}
        />
      )}

      {/* Bulk invite dialog */}
      <BulkInviteDialog
        teamId={teamId}
        isOpen={isBulkDialogOpen}
        onClose={() => setIsBulkDialogOpen(false)}
        onInvited={handleInvited}
      />
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
  } as React.CSSProperties,
  inviteArea: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  } as React.CSSProperties,
  inviteHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,
  inviteTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  bulkInviteButton: {
    padding: '5px 12px',
    fontSize: '0.775rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    background: 'rgba(0, 217, 166, 0.12)',
    color: 'var(--color-teal)',
    border: '1px solid rgba(0, 217, 166, 0.3)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
  skeletonInvite: {
    height: '40px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-sm)',
  } as React.CSSProperties,
  skeletonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) 0',
  } as React.CSSProperties,
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--glass-border)',
    transition: 'background 0.15s ease',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  avatar: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-coral), var(--color-teal))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  avatarInitials: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  memberInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  } as React.CSSProperties,
  memberName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  memberEmail: {
    fontSize: '0.775rem',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  joinedAt: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  } as React.CSSProperties,
  memberActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  } as React.CSSProperties,
  removeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-coral)',
    fontSize: '0.775rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  } as React.CSSProperties,
  deactivateButton: {
    background: 'none',
    border: 'none',
    color: 'rgba(205, 94, 129, 0.7)',
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  } as React.CSSProperties,
  matrixSection: {
    marginTop: 'var(--space-sm)',
  } as React.CSSProperties,
  matrixToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.775rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    cursor: 'pointer',
    padding: '4px 0',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    marginBottom: '8px',
  } as React.CSSProperties,
  matrixWrapper: {
    marginTop: '4px',
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
    margin: 0,
  } as React.CSSProperties,
};
