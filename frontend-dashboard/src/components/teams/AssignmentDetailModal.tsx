/**
 * AssignmentDetailModal — Ticket role assignment detail modal.
 *
 * Shows tracking number, member, role, and assignment date.
 * Glassmorphic overlay, Escape/overlay close, max-width 480px.
 */

import { useEffect } from 'react';
import type { TicketRoleAssignment } from '../../types/teams';

interface AssignmentDetailModalProps {
  assignment: TicketRoleAssignment;
  onClose: () => void;
}

function getRoleColor(role: string): { bg: string; color: string } {
  switch (role) {
    case 'lead': return { bg: 'rgba(0,191,165,0.15)', color: '#00bfa5' };
    case 'support': return { bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' };
    case 'inspector': return { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' };
    default: return { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' };
  }
}

export function AssignmentDetailModal({ assignment, onClose }: AssignmentDetailModalProps) {
  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Keyboard close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const roleStyle = getRoleColor(assignment.assigned_role);
  const assignedDate = new Date(assignment.assigned_at).toLocaleDateString('en-ZA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Assignment ${assignment.tracking_number}`}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Tracking number */}
        <div style={styles.trackingSection}>
          <span style={styles.trackingLabel}>Tracking Number</span>
          <span style={styles.trackingNumber}>{assignment.tracking_number}</span>
        </div>

        {/* Assignment details */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Assignment Details</h3>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Assigned To</span>
            <span style={styles.fieldValue}>{assignment.member_name}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Role</span>
            <span style={{ ...styles.roleBadge, background: roleStyle.bg, color: roleStyle.color }}>
              {assignment.assigned_role}
            </span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Assigned Date</span>
            <span style={styles.fieldValue}>{assignedDate}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Ticket ID</span>
            <span style={{ ...styles.fieldValue, fontFamily: 'monospace', fontSize: '0.8rem' }}>{assignment.ticket_id}</span>
          </div>
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
    maxWidth: '480px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    padding: 'var(--glass-card-padding)',
    position: 'relative' as const,
  } as React.CSSProperties,
  closeButton: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  trackingSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.25rem',
    marginBottom: '1.5rem',
    paddingTop: '0.5rem',
  } as React.CSSProperties,
  trackingLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  } as React.CSSProperties,
  trackingNumber: {
    fontFamily: 'monospace',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--color-teal)',
    letterSpacing: '0.02em',
  } as React.CSSProperties,
  section: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: '0 0 0.75rem 0',
  } as React.CSSProperties,
  fieldRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0',
  } as React.CSSProperties,
  fieldLabel: {
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  fieldValue: {
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontWeight: 500,
  } as React.CSSProperties,
  roleBadge: {
    padding: '3px 12px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
    display: 'inline-block',
  } as React.CSSProperties,
};
