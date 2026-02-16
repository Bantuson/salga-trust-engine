/**
 * Ticket volume bar chart by category.
 *
 * Shows open vs resolved tickets per category using Recharts.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CategoryVolume } from '../../types/dashboard';

interface VolumeChartProps {
  data: CategoryVolume[];
  isLoading: boolean;
}

export function VolumeChart({ data, isLoading }: VolumeChartProps) {
  if (isLoading) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Ticket Volume by Category</h3>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Ticket Volume by Category</h3>
        <div style={styles.loading}>No data available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Ticket Volume by Category</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
          <XAxis dataKey="category" tick={{ fill: 'var(--text-secondary)' }} />
          <YAxis tick={{ fill: 'var(--text-secondary)' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(163, 72, 102, 0.95)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--text-primary)' }}
            itemStyle={{ color: 'var(--text-secondary)' }}
          />
          <Legend wrapperStyle={{ color: 'var(--text-secondary)' }} />
          <Bar dataKey="open" fill="#f59e0b" name="Open" />
          <Bar dataKey="resolved" fill="#10b981" name="Resolved" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const styles = {
  container: {
    background: 'var(--chart-bg)',
    backdropFilter: 'blur(10px)',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid var(--glass-border)',
  } as React.CSSProperties,
  title: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '4rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
};
