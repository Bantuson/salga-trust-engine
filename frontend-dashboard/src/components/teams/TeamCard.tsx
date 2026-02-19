/**
 * TeamCard — Individual team card with category badge and stats.
 *
 * Uses AnimatedCard + GlassCard wrapper matching MetricsCards pattern.
 * Displays: team name, category badge, manager name, member count, active tickets.
 */

import { AnimatedCard } from '../AnimatedCard';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { getCategoryConfig } from '../../constants/categories';
import type { Team } from '../../types/teams';

interface TeamCardProps {
  team: Team;
  index: number;
  onClick: () => void;
}

export function TeamCard({ team, index, onClick }: TeamCardProps) {
  const categoryConfig = getCategoryConfig(team.category);
  const glowColor = index % 2 === 0 ? 'coral' : 'teal';

  return (
    <AnimatedCard glowColor={glowColor} delay={index * 0.05}>
      <GlassCard variant="interactive" onClick={onClick} style={styles.card}>
        {/* Top section: name + category badge */}
        <div style={styles.topSection}>
          <h3 style={styles.teamName}>{team.name}</h3>
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

        {/* Middle section: manager */}
        <div style={styles.managerRow}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, color: 'var(--text-muted)' }}
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span style={team.manager_name ? styles.managerName : styles.noManager}>
            {team.manager_name || 'No manager assigned'}
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
    </AnimatedCard>
  );
}

const styles = {
  card: {
    minHeight: '160px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
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
    color: 'var(--text-primary)',
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
  managerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } as React.CSSProperties,
  managerName: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    truncate: true,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  noManager: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
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
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  statLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  statDivider: {
    width: '1px',
    height: '20px',
    backgroundColor: 'var(--glass-border)',
  } as React.CSSProperties,
};
