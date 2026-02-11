/**
 * Onboarding Wizard — Set SLA Step (Step 4, Skippable)
 *
 * Configure response and resolution time targets using sliders.
 */

import React, { useState, useEffect } from 'react';

export interface SLAData {
  responseHours: number;
  resolutionHours: number;
}

interface SetSLAStepProps {
  initialData?: Partial<SLAData>;
  onDataChange: (data: SLAData) => void;
}

export const SetSLAStep: React.FC<SetSLAStepProps> = ({ initialData, onDataChange }) => {
  const [slaData, setSlaData] = useState<SLAData>({
    responseHours: initialData?.responseHours || 24,
    resolutionHours: initialData?.resolutionHours || 168, // 7 days
  });

  // Notify parent of changes
  useEffect(() => {
    onDataChange(slaData);
  }, [slaData, onDataChange]);

  const handleResponseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlaData({ ...slaData, responseHours: parseInt(e.target.value, 10) });
  };

  const handleResolutionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlaData({ ...slaData, resolutionHours: parseInt(e.target.value, 10) });
  };

  const formatDuration = (hours: number): string => {
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${days}d ${remainingHours}h`;
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Set SLA Targets</h2>
      <p style={styles.description}>
        Service Level Agreement targets help your team stay on track. You can adjust these
        anytime in Settings.
      </p>

      <div style={styles.slaSection}>
        <div style={styles.slaCard}>
          <div style={styles.slaHeader}>
            <label htmlFor="response-slider" style={styles.slaLabel}>
              Response Time Target
            </label>
            <div style={styles.slaValue}>{formatDuration(slaData.responseHours)}</div>
          </div>
          <p style={styles.slaHint}>
            How quickly should your team acknowledge a new ticket?
          </p>
          <input
            id="response-slider"
            type="range"
            min="1"
            max="72"
            step="1"
            value={slaData.responseHours}
            onChange={handleResponseChange}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span style={styles.sliderLabel}>1 hour</span>
            <span style={styles.sliderLabel}>72 hours</span>
          </div>
        </div>

        <div style={styles.slaCard}>
          <div style={styles.slaHeader}>
            <label htmlFor="resolution-slider" style={styles.slaLabel}>
              Resolution Time Target
            </label>
            <div style={styles.slaValue}>{formatDuration(slaData.resolutionHours)}</div>
          </div>
          <p style={styles.slaHint}>
            How long should it take to fully resolve a ticket?
          </p>
          <input
            id="resolution-slider"
            type="range"
            min="24"
            max="720"
            step="24"
            value={slaData.resolutionHours}
            onChange={handleResolutionChange}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span style={styles.sliderLabel}>1 day</span>
            <span style={styles.sliderLabel}>30 days</span>
          </div>
        </div>
      </div>

      <div style={styles.infoBox}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span style={styles.infoText}>
          These targets help measure team performance. They don't automatically close or
          escalate tickets.
        </span>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    lineHeight: 1.5,
  } as React.CSSProperties,
  slaSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  slaCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
  } as React.CSSProperties,
  slaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  slaLabel: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  slaValue: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--color-teal)',
  } as React.CSSProperties,
  slaHint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: '1.5rem',
    lineHeight: 1.4,
  } as React.CSSProperties,
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    appearance: 'none' as const,
    background: 'var(--surface-higher)',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
  } as React.CSSProperties,
  sliderLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: 'rgba(0, 217, 166, 0.05)',
    border: '1px solid rgba(0, 217, 166, 0.2)',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  infoText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    flex: 1,
  } as React.CSSProperties,
};
