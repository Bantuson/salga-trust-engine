/**
 * Teams Page — Card grid of all municipal teams.
 *
 * Features:
 * - Small "+" button next to header opens TeamCreateModal
 * - Card grid with TeamCards
 * - Click a team card to open TeamDetailModal
 * - Loading skeletons matching MetricsCards pattern
 * - Empty state with create prompt
 * - Error state with retry
 */

import { useState } from 'react';
import { useTeams } from '../hooks/useTeams';
import { TeamCard } from '../components/teams/TeamCard';
import { TeamCreateModal } from '../components/teams/TeamCreateModal';
import { TeamDetailModal } from '../components/teams/TeamDetailModal';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';

export function TeamsPage() {
  const { teams, isLoading, error, selectedTeam, setSelectedTeam, refreshTeams } =
    useTeams();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={styles.title}>Teams</h1>
          <button
            style={styles.addButton}
            onClick={() => setShowCreateModal(true)}
            aria-label="Create team"
            title="Create team"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
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
          {/* Team cards */}
          {teams.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>
                No teams yet. Click the + button above to create your first team.
              </p>
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

      {/* Team create modal */}
      {showCreateModal && (
        <TeamCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            refreshTeams();
          }}
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
  addButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'var(--color-teal)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
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
