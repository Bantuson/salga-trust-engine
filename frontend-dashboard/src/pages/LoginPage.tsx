/**
 * Premium Branded Login Page for Municipal Dashboard
 *
 * Features:
 * - Full-viewport skyline background with pink overlay
 * - Glassmorphism login card with SALGA branding
 * - Staggered GSAP animation sequence on load
 * - Dual auth modes: Email+password and Phone OTP
 */

import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GlassCard } from '@shared/components/ui/GlassCard';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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
  const productInfoRef = useRef<HTMLDivElement>(null);

  // Staggered entrance animation
  useGSAP(
    () => {
      const tl = gsap.timeline();
      // Product info slides in from left
      tl.from(productInfoRef.current, {
        x: -30,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.out',
      });
      // Card slides up with bounce
      tl.from(cardRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.7)',
      }, '-=0.2');
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
      {/* Skyline background layers */}
      <div className="auth-skyline-bg" />
      <div className="auth-skyline-overlay" />

      {/* Top-right branding pill (like Report Issue CTA in public portal) */}
      <div style={styles.brandingCorner}>
        <div style={styles.brandingPill}>
          <span style={styles.brandingTitle}>SALGA Trust Engine</span>
          <span style={styles.brandingSeparator}>|</span>
          <span style={styles.brandingSubtitle}>Municipal Dashboard</span>
        </div>
      </div>

      {/* Product Info Section */}
      <div ref={productInfoRef} className="login-product-info" style={styles.productInfo}>
        <h2 style={styles.productTagline}>Municipal Service Management</h2>
        <p style={styles.productDescription}>
          Manage citizen reports, track service delivery, and monitor municipal performance in real time.
          AI-powered routing, SLA tracking, and automated escalation ensure no issue falls through the cracks.
        </p>

        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <span style={styles.checkIcon}>✓</span>
            <span style={styles.featureText}>Real-time ticket management and assignment</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.checkIcon}>✓</span>
            <span style={styles.featureText}>SLA compliance monitoring with auto-escalation</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.checkIcon}>✓</span>
            <span style={styles.featureText}>Team workload analytics and performance tracking</span>
          </div>
          <div style={styles.featureItem}>
            <span style={styles.checkIcon}>✓</span>
            <span style={styles.featureText}>Citizen communication via WhatsApp integration</span>
          </div>
        </div>
      </div>

      {/* Glassmorphism Login Card */}
      <div ref={cardRef}>
      <GlassCard style={styles.card}>
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
    justifyContent: 'space-between',
    position: 'relative' as const,
    overflow: 'hidden',
    padding: '0 5%',
  } as React.CSSProperties,
  productInfo: {
    position: 'relative' as const,
    zIndex: 2,
    maxWidth: '480px',
    marginLeft: '5%',
    color: 'white',
    background: 'rgba(205, 94, 129, 0.35)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-xl)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
  } as React.CSSProperties,
  productTagline: {
    fontSize: '2rem',
    fontWeight: '800',
    marginBottom: '1.5rem',
    lineHeight: '1.1',
    color: 'white',
  } as React.CSSProperties,
  productDescription: {
    fontSize: '1.125rem',
    lineHeight: '1.7',
    marginBottom: '2rem',
    color: 'rgba(255, 255, 255, 0.95)',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
  } as React.CSSProperties,
  featureList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  } as React.CSSProperties,
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,
  checkIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-teal)',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: '700',
    flexShrink: 0,
  } as React.CSSProperties,
  featureText: {
    fontSize: '1rem',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,
  brandingCorner: {
    position: 'absolute' as const,
    top: '1.5rem',
    right: '5%',
    zIndex: 3,
  } as React.CSSProperties,
  brandingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 'var(--radius-xl)',
  } as React.CSSProperties,
  brandingTitle: {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'var(--color-accent-gold)',
  } as React.CSSProperties,
  brandingSeparator: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '1rem',
  } as React.CSSProperties,
  brandingSubtitle: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '1.75rem 2rem',
    borderRadius: 'var(--radius-xl)',
    position: 'relative' as const,
    zIndex: 2,
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
    color: 'var(--color-teal)',
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
