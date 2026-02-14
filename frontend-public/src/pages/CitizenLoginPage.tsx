/**
 * Premium Citizen Login Page for Public Portal
 *
 * Features:
 * - Full-viewport skyline background with pink overlay
 * - Glassmorphism login card centered (citizen-focused layout)
 * - Staggered GSAP animation sequence on load
 * - Dual auth modes: Email+password and Phone OTP
 * - Return URL redirect after successful authentication
 */

import { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { GlassCard } from '@shared/components/ui/GlassCard';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type AuthMode = 'email' | 'phone' | 'verify-otp';

export function CitizenLoginPage() {
  const { signInWithEmail, signInWithPhone, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTagline = () => {
    const fromPath = location.state?.from?.pathname;
    if (fromPath === '/profile' || fromPath === '/my-reports') {
      return 'Sign in to access your profile';
    }
    if (fromPath === '/dashboard') {
      return 'Sign in to access your dashboard';
    }
    return 'Sign in to track your reports'; // default (e.g., from /report)
  };

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

      // Return URL handling with sessionStorage fallback
      const returnUrl =
        location.state?.from?.pathname ||
        sessionStorage.getItem('returnUrl') ||
        '/profile';
      sessionStorage.removeItem('returnUrl');
      navigate(returnUrl, { replace: true });
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

      // Return URL handling with sessionStorage fallback
      const returnUrl =
        location.state?.from?.pathname ||
        sessionStorage.getItem('returnUrl') ||
        '/profile';
      sessionStorage.removeItem('returnUrl');
      navigate(returnUrl, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Glassmorphism Login Card - Centered for Citizens */}
      <div ref={cardRef}>
        <GlassCard style={styles.card}>
          <div style={styles.logoSection}>
            <h1 style={styles.title}>Citizen Portal</h1>
            <p style={styles.tagline}>{getTagline()}</p>
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
                    placeholder="your.email@example.com"
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

                <div style={styles.divider}>
                  <span style={styles.dividerText}>Don't have an account?</span>
                </div>

                <Link to="/register" style={styles.linkButton}>
                  Register
                </Link>
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
        </GlassCard>
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
    padding: '0 var(--space-lg)',
    paddingTop: '80px',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '1.25rem 2rem 1.75rem 2rem',
    borderRadius: 'var(--radius-xl)',
    position: 'relative' as const,
    zIndex: 2,
    margin: '0 auto',
  } as React.CSSProperties,
  logoSection: {
    marginBottom: '0.75rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  title: {
    fontSize: '1.75rem',
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
    gap: '0.875rem',
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
    padding: '0.625rem',
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
    padding: '0.75rem',
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
    color: 'var(--color-accent-gold)',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'underline',
  } as React.CSSProperties,
  divider: {
    textAlign: 'center' as const,
    margin: '0.25rem 0',
  } as React.CSSProperties,
  dividerText: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
