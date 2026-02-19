/**
 * TeamLeaderboard — horizontal bar rankings for team performance.
 *
 * Per locked decision: "Team/category comparisons as horizontal bar rankings
 * with progress bars and trend arrows (leaderboard style)"
 * Per context: "Team leaderboards should use horizontal bars (not vertical)
 * for easy scanning"
 *
 * - Sorted by total_count descending
 * - Max 10 teams
 * - Progress bar: fill proportional to max total_count in list
 * - Trend arrow: up (teal) = more resolved than open, down (coral) = more open
 */

interface LeaderboardTeam {
  team_id: string;
  team_name: string;
  open_count: number;
  total_count: number;
}

interface TeamLeaderboardProps {
  workload: LeaderboardTeam[];
  title?: string;
}

export function TeamLeaderboard({ workload, title = 'Team Performance' }: TeamLeaderboardProps) {
  if (!workload || workload.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>
          <span style={styles.rankIcon}>🏆</span> {title}
        </h2>
        <p style={styles.empty}>No team data available for this period.</p>
      </div>
    );
  }

  const sorted = [...workload]
    .sort((a, b) => b.total_count - a.total_count)
    .slice(0, 10);

  const maxTotal = Math.max(...sorted.map((t) => t.total_count), 1);

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>
        <span style={styles.rankIcon}>🏆</span> {title}
      </h2>

      <div style={styles.list}>
        {sorted.map((team, i) => {
          const resolved = team.total_count - team.open_count;
          const resolutionRate = team.total_count > 0 ? resolved / team.total_count : 0;
          const trendUp = resolutionRate >= 0.5;
          const trendColor = trendUp ? 'var(--color-teal)' : 'var(--color-coral)';
          const trendArrow = trendUp ? '↑' : '↓';
          const barWidth = Math.max((team.total_count / maxTotal) * 100, 2);

          return (
            <div key={team.team_id} style={styles.row}>
              {/* Rank */}
              <span style={styles.rank}>#{i + 1}</span>

              {/* Team name */}
              <div style={styles.nameCol}>
                <span style={styles.teamName}>{team.team_name}</span>
                {/* Progress bar track */}
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${barWidth}%`,
                    }}
                  />
                </div>
              </div>

              {/* Value + trend */}
              <div style={styles.metaCol}>
                <span style={styles.totalCount}>{team.total_count}</span>
                <span style={{ ...styles.trendArrow, color: trendColor }}>{trendArrow}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
  },
  heading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  rankIcon: {
    fontSize: '1rem',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
    padding: '2rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.875rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  rank: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    minWidth: '2rem',
    textAlign: 'right' as const,
    flexShrink: 0,
  },
  nameCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    minWidth: 0,
  },
  teamName: {
    fontSize: '0.8125rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  barTrack: {
    height: '8px',
    borderRadius: '9999px',
    background: 'var(--glass-border)',
    overflow: 'hidden',
  } as React.CSSProperties,
  barFill: {
    height: '100%',
    borderRadius: '9999px',
    background: 'linear-gradient(90deg, var(--color-teal), rgba(0,191,165,0.6))',
    transition: 'width 0.6s ease',
  } as React.CSSProperties,
  metaCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '0.125rem',
    flexShrink: 0,
  },
  totalCount: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  trendArrow: {
    fontSize: '0.75rem',
    fontWeight: '700',
  },
};
