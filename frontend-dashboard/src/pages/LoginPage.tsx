/**
 * Premium Branded Login Page for Municipal Dashboard
 *
 * Features:
 * - Full-viewport dark background with GradientMeshBg
 * - Small decorative 3D globe (React.lazy + Suspense)
 * - Glassmorphism login card with SALGA branding
 * - Staggered GSAP animation sequence on load
 * - Dual auth modes: Email+password and Phone OTP
 */

import { useState, Suspense, lazy } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GradientMeshBg } from '../components/GradientMeshBg';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useRef } from 'react';

// Code-split 3D globe for performance
const Globe3DSmall = lazy(() => import('../components/Globe3DSmall'));

type AuthMode = 'email' | 'phone' | 'verify-otp';

export function LoginPage() {
  const { signInWithEmail, signInWithPhone, verifyOtp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email + password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone OTP fields
  const [phone, setPhone] = useState('');
  const [otpToken, setOtpToken] = useState('');

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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithEmail(email, password);
      // Auth state change will trigger redirect via App.tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signInWithPhone(phone);
      setMode('verify-otp');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await verifyOtp(phone, otpToken);
      // Auth state change will trigger redirect via App.tsx
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} style={styles.container}>
      <GradientMeshBg />

      {/* Decorative 3D Globe */}
      <div style={styles.globeContainer}>
        <Suspense fallback={null}>
          <Globe3DSmall />
        </Suspense>
      </div>

      {/* Glassmorphism Login Card */}
      <div ref={cardRef} className="glass" style={styles.card}>
        <div style={styles.logoSection}>
          <h1 style={styles.title}>SALGA Trust Engine</h1>
          <p style={styles.tagline}>Municipal Dashboard</p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <div ref={formFieldsRef}>
          {mode === 'email' && (
            <form onSubmit={handleEmailLogin} style={styles.form}>
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
                style={styles.input}
                placeholder="Enter your password"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div style={styles.divider}>OR</div>

            <button
              type="button"
              onClick={() => setMode('phone')}
              style={styles.linkButton}
            >
              Sign in with Phone OTP
            </button>
          </form>
        )}

        {mode === 'phone' && (
          <form onSubmit={handlePhoneLogin} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="phone" style={styles.label}>Phone Number</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={styles.input}
                placeholder="+27123456789"
              />
              <small style={styles.helperText}>Format: +27XXXXXXXXX</small>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>

            <button
              type="button"
              onClick={() => setMode('email')}
              style={styles.linkButton}
            >
              Back to email login
            </button>
          </form>
        )}

        {mode === 'verify-otp' && (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <div style={styles.infoBox}>
              OTP code sent to {phone}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="otp" style={styles.label}>6-Digit Code</label>
              <input
                id="otp"
                type="text"
                value={otpToken}
                onChange={(e) => setOtpToken(e.target.value)}
                required
                maxLength={6}
                pattern="[0-9]{6}"
                style={styles.input}
                placeholder="123456"
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
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('phone');
                setOtpToken('');
              }}
              style={styles.linkButton}
            >
              Resend OTP
            </button>
          </form>
        )}
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
  globeContainer: {
    position: 'absolute' as const,
    left: '10%',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '300px',
    height: '300px',
    opacity: 0.6,
    pointerEvents: 'none' as const,
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
  infoBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(0, 217, 166, 0.1)',
    border: '1px solid var(--color-teal)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-teal)',
    marginBottom: '1rem',
    fontSize: '0.875rem',
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
  helperText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
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
  } as React.CSSProperties,
  divider: {
    textAlign: 'center' as const,
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    margin: '0.5rem 0',
  } as React.CSSProperties,
};
