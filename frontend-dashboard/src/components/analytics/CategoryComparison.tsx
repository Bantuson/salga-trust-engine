/**
 * CategoryComparison — stacked horizontal bars for open vs resolved by category.
 *
 * - Sorted by total (open + resolved) descending
 * - Stacked bar: open portion (coral shade) + resolved portion (teal shade)
 * - Bar width proportional to max category total
 * - Category badge uses CATEGORY_CONFIG colors
 */

import { getCategoryConfig } from '../../constants/categories';

interface CategoryVolume {
  category: string;
  open: number;
  resolved: number;
}

interface CategoryComparisonProps {
  volume: CategoryVolume[];
  title?: string;
}

export function CategoryComparison({ volume, title = 'Category Breakdown' }: CategoryComparisonProps) {
  if (!volume || volume.length === 0) {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>
          <span style={styles.icon}>📊</span> {title}
        </h2>
        <p style={styles.empty}>No category data for this period.</p>
      </div>
    );
  }

  const sorted = [...volume]
    .map((v) => ({ ...v, total: v.open + v.resolved }))
    .sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(...sorted.map((v) => v.total), 1);

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>
        <span style={styles.icon}>📊</span> {title}
      </h2>

      <div style={styles.list}>
        {sorted.map((item) => {
          const config = getCategoryConfig(item.category);
          const totalWidth = Math.max((item.total / maxTotal) * 100, 2);
          const openWidth = item.total > 0 ? (item.open / item.total) * totalWidth : 0;
          const resolvedWidth = item.total > 0 ? (item.resolved / item.total) * totalWidth : 0;

          return (
            <div key={item.category} style={styles.row}>
              {/* Category badge */}
              <div
                style={{
                  ...styles.badge,
                  background: config.bgColor,
                  color: config.color,
                  borderColor: `${config.color}44`,
                }}
              >
                {config.label}
              </div>

              {/* Stacked bar + numbers */}
              <div style={styles.barSection}>
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.barOpen,
                      width: `${openWidth}%`,
                    }}
                  />
                  <div
                    style={{
                      ...styles.barResolved,
                      width: `${resolvedWidth}%`,
                    }}
                  />
                </div>
                <div style={styles.numbers}>
                  <span style={{ ...styles.numOpen }}>{item.open} open</span>
                  <span style={styles.numSep}>/</span>
                  <span style={{ ...styles.numResolved }}>{item.resolved} resolved</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: 'rgba(205, 94, 129, 0.7)' }} />
          <span>Open</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendDot, background: 'var(--color-teal)' }} />
          <span>Resolved</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
  },
  heading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  icon: {
    fontSize: '1rem',
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
    padding: '2rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  row: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.375rem',
  },
  badge: {
    display: 'inline-block',
    padding: '0.2rem 0.625rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    border: '1px solid',
    alignSelf: 'flex-start',
  } as React.CSSProperties,
  barSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  barTrack: {
    height: '10px',
    borderRadius: '9999px',
    background: 'var(--glass-border)',
    overflow: 'hidden',
    display: 'flex',
  } as React.CSSProperties,
  barOpen: {
    height: '100%',
    background: 'rgba(205, 94, 129, 0.65)',
    transition: 'width 0.6s ease',
    flexShrink: 0,
  } as React.CSSProperties,
  barResolved: {
    height: '100%',
    background: 'rgba(0, 191, 165, 0.75)',
    transition: 'width 0.6s ease',
    flexShrink: 0,
  } as React.CSSProperties,
  numbers: {
    display: 'flex',
    gap: '0.25rem',
    fontSize: '0.75rem',
  },
  numOpen: {
    color: 'var(--color-coral)',
    fontWeight: '500',
  },
  numSep: {
    color: 'var(--text-muted)',
  },
  numResolved: {
    color: 'var(--color-teal)',
    fontWeight: '500',
  },
  legend: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--glass-border)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
};
