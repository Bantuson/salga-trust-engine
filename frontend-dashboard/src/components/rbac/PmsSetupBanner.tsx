/**
 * PmsSetupBanner -- dismissible info banner shown on the admin dashboard
 * when PMS department setup has not been completed.
 *
 * Behaviour:
 * - Only renders for admin-level roles (admin, municipal_manager, executive_mayor).
 * - Provides a direct link to /pms-setup so the wizard is discoverable.
 * - Dismiss state is persisted in localStorage; the banner stays hidden until
 *   the key is cleared (e.g. on a new browser profile or manual reset).
 * - Uses GlassCard with teal glow to match the design system.
 *
 * Accessibility:
 * - Uses role="status" so screen readers announce the banner.
 * - Dismiss button has an explicit aria-label.
 * - Link uses semantic <a> via react-router NavLink.
 *
 * Styling: CSS variables from @shared/design-tokens.css (no Tailwind).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';

const DISMISS_KEY = 'pms-setup-banner-dismissed';

interface PmsSetupBannerProps {
  /** Current user role -- banner only renders for privileged roles. */
  userRole: string;
}

const ELIGIBLE_ROLES = new Set(['admin', 'manager', 'municipal_manager', 'executive_mayor']);

export function PmsSetupBanner({ userRole }: PmsSetupBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  // Only show for eligible roles, and only when not dismissed
  if (!ELIGIBLE_ROLES.has(userRole) || dismissed) {
    return null;
  }

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable -- non-critical
    }
  }

  return (
    <div role="status" style={styles.wrapper}>
      <GlassCard glow="teal" style={styles.card}>
        <div style={styles.content}>
          {/* Teal accent bar */}
          <div style={styles.accentBar} aria-hidden="true" />

          {/* Icon */}
          <div style={styles.icon} aria-hidden="true">
            <svg width="20" height="20" fill="none" stroke="var(--color-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6m9-9h-6m-6 0H3m15.364 6.364l-4.243-4.243m-6.364 0L3.636 18.364m12.728 0l-4.243-4.243m-6.364 0L3.636 5.636" />
            </svg>
          </div>

          {/* Message + link */}
          <div style={styles.textBlock}>
            <p style={styles.message}>
              Complete PMS department setup to enable Performance Management features.
            </p>
            <Link to="/pms-setup" style={styles.link}>
              Open PMS Setup Wizard
            </Link>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            style={styles.dismissButton}
            aria-label="Dismiss PMS setup banner"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    marginBottom: 'var(--space-lg)',
  },
  card: {
    padding: '0',
    overflow: 'hidden',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-md) var(--space-lg)',
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
    background: 'var(--color-teal)',
    borderRadius: '4px 0 0 4px',
  },
  icon: {
    flexShrink: 0,
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0, 191, 165, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    fontWeight: 500,
    margin: '0 0 4px 0',
    lineHeight: 'var(--leading-relaxed)',
  },
  link: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-teal)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  dismissButton: {
    flexShrink: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
};
