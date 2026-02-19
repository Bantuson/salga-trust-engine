/**
 * QuickInviteForm — Compact inline form to send a single team invitation.
 *
 * Per locked decisions:
 * - "Quick single invite: inline email + role form within the team detail modal"
 * - "Role assignment includes preview + confirm step"
 *
 * Flow: enter email → select role → see RoleAssignPreview → confirm → send
 */

import { useState } from 'react';
import { createInvitation } from '../../services/api';
import { RoleAssignPreview } from './RoleAssignPreview';

/** Roles that can be invited via team management (excludes citizen, admin, saps_liaison) */
const INVITABLE_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'ward_councillor', label: 'Ward Councillor' },
  { value: 'field_worker', label: 'Field Worker' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface QuickInviteFormProps {
  teamId: string;
  onInvited: () => void;
}

interface FormState {
  email: string;
  role: string;
  showPreview: boolean;
  confirmed: boolean;
}

export function QuickInviteForm({ teamId, onInvited }: QuickInviteFormProps) {
  const [form, setForm] = useState<FormState>({
    email: '',
    role: '',
    showPreview: false,
    confirmed: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isEmailValid = EMAIL_REGEX.test(form.email.trim());
  const canSubmit = isEmailValid && form.role !== '' && form.confirmed && !isSubmitting;

  const handleRoleChange = (role: string) => {
    // When role changes, reset confirmed state and show preview
    setForm((prev) => ({
      ...prev,
      role,
      showPreview: role !== '',
      confirmed: false,
    }));
    setError(null);
  };

  const handlePreviewConfirm = () => {
    setForm((prev) => ({ ...prev, confirmed: true, showPreview: false }));
  };

  const handlePreviewCancel = () => {
    setForm((prev) => ({ ...prev, role: '', showPreview: false, confirmed: false }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await createInvitation({
        email: form.email.trim(),
        role: form.role,
        team_id: teamId,
      });

      // Show success toast
      setSuccessMessage(`Invitation sent to ${form.email.trim()}`);
      setTimeout(() => setSuccessMessage(null), 3500);

      // Reset form
      setForm({ email: '', role: '', showPreview: false, confirmed: false });

      // Refresh parent list
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.form} noValidate>
        {/* Email input */}
        <input
          type="email"
          placeholder="team.member@municipality.gov.za"
          value={form.email}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, email: e.target.value }));
            setError(null);
          }}
          style={styles.emailInput}
          disabled={isSubmitting}
          aria-label="Invitee email address"
        />

        {/* Role select */}
        <select
          value={form.role}
          onChange={(e) => handleRoleChange(e.target.value)}
          style={styles.roleSelect}
          disabled={isSubmitting}
          aria-label="Select role"
        >
          <option value="">Select role…</option>
          {INVITABLE_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {/* Confirmed indicator or submit button */}
        {form.confirmed && (
          <span style={styles.confirmedBadge} title="Role confirmed">
            ✓ Confirmed
          </span>
        )}

        <button
          type="submit"
          style={{
            ...styles.inviteButton,
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
          disabled={!canSubmit}
        >
          {isSubmitting ? 'Sending…' : 'Invite'}
        </button>
      </form>

      {/* Role assignment preview (slide-down) */}
      {form.showPreview && form.role && (
        <RoleAssignPreview
          role={form.role}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}

      {/* Inline error */}
      {error && <p style={styles.errorText}>{error}</p>}

      {/* Success toast */}
      {successMessage && (
        <div style={styles.successToast}>{successMessage}</div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  emailInput: {
    flex: '1 1 200px',
    minWidth: '180px',
    padding: '8px 12px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    background: 'var(--glass-white-frost)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,
  roleSelect: {
    flex: '0 1 160px',
    minWidth: '140px',
    padding: '8px 12px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    background: 'var(--glass-white-frost)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,
  confirmedBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-teal)',
    padding: '4px 8px',
    background: 'rgba(0, 217, 166, 0.1)',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  } as React.CSSProperties,
  inviteButton: {
    flexShrink: 0,
    padding: '8px 18px',
    fontSize: '0.84rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    background: 'var(--color-teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
  errorText: {
    color: 'var(--color-coral)',
    fontSize: '0.775rem',
    margin: '6px 0 0 0',
  } as React.CSSProperties,
  successToast: {
    marginTop: '8px',
    padding: '8px 12px',
    background: 'rgba(0, 217, 166, 0.12)',
    border: '1px solid var(--color-teal)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-teal)',
    fontSize: '0.8rem',
    fontWeight: 500,
    animation: 'fadeInOut 3.5s ease forwards',
  } as React.CSSProperties,
};
