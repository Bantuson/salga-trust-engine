import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ResponseTimeData } from '../types/public';

interface ResponseTimeChartProps {
  data: ResponseTimeData[];
  isLoading: boolean;
}

function getBarColor(hours: number): string {
  if (hours < 24) return '#10b981'; // green - excellent
  if (hours < 72) return '#f59e0b'; // amber - acceptable
  return '#ef4444'; // red - needs improvement
}

const glassContainer: React.CSSProperties = {
  padding: '20px',
  border: '1px solid var(--glass-border)',
  borderRadius: '8px',
  background: 'var(--chart-bg)',
  backdropFilter: 'blur(10px)',
};

export function ResponseTimeChart({ data, isLoading }: ResponseTimeChartProps) {
  if (isLoading) {
    return (
      <div style={{
        ...glassContainer,
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}>
        Loading response time data...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        ...glassContainer,
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}>
        No response time data available
      </div>
    );
  }

  return (
    <div style={glassContainer}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '16px',
        color: 'var(--text-primary)'
      }}>
        Average Response Times
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
          <XAxis
            dataKey="municipality_name"
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fontSize: '12px' }}
            tick={{ fill: 'var(--text-secondary)' }}
          />
          <YAxis
            label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)' }}
            style={{ fontSize: '12px' }}
            tick={{ fill: 'var(--text-secondary)' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)} hours`, 'Avg Response Time']}
            contentStyle={{
              backgroundColor: 'rgba(163, 72, 102, 0.95)',
              border: '1px solid var(--glass-border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--text-primary)' }}
            itemStyle={{ color: 'var(--text-secondary)' }}
          />
          <Bar dataKey="avg_response_hours" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.avg_response_hours)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        display: 'flex',
        gap: '16px',
        justifyContent: 'center'
      }}>
        <span><span style={{ color: '#10b981' }}>●</span> Excellent (&lt;24h)</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> Acceptable (24-72h)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Needs Improvement (&gt;72h)</span>
      </div>
    </div>
  );
}
