/**
 * Team workload bar chart.
 *
 * Shows number of open tickets per team.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TeamWorkload } from '../../types/dashboard';

interface TeamWorkloadChartProps {
  data: TeamWorkload[];
  isLoading: boolean;
}

export function TeamWorkloadChart({ data, isLoading }: TeamWorkloadChartProps) {
  if (isLoading) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Team Workload</h3>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Team Workload</h3>
        <div style={styles.loading}>No data available</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Team Workload</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
          <XAxis type="number" tick={{ fill: 'var(--text-secondary)' }} />
          <YAxis dataKey="team_name" type="category" tick={{ fill: 'var(--text-secondary)' }} />
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
          <Bar dataKey="open_count" fill="var(--color-teal)" name="Open Tickets" />
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
