/**
 * Login page for municipal dashboard.
 *
 * Supports:
 * - Email + password authentication (primary)
 * - Phone OTP authentication (secondary)
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>SALGA Trust Engine</h1>
        <h2 style={styles.subtitle}>Municipal Dashboard</h2>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

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
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center' as const,
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '1rem',
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center' as const,
    marginBottom: '2rem',
  } as React.CSSProperties,
  errorBox: {
    padding: '0.75rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '4px',
    color: '#991b1b',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  infoBox: {
    padding: '0.75rem',
    backgroundColor: '#dbeafe',
    border: '1px solid #3b82f6',
    borderRadius: '4px',
    color: '#1e40af',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  } as React.CSSProperties,
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  } as React.CSSProperties,
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#374151',
  } as React.CSSProperties,
  input: {
    padding: '0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '1rem',
  } as React.CSSProperties,
  helperText: {
    fontSize: '0.75rem',
    color: '#6b7280',
  } as React.CSSProperties,
  button: {
    padding: '0.75rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  linkButton: {
    padding: '0.5rem',
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'underline',
  } as React.CSSProperties,
  divider: {
    textAlign: 'center' as const,
    color: '#6b7280',
    fontSize: '0.875rem',
    margin: '0.5rem 0',
  } as React.CSSProperties,
};
