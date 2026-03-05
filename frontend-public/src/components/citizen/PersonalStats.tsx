/**
 * SALGA Trust Engine — Personal Stats Component
 * Compact stats bar: total reports, resolved count, avg resolution time
 */

import React, { useEffect, useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import type { CitizenStats } from '../../hooks/useCitizenReports';
import { animate } from 'animejs';

export interface PersonalStatsProps {
  stats: CitizenStats | null;
  loading?: boolean;
}

export const PersonalStats: React.FC<PersonalStatsProps> = ({ stats, loading }) => {
  const prefersReducedMotion = useReducedMotion();
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [animatedResolved, setAnimatedResolved] = useState(0);
  const [animatedAvg, setAnimatedAvg] = useState(0);

  useEffect(() => {
    if (!stats || prefersReducedMotion) {
      if (stats) {
        setAnimatedTotal(stats.total_reports);
        setAnimatedResolved(stats.resolved_count);
        setAnimatedAvg(stats.avg_resolution_days || 0);
      }
      return;
    }

    const targets = { total: 0, resolved: 0, avg: 0 };
    animate(targets, {
      total: stats.total_reports,
      resolved: stats.resolved_count,
      avg: stats.avg_resolution_days || 0,
      duration: 1200,
      easing: 'easeOutQuad',
      onUpdate: () => {
        setAnimatedTotal(Math.round(targets.total));
        setAnimatedResolved(Math.round(targets.resolved));
        setAnimatedAvg(Number(targets.avg.toFixed(1)));
      },
    });
  }, [stats, prefersReducedMotion]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '8px' }}>
        <div style={{
          width: 20, height: 20,
          border: '2px solid rgba(255,255,255,0.15)',
          borderTopColor: 'var(--color-teal)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Loading stats...</span>
      </div>
    );
  }

  if (!stats) return null;

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
    <GlassCard variant="default" style={{ padding: '16px 20px' }}>
      {/* Stats row + comparison in one card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <StatItem value={animatedTotal} label="Reports" />
          <StatItem value={animatedResolved} label="Resolved" color="var(--color-teal)" />
          <StatItem
            value={stats.avg_resolution_days !== null ? `${animatedAvg}d` : 'N/A'}
            label="Avg Resolution"
          />
        </div>

        {/* Comparison */}
        {comparisonAvailable && comparisonPercent !== null && (
          <div style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: isFaster ? 'rgba(0, 191, 165, 0.15)' : 'rgba(255, 107, 74, 0.15)',
              color: isFaster ? 'var(--color-teal)' : 'var(--color-coral)',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isFaster
                  ? <polyline points="18 15 12 9 6 15" />
                  : <polyline points="6 9 12 15 18 9" />
                }
              </svg>
              {comparisonPercent}% {isFaster ? 'faster' : 'slower'} than avg
            </span>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

function StatItem({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <span style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color: color || 'var(--text-primary)',
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{
        fontSize: '0.75rem',
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        fontWeight: 500,
      }}>
        {label}
      </span>
    </div>
  );
}
