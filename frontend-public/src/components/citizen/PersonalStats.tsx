/**
 * SALGA Trust Engine — Personal Stats Component
 * Displays citizen's personal analytics: total reports, resolved count, avg resolution time
 */

import React, { useEffect, useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import type { CitizenStats } from '../../hooks/useCitizenReports';
import anime from 'animejs';

export interface PersonalStatsProps {
  stats: CitizenStats | null;
  loading?: boolean;
}

export const PersonalStats: React.FC<PersonalStatsProps> = ({ stats, loading }) => {
  const prefersReducedMotion = useReducedMotion();
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [animatedResolved, setAnimatedResolved] = useState(0);
  const [animatedAvg, setAnimatedAvg] = useState(0);

  // Animate counters when stats arrive (respect reduced motion)
  useEffect(() => {
    if (!stats || prefersReducedMotion) {
      // If reduced motion, skip animation
      if (stats) {
        setAnimatedTotal(stats.total_reports);
        setAnimatedResolved(stats.resolved_count);
        setAnimatedAvg(stats.avg_resolution_days || 0);
      }
      return;
    }

    // Animate numbers with anime.js
    const targets = {
      total: 0,
      resolved: 0,
      avg: 0,
    };

    anime({
      targets,
      total: stats.total_reports,
      resolved: stats.resolved_count,
      avg: stats.avg_resolution_days || 0,
      duration: 1200,
      easing: 'easeOutQuad',
      update: () => {
        setAnimatedTotal(Math.round(targets.total));
        setAnimatedResolved(Math.round(targets.resolved));
        setAnimatedAvg(Number(targets.avg.toFixed(1)));
      },
    });
  }, [stats, prefersReducedMotion]);

  if (loading) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
      }}>
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} variant="interactive" style={{ padding: 'var(--spacing-lg)' }}>
            <Skeleton height={80} />
          </GlassCard>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Calculate comparison (percentage faster/slower than average)
  const comparisonAvailable = stats.avg_resolution_days !== null && stats.municipality_avg_resolution_days !== null;
  let comparisonPercent: number | null = null;
  let isFaster = false;

  if (comparisonAvailable) {
    const userAvg = stats.avg_resolution_days!;
    const muniAvg = stats.municipality_avg_resolution_days!;
    comparisonPercent = Math.round(Math.abs((muniAvg - userAvg) / muniAvg * 100));
    isFaster = userAvg < muniAvg;
  }

  return (
    <div>
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-lg)',
      }}>
        {/* Total Reports */}
        <GlassCard variant="interactive" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--color-teal)',
            marginBottom: 'var(--spacing-xs)',
          }}>
            {animatedTotal}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Total Reports
          </div>
        </GlassCard>

        {/* Resolved */}
        <GlassCard variant="interactive" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--color-teal)',
            marginBottom: 'var(--spacing-xs)',
          }}>
            {animatedResolved}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Resolved
          </div>
        </GlassCard>

        {/* Avg Resolution Time */}
        <GlassCard variant="interactive" style={{ padding: 'var(--spacing-lg)', textAlign: 'center' }}>
          <div style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--color-teal)',
            marginBottom: 'var(--spacing-xs)',
          }}>
            {stats.avg_resolution_days !== null ? `${animatedAvg}` : 'N/A'}
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {stats.avg_resolution_days !== null ? 'Avg Days to Resolve' : 'No Resolved Tickets Yet'}
          </div>
        </GlassCard>
      </div>

      {/* Comparison Banner */}
      {comparisonAvailable && (
        <GlassCard variant="default" style={{
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
          }}>
            Your avg resolution time: <strong>{stats.avg_resolution_days!.toFixed(1)} days</strong>
            {' | '}
            Municipality avg: <strong>{stats.municipality_avg_resolution_days!.toFixed(1)} days</strong>
            {' — '}
            <span style={{
              color: isFaster ? 'var(--color-teal)' : 'var(--color-coral)',
              fontWeight: 600,
            }}>
              You're {comparisonPercent}% {isFaster ? 'faster' : 'slower'} than average
            </span>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
