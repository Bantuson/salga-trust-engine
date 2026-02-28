/**
 * KPICard — Stripe-style KPI stat card with inline sparkline.
 *
 * Per locked decision: "Top-level KPIs as large stat cards with inline sparklines
 * (Stripe/Linear dashboard style)"
 *
 * Features:
 * - Large static counter value
 * - Optional unit suffix in smaller font
 * - SparkLine positioned right-aligned with trend arrow + percentage label
 * - GlassCard wrapper (no AnimatedCard to avoid double backgrounds)
 */

import { GlassCard } from '@shared/components/ui/GlassCard';
import SparkLine from './SparkLine';

interface KPICardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: number[];
  trendDirection?: 'up' | 'down' | 'neutral';
  color: string;
  index: number;
}

export function KPICard({
  label,
  value,
  unit,
  trend,
  trendDirection = 'neutral',
  color,
}: KPICardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;

  const trendColor =
    trendDirection === 'up'
      ? 'var(--color-teal)'
      : trendDirection === 'down'
        ? 'var(--color-coral)'
        : 'var(--text-muted)';

  const trendArrow =
    trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→';

  // Calculate trend percentage from sparkline data
  let trendPct: string | null = null;
  if (trend && trend.length >= 2) {
    const first = trend[0];
    const last = trend[trend.length - 1];
    if (first !== 0) {
      const pct = Math.round(((last - first) / first) * 100);
      trendPct = `${pct >= 0 ? '+' : ''}${pct}%`;
    }
  }

  return (
    <GlassCard variant="default" style={styles.card}>
      {/* Label row */}
      <div style={styles.label}>{label}</div>

      {/* Value row */}
      <div style={styles.valueRow}>
        <div style={{ ...styles.value, color }}>
          <span>{numericValue % 1 === 0 ? numericValue : numericValue.toFixed(1)}</span>
          {unit && <span style={styles.unit}>{unit}</span>}
        </div>
      </div>

      {/* Sparkline + trend indicator row */}
      {trend && trend.length >= 2 && (
        <div style={styles.sparkRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ ...styles.trendArrow, color: trendColor }}>{trendArrow}</span>
            {trendPct && (
              <span style={{ ...styles.trendPct, color: trendColor }}>{trendPct}</span>
            )}
          </div>
          <SparkLine data={trend} width={80} height={28} color={color} />
        </div>
      )}
    </GlassCard>
  );
}

const styles = {
  card: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    padding: '1.25rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.25rem',
  },
  value: {
    fontSize: '2rem',
    fontWeight: '700',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.25rem',
  },
  unit: {
    fontSize: '1rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
    marginLeft: '0.125rem',
  },
  sparkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '0.25rem',
  },
  trendArrow: {
    fontSize: '0.875rem',
    fontWeight: '700',
  },
  trendPct: {
    fontSize: '0.75rem',
    fontWeight: '600',
  },
};
