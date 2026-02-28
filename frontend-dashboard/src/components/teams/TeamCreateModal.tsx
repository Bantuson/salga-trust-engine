/**
 * TeamCreateModal -- Full modal for creating a new team.
 *
 * Sections: Supervisor Details, Team Category, Team Members, Dashboard Invitation.
 *
 * Uses the same modal shell pattern as TeamDetailModal:
 * - Overlay at z-1000, rgba(0,0,0,0.5) blur 4px
 * - glass-pink-frost container, blur medium
 * - Sticky header, body scroll lock, Escape handler
 */

import { useState, useEffect } from 'react';
import { CATEGORY_CONFIG } from '../../constants/categories';
import { createTeam, createInvitation } from '../../services/api';

interface TeamCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function TeamCreateModal({ onClose, onCreated }: TeamCreateModalProps) {
  const [supervisorName, setSupervisorName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [category, setCategory] = useState('water');
  const [members, setMembers] = useState<{ name: string; employeeId: string }[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendInvite, setSendInvite] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep inviteEmail synced with supervisorEmail
  useEffect(() => {
    setInviteEmail(supervisorEmail);
  }, [supervisorEmail]);

  // Body scroll lock while modal is open
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

  const handleAddMember = () => {
    setMembers((prev) => [...prev, { name: '', employeeId: '' }]);
  };

  const handleRemoveMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMemberChange = (index: number, field: 'name' | 'employeeId', value: string) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!supervisorName.trim()) {
      setError('Supervisor name is required');
      return;
    }
    if (!category) {
      setError('Please select a team category');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const categoryLabel = CATEGORY_CONFIG[category]?.label ?? category;
      const newTeam = await createTeam({
        name: categoryLabel,
        category,
      });

      // Send invitation if requested
      if (sendInvite && inviteEmail.trim()) {
        try {
          await createInvitation({
            email: inviteEmail.trim(),
            role: 'field_worker',
            team_id: newTeam.id,
          });
        } catch {
          // Invitation failure is non-blocking -- team was created successfully
        }
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create new team"
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Create New Team</h2>
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
          {/* Error banner */}
          {error && <div style={styles.errorBanner}>{error}</div>}

          {/* Section: Supervisor Details */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Supervisor Details</h3>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="e.g. Sipho Dlamini"
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP-001"
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={supervisorEmail}
                onChange={(e) => setSupervisorEmail(e.target.value)}
                placeholder="e.g. sipho@municipality.gov.za"
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Section: Team Category */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Team Category</h3>
            <div style={styles.fieldGroup}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={styles.select}
                disabled={isSubmitting}
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Team Members */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Team Members</h3>
            {members.length === 0 && (
              <p style={styles.emptyHint}>No members added yet. Add team members below.</p>
            )}
            {members.map((member, index) => (
              <div key={index} style={styles.memberRow}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                    placeholder="Full Name"
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={member.employeeId}
                    onChange={(e) => handleMemberChange(index, 'employeeId', e.target.value)}
                    placeholder="Employee ID"
                    style={styles.input}
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="button"
                  style={styles.removeButton}
                  onClick={() => handleRemoveMember(index)}
                  disabled={isSubmitting}
                  aria-label={`Remove member ${index + 1}`}
                >
                  <svg
                    width="16"
                    height="16"
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
            ))}
            <button
              type="button"
              style={styles.addMemberButton}
              onClick={handleAddMember}
              disabled={isSubmitting}
            >
              + Add Member
            </button>
          </div>

          {/* Section: Dashboard Invitation */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Dashboard Invitation</h3>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. sipho@municipality.gov.za"
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
                disabled={isSubmitting}
                style={styles.checkbox}
              />
              <span>Send invitation on create</span>
            </label>
          </div>
        </div>

        {/* Footer */}
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
              ...styles.createButton,
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  modal: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '720px',
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--glass-card-padding)',
    paddingBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    zIndex: 1,
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
  } as React.CSSProperties,
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
  } as React.CSSProperties,
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 'var(--glass-card-padding)',
  } as React.CSSProperties,
  errorBanner: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: 'var(--space-lg)',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  section: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--glass-card-padding)',
    marginBottom: 'var(--space-lg)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginTop: 0,
    marginBottom: 'var(--space-md)',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    marginBottom: 'var(--space-md)',
  } as React.CSSProperties,
  label: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
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
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  select: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  emptyHint: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    margin: '0 0 var(--space-md) 0',
  } as React.CSSProperties,
  memberRow: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'center',
    marginBottom: 'var(--space-sm)',
  } as React.CSSProperties,
  removeButton: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: 'var(--color-coral)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
  addMemberButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-teal)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 600,
    padding: '0.25rem 0',
  } as React.CSSProperties,
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  } as React.CSSProperties,
  checkbox: {
    accentColor: 'var(--color-teal)',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--glass-card-padding)',
    borderTop: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    bottom: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
  } as React.CSSProperties,
  cancelButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  createButton: {
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 1.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
