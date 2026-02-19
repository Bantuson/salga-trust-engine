/**
 * SparkLine — pure SVG sparkline component.
 *
 * Zero dependencies. No Recharts. Just an SVG polyline with a subtle
 * gradient fill below the line for depth.
 *
 * Used in: Analytics KPI cards to show trends alongside numeric values.
 *
 * Per design context: "Pure SVG sparklines drawn inline — ~20 lines, zero deps"
 */

import React from 'react';

interface SparkLineProps {
  /** Numeric data array (at least 2 points required) */
  data: number[];
  /** SVG width in pixels */
  width?: number;
  /** SVG height in pixels */
  height?: number;
  /** Stroke color (hex or CSS variable) */
  color?: string;
}

const SparkLine: React.FC<SparkLineProps> = ({
  data,
  width = 80,
  height = 32,
  color = 'var(--color-teal)',
}) => {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // prevent divide-by-zero if all values equal

  // Map data points to SVG coordinates with 2px padding on each side
  const padX = 2;
  const padY = 2;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((value, i) => {
    const x = padX + (i / (data.length - 1)) * innerW;
    const y = padY + (1 - (value - min) / range) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const polylinePoints = points.join(' ');

  // Gradient fill polygon: close the path to the bottom of the SVG
  const firstX = padX.toFixed(2);
  const lastX = (padX + innerW).toFixed(2);
  const bottomY = (padY + innerH).toFixed(2);
  const polygonPoints = `${firstX},${bottomY} ${polylinePoints} ${lastX},${bottomY}`;

  const gradientId = `spark-gradient-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gradient fill polygon below the line */}
      <polygon
        points={polygonPoints}
        fill={`url(#${gradientId})`}
      />

      {/* Main sparkline */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default SparkLine;
