import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

interface SdbipGaugeChartProps {
  achievementPct: number;
  municipalityName: string;
}

function getTrafficLightColor(pct: number): string {
  if (pct >= 80) return '#10b981'; // green
  if (pct >= 50) return '#f59e0b'; // amber
  return '#ef4444';                // red
}

export function SdbipGaugeChart({ achievementPct, municipalityName }: SdbipGaugeChartProps) {
  const gaugeColor = getTrafficLightColor(achievementPct);

  const gaugeData = [
    {
      name: 'achievement',
      value: achievementPct,
      fill: gaugeColor,
    },
  ];

  return (
    <div style={{ textAlign: 'center' }}>
      <ResponsiveContainer width="100%" height={180}>
        <RadialBarChart
          cx="50%"
          cy="80%"
          innerRadius={60}
          outerRadius={90}
          barSize={14}
          data={gaugeData}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            background={{ fill: 'rgba(255,255,255,0.1)' }}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Centered percentage below the gauge arc */}
      <div style={{ marginTop: '-32px' }}>
        <div
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: gaugeColor,
            lineHeight: 1,
          }}
        >
          {achievementPct.toFixed(1)}%
        </div>
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginTop: '0.375rem',
          }}
        >
          {municipalityName}
        </div>
      </div>
    </div>
  );
}
