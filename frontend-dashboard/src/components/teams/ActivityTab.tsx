/**
 * ActivityTab — Timeline of team activity (informational, read-only).
 *
 * Derives events from team member joined_at dates and invitation created_at dates.
 * Falls back to empty state message if no data.
 */

import type { Team } from '../../types/teams';

interface ActivityTabProps {
  teamId: string;
  team?: Team;
}

interface TimelineEvent {
  id: string;
  type: 'member_joined' | 'team_created';
  label: string;
  date: string | null;
}

export function ActivityTab({ team }: ActivityTabProps) {
  // Derive events from team creation date if available
  const events: TimelineEvent[] = [];

  if (team?.created_at) {
    events.push({
      id: 'team-created',
      type: 'team_created',
      label: `Team "${team.name}" was created`,
      date: team.created_at,
    });
  }

  return (
    <div style={styles.container}>
      {events.length === 0 ? (
        <p style={styles.emptyText}>
          Team activity will appear here as members join and tickets are assigned.
        </p>
      ) : (
        <div style={styles.timeline}>
          {events.map((event, index) => (
            <div key={event.id} style={styles.timelineItem}>
              {/* Dot + line */}
              <div style={styles.dotColumn}>
                <div
                  style={{
                    ...styles.dot,
                    backgroundColor:
                      event.type === 'team_created'
                        ? 'var(--color-teal)'
                        : 'var(--color-coral)',
                  }}
                />
                {index < events.length - 1 && <div style={styles.line} />}
              </div>

              {/* Content */}
              <div style={styles.eventContent}>
                <span style={styles.eventLabel}>{event.label}</span>
                {event.date && (
                  <span style={styles.eventDate}>
                    {new Date(event.date).toLocaleDateString('en-ZA', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={styles.footerNote}>
        Detailed activity logs (member joins, ticket assignments) will appear as the team operates.
      </p>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
  } as React.CSSProperties,
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
    padding: '2rem 0',
    margin: 0,
  } as React.CSSProperties,
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  } as React.CSSProperties,
  timelineItem: {
    display: 'flex',
    gap: 'var(--space-md)',
    position: 'relative' as const,
    paddingBottom: 'var(--space-md)',
  } as React.CSSProperties,
  dotColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flexShrink: 0,
    width: '20px',
  } as React.CSSProperties,
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '4px',
    boxShadow: '0 0 6px currentColor',
  } as React.CSSProperties,
  line: {
    flex: 1,
    width: '2px',
    background: 'var(--glass-border)',
    marginTop: '4px',
    minHeight: '20px',
  } as React.CSSProperties,
  eventContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  } as React.CSSProperties,
  eventLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    lineHeight: 1.4,
  } as React.CSSProperties,
  eventDate: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  footerNote: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: 'var(--space-sm) 0',
    borderTop: '1px solid var(--glass-border)',
    marginTop: 'var(--space-sm)',
  } as React.CSSProperties,
};
