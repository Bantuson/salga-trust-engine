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
  background: 'var(--glass-white-frost)',
  backdropFilter: 'blur(var(--glass-blur-medium))',
};

export function ResponseTimeChart({ data, isLoading }: ResponseTimeChartProps) {
  if (isLoading) {
    return (
      <div style={{
        ...glassContainer,
        padding: '40px',
        textAlign: 'center',
        color: '#555',
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
        color: '#888',
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
        color: '#1a1a1a'
      }}>
        Average Response Times
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.08)" />
          <XAxis
            dataKey="municipality_name"
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fontSize: '12px' }}
            tick={{ fill: '#555' }}
          />
          <YAxis
            label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: '#555' }}
            style={{ fontSize: '12px' }}
            tick={{ fill: '#555' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)} hours`, 'Avg Response Time']}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '6px',
              color: '#1a1a1a',
            }}
            labelStyle={{ color: '#1a1a1a' }}
            itemStyle={{ color: '#555' }}
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
        color: '#555',
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
