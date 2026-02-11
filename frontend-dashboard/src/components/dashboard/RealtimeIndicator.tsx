/**
 * Real-time connection status indicator.
 *
 * Shows Supabase Realtime connection status and last update time.
 */

import { formatDistanceToNow } from 'date-fns';

interface RealtimeIndicatorProps {
  isConnected: boolean;
  error?: string | null;
  lastUpdated: Date | null;
}

export function RealtimeIndicator({ isConnected, error, lastUpdated }: RealtimeIndicatorProps) {
  const dotColor = isConnected ? '#10b981' : '#ef4444';
  const statusText = isConnected ? 'Live' : 'Reconnecting...';

  return (
    <div style={styles.container}>
      <div style={{ ...styles.dot, backgroundColor: dotColor }} />
      <span style={styles.statusText}>{statusText}</span>
      {error && <span style={styles.error}>({error})</span>}
      {lastUpdated && !error && (
        <span style={styles.timestamp}>
          Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  } as React.CSSProperties,
  statusText: {
    fontWeight: '500',
    color: '#111827',
  } as React.CSSProperties,
  error: {
    color: '#ef4444',
    fontSize: '0.75rem',
  } as React.CSSProperties,
  timestamp: {
    color: '#6b7280',
    fontSize: '0.75rem',
  } as React.CSSProperties,
};
