/**
 * MembersTab — Lists team members with avatar, role badge, and remove action.
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fetchTeamMembers, removeTeamMember } from '../../services/api';
import { Badge } from '@shared/components/ui/Badge';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import type { TeamMember } from '../../types/teams';

interface MembersTabProps {
  teamId: string;
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

export function MembersTab({ teamId }: MembersTabProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  const handleRemove = async (member: TeamMember) => {
    if (!window.confirm(`Remove ${member.full_name} from this team?`)) return;

    setRemovingId(member.id);
    try {
      await removeTeamMember(teamId, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
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
    );
  }

  if (error) {
    return <p style={styles.errorText}>{error}</p>;
  }

  if (members.length === 0) {
    return (
      <p style={styles.emptyText}>
        No team members yet. Send invitations to add members.
      </p>
    );
  }

  return (
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

          {/* Remove */}
          <button
            style={{
              ...styles.removeButton,
              opacity: removingId === member.id ? 0.5 : 1,
              cursor: removingId === member.id ? 'not-allowed' : 'pointer',
            }}
            onClick={() => handleRemove(member)}
            disabled={removingId === member.id}
            title="Remove from team"
          >
            Remove
          </button>
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
  removeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--color-coral)',
    fontSize: '0.775rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
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
