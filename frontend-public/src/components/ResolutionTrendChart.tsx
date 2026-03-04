import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyTrend } from '../types/public';

interface ResolutionTrendChartProps {
  trend: MonthlyTrend[];
  municipalityName: string;
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(163, 72, 102, 0.95)',
    border: '1px solid var(--glass-border)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
  },
  labelStyle: { color: 'var(--text-primary)' },
  itemStyle: { color: 'var(--text-secondary)' },
};

export function ResolutionTrendChart({ trend, municipalityName }: ResolutionTrendChartProps) {
  if (trend.length === 0) {
    return (
      <div
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
        }}
      >
        No trend data available
      </div>
    );
  }

  return (
    <div>
      <h4
        style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Resolution Rate Trend — {municipalityName}
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid-stroke, rgba(255,255,255,0.15))" />
          <XAxis
            dataKey="month"
            tickFormatter={(val: string) => val.split('-')[1] ?? val}
            tick={{ fill: 'var(--chart-axis-text, #e0d4d8)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(val: number) => `${val}%`}
            tick={{ fill: 'var(--chart-axis-text, #e0d4d8)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Resolution Rate']}
            contentStyle={tooltipStyle.contentStyle}
            labelStyle={tooltipStyle.labelStyle}
            itemStyle={tooltipStyle.itemStyle}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--color-teal, #00bfa5)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-teal, #00bfa5)', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
