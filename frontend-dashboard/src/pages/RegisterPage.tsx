/**
 * Premium Registration Page for Municipal Dashboard
 *
 * Features:
 * - Full-viewport dark background with AnimatedGradientBg
 * - Small decorative 3D globe (React.lazy + Suspense)
 * - Glassmorphism registration card with SALGA branding
 * - Staggered GSAP animation sequence on load
 * - Registration with email + password + full name
 */

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AnimatedGradientBg } from '@shared/components/AnimatedGradientBg';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Animation refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formFieldsRef = useRef<HTMLDivElement>(null);

  // Staggered entrance animation
  useGSAP(
    () => {
      const tl = gsap.timeline();
      // Card slides up with bounce
      tl.from(cardRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.7)',
      });
      // Form fields stagger in
      tl.from(
        formFieldsRef.current?.children || [],
        {
          y: 20,
          opacity: 0,
          duration: 0.4,
          stagger: 0.1,
        },
        '-=0.3'
      );
    },
    { scope: containerRef }
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      setSuccess(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div ref={containerRef} style={styles.container}>
        <AnimatedGradientBg />

        <div ref={cardRef} className="glass" style={styles.card}>
          <div style={styles.logoSection}>
            <h1 style={styles.title}>SALGA Trust Engine</h1>
            <p style={styles.tagline}>Municipal Dashboard</p>
          </div>

          <div style={styles.successBox}>
            <svg
              width="48"
              height="48"
              fill="none"
              stroke="var(--color-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 1rem' }}
            >
              <path d="M22 11.08V12a10 10 0 0 0 10 10h.92" />
              <circle cx="12" cy="12" r="10" />
              <polyline points="8 12 12 16 16 12" />
            </svg>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Account Created!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Please check your email to verify your account.
            </p>
            <Link to="/login" style={styles.linkButton}>
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      <AnimatedGradientBg />

      {/* Glassmorphism Registration Card */}
      <div ref={cardRef} className="glass" style={styles.card}>
        <div style={styles.logoSection}>
          <h1 style={styles.title}>SALGA Trust Engine</h1>
          <p style={styles.tagline}>Create Municipal Account</p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <div ref={formFieldsRef}>
          <form onSubmit={handleRegister} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="fullName" style={styles.label}>Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={styles.input}
                placeholder="John Doe"
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="email" style={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
                placeholder="user@municipality.gov.za"
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={styles.input}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="confirmPassword" style={styles.label}>Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                style={styles.input}
                placeholder="Re-enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerText}>Already have an account?</span>
            </div>

            <Link to="/login" style={styles.linkButton}>
              Sign In
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '3rem 2.5rem',
    borderRadius: 'var(--radius-xl)',
    position: 'relative' as const,
    zIndex: 10,
    marginLeft: 'auto',
    marginRight: '10%',
  } as React.CSSProperties,
  logoSection: {
    marginBottom: '2rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
    background: 'linear-gradient(135deg, var(--color-coral), var(--color-teal))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } as React.CSSProperties,
  tagline: {
    fontSize: '1rem',
    fontWeight: '400',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  errorBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  successBox: {
    textAlign: 'center' as const,
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  } as React.CSSProperties,
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } as React.CSSProperties,
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  input: {
    padding: '0.75rem',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,
  button: {
    padding: '0.875rem',
    backgroundColor: 'var(--color-coral)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  buttonDisabled: {
    backgroundColor: 'var(--surface-higher)',
    cursor: 'not-allowed',
    opacity: 0.6,
  } as React.CSSProperties,
  linkButton: {
    padding: '0.5rem',
    backgroundColor: 'transparent',
    color: 'var(--color-teal)',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'underline',
    textAlign: 'center' as const,
    display: 'block',
  } as React.CSSProperties,
  divider: {
    textAlign: 'center' as const,
    margin: '0.5rem 0',
  } as React.CSSProperties,
  dividerText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
