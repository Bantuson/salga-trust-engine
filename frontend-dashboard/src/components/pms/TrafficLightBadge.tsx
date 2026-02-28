/**
 * TrafficLightBadge — reusable performance status badge.
 *
 * Renders a colored badge based on achievement status:
 * - green  >= 80%: var(--color-teal)
 * - amber 50-79%: var(--color-gold)
 * - red    < 50%: var(--color-coral)
 *
 * Props:
 *   status: 'green' | 'amber' | 'red'
 *   pct:    Achievement percentage (number, e.g. 75.5)
 */

import React from 'react';

interface TrafficLightBadgeProps {
  status: 'green' | 'amber' | 'red';
  pct: number;
}

const colorMap: Record<'green' | 'amber' | 'red', string> = {
  green: 'var(--color-teal)',
  amber: 'var(--color-gold)',
  red: 'var(--color-coral)',
};

const labelMap: Record<'green' | 'amber' | 'red', string> = {
  green: 'On Track',
  amber: 'At Risk',
  red: 'Off Track',
};

export function TrafficLightBadge({ status, pct }: TrafficLightBadgeProps) {
  const color = colorMap[status];

  const containerStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-xs)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    background: `${color}22`,
    border: `1px solid ${color}66`,
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    fontFamily: 'var(--font-body)',
    color: color,
  };

  const dotStyles: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  };

  return (
    <span style={containerStyles} aria-label={`${labelMap[status]}: ${pct.toFixed(1)}%`}>
      <span style={dotStyles} />
      {pct.toFixed(1)}%
    </span>
  );
}
