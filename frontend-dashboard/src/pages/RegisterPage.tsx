/**
 * Premium Registration Page for Municipal Dashboard
 *
 * Features:
 * - Full-viewport skyline background with pink overlay
 * - Glassmorphism registration card with SALGA branding
 * - Staggered GSAP animation sequence on load
 * - Registration with email + password + full name
 * - Inline 6-digit OTP verification step after signup (no dead-end success screen)
 * - Client-side password validation matching backend policy (12 chars, uppercase, lowercase, digit)
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { validatePassword, checkPasswordLeaked } from '@shared/lib/password';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type RegisterMode = 'form' | 'verify-otp';

export function RegisterPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<RegisterMode>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // HIBP leaked password check state
  const [leakedCount, setLeakedCount] = useState<number | null>(null);
  const [checkingLeaked, setCheckingLeaked] = useState(false);

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

  // Debounced HIBP leaked password check — runs when password passes basic validation
  useEffect(() => {
    setLeakedCount(null);
    if (!validatePassword(password).valid) return;
    setCheckingLeaked(true);
    const timer = setTimeout(async () => {
      const count = await checkPasswordLeaked(password);
      setLeakedCount(count);
      setCheckingLeaked(false);
    }, 500);
    return () => { clearTimeout(timer); setCheckingLeaked(false); };
  }, [password]);

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

    const pwdValidation = validatePassword(password);
    if (!pwdValidation.valid) {
      setError('Password must contain: ' + pwdValidation.errors.join(', '));
      setLoading(false);
      return;
    }

    // Block submission if password found in breaches (fail-open: -1 = API unavailable, allow)
    const breachCount = leakedCount ?? await checkPasswordLeaked(password);
    if (breachCount > 0) {
      setLeakedCount(breachCount);
      setError('This password has been found in data breaches. Please choose a different password.');
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
            display_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;

      // Transition to OTP verification step immediately after signUp succeeds
      setRegisteredEmail(email);
      setMode('verify-otp');
      setError(null);

      // Also send OTP via signInWithOtp (uses "Magic Link" template which delivers reliably)
      // Non-blocking: if rate-limited, user still has the signUp confirmation code
      try {
        await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
      } catch {
        // Ignore rate limit errors — signUp already sent a code
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // verifyOtp with type 'email' confirms the email AND creates an active session
      await supabase.auth.verifyOtp({
        email: registeredEmail,
        token: otpCode,
        type: 'email',
      });
      // User is now fully authenticated — navigate to dashboard root
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendMessage(null);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.signInWithOtp({
        email: registeredEmail,
        options: { shouldCreateUser: false },
      });
      if (resendError) throw resendError;
      setResendMessage('Verification code resent! Check your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    }
  };

  // OTP verification step — appears after successful signUp()
  if (mode === 'verify-otp') {
    return (
      <div ref={containerRef} style={styles.container}>
        {/* Skyline background layers */}
        <div className="auth-skyline-bg" />
        <div className="auth-skyline-overlay" />

        <div ref={cardRef}>
          <GlassCard style={styles.card}>
            <div style={styles.logoSection}>
              <h1 style={styles.title}>SALGA Trust Engine</h1>
              <p style={styles.tagline}>Verify Your Email</p>
            </div>

            {error && (
              <div style={styles.errorBox}>
                {error}
              </div>
            )}

            {resendMessage && (
              <div style={styles.successBox}>
                {resendMessage}
              </div>
            )}

            <div style={styles.successBox}>
              <p style={{ margin: 0 }}>
                Verification code sent to <strong>{registeredEmail}</strong>
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Check your spam folder if you don't see it within a minute.
              </p>
            </div>

            <form onSubmit={handleVerifyRegistrationOtp} style={{ ...styles.form, marginTop: '1.5rem' }}>
              <div style={styles.formGroup}>
                <label htmlFor="otpCode" style={styles.label}>Verification Code</label>
                <input
                  id="otpCode"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  required
                  maxLength={8}
                  pattern="[0-9]{6,8}"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{
                    ...styles.input,
                    textAlign: 'center',
                    letterSpacing: '0.5em',
                    fontSize: '1.5rem',
                  }}
                  placeholder="00000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                style={{
                  ...styles.button,
                  ...(loading || otpCode.length < 6 ? styles.buttonDisabled : {}),
                }}
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>

              <div style={styles.divider}>
                <span style={styles.dividerText}>Didn't receive the code?</span>
              </div>

              <button
                type="button"
                onClick={handleResendCode}
                style={styles.linkButton}
              >
                Resend Code
              </button>
            </form>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Skyline background layers */}
      <div className="auth-skyline-bg" />
      <div className="auth-skyline-overlay" />
      <div className="auth-skyline-frame" />

      {/* Glassmorphism Registration Card */}
      <div ref={cardRef}>
      <GlassCard style={styles.card}>
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
                minLength={12}
                style={styles.input}
                placeholder="Minimum 12 characters"
              />
              {/* Password requirements hint — shown when password field has content */}
              {password.length > 0 && (
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap' as const,
                  gap: '0.375rem',
                  marginTop: '0.25rem',
                }}>
                  {[
                    { label: '12+ characters', met: password.length >= 12 },
                    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
                    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
                    { label: 'Number', met: /\d/.test(password) },
                  ].map(({ label, met }) => (
                    <span key={label} style={{
                      fontSize: '0.75rem',
                      color: met ? '#4ade80' : 'rgba(255,255,255,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}>
                      <span style={{ fontSize: '0.65rem' }}>{met ? '✓' : '○'}</span>
                      {label}
                    </span>
                  ))}
                  {validatePassword(password).valid && (
                    <span style={{
                      fontSize: '0.75rem',
                      color: checkingLeaked ? 'rgba(255,255,255,0.45)' : leakedCount === 0 ? '#4ade80' : leakedCount !== null && leakedCount > 0 ? '#ef4444' : 'rgba(255,255,255,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                    }}>
                      <span style={{ fontSize: '0.65rem' }}>
                        {checkingLeaked ? '...' : leakedCount === 0 ? '✓' : leakedCount !== null && leakedCount > 0 ? '✗' : '○'}
                      </span>
                      {checkingLeaked ? 'Checking breaches...' : leakedCount === 0 ? 'Not in known breaches' : leakedCount !== null && leakedCount > 0 ? 'Found in data breaches!' : 'Breach check pending'}
                    </span>
                  )}
                </div>
              )}
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
              disabled={loading || (password.length > 0 && !validatePassword(password).valid) || (leakedCount !== null && leakedCount > 0)}
              style={{
                ...styles.button,
                ...(loading || (password.length > 0 && !validatePassword(password).valid) || (leakedCount !== null && leakedCount > 0) ? styles.buttonDisabled : {}),
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
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '3rem 2.5rem',
    borderRadius: 'var(--radius-xl)',
    position: 'relative' as const,
    zIndex: 2,
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
    padding: '1rem',
    backgroundColor: 'rgba(0, 217, 166, 0.1)',
    border: '1px solid var(--color-teal)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
    fontSize: '0.95rem',
    lineHeight: '1.6',
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
