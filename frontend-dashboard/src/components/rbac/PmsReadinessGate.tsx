/**
 * PmsReadinessGate — checklist overlay shown when PMS is not configured.
 *
 * Displayed when the backend returns a 403 PMS_NOT_READY response, or when
 * proactively fetching the readiness status from GET /departments/pms-readiness.
 *
 * Shows a visual checklist with green/red indicators for each condition and
 * a "Configure Now" button that navigates to the PMS setup wizard.
 *
 * Styling: uses CSS variables from @shared/design-tokens.css (no Tailwind).
 * Components: uses Button from @shared/components/ui/Button.
 *
 * Usage:
 *   <PmsReadinessGate checklist={readinessData} onConfigureClick={() => navigate('/pms-setup')} />
 */

import React from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';

/** Matches PmsReadinessStatus from src/services/pms_readiness.py */
export interface PmsChecklist {
  is_ready: boolean;
  municipality_configured: boolean;
  all_departments_have_directors: boolean;
  pms_officer_assigned: boolean;
  department_count: number;
  departments_with_directors: number;
  missing_directors: string[];
}

interface PmsReadinessGateProps {
  /** Readiness checklist from the backend. */
  checklist: PmsChecklist;
  /** Called when the admin clicks "Configure Now" — navigate to /pms-setup. */
  onConfigureClick: () => void;
}

/**
 * PmsReadinessGate renders a centered GlassCard with a three-item checklist.
 *
 * Each item shows a green checkmark or red cross:
 * - Municipality settings configured (settings_locked=True)
 * - All departments have directors (N/M assigned)
 * - PMS officer assigned
 *
 * If any departments are missing directors, their names are listed in an
 * amber warning box below the checklist.
 */
export function PmsReadinessGate({ checklist, onConfigureClick }: PmsReadinessGateProps) {
  const items = [
    {
      label: 'Municipality settings configured',
      done: checklist.municipality_configured,
    },
    {
      label: `All departments have directors (${checklist.departments_with_directors}/${checklist.department_count})`,
      done: checklist.all_departments_have_directors,
    },
    {
      label: 'PMS officer assigned',
      done: checklist.pms_officer_assigned,
    },
  ];

  return (
    <div style={styles.wrapper}>
      <GlassCard style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>PMS Setup Required</h2>
          <p style={styles.subtitle}>
            Complete the following steps to enable Performance Management System features.
          </p>
        </div>

        {/* Checklist */}
        <ul style={styles.list}>
          {items.map((item, i) => (
            <li key={i} style={styles.listItem}>
              {/* Status indicator */}
              <span
                style={{
                  ...styles.indicator,
                  background: item.done ? 'rgba(0, 191, 165, 0.15)' : 'rgba(255, 107, 74, 0.15)',
                  color: item.done ? 'var(--color-teal)' : 'var(--color-coral)',
                }}
                aria-hidden="true"
              >
                {item.done ? '\u2713' : '\u2717'}
              </span>

              {/* Label */}
              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  color: item.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  textDecoration: item.done ? 'line-through' : 'none',
                  fontWeight: item.done ? 400 : 500,
                }}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Missing directors warning */}
        {checklist.missing_directors.length > 0 && (
          <div style={styles.warningBox}>
            <p style={styles.warningTitle}>Departments missing directors:</p>
            <ul style={styles.warningList}>
              {checklist.missing_directors.map((deptName) => (
                <li key={deptName} style={styles.warningItem}>
                  <span aria-hidden="true">-</span>
                  <span>{deptName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <Button variant="primary" onClick={onConfigureClick} style={styles.ctaButton}>
          Configure Now
        </Button>
      </GlassCard>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-xl)',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    padding: 'var(--space-xl)',
  },
  header: {
    marginBottom: 'var(--space-lg)',
  },
  title: {
    fontSize: 'var(--text-h4)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 'var(--leading-relaxed)',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 var(--space-lg) 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  indicator: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
  },
  warningBox: {
    marginBottom: 'var(--space-lg)',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.25)',
    borderRadius: 'var(--radius-sm)',
  },
  warningTitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-gold)',
    fontWeight: 600,
    margin: '0 0 6px 0',
  },
  warningList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  warningItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-gold)',
  },
  ctaButton: {
    width: '100%',
  },
};
