import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ResolutionRateData } from '../../types/public';

interface ResolutionRateChartProps {
  data: ResolutionRateData[];
  isLoading: boolean;
}

function getRateColor(rate: number): string {
  if (rate >= 80) return '#10b981'; // green - excellent
  if (rate >= 60) return '#f59e0b'; // amber - acceptable
  return '#ef4444'; // red - needs improvement
}

export function ResolutionRateChart({ data, isLoading }: ResolutionRateChartProps) {
  if (isLoading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#6b7280',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: 'white'
      }}>
        Loading resolution rate data...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: '#9ca3af',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: 'white'
      }}>
        No resolution rate data available
      </div>
    );
  }

  // Show trend line if single municipality selected
  const showTrend = data.length === 1 && data[0].trend.length > 0;

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: 'white'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '16px',
        color: '#111827'
      }}>
        Resolution Rates
      </h3>

      {/* Overall rates bar chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="municipality_name"
            angle={-45}
            textAnchor="end"
            height={80}
            style={{ fontSize: '12px' }}
          />
          <YAxis
            label={{ value: 'Resolution Rate (%)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Resolution Rate']}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px'
            }}
          />
          <Bar dataKey="resolution_rate" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getRateColor(entry.resolution_rate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Trend line chart for single municipality */}
      {showTrend && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '500',
            marginBottom: '12px',
            color: '#374151'
          }}>
            Monthly Trend
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data[0].trend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Resolution Rate']}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#6b7280',
        display: 'flex',
        gap: '16px',
        justifyContent: 'center'
      }}>
        <span><span style={{ color: '#10b981' }}>●</span> Excellent (≥80%)</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> Acceptable (≥60%)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> Needs Improvement (&lt;60%)</span>
      </div>
    </div>
  );
}
