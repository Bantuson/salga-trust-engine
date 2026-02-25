/**
 * Premium Citizen Registration Page for Public Portal
 *
 * Features:
 * - Full-viewport skyline background with pink overlay
 * - Glassmorphism registration card centered
 * - GSAP animation sequence on load
 * - Email+password signup with optional phone and municipality
 * - NO proof of residence required at signup (per user decision)
 * - Inline 6-digit OTP verification step after signup (no dead-end success screen)
 * - Client-side password validation matching backend policy (12 chars, uppercase, lowercase, digit)
 */

import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { GlassCard } from '@shared/components/ui/GlassCard';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

function MunicipalityDropdown({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || options[0]?.label;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.75rem',
          paddingRight: '2.5rem',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '1rem',
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          position: 'relative',
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2300d9a6' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
        }}
      >
        {selectedLabel}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            background: 'rgba(30, 30, 40, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            maxHeight: '240px',
            overflowY: 'auto',
            zIndex: 50,
          }}
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              onMouseEnter={() => setFocusedIndex(index)}
              onMouseLeave={() => setFocusedIndex(-1)}
              style={{
                padding: '0.625rem 1rem',
                color: option.value === value ? 'var(--color-teal)' : 'var(--text-primary)',
                fontWeight: option.value === value ? 600 : 400,
                background: focusedIndex === index ? 'rgba(205, 94, 129, 0.15)' : 'transparent',
                cursor: 'pointer',
                fontSize: '0.95rem',
                transition: 'background 0.15s',
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PILOT_MUNICIPALITIES = [
  { value: '', label: 'Select your municipality (optional)' },
  { value: 'city-of-johannesburg', label: 'City of Johannesburg' },
  { value: 'ethekwini', label: 'eThekwini Metropolitan' },
  { value: 'city-of-cape-town', label: 'City of Cape Town' },
  { value: 'city-of-tshwane', label: 'City of Tshwane' },
  { value: 'buffalo-city', label: 'Buffalo City Metropolitan' },
];

// Password validation matching backend policy (12 chars, uppercase, lowercase, digit)
// SEC-01: Client-side validation mirrors src/schemas/user.py validate_password_complexity
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 12) errors.push('At least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/\d/.test(password)) errors.push('At least one digit');
  return { valid: errors.length === 0, errors };
}

type RegisterMode = 'form' | 'verify-otp' | 'success';

export function CitizenRegisterPage() {
  const { signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState<RegisterMode>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('');

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Animation refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const formFieldsRef = useRef<HTMLFormElement>(null);

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
        clearProps: 'opacity,transform',
      });
      // Form fields stagger in
      tl.from(
        formFieldsRef.current?.children || [],
        {
          y: 20,
          opacity: 0,
          duration: 0.4,
          stagger: 0.1,
          clearProps: 'opacity,transform',
        },
        '-=0.3'
      );
    },
    { scope: containerRef }
  );

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!username.trim()) {
      errors.username = 'Username is required';
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else {
      const pwdValidation = validatePassword(password);
      if (!pwdValidation.valid) {
        errors.password = 'Password must contain: ' + pwdValidation.errors.join(', ');
      }
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create the account with metadata
      await signUp(email, password, {
        full_name: fullName,
        display_name: username,
        phone: phone || undefined,
        municipality: municipality || undefined,
      });

      // Transition to OTP verification step immediately after signUp succeeds
      setRegisteredEmail(email);
      setMode('verify-otp');

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
      // User is now fully authenticated — navigate to profile
      navigate('/profile', { replace: true });
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
        <div className="auth-skyline-bg" />
        <div className="auth-skyline-overlay" />

        <div ref={cardRef}>
          <GlassCard style={styles.card}>
            <div style={styles.logoSection}>
              <h1 style={styles.title}>Verify Your Email</h1>
              <p style={styles.tagline}>Enter the verification code we sent you</p>
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
                <label htmlFor="otpCode" style={styles.label}>
                  Verification Code <span style={styles.required}>*</span>
                </label>
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

      {/* Glassmorphism Registration Card - Centered for Citizens */}
      <div ref={cardRef}>
        <GlassCard style={styles.card}>
          <div style={styles.logoSection}>
            <h1 style={styles.title}>Create Your Account</h1>
            <p style={styles.tagline}>Join the SALGA Trust Engine citizen portal</p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} style={styles.form} ref={formFieldsRef}>
            <div style={styles.formGroup}>
              <label htmlFor="fullName" style={styles.label}>
                Full Name <span style={styles.required}>*</span>
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={styles.input}
                placeholder="John Doe"
                autoComplete="name"
              />
              {fieldErrors.fullName && (
                <span style={styles.fieldError}>{fieldErrors.fullName}</span>
              )}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="username" style={styles.label}>
                Username <span style={styles.required}>*</span>
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={styles.input}
                placeholder="johndoe"
                autoComplete="username"
              />
              {fieldErrors.username && (
                <span style={styles.fieldError}>{fieldErrors.username}</span>
              )}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="email" style={styles.label}>
                Email Address <span style={styles.required}>*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
                placeholder="your.email@example.com"
                autoComplete="email"
              />
              {fieldErrors.email && (
                <span style={styles.fieldError}>{fieldErrors.email}</span>
              )}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="password" style={styles.label}>
                Password <span style={styles.required}>*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
                placeholder="At least 12 characters"
                autoComplete="new-password"
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
                </div>
              )}
              {fieldErrors.password && (
                <span style={styles.fieldError}>{fieldErrors.password}</span>
              )}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="confirmPassword" style={styles.label}>
                Confirm Password <span style={styles.required}>*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={styles.input}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && (
                <span style={styles.fieldError}>{fieldErrors.confirmPassword}</span>
              )}
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="phone" style={styles.label}>
                Phone Number (optional)
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={styles.input}
                placeholder="+27123456789"
                autoComplete="tel"
              />
              <small style={styles.helperText}>Format: +27XXXXXXXXX</small>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Municipality (optional)
              </label>
              <MunicipalityDropdown
                options={PILOT_MUNICIPALITIES}
                value={municipality}
                onChange={setMunicipality}
              />
              <small style={styles.helperText}>You can set this later in your profile</small>
            </div>

            <button
              type="submit"
              disabled={loading || (password.length > 0 && !validatePassword(password).valid)}
              style={{
                ...styles.button,
                ...(loading || (password.length > 0 && !validatePassword(password).valid) ? styles.buttonDisabled : {}),
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerText}>Already have an account?</span>
            </div>

            <Link to="/login" style={styles.linkButton}>
              Sign in
            </Link>
          </form>
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
    paddingTop: '100px',
    paddingBottom: 'var(--space-lg)',
    paddingLeft: 0,
    paddingRight: 0,
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '500px',
    padding: '3rem 2.5rem',
    borderRadius: 'var(--radius-xl)',
    position: 'relative' as const,
    zIndex: 2,
    margin: '0 auto',
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
  required: {
    color: 'var(--color-coral)',
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
  fieldError: {
    fontSize: '0.75rem',
    color: 'var(--color-coral)',
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
    textAlign: 'center' as const,
    textDecoration: 'none',
    display: 'block',
    opacity: 1,
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
