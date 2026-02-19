/**
 * BulkInviteDialog — Modal dialog for sending batch team invitations.
 *
 * Per locked decision: "Bulk invite: separate 'Bulk Invite' button opens a batch dialog
 * (multi-line email input + role selector)"
 *
 * Flow: paste emails (one per line) → select shared role → see RoleAssignPreview →
 *       confirm → send N invitations
 *
 * z-index: 1100 (above TeamDetailModal at 1000)
 */

import { useState, useEffect, useRef } from 'react';
import { createBulkInvitations } from '../../services/api';
import { RoleAssignPreview } from './RoleAssignPreview';

const INVITABLE_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'ward_councillor', label: 'Ward Councillor' },
  { value: 'field_worker', label: 'Field Worker' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse textarea content into unique valid email addresses */
function parseEmails(raw: string): string[] {
  const lines = raw.split('\n');
  const emails: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && EMAIL_REGEX.test(trimmed) && !emails.includes(trimmed)) {
      emails.push(trimmed);
    }
  }
  return emails;
}

interface BulkInviteDialogProps {
  teamId: string;
  isOpen: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export function BulkInviteDialog({ teamId, isOpen, onClose, onInvited }: BulkInviteDialogProps) {
  const [emailsRaw, setEmailsRaw] = useState('');
  const [role, setRole] = useState('');
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const validEmails = parseEmails(emailsRaw);
  const canSubmit = validEmails.length > 0 && role !== '' && roleConfirmed && !isSubmitting;

  // Focus textarea on open, lock body scroll
  useEffect(() => {
    if (!isOpen) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Delay focus to after render
    const tid = setTimeout(() => textareaRef.current?.focus(), 50);

    return () => {
      document.body.style.overflow = original;
      clearTimeout(tid);
    };
  }, [isOpen]);

  // Keyboard close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setRoleConfirmed(false);
    setShowPreview(newRole !== '');
    setError(null);
  };

  const handlePreviewConfirm = () => {
    setRoleConfirmed(true);
    setShowPreview(false);
  };

  const handlePreviewCancel = () => {
    setRole('');
    setRoleConfirmed(false);
    setShowPreview(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createBulkInvitations({
        invitations: validEmails.map((email) => ({
          email,
          role,
          team_id: teamId,
        })),
      });

      // Reset and close
      setEmailsRaw('');
      setRole('');
      setRoleConfirmed(false);
      setShowPreview(false);
      onInvited();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        style={styles.overlay}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-label="Bulk invite team members"
      >
        {/* Dialog content */}
        <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={styles.header}>
            <h3 style={styles.title}>Bulk Invite Team Members</h3>
            <button
              style={styles.closeButton}
              onClick={handleClose}
              aria-label="Close dialog"
              disabled={isSubmitting}
            >
              <svg
                width="18"
                height="18"
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
            {/* Email textarea */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email Addresses</label>
              <textarea
                ref={textareaRef}
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
                placeholder={`Enter email addresses, one per line\n\nalice@joburg.gov.za\nbob@joburg.gov.za`}
                style={styles.textarea}
                rows={6}
                disabled={isSubmitting}
                aria-label="Email addresses, one per line"
              />
              {validEmails.length > 0 && (
                <p style={styles.emailCount}>
                  {validEmails.length} valid email{validEmails.length !== 1 ? 's' : ''} detected
                </p>
              )}
            </div>

            {/* Role selector */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Role for All Invitees</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                style={styles.select}
                disabled={isSubmitting}
                aria-label="Select role for all invitees"
              >
                <option value="">Select a role…</option>
                {INVITABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p style={styles.helperText}>
                All invitees will receive the same role. You can change individual roles later.
              </p>
            </div>

            {/* Role preview (shown when role selected but not yet confirmed) */}
            {showPreview && role && (
              <RoleAssignPreview
                role={role}
                onConfirm={handlePreviewConfirm}
                onCancel={handlePreviewCancel}
              />
            )}

            {/* Confirmed indicator */}
            {roleConfirmed && (
              <p style={styles.confirmedText}>
                <span style={styles.confirmedMark}>✓</span> Role confirmed: {
                  INVITABLE_ROLES.find((r) => r.value === role)?.label ?? role
                }
              </p>
            )}

            {/* Error message */}
            {error && <div style={styles.errorBox}>{error}</div>}
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button
              style={styles.cancelButton}
              onClick={handleClose}
              disabled={isSubmitting}
              type="button"
            >
              Cancel
            </button>
            <button
              style={{
                ...styles.submitButton,
                opacity: canSubmit ? 1 : 0.5,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              onClick={handleSubmit}
              disabled={!canSubmit}
              type="button"
            >
              {isSubmitting
                ? 'Sending…'
                : `Send ${validEmails.length > 0 ? validEmails.length : ''} Invitation${
                    validEmails.length !== 1 ? 's' : ''
                  }`}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  dialog: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '520px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    zIndex: 1,
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  closeButton: {
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
  } as React.CSSProperties,
  body: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  } as React.CSSProperties,
  label: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    background: 'var(--glass-white-frost)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    resize: 'vertical' as const,
    lineHeight: 1.5,
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,
  emailCount: {
    fontSize: '0.75rem',
    color: 'var(--color-teal)',
    fontWeight: 500,
    margin: 0,
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    background: 'var(--glass-white-frost)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  helperText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    margin: 0,
    lineHeight: 1.4,
  } as React.CSSProperties,
  confirmedText: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--color-teal)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    margin: 0,
  } as React.CSSProperties,
  confirmedMark: {
    fontWeight: 700,
  } as React.CSSProperties,
  errorBox: {
    padding: '10px 12px',
    background: 'rgba(205, 94, 129, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 24px 20px',
    borderTop: '1px solid var(--glass-border)',
  } as React.CSSProperties,
  cancelButton: {
    padding: '8px 18px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 500,
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
  submitButton: {
    padding: '8px 20px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    background: 'var(--color-teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
};
