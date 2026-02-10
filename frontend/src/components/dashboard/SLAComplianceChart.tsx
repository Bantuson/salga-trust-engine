/**
 * SLA compliance gauge chart.
 *
 * Displays compliance percentage with color-coded visual indicator.
 */

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { SLACompliance } from '../../types/dashboard';

interface SLAComplianceChartProps {
  data: SLACompliance | null;
  isLoading: boolean;
}

export function SLAComplianceChart({ data, isLoading }: SLAComplianceChartProps) {
  if (isLoading) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>SLA Compliance</h3>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>SLA Compliance</h3>
        <div style={styles.loading}>No data available</div>
      </div>
    );
  }

  const percent = data.resolution_compliance_percent;
  const color = percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444';

  // Create data for semi-circle gauge
  const gaugeData = [
    { name: 'Compliant', value: percent },
    { name: 'Non-compliant', value: 100 - percent },
  ];

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>SLA Compliance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={gaugeData}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={100}
            dataKey="value"
            label={false}
          >
            <Cell fill={color} />
            <Cell fill="#e5e7eb" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={styles.centerText}>
        <div style={{ ...styles.percentValue, color }}>{percent.toFixed(1)}%</div>
        <div style={styles.breakdown}>
          Response: {data.response_compliance_percent.toFixed(1)}% | Resolution: {data.resolution_compliance_percent.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    position: 'relative' as const,
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
  centerText: {
    textAlign: 'center' as const,
    marginTop: '-3rem',
  } as React.CSSProperties,
  percentValue: {
    fontSize: '2rem',
    fontWeight: '700',
  } as React.CSSProperties,
  breakdown: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.5rem',
  } as React.CSSProperties,
};
