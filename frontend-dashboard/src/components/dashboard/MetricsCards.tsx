/**
 * Dashboard metrics summary cards.
 *
 * Displays 4 key metrics:
 * - Total open tickets
 * - Total resolved tickets
 * - SLA compliance percentage
 * - SLA breaches count
 *
 * Features:
 * - AnimatedCard wrapper with glow effects
 * - anime.js counter animations
 * - Staggered entrance delays
 */

import { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import { AnimatedCard } from '../AnimatedCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { GlassCard } from '@shared/components/ui/GlassCard';
import type { DashboardMetrics } from '../../types/dashboard';

interface MetricsCardsProps {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
}

export function MetricsCards({ metrics, isLoading }: MetricsCardsProps) {
  const openRef = useRef<HTMLDivElement>(null);
  const resolvedRef = useRef<HTMLDivElement>(null);
  const complianceRef = useRef<HTMLDivElement>(null);
  const breachesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!metrics || isLoading) return;

    // Animate counter for open tickets
    if (openRef.current) {
      animate(openRef.current, {
        innerHTML: [0, metrics.total_open],
        round: 1,
        duration: 2000,
        ease: 'outExpo',
      });
    }

    // Animate counter for resolved tickets
    if (resolvedRef.current) {
      animate(resolvedRef.current, {
        innerHTML: [0, metrics.total_resolved],
        round: 1,
        duration: 2000,
        ease: 'outExpo',
      });
    }

    // Animate counter for SLA compliance
    if (complianceRef.current) {
      animate(complianceRef.current, {
        innerHTML: [0, metrics.sla_compliance_percent],
        round: 1,
        duration: 2000,
        ease: 'outExpo',
      });
    }

    // Animate counter for SLA breaches
    if (breachesRef.current) {
      animate(breachesRef.current, {
        innerHTML: [0, metrics.sla_breaches],
        round: 1,
        duration: 2000,
        ease: 'outExpo',
      });
    }
  }, [metrics, isLoading]);

  if (isLoading) {
    return (
      <div style={styles.container}>
        <SkeletonTheme>
          {[0, 1, 2, 3].map((i) => (
            <GlassCard key={i} variant="default">
              <div style={styles.skeletonCard}>
                <Skeleton height={14} width="60%" style={{ marginBottom: 'var(--space-md)' }} />
                <Skeleton height={40} width="80%" />
              </div>
            </GlassCard>
          ))}
        </SkeletonTheme>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={styles.container}>
        {['Open Tickets', 'Resolved', 'SLA Compliance', 'SLA Breaches'].map((title) => (
          <GlassCard key={title} variant="default" style={{ border: '1px solid rgba(255, 255, 255, 0.25)' }}>
            <div style={styles.cardTitle}>{title}</div>
            <div style={{ ...styles.cardValue, color: 'var(--text-muted)' }}>--</div>
          </GlassCard>
        ))}
      </div>
    );
  }

  // Determine SLA compliance color based on percentage
  const slaColor =
    metrics.sla_compliance_percent >= 80 ? 'var(--color-teal)' : // green
    metrics.sla_compliance_percent >= 60 ? '#FBBF24' : // amber
    'var(--color-coral)'; // red

  return (
    <div style={styles.container}>
      <AnimatedCard glowColor="coral" delay={0}>
        <MetricCard
          title="Open Tickets"
          valueRef={openRef}
          value={metrics.total_open.toString()}
          color="var(--color-teal)"
        />
      </AnimatedCard>
      <AnimatedCard glowColor="teal" delay={0.1}>
        <MetricCard
          title="Resolved"
          valueRef={resolvedRef}
          value={metrics.total_resolved.toString()}
          color="var(--color-teal)"
        />
      </AnimatedCard>
      <AnimatedCard glowColor="coral" delay={0.2}>
        <MetricCard
          title="SLA Compliance"
          valueRef={complianceRef}
          value={`${metrics.sla_compliance_percent}%`}
          color={slaColor}
        />
      </AnimatedCard>
      <AnimatedCard glowColor="teal" delay={0.3}>
        <MetricCard
          title="SLA Breaches"
          valueRef={breachesRef}
          value={metrics.sla_breaches.toString()}
          color="var(--color-coral)"
        />
      </AnimatedCard>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  color: string;
  valueRef?: React.RefObject<HTMLDivElement | null>;
}

function MetricCard({ title, value, color, valueRef }: MetricCardProps) {
  return (
    <>
      <div style={styles.cardTitle}>{title}</div>
      <div ref={valueRef} className="metric-value" style={{ ...styles.cardValue, color }}>
        {value}
      </div>
    </>
  );
}

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 'var(--space-lg)',
    marginBottom: 'var(--space-2xl)',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-md)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
  } as React.CSSProperties,
  cardValue: {
    fontSize: '2.5rem',
    fontWeight: '700',
  } as React.CSSProperties,
  skeletonCard: {
    padding: 'var(--space-md) 0',
  } as React.CSSProperties,
};
