/**
 * WardBoundariesSection — Read-only display of ward boundary configuration.
 *
 * Per research: Ward boundary configuration is managed by SALGA administration.
 * Displays a contact message and any known ward IDs.
 */

import React from 'react';
import { SettingsSection } from './SettingsSection';
import type { MunicipalityProfile } from '../../types/settings';

interface WardBoundariesSectionProps {
  /** Profile used to check municipality ID (ward IDs not stored yet) */
  profile: MunicipalityProfile | null;
}

export function WardBoundariesSection({ profile }: WardBoundariesSectionProps) {
  return (
    <SettingsSection
      id="ward-boundaries"
      title="Ward Boundaries"
      description="Ward boundary configuration for spatial ticket routing."
      onSave={async () => {}}
      isDirty={false}
      isSaving={false}
    >
      <div style={styles.infoBox}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div style={styles.infoContent}>
          <p style={styles.infoTitle}>Managed by SALGA Administration</p>
          <p style={styles.infoText}>
            Ward boundary configuration is managed by SALGA administration. Contact{' '}
            <a href="mailto:support@salga.org.za" style={styles.link}>
              support@salga.org.za
            </a>{' '}
            to update ward boundaries for your municipality.
          </p>
        </div>
      </div>

      {profile && (
        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Municipality</span>
            <span style={styles.detailValue}>{profile.name}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Code</span>
            <span style={styles.detailValue}>{profile.code}</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>Province</span>
            <span style={styles.detailValue}>{profile.province}</span>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-md)',
    padding: 'var(--space-md)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(0, 191, 165, 0.07)',
    border: '1px solid rgba(0, 191, 165, 0.2)',
    marginBottom: 'var(--space-md)',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--color-teal)',
    margin: '0 0 0.375rem',
  },
  infoText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  link: {
    color: 'var(--color-teal)',
    textDecoration: 'underline',
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: 'var(--space-md)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
  },
  detailRow: {
    display: 'flex',
    gap: 'var(--space-md)',
    alignItems: 'baseline',
  },
  detailLabel: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    minWidth: '100px',
    flexShrink: 0,
    fontWeight: 500,
  },
  detailValue: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
  },
};
