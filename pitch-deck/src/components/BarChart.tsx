import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { colors, glass } from "../design/tokens";
import { fontFamily } from "../design/fonts";

interface BarData {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarData[];
  delay?: number;
  stagger?: number;
  maxValue?: number;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  delay = 0,
  stagger = 5,
  maxValue,
  height = 300,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const max = maxValue ?? Math.max(...data.map((d) => d.value));
  const barWidth = Math.floor((900 - (data.length - 1) * 12) / data.length);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${data.length * (barWidth + 12)} ${height}`}
      style={{ overflow: "visible" }}
    >
      {data.map((item, i) => {
        const barSpring = spring({
          frame,
          fps,
          delay: delay + i * stagger,
          config: { damping: 200 },
        });

        const barHeight = interpolate(barSpring, [0, 1], [0, (item.value / max) * (height - 60)]);
        const x = i * (barWidth + 12);
        const y = height - 30 - barHeight;

        const labelOpacity = interpolate(barSpring, [0.5, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={8}
              fill={item.color}
              opacity={0.85}
            />
            {/* Value label */}
            <text
              x={x + barWidth / 2}
              y={y - 8}
              textAnchor="middle"
              fill={colors.text.primary}
              fontSize={16}
              fontFamily={fontFamily.display}
              fontWeight={600}
              opacity={labelOpacity}
            >
              {item.value}
            </text>
            {/* Category label */}
            <text
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill={colors.text.secondary}
              fontSize={13}
              fontFamily={fontFamily.body}
              opacity={labelOpacity}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
