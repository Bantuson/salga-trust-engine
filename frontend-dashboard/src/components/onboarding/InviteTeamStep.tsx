/**
 * Onboarding Wizard — Invite Team Step (Step 2, Skippable)
 *
 * Dynamic form for inviting team members.
 * Submits to POST /api/v1/invitations/bulk on completion.
 */

import React, { useState } from 'react';
import { Input } from '@shared/components/ui/Input';
import { Button } from '@shared/components/ui/Button';

const TEAM_ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'ward_councillor', label: 'Ward Councillor' },
  { value: 'field_worker', label: 'Field Worker' },
];

export interface TeamInvitation {
  email: string;
  role: string;
}

export interface InviteTeamData {
  invitations: TeamInvitation[];
}

interface InviteTeamStepProps {
  initialData?: Partial<InviteTeamData>;
  onDataChange: (data: InviteTeamData) => void;
  onSubmitInvitations: (invitations: TeamInvitation[]) => Promise<void>;
}

export const InviteTeamStep: React.FC<InviteTeamStepProps> = ({
  initialData,
  onDataChange,
  onSubmitInvitations,
}) => {
  const [invitations, setInvitations] = useState<TeamInvitation[]>(
    initialData?.invitations && initialData.invitations.length > 0
      ? initialData.invitations
      : [{ email: '', role: 'manager' }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddRow = () => {
    setInvitations([...invitations, { email: '', role: 'manager' }]);
  };

  const handleRemoveRow = (index: number) => {
    if (invitations.length === 1) return; // Keep at least one row
    setInvitations(invitations.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof TeamInvitation, value: string) => {
    const updated = [...invitations];
    updated[index] = { ...updated[index], [field]: value };
    setInvitations(updated);
    onDataChange({ invitations: updated });
  };

  const handleSubmit = async () => {
    // Filter out empty emails
    const validInvitations = invitations.filter((inv) => inv.email.trim() !== '');

    if (validInvitations.length === 0) {
      setError('Please add at least one team member with a valid email');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmitInvitations(validInvitations);
      setSubmitSuccess(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Invite Your Team</h2>
      <p style={styles.description}>
        Add team members who will help manage tickets and respond to citizen reports.
        You can always add more team members later from Settings.
      </p>

      {submitSuccess && (
        <div style={styles.successBox}>
          {invitations.filter((i) => i.email.trim()).length} invitation(s) sent successfully!
        </div>
      )}

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.invitationList}>
        {invitations.map((invitation, index) => (
          <div key={index} style={styles.invitationRow}>
            <div style={styles.emailField}>
              <Input
                type="email"
                placeholder="email@municipality.gov.za"
                value={invitation.email}
                onChange={(e) => handleChange(index, 'email', e.target.value)}
                disabled={isSubmitting || submitSuccess}
              />
            </div>

            <div style={styles.roleField}>
              <select
                value={invitation.role}
                onChange={(e) => handleChange(index, 'role', e.target.value)}
                style={styles.select}
                disabled={isSubmitting || submitSuccess}
              >
                {TEAM_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveRow(index)}
              style={styles.removeButton}
              disabled={invitations.length === 1 || isSubmitting || submitSuccess}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {!submitSuccess && (
        <div style={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddRow}
            disabled={isSubmitting}
          >
            + Add Another
          </Button>

          <Button
            variant="secondary"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending invitations...' : 'Send Invitations'}
          </Button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    lineHeight: 1.5,
  } as React.CSSProperties,
  successBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(0, 217, 166, 0.1)',
    border: '1px solid var(--color-teal)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-teal)',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  errorBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  invitationList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  invitationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  } as React.CSSProperties,
  emailField: {
    flex: 2,
  } as React.CSSProperties,
  roleField: {
    flex: 1,
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-body)',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
  removeButton: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
  } as React.CSSProperties,
};
