/**
 * FieldWorkerTeamPage -- Supervisor's team management page with 4 tabs.
 *
 * Tabs: Members, Schedule, Reviews, Assignments
 * Data source: useSupervisorTeam() hook with mock fallback.
 * Read-only view of team roster, shift schedules, performance reviews,
 * and ticket role assignments.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { getCategoryConfig } from '../constants/categories';
import { useSupervisorTeam } from '../hooks/useSupervisorTeam';
import { MemberDetailModal } from '../components/teams/MemberDetailModal';
import { MemberScheduleModal } from '../components/teams/MemberScheduleModal';
import { ReviewDetailModal } from '../components/teams/ReviewDetailModal';
import { AssignmentDetailModal } from '../components/teams/AssignmentDetailModal';
import type { TeamMember, TeamSchedule, TeamReview, TicketRoleAssignment } from '../types/teams';

type TabKey = 'members' | 'schedule' | 'reviews' | 'assignments';

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'members', label: 'Members' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'assignments', label: 'Assignments' },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.split(' ');
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string, fmt: string = 'MMM dd'): string {
  try {
    return format(new Date(dateStr), fmt);
  } catch {
    return dateStr;
  }
}

function getShiftColor(shift: string): string {
  switch (shift) {
    case 'morning': return '#00bfa5';
    case 'afternoon': return '#FBBF24';
    case 'night': return '#a78bfa';
    default: return 'var(--text-muted)';
  }
}

function getScheduleStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return '#22c55e';
    case 'on_leave': return '#FBBF24';
    case 'absent': return '#ef4444';
    default: return 'var(--text-muted)';
  }
}

function getRoleColor(role: string): { bg: string; color: string } {
  switch (role) {
    case 'lead': return { bg: 'rgba(0,191,165,0.15)', color: '#00bfa5' };
    case 'support': return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    case 'inspector': return { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' };
    default: return { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' };
  }
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function MembersPanel({ members, onItemClick }: { members: TeamMember[]; onItemClick?: (m: TeamMember) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (members.length === 0) {
    return (
      <GlassCard variant="default" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No team members found.</p>
      </GlassCard>
    );
  }

  return (
    <div style={styles.panelGrid}>
      {members.map((m) => {
        const isManager = m.role === 'manager';
        return (
          <GlassCard
            key={m.id}
            variant="default"
            style={{
              padding: '1rem',
              cursor: onItemClick ? 'pointer' : 'default',
              background: hoveredId === m.id ? 'rgba(255,255,255,0.1)' : undefined,
              transition: 'background 0.15s ease',
            }}
            onClick={() => onItemClick?.(m)}
            onMouseEnter={() => setHoveredId(m.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div style={styles.memberRow}>
              {/* Avatar */}
              <div style={styles.avatar}>{getInitials(m.full_name)}</div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.memberName}>{m.full_name}</div>
                <span
                  style={{
                    ...styles.pill,
                    background: isManager
                      ? 'rgba(255, 107, 74, 0.15)'
                      : 'rgba(0, 191, 165, 0.15)',
                    color: isManager ? 'var(--color-coral)' : 'var(--color-teal)',
                  }}
                >
                  {m.role}
                </span>
              </div>

              {/* Joined */}
              {m.joined_at && (
                <span style={styles.mutedDate}>
                  Joined {formatDate(m.joined_at, 'MMM dd, yyyy')}
                </span>
              )}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

