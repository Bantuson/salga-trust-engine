/**
 * Onboarding Wizard Progress Indicator
 *
 * Visual progress bar showing step completion with circles, check icons, and percentage.
 * Responsive: hides step titles on mobile, shows only circles and percentage.
 */

import React from 'react';

export interface WizardStep {
  id: string;
  title: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStepIndex: number;
}

export const WizardProgress: React.FC<WizardProgressProps> = ({ steps, currentStepIndex }) => {
  const completedCount = steps.filter((s) => s.isCompleted).length;
  const progressPercentage = Math.round((completedCount / steps.length) * 100);

  return (
    <div style={styles.container}>
      {/* Step indicators */}
      <div style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} style={styles.stepWrapper}>
              {/* Circle */}
              <div
                style={{
                  ...styles.circle,
                  ...(step.isCompleted
                    ? styles.circleCompleted
                    : step.isCurrent
                    ? styles.circleCurrent
                    : styles.circleUpcoming),
                }}
              >
                {step.isCompleted ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={styles.stepNumber}>{index + 1}</span>
                )}
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  style={{
                    ...styles.line,
                    ...(steps[index + 1]?.isCompleted || step.isCompleted
                      ? styles.lineCompleted
                      : styles.lineUpcoming),
                  }}
                />
              )}

              {/* Step title (desktop only) */}
              <div style={styles.stepTitle}>{step.title}</div>
            </div>
          );
        })}
      </div>

      {/* Progress text */}
      <div style={styles.progressText}>
        Step {currentStepIndex + 1} of {steps.length} — {progressPercentage}%
      </div>
    </div>
  );
};

const styles = {
  container: {
    marginBottom: '2rem',
  } as React.CSSProperties,
  stepsRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    position: 'relative' as const,
    marginBottom: '1rem',
  } as React.CSSProperties,
  stepWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flex: 1,
    position: 'relative' as const,
  } as React.CSSProperties,
  circle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'var(--transition-base)',
    zIndex: 2,
    position: 'relative' as const,
  } as React.CSSProperties,
  circleCompleted: {
    backgroundColor: 'var(--color-teal)',
    color: 'white',
    boxShadow: '0 0 20px rgba(0, 217, 166, 0.4)',
  } as React.CSSProperties,
  circleCurrent: {
    backgroundColor: 'var(--color-coral)',
    color: 'white',
    boxShadow: '0 0 20px rgba(255, 107, 74, 0.4)',
    animation: 'pulse 2s ease-in-out infinite',
  } as React.CSSProperties,
  circleUpcoming: {
    backgroundColor: 'var(--surface-higher)',
    color: 'var(--text-muted)',
    border: '2px solid var(--border-subtle)',
  } as React.CSSProperties,
  stepNumber: {
    fontSize: '1rem',
    fontWeight: '600',
  } as React.CSSProperties,
  line: {
    position: 'absolute' as const,
    top: '20px',
    left: '50%',
    width: '100%',
    height: '2px',
    zIndex: 1,
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
  lineCompleted: {
    backgroundColor: 'var(--color-teal)',
  } as React.CSSProperties,
  lineUpcoming: {
    backgroundColor: 'var(--border-subtle)',
  } as React.CSSProperties,
  stepTitle: {
    marginTop: '0.75rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    maxWidth: '80px',
    lineHeight: 1.2,
  } as React.CSSProperties,
  progressText: {
    textAlign: 'center' as const,
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginTop: '1rem',
  } as React.CSSProperties,
};
