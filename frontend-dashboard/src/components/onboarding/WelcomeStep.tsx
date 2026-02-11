/**
 * Onboarding Wizard — Welcome Step (Step 0)
 *
 * Introduction screen with animated entrance.
 * Shows what will be configured during onboarding.
 */

import React, { useRef } from 'react';
import { Button } from '@shared/components/ui/Button';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useReducedMotion } from '@shared/hooks/useReducedMotion';

interface WelcomeStepProps {
  onStart: () => void;
}

export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onStart }) => {
  const reducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (reducedMotion) return;

      const tl = gsap.timeline();
      tl.from(contentRef.current?.children || [], {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out',
      });
    },
    { scope: contentRef }
  );

  return (
    <div style={styles.container}>
      <div ref={contentRef} style={styles.content}>
        <h1 style={styles.title}>Welcome to SALGA Trust Engine!</h1>
        <p style={styles.description}>
          Let's get your municipality set up. This takes about 5 minutes.
        </p>

        <div style={styles.features}>
          <div style={styles.feature}>
            <div style={styles.icon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3 style={styles.featureTitle}>Profile</h3>
            <p style={styles.featureText}>
              Set up your municipality details
            </p>
          </div>

          <div style={styles.feature}>
            <div style={styles.icon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-coral)" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 style={styles.featureTitle}>Team</h3>
            <p style={styles.featureText}>
              Invite your team members
            </p>
          </div>

          <div style={styles.feature}>
            <div style={styles.icon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-gold)" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3 style={styles.featureTitle}>Settings</h3>
            <p style={styles.featureText}>
              Configure wards and SLA targets
            </p>
          </div>
        </div>

        <Button variant="primary" size="lg" onClick={onStart} style={styles.startButton}>
          Start Setup
        </Button>
      </div>
    </div>
  );
};

const styles = {
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
  title: {
    fontSize: '2.5rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
    background: 'linear-gradient(135deg, var(--color-coral), var(--color-teal))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } as React.CSSProperties,
  description: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    marginBottom: '3rem',
    lineHeight: 1.6,
  } as React.CSSProperties,
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '2rem',
    marginBottom: '3rem',
  } as React.CSSProperties,
  feature: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,
  icon: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--surface-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  featureTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
  } as React.CSSProperties,
  featureText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.4,
  } as React.CSSProperties,
  startButton: {
    minWidth: '200px',
  } as React.CSSProperties,
};
