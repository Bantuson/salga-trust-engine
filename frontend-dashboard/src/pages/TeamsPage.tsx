/**
 * Teams Page — Card grid of all municipal teams.
 *
 * Features:
 * - Card grid with TeamCreateCard (always first) + TeamCards
 * - Click a team card to open TeamDetailModal
 * - Loading skeletons matching MetricsCards pattern
 * - Empty state with create prompt
 * - Error state with retry
 */

import { useTeams } from '../hooks/useTeams';
import { TeamCard } from '../components/teams/TeamCard';
import { TeamCreateCard } from '../components/teams/TeamCreateCard';
import { TeamDetailModal } from '../components/teams/TeamDetailModal';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';

export function TeamsPage() {
  const { teams, isLoading, error, selectedTeam, setSelectedTeam, refreshTeams, createTeam } =
    useTeams();

  const handleTeamCreated = () => {
    // useTeams.createTeam already appends to local state — nothing extra needed
  };

  if (error) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Teams</h1>
        </header>
        <GlassCard variant="default" style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
          <Button variant="secondary" size="sm" onClick={refreshTeams}>
            Try Again
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Teams</h1>
      </header>

      {isLoading ? (
        <SkeletonTheme>
          <div style={styles.grid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <GlassCard key={i} variant="default" style={styles.skeletonCard}>
                <div style={{ padding: 'var(--space-sm) 0' }}>
                  <Skeleton height={14} width="60%" style={{ marginBottom: 'var(--space-md)' }} />
                  <Skeleton height={20} width="80%" style={{ marginBottom: 'var(--space-sm)' }} />
                  <Skeleton height={14} width="40%" style={{ marginBottom: 'var(--space-lg)' }} />
                  <Skeleton height={14} width="50%" />
                </div>
              </GlassCard>
            ))}
          </div>
        </SkeletonTheme>
      ) : (
        <div style={styles.grid}>
          {/* Create card always first */}
          <TeamCreateCard createTeam={createTeam} onCreated={handleTeamCreated} />

          {/* Team cards */}
          {teams.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>
                No teams yet. Create your first team to get started.
              </p>
              <span style={styles.emptyArrow}>← Create your first team</span>
            </div>
          ) : (
            teams.map((team, index) => (
              <TeamCard
                key={team.id}
                team={team}
                index={index}
                onClick={() => setSelectedTeam(team)}
              />
            ))
          )}
        </div>
      )}

      {/* Team detail modal */}
      {selectedTeam && (
        <TeamDetailModal
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    margin: 0,
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 'var(--space-lg)',
  } as React.CSSProperties,
  skeletonCard: {
    minHeight: '160px',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    padding: '2rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  emptyText: {
    fontSize: '0.9rem',
    marginBottom: 'var(--space-sm)',
  } as React.CSSProperties,
  emptyArrow: {
    fontSize: '0.825rem',
    color: 'var(--color-teal)',
    fontStyle: 'italic',
  } as React.CSSProperties,
  errorCard: {
    padding: '2rem',
    borderColor: 'rgba(255, 107, 74, 0.4)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 'var(--space-md)',
  } as React.CSSProperties,
  errorText: {
    color: 'var(--color-coral)',
    fontSize: '0.9rem',
    margin: 0,
  } as React.CSSProperties,
};
