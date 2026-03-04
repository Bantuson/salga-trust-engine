import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategoryBreakdownData } from '../types/public';

interface CategoryDonutChartProps {
  data: CategoryBreakdownData[];
}

const COLORS = ['#00bfa5', '#ffd54f', '#ff6e40', '#7c4dff', '#ef4444', '#10b981'];

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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '0.875rem',
        }}
      >
        No category data
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="category"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [value.toLocaleString(), capitalize(name)]}
            contentStyle={tooltipStyle.contentStyle}
            labelStyle={tooltipStyle.labelStyle}
            itemStyle={tooltipStyle.itemStyle}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend — avoids overflow issues with built-in Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1rem',
          justifyContent: 'center',
          marginTop: '0.5rem',
        }}
      >
        {data.map((entry, index) => (
          <div
            key={entry.category}
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: COLORS[index % COLORS.length],
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {capitalize(entry.category)} ({entry.count.toLocaleString()})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
