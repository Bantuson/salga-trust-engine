/**
 * InviteUserModal — Reusable user invite modal.
 *
 * Can be used standalone from any page (department management, user admin, etc.)
 * Uses TeamCreateModal shell pattern exactly:
 *   - Overlay: position fixed, inset 0, rgba(0,0,0,0.5), blur(4px), zIndex 1000
 *   - Modal: glass-pink-frost, blur medium, border glass-border, radius-xl, max-w 720px, max-h 85vh
 *   - Sticky header/footer, body scroll lock, Escape close, overlay click close
 *
 * Roles:
 *   - Defaults to all invitable roles (ALL_INVITABLE_ROLES below)
 *   - Filtered by allowedRoles prop when provided
 *   - field_worker and saps_liaison EXCLUDED (not part of initial onboarding per plan spec)
 *
 * Styling: inline CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Select } from '@shared/components/ui/Select';

// ---------------------------------------------------------------------------
// Role definitions — field_worker and saps_liaison intentionally excluded
// ---------------------------------------------------------------------------

export interface InvitableRole {
  value: string;
  label: string;
  tier: number;
}

export const ALL_INVITABLE_ROLES: InvitableRole[] = [
  { value: 'executive_mayor', label: 'Executive Mayor', tier: 1 },
  { value: 'municipal_manager', label: 'Municipal Manager', tier: 1 },
  { value: 'cfo', label: 'Chief Financial Officer', tier: 1 },
  { value: 'speaker', label: 'Speaker', tier: 1 },
  { value: 'section56_director', label: 'Section 56 Director', tier: 2 },
  { value: 'ward_councillor', label: 'Ward Councillor', tier: 2 },
  { value: 'chief_whip', label: 'Chief Whip', tier: 2 },
  { value: 'pms_officer', label: 'PMS Officer', tier: 3 },
  { value: 'audit_committee_member', label: 'Audit Committee Member', tier: 3 },
  { value: 'internal_auditor', label: 'Internal Auditor', tier: 3 },
  { value: 'mpac_member', label: 'MPAC Member', tier: 3 },
  { value: 'department_manager', label: 'Department Manager', tier: 4 },
  // NOTE: field_worker and saps_liaison are intentionally excluded from initial onboarding
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InviteUserModalProps {
  onClose: () => void;
  onInvited: () => void;
  allowedRoles?: string[];   // Filter available roles (e.g. ['section56_director'] for department page)
  defaultRole?: string;      // Pre-select a role
  departmentId?: string;     // If inviting for a specific department (passed in body as context)
  departmentName?: string;   // Display context in header
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteUserModal({
  onClose,
  onInvited,
  allowedRoles,
  defaultRole,
  departmentId: _departmentId,
  departmentName,
}: InviteUserModalProps) {
  const { getAccessToken, getTenantId } = useAuth();

  // Derive available roles
  const availableRoles = allowedRoles
    ? ALL_INVITABLE_ROLES.filter((r) => allowedRoles.includes(r.value))
    : ALL_INVITABLE_ROLES;

  const firstRole = availableRoles[0]?.value ?? 'section56_director';
  const initialRole = defaultRole && availableRoles.some((r) => r.value === defaultRole)
    ? defaultRole
    : firstRole;

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState(initialRole);
  const [sendEmail, setSendEmail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Invalid email format');
      return;
    }
    if (!role) {
      setError('Please select a role');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const token = getAccessToken();
    const tenantId = getTenantId();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    try {
      const response = await fetch(`${apiUrl}/api/v1/invitations/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
        body: JSON.stringify({
          invitations: [
            {
              email: email.trim(),
              role,
              ...(firstName.trim() ? { first_name: firstName.trim() } : {}),
              send_email: sendEmail,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(typeof body.detail === 'string' ? body.detail : 'Failed to send invite');
      }

      setSuccess(true);
      // Brief success flash, then notify parent
      setTimeout(() => {
        onInvited();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerTitle = departmentName
    ? `Invite Director — ${departmentName}`
    : 'Invite User';

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>{headerTitle}</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* Success state */}
          {success ? (
            <div style={styles.successBanner}>
              <svg width="20" height="20" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Invite sent successfully!</span>
            </div>
          ) : (
            <>
              {/* Error banner */}
              {error && <div style={styles.errorBanner}>{error}</div>}

              <div style={styles.section}>
                {/* Email */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="invite-email">
                    Email Address *
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    placeholder="user@municipality.gov.za"
                    style={styles.input}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>

                {/* First Name */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="invite-first-name">
                    First Name (optional — shown in invite email)
                  </label>
                  <input
                    id="invite-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
                    placeholder="First name"
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Role */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label} htmlFor="invite-role">
                    Role *
                  </label>
                  {availableRoles.length === 1 ? (
                    // Single role — display as readonly
                    <div style={styles.singleRoleDisplay}>
                      {availableRoles[0].label}
                      <span style={styles.tierBadge}>Tier {availableRoles[0].tier}</span>
                    </div>
                  ) : (
                    <Select
                      value={role}
                      onChange={(value) => setRole(value)}
                      options={availableRoles.map((r) => ({ value: r.value, label: `${r.label} (Tier ${r.tier})` }))}
                      size="md"
                      disabled={isSubmitting}
                      ariaLabel="Select role"
                    />
                  )}
                </div>

                {/* Send Email checkbox */}
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSendEmail(e.target.checked)}
                    disabled={isSubmitting}
                    style={{ accentColor: 'var(--color-teal)' }}
                  />
                  <span>Send invitation email now</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div style={styles.footer}>
            <button
              type="button"
              style={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{
                ...styles.sendButton,
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles — following TeamCreateModal pattern exactly
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '560px',
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--glass-card-padding)',
    paddingBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--glass-border)',
    position: 'sticky',
    top: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
  },
  closeButton: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s ease',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--glass-card-padding)',
  },
  errorBanner: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: 'var(--space-lg)',
    fontSize: '0.8rem',
  },
  successBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.5rem',
    background: 'rgba(0, 191, 165, 0.1)',
    border: '1px solid rgba(0, 191, 165, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-teal)',
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  section: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--glass-card-padding)',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: 'var(--space-md)',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  },
  singleRoleDisplay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.75rem',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  tierBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: 'var(--color-teal)',
    background: 'rgba(0, 191, 165, 0.1)',
    border: '1px solid rgba(0, 191, 165, 0.2)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--glass-card-padding)',
    borderTop: '1px solid var(--glass-border)',
    position: 'sticky',
    bottom: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
  },
  cancelButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  },
  sendButton: {
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 1.5rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  },
};
