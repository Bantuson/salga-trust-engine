/**
 * Dashboard metrics summary cards.
 *
 * Displays 4 key metrics:
 * - Total open tickets
 * - Total resolved tickets
 * - SLA compliance percentage
 * - SLA breaches count
 */

import type { DashboardMetrics } from '../../types/dashboard';

interface MetricsCardsProps {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
}

export function MetricsCards({ metrics, isLoading }: MetricsCardsProps) {
  if (isLoading) {
    return (
      <div style={styles.container}>
        <MetricCard title="Open Tickets" value="..." color="#3b82f6" />
        <MetricCard title="Resolved" value="..." color="#10b981" />
        <MetricCard title="SLA Compliance" value="..." color="#6b7280" />
        <MetricCard title="SLA Breaches" value="..." color="#ef4444" />
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Determine SLA compliance color based on percentage
  const slaColor =
    metrics.sla_compliance_percent >= 80 ? '#10b981' : // green
    metrics.sla_compliance_percent >= 60 ? '#f59e0b' : // amber
    '#ef4444'; // red

  return (
    <div style={styles.container}>
      <MetricCard
        title="Open Tickets"
        value={metrics.total_open.toString()}
        color="#3b82f6"
      />
      <MetricCard
        title="Resolved"
        value={metrics.total_resolved.toString()}
        color="#10b981"
      />
      <MetricCard
        title="SLA Compliance"
        value={`${metrics.sla_compliance_percent}%`}
        color={slaColor}
      />
      <MetricCard
        title="SLA Breaches"
        value={metrics.sla_breaches.toString()}
        color="#ef4444"
      />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  color: string;
}

function MetricCard({ title, value, color }: MetricCardProps) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
    </div>
  );
}

const styles = {
  container: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#f9fafb',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  cardValue: {
    fontSize: '2rem',
    fontWeight: '700',
  } as React.CSSProperties,
};
