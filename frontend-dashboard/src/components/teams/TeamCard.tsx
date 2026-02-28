/**
 * TeamCard — Individual team card with category badge and stats.
 *
 * Uses GlassCard only (no AnimatedCard wrapper to avoid double backgrounds).
 * Displays: team name, category badge, manager name, member count, active tickets.
 */

import { GlassCard } from '@shared/components/ui/GlassCard';
import { getCategoryConfig } from '../../constants/categories';
import type { Team } from '../../types/teams';

interface TeamCardProps {
  team: Team;
  index: number;
  onClick: () => void;
}

export function TeamCard({ team, onClick }: TeamCardProps) {
  const categoryConfig = getCategoryConfig(team.category);

  return (
    <GlassCard variant="interactive" onClick={onClick} style={styles.card}>
      {/* Top section: supervisor name + category badge */}
      <div style={styles.topSection}>
        <h3 style={styles.teamName}>{team.manager_name || 'Unassigned Supervisor'}</h3>
        <span
          style={{
            ...styles.categoryBadge,
            backgroundColor: categoryConfig.bgColor,
            color: categoryConfig.color,
          }}
        >
          {categoryConfig.label}
        </span>
      </div>

      {/* Middle section: team name */}
      <div style={styles.teamNameRow}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, color: 'rgba(255, 255, 255, 0.5)' }}
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span style={styles.teamSubtitle}>
          {team.name}
        </span>
      </div>

      {/* Bottom section: stats */}
      <div style={styles.statsRow}>
        {/* Member count */}
        <div style={styles.statItem}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--color-teal)' }}
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span style={styles.statValue}>{team.member_count}</span>
          <span style={styles.statLabel}>members</span>
        </div>

        {/* Divider */}
        <div style={styles.statDivider} />

        {/* Active tickets */}
        <div style={styles.statItem}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--color-coral)' }}
          >
            <path d="M15 5v2" />
            <path d="M15 11v2" />
            <path d="M15 17v2" />
            <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7a2 2 0 0 1 2-2z" />
          </svg>
          <span style={styles.statValue}>{team.active_ticket_count}</span>
          <span style={styles.statLabel}>active tickets</span>
        </div>
      </div>
    </GlassCard>
  );
}

const styles = {
  card: {
    height: '200px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
    overflow: 'hidden',
  } as React.CSSProperties,
  topSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--space-sm)',
  } as React.CSSProperties,
  teamName: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    margin: 0,
    lineHeight: 1.3,
    flex: 1,
    minWidth: 0,
    wordBreak: 'break-word' as const,
  } as React.CSSProperties,
  categoryBadge: {
    flexShrink: 0,
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  teamNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  teamSubtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255, 255, 255, 0.65)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    marginTop: 'auto',
    paddingTop: 'var(--space-sm)',
    borderTop: '1px solid var(--glass-border)',
  } as React.CSSProperties,
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  } as React.CSSProperties,
  statValue: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 0.75)',
  } as React.CSSProperties,
  statLabel: {
    fontSize: '0.78rem',
    color: 'rgba(255, 255, 255, 0.5)',
  } as React.CSSProperties,
  statDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'var(--glass-border)',
  } as React.CSSProperties,
};
