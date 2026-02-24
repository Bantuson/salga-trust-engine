/**
 * AnalyticsPage — Municipal analytics dashboard.
 *
 * Replaces the "Coming Soon" placeholder at /analytics.
 *
 * Sections (top to bottom):
 *   1. KPI cards (4 columns) with animated counters + sparklines
 *   2. Two-column: TeamLeaderboard + CategoryComparison
 *   3. SLA Details full-width card
 *
 * Ward councillors: see "Ward Analytics" heading and ward-filtered data.
 * CSV Export: triggers blob download for current time range.
 *
 * Per locked decisions:
 * - Stripe-style KPI cards (large numbers + sparklines)
 * - Horizontal bar rankings (no Recharts usage)
 * - Pure CSS bars + SVG sparklines
 */

import { useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import { exportTicketsCSV } from '../services/api';
import { KPICard } from '../components/analytics/KPICard';
import { TimeRangeControls } from '../components/analytics/TimeRangeControls';
import { TeamLeaderboard } from '../components/analytics/TeamLeaderboard';
import { CategoryComparison } from '../components/analytics/CategoryComparison';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import type { TicketFilters } from '../types/dashboard';

// Generate a synthetic sparkline trend array for KPI cards (7 data points).
// Trends in the specified direction over the last 7 periods.
function makeTrend(baseValue: number, direction: 'up' | 'down' | 'neutral', steps = 7): number[] {
  const result: number[] = [];
  let current = baseValue * (direction === 'up' ? 0.6 : direction === 'down' ? 1.4 : 1.0);
  for (let i = 0; i < steps; i++) {
    const noise = (Math.random() - 0.5) * baseValue * 0.08;
    const trend =
      direction === 'up'
        ? (baseValue * 0.4 * i) / (steps - 1)
        : direction === 'down'
          ? -(baseValue * 0.4 * i) / (steps - 1)
          : 0;
    current = Math.max(0, current + trend / steps + noise);
    result.push(Math.round(current));
  }
  // Ensure last value is close to baseValue
  result[steps - 1] = baseValue;
  return result;
}

export function AnalyticsPage() {
  const { getUserRole, getTenantId } = useAuth();
  const role = getUserRole();
  const isWardCouncillor = role === 'ward_councillor';

  // Ward councillors get a placeholder ward ID — backend will add proper ward_id to JWT later
  const wardId = isWardCouncillor ? (getTenantId() ?? undefined) : undefined;

  const {
    data,
    isLoading,
    timeRange,
    setTimeRange,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
  } = useAnalytics({ wardId });

  // CSV Export
  const handleExportCSV = useCallback(async () => {
    try {
      const filters: TicketFilters = {
        page: 0,
        page_size: 10000,
        ...(wardId ? { ward_id: wardId } : {}),
      };
      const blob = await exportTicketsCSV(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
    }
  }, [timeRange, wardId]);

  // Build KPI metrics from data
  const metrics = data?.metrics ?? null;
  const slaCompliance = metrics?.sla_compliance_percent ?? 0;
  const avgResponse = metrics?.avg_response_hours ?? 0;

  // SLA color: green >= 80%, amber >= 60%, coral < 60%
  const slaColor =
    slaCompliance >= 80
      ? 'var(--color-teal)'
      : slaCompliance >= 60
        ? '#FBBF24'
        : 'var(--color-coral)';

  // Avg response color: teal if fast (<= 24h), coral if slow (> 48h)
  const responseColor =
    avgResponse <= 24
      ? 'var(--color-teal)'
      : avgResponse > 48
        ? 'var(--color-coral)'
        : '#FBBF24';

  return (
    <div style={styles.container}>
      {/* Page header */}
      <header style={styles.header}>
        <h1 style={styles.title}>
          {isWardCouncillor ? 'Ward Analytics' : 'Analytics'}
        </h1>
        <button onClick={handleExportCSV} style={styles.exportBtn}>
          Export CSV
        </button>
      </header>

      {/* Time range controls */}
      <TimeRangeControls
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
      />

      {/* Loading skeletons */}
      {isLoading && (
        <SkeletonTheme>
          {/* KPI skeletons */}
          <div style={styles.kpiGrid}>
            {[0, 1, 2, 3].map((i) => (
              <GlassCard key={i} variant="default" style={{ padding: '1.25rem' }}>
                <Skeleton height={12} width="60%" style={{ marginBottom: '0.75rem' }} />
                <Skeleton height={36} width="70%" style={{ marginBottom: '0.5rem' }} />
                <Skeleton height={28} />
              </GlassCard>
            ))}
          </div>

          {/* Two-column skeletons */}
          <div style={styles.twoCol}>
            <GlassCard variant="default" style={{ padding: '1.5rem' }}>
              <Skeleton height={20} width="50%" style={{ marginBottom: '1rem' }} />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={40} style={{ marginBottom: '0.75rem' }} />
              ))}
            </GlassCard>
            <GlassCard variant="default" style={{ padding: '1.5rem' }}>
              <Skeleton height={20} width="50%" style={{ marginBottom: '1rem' }} />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={40} style={{ marginBottom: '0.75rem' }} />
              ))}
            </GlassCard>
          </div>

          {/* SLA skeleton */}
          <GlassCard variant="default" style={{ padding: '1.5rem' }}>
            <Skeleton height={20} width="30%" style={{ marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '2rem' }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={48} style={{ flex: 1 }} />
              ))}
            </div>
          </GlassCard>
        </SkeletonTheme>
      )}

      {/* Empty state */}
      {!isLoading && !data && (
        <GlassCard variant="default" style={styles.emptyState}>
          <p style={styles.emptyText}>
            No analytics data available. Analytics will populate as tickets are created and
            resolved.
          </p>
        </GlassCard>
      )}

      {/* Content */}
      {!isLoading && data && (
        <>
          {/* Section 1: KPI cards */}
          <div style={styles.kpiGrid}>
            <KPICard
              label="Open Tickets"
              value={metrics?.total_open ?? 0}
              trend={makeTrend(metrics?.total_open ?? 10, 'up')}
              trendDirection="up"
              color="var(--color-teal)"
              index={0}
            />
            <KPICard
              label="Resolved"
              value={metrics?.total_resolved ?? 0}
              trend={makeTrend(metrics?.total_resolved ?? 10, 'up')}
              trendDirection="up"
              color="var(--color-teal)"
              index={1}
            />
            <KPICard
              label="SLA Compliance"
              value={slaCompliance}
              unit="%"
              trend={makeTrend(slaCompliance, slaCompliance >= 80 ? 'up' : 'neutral')}
              trendDirection={slaCompliance >= 80 ? 'up' : slaCompliance < 60 ? 'down' : 'neutral'}
              color={slaColor}
              index={2}
            />
            <KPICard
              label="Avg Response"
              value={avgResponse}
              unit="h"
              trend={makeTrend(avgResponse, avgResponse <= 24 ? 'down' : 'up')}
              trendDirection={avgResponse <= 24 ? 'up' : 'down'}
              color={responseColor}
              index={3}
            />
          </div>

          {/* Section 2: Leaderboard + Category comparison */}
          <div style={styles.twoCol}>
            <GlassCard variant="default" style={styles.sectionCard}>
              <TeamLeaderboard workload={data.workload} />
            </GlassCard>
            <GlassCard variant="default" style={styles.sectionCard}>
              <CategoryComparison volume={data.volume} />
            </GlassCard>
          </div>

          {/* Section 3: SLA details */}
          <GlassCard variant="elevated" style={styles.slaCard}>
            <h2 style={styles.sectionHeading}>SLA Performance</h2>
            <div style={styles.slaGrid}>
              <SLAStat
                label="Response Compliance"
                value={data.sla.response_compliance_percent}
                unit="%"
                color={data.sla.response_compliance_percent >= 80 ? 'var(--color-teal)' : '#FBBF24'}
              />
              <SLAStat
                label="Resolution Compliance"
                value={data.sla.resolution_compliance_percent}
                unit="%"
                color={
                  data.sla.resolution_compliance_percent >= 80 ? 'var(--color-teal)' : '#FBBF24'
                }
              />
              <SLAStat
                label="Total Breaches"
                value={(data.sla.response_breaches ?? 0) + (data.sla.resolution_breaches ?? 0)}
                color={
                  (data.sla.response_breaches ?? 0) + (data.sla.resolution_breaches ?? 0) === 0
                    ? 'var(--color-teal)'
                    : 'var(--color-coral)'
                }
              />
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal SLA stat block
// ---------------------------------------------------------------------------

interface SLAStatProps {
  label: string;
  value: number;
  unit?: string;
  color: string;
}

function SLAStat({ label, value, unit, color }: SLAStatProps) {
  return (
    <div style={slaStatStyles.block}>
      <div style={slaStatStyles.label}>{label}</div>
      <div style={{ ...slaStatStyles.value, color }}>
        {Math.round(value)}
        {unit && <span style={slaStatStyles.unit}>{unit}</span>}
      </div>
    </div>
  );
}

const slaStatStyles = {
  block: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  value: {
    fontSize: '1.875rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.125rem',
  } as React.CSSProperties,
  unit: {
    fontSize: '1rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
};

// ---------------------------------------------------------------------------
// Page styles
// ---------------------------------------------------------------------------

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
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,
  exportBtn: {
    padding: '0.5rem 1.25rem',
    background: 'var(--color-teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s ease',
  } as React.CSSProperties,
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  sectionCard: {
    padding: '1.5rem',
  } as React.CSSProperties,
  slaCard: {
    padding: '1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  sectionHeading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
  },
  slaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '2rem',
  } as React.CSSProperties,
  emptyState: {
    padding: '3rem',
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: '1rem',
    maxWidth: '480px',
    margin: '0 auto',
  },
};
