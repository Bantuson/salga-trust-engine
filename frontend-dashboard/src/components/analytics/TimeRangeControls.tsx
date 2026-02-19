/**
 * TimeRangeControls — preset and custom date range selector.
 *
 * Per locked decision: "Time range controls: preset buttons (7d, 30d, 90d, 6mo, 1yr)
 * PLUS custom date range picker with two <input type="date"> elements."
 *
 * Uses two native <input type="date"> elements styled with design tokens —
 * no external date-picker library required per research discretion.
 */

import type { TimeRange } from '../../types/analytics';

interface TimeRangeControlsProps {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  customStart: string;
  setCustomStart: (date: string) => void;
  customEnd: string;
  setCustomEnd: (date: string) => void;
}

const PRESETS: Array<{ label: string; value: Exclude<TimeRange, 'custom'> }> = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '6mo', value: '6mo' },
  { label: '1yr', value: '1yr' },
];

export function TimeRangeControls({
  timeRange,
  setTimeRange,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}: TimeRangeControlsProps) {
  const isCustom = timeRange === 'custom';

  return (
    <div style={styles.wrapper}>
      <div style={styles.buttonRow}>
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => setTimeRange(preset.value)}
            style={{
              ...styles.pill,
              ...(timeRange === preset.value ? styles.pillActive : styles.pillInactive),
            }}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setTimeRange('custom')}
          style={{
            ...styles.pill,
            ...(isCustom ? styles.pillActive : styles.pillInactive),
          }}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div style={styles.customRow}>
          <div style={styles.dateGroup}>
            <label style={styles.dateLabel} htmlFor="analytics-start">
              From
            </label>
            <input
              id="analytics-start"
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.dateGroup}>
            <label style={styles.dateLabel} htmlFor="analytics-end">
              To
            </label>
            <input
              id="analytics-end"
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={styles.dateInput}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    marginBottom: '2rem',
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  pill: {
    padding: '0.375rem 0.875rem',
    borderRadius: '9999px',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid var(--glass-border)',
    outline: 'none',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  pillActive: {
    background: 'var(--color-teal)',
    color: '#fff',
    borderColor: 'var(--color-teal)',
  } as React.CSSProperties,
  pillInactive: {
    background: 'transparent',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  customRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    alignItems: 'flex-end',
  },
  dateGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  dateLabel: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  dateInput: {
    background: 'var(--glass-white-frost)',
    backdropFilter: 'blur(var(--glass-blur-subtle))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0.375rem 0.75rem',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
};