function SchedulePanel({ schedules, onItemClick }: { schedules: TeamSchedule[]; onItemClick?: (s: TeamSchedule) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (schedules.length === 0) {
    return (
      <GlassCard variant="default" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No schedules found.</p>
      </GlassCard>
    );
  }

  return (
    <div style={styles.innerSection}>
      {schedules.map((s, i) => (
        <div
          key={s.id}
          style={{
            ...styles.listRow,
            borderBottom:
              i < schedules.length - 1 ? '1px solid var(--glass-border)' : 'none',
            cursor: onItemClick ? 'pointer' : 'default',
            background: hoveredId === s.id ? 'rgba(255,255,255,0.06)' : 'transparent',
            transition: 'background 0.15s ease',
            borderRadius: 'var(--radius-sm)',
          }}
          onClick={() => onItemClick?.(s)}
          onMouseEnter={() => setHoveredId(s.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <span style={{ flex: 1, color: 'var(--text-primary)' }}>{s.member_name}</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {formatDate(s.date)}
          </span>
          <span
            style={{
              ...styles.pill,
              background: `${getShiftColor(s.shift)}22`,
              color: getShiftColor(s.shift),
            }}
          >
            {s.shift}
          </span>
          <span
            style={{
              ...styles.pill,
              background: `${getScheduleStatusColor(s.status)}22`,
              color: getScheduleStatusColor(s.status),
            }}
          >
            {s.status.replace('_', ' ')}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReviewsPanel({ reviews, onItemClick }: { reviews: TeamReview[]; onItemClick?: (r: TeamReview) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <GlassCard variant="default" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No reviews found.</p>
      </GlassCard>
    );
  }

  return (
    <div style={styles.panelGrid}>
      {reviews.map((r) => (
        <div
          key={r.id}
          style={{
            ...styles.innerSection,
            cursor: onItemClick ? 'pointer' : 'default',
            background: hoveredId === r.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
            transition: 'background 0.15s ease',
          }}
          onClick={() => onItemClick?.(r)}
          onMouseEnter={() => setHoveredId(r.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          {/* Header */}
          <div style={styles.reviewHeader}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{r.member_name}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {formatDate(r.review_date, 'MMM dd, yyyy')}
            </span>
          </div>

          {/* Stars */}
          <div style={{ margin: '0.5rem 0', fontSize: '1rem', color: '#FBBF24' }}>
            {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
          </div>

          {/* Comments */}
          <p style={styles.reviewComment}>{r.comments}</p>

          {/* Reviewer */}
          <p style={styles.reviewerLine}>Reviewed by {r.reviewer_name}</p>
        </div>
      ))}
    </div>
  );
}

function AssignmentsPanel({ assignments, onItemClick }: { assignments: TicketRoleAssignment[]; onItemClick?: (a: TicketRoleAssignment) => void }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (assignments.length === 0) {
    return (
      <GlassCard variant="default" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No role assignments found.</p>
      </GlassCard>
    );
  }

  return (
    <div style={styles.innerSection}>
      {assignments.map((a, i) => {
        const roleStyle = getRoleColor(a.assigned_role);
        return (
          <div
            key={a.id}
            style={{
              ...styles.listRow,
              borderBottom:
                i < assignments.length - 1 ? '1px solid var(--glass-border)' : 'none',
              cursor: onItemClick ? 'pointer' : 'default',
              background: hoveredId === a.id ? 'rgba(255,255,255,0.06)' : 'transparent',
              transition: 'background 0.15s ease',
              borderRadius: 'var(--radius-sm)',
            }}
            onClick={() => onItemClick?.(a)}
            onMouseEnter={() => setHoveredId(a.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <span style={styles.trackingNumber}>{a.tracking_number}</span>
            <span style={{ flex: 1, color: 'var(--text-primary)' }}>{a.member_name}</span>
            <span
              style={{
                ...styles.pill,
                background: roleStyle.bg,
                color: roleStyle.color,
              }}
            >
              {a.assigned_role}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {formatDate(a.assigned_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function LoadingSkeletons() {
  return (
    <SkeletonTheme>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[0, 1, 2, 3].map((i) => (
          <GlassCard key={i} variant="default" style={{ padding: '1.25rem' }}>
            <Skeleton height={16} width="50%" style={{ marginBottom: '0.75rem' }} />
            <Skeleton height={12} width="30%" style={{ marginBottom: '0.5rem' }} />
            <Skeleton height={12} width="70%" />
          </GlassCard>
        ))}
      </div>
    </SkeletonTheme>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FieldWorkerTeamPage() {
  const { team, members, schedules, reviews, roleAssignments, isLoading } = useSupervisorTeam();
  const [activeTab, setActiveTab] = useState<TabKey>('members');

  // Modal selection state
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedScheduleMember, setSelectedScheduleMember] = useState<{ id: string; name: string } | null>(null);
  const [selectedReview, setSelectedReview] = useState<TeamReview | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<TicketRoleAssignment | null>(null);

  const categoryConfig = team ? getCategoryConfig(team.category) : null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>My Team</h1>
          {team && <p style={styles.subtitle}>{team.name}</p>}
        </div>
        {team && categoryConfig && (
          <span
            style={{
              ...styles.categoryBadge,
              background: categoryConfig.bgColor + '33',
              color: categoryConfig.color,
            }}
          >
            {categoryConfig.label}
          </span>
        )}
      </header>

      {isLoading ? (
        <LoadingSkeletons />
      ) : (
        <>
          {/* Tab bar */}
          <div style={styles.tabs}>
            {TAB_LABELS.map((t) => (
              <button
                key={t.key}
                style={activeTab === t.key ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={styles.tabContent}>
            {activeTab === 'members' && (
              <MembersPanel members={members} onItemClick={setSelectedMember} />
            )}
            {activeTab === 'schedule' && (
              <SchedulePanel
                schedules={schedules}
                onItemClick={(s) => setSelectedScheduleMember({ id: s.member_id, name: s.member_name })}
              />
            )}
            {activeTab === 'reviews' && (
              <ReviewsPanel reviews={reviews} onItemClick={setSelectedReview} />
            )}
            {activeTab === 'assignments' && (
              <AssignmentsPanel assignments={roleAssignments} onItemClick={setSelectedAssignment} />
            )}
          </div>
        </>
      )}

      {/* Detail modals */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
      {selectedScheduleMember && (
        <MemberScheduleModal
          memberName={selectedScheduleMember.name}
          memberId={selectedScheduleMember.id}
          schedules={schedules}
          onClose={() => setSelectedScheduleMember(null)}
        />
      )}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          allReviews={reviews}
          onClose={() => setSelectedReview(null)}
        />
      )}
      {selectedAssignment && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    marginTop: '0.25rem',
  } as React.CSSProperties,
  categoryBadge: {
    padding: '0.35rem 0.875rem',
    borderRadius: '9999px',
    fontSize: '0.8125rem',
    fontWeight: '600' as const,
  } as React.CSSProperties,

  // Tab bar (matches TeamDetailModal pattern)
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--glass-border)',
    background: 'rgba(255, 255, 255, 0.05)',
    marginBottom: '1.5rem',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
  } as React.CSSProperties,
  tab: {
    padding: '0.75rem 1.5rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500' as const,
    fontFamily: 'inherit',
    transition: 'color 0.2s ease',
  } as React.CSSProperties,
  tabActive: {
    padding: '0.75rem 1.5rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid var(--color-teal)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  tabContent: {
    minHeight: '300px',
  } as React.CSSProperties,

  // Inner sections (glass panels)
  innerSection: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
  } as React.CSSProperties,

  // Members panel
  panelGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-teal), var(--color-coral))',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8125rem',
    fontWeight: '700' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  memberName: {
    color: 'var(--text-primary)',
    fontWeight: '600' as const,
    fontSize: '0.9375rem',
    marginBottom: '0.2rem',
  } as React.CSSProperties,
  pill: {
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
    display: 'inline-block',
  } as React.CSSProperties,
  mutedDate: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    flexShrink: 0,
  } as React.CSSProperties,

  // List rows (schedule, assignments)
  listRow: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    padding: '0.75rem',
  } as React.CSSProperties,

  // Reviews
  reviewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  reviewComment: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    margin: '0 0 0.5rem 0',
  } as React.CSSProperties,
  reviewerLine: {
    color: 'var(--text-muted)',
    fontSize: '0.8rem',
    margin: 0,
  } as React.CSSProperties,

  // Assignments
  trackingNumber: {
    fontFamily: 'monospace',
    fontWeight: '600' as const,
    color: 'var(--color-teal)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
