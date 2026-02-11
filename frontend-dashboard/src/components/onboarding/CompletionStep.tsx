/**
 * Onboarding Wizard — Completion Step (Step 5)
 *
 * Celebration screen with summary of what was configured.
 * Calls POST /api/v1/onboarding/complete on mount.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@shared/components/ui/Button';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface CompletionStepProps {
  onComplete: () => Promise<boolean>;
  onNavigateDashboard: () => void;
  summary: {
    municipalityName?: string;
    municipalityCode?: string;
    teamMembersCount?: number;
    wardsCount?: number;
    slaConfigured?: boolean;
  };
}

export const CompletionStep: React.FC<CompletionStepProps> = ({
  onComplete,
  onNavigateDashboard,
  summary,
}) => {
  const reducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Call onboarding complete API on mount
  useEffect(() => {
    const completeOnboarding = async () => {
      setIsCompleting(true);
      const success = await onComplete();
      if (!success) {
        setError('Failed to mark onboarding as complete. You can still proceed to the dashboard.');
      }
      setIsCompleting(false);
    };

    completeOnboarding();
  }, [onComplete]);

  // Celebration animation
  useGSAP(
    () => {
      if (reducedMotion || isCompleting) return;

      const tl = gsap.timeline();

      // Icon scales in with bounce
      tl.from('.completion-icon', {
        scale: 0,
        rotation: -180,
        duration: 0.8,
        ease: 'back.out(2)',
      });

      // Content fades in with stagger
      tl.from(
        contentRef.current?.children || [],
        {
          y: 20,
          opacity: 0,
          duration: 0.5,
          stagger: 0.1,
        },
        '-=0.4'
      );
    },
    { scope: contentRef, dependencies: [isCompleting] }
  );

  if (isCompleting) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Finalizing your setup...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div ref={contentRef} style={styles.content}>
        <div className="completion-icon" style={styles.iconWrapper}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <h1 style={styles.title}>Your Dashboard is Ready!</h1>

        <p style={styles.description}>
          You've successfully set up your municipality on the SALGA Trust Engine platform.
        </p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* Summary */}
        <div style={styles.summary}>
          <h3 style={styles.summaryTitle}>What You Configured:</h3>
          <ul style={styles.summaryList}>
            {summary.municipalityName && (
              <li style={styles.summaryItem}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  <strong>{summary.municipalityName}</strong>
                  {summary.municipalityCode && ` (${summary.municipalityCode})`}
                </span>
              </li>
            )}
            <li style={styles.summaryItem}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {summary.teamMembersCount && summary.teamMembersCount > 0
                  ? `${summary.teamMembersCount} team member${summary.teamMembersCount !== 1 ? 's' : ''} invited`
                  : 'No team members yet (you can add them in Settings)'}
              </span>
            </li>
            <li style={styles.summaryItem}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {summary.wardsCount && summary.wardsCount > 0
                  ? `${summary.wardsCount} ward${summary.wardsCount !== 1 ? 's' : ''} configured`
                  : 'No wards configured yet (you can add them in Settings)'}
              </span>
            </li>
            <li style={styles.summaryItem}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {summary.slaConfigured
                  ? 'SLA targets configured'
                  : 'Using default SLA targets (24h response, 7 days resolution)'}
              </span>
            </li>
          </ul>
        </div>

        <Button variant="primary" size="lg" onClick={onNavigateDashboard} style={styles.ctaButton}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

const styles = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '1rem',
  } as React.CSSProperties,
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid var(--surface-higher)',
    borderTop: '4px solid var(--color-teal)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,
  loadingText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
  } as React.CSSProperties,
  content: {
    textAlign: 'center' as const,
    maxWidth: '600px',
  } as React.CSSProperties,
  iconWrapper: {
    marginBottom: '1.5rem',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  } as React.CSSProperties,
  description: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    lineHeight: 1.6,
  } as React.CSSProperties,
  errorBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  summary: {
    textAlign: 'left' as const,
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
  } as React.CSSProperties,
  summaryTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  } as React.CSSProperties,
  summaryList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  } as React.CSSProperties,
  ctaButton: {
    minWidth: '200px',
  } as React.CSSProperties,
};
