/**
 * MemberDetailModal — Employee detail modal for Field Worker Team page.
 *
 * Shows member avatar, contact info, employment details.
 * Glassmorphic overlay, Escape/overlay close, max-width 480px.
 */

import { useEffect } from 'react';
import type { TeamMember } from '../../types/teams';

interface MemberDetailModalProps {
  member: TeamMember;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.split(' ');
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function MemberDetailModal({ member, onClose }: MemberDetailModalProps) {
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

  const isManager = member.role === 'manager';
  const joinedDate = member.joined_at
    ? new Date(member.joined_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  // Derive employee ID from member id
  const employeeId = member.id.toUpperCase().slice(0, 12);

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${member.full_name} details`}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Avatar + Name */}
        <div style={styles.avatarSection}>
          <div style={styles.avatar}>{getInitials(member.full_name)}</div>
          <h2 style={styles.name}>{member.full_name}</h2>
          <span style={{
            ...styles.roleBadge,
            background: isManager ? 'rgba(255, 107, 74, 0.15)' : 'rgba(0, 191, 165, 0.15)',
            color: isManager ? 'var(--color-coral)' : 'var(--color-teal)',
          }}>
            {member.role}
          </span>
        </div>

        {/* Contact Info */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Contact Info</h3>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Email</span>
            <span style={styles.fieldValue}>{member.email}</span>
          </div>
        </div>

        {/* Employment Details */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Employment Details</h3>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Employee ID</span>
            <span style={{ ...styles.fieldValue, fontFamily: 'monospace', color: 'var(--color-teal)' }}>{employeeId}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Role</span>
            <span style={styles.fieldValue}>{member.role}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Team Joined</span>
            <span style={styles.fieldValue}>{joinedDate}</span>
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
  avatarSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    paddingTop: '0.5rem',
  } as React.CSSProperties,
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--color-teal), var(--color-coral))',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: 700,
  } as React.CSSProperties,
  name: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  } as React.CSSProperties,
  roleBadge: {
    padding: '3px 12px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  } as React.CSSProperties,
  section: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
    marginBottom: '0.75rem',
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
};
