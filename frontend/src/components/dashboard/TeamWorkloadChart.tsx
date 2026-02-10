/**
 * Team workload bar chart.
 *
 * Shows number of open tickets per team.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TeamWorkload } from '../../types/dashboard';

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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="team_name" type="category" />
          <Tooltip />
          <Bar dataKey="open_count" fill="#3b82f6" name="Open Tickets" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  title: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#111827',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '4rem',
    color: '#6b7280',
  } as React.CSSProperties,
};
