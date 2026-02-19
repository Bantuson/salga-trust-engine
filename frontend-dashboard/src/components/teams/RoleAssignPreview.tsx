/**
 * RoleAssignPreview — Permission summary preview before confirming role assignment.
 *
 * Per locked decision: "after selecting role, show brief permission summary before
 * confirming — prevents accidental over-privilege"
 *
 * Shows capability list for the selected role with amber highlight to draw attention.
 */

import { ROLE_LABELS, CAPABILITIES, PERMISSION_MATRIX } from '../../constants/permissions';
import type { SystemRole } from '../../constants/permissions';

interface RoleAssignPreviewProps {
  role: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RoleAssignPreview({ role, onConfirm, onCancel }: RoleAssignPreviewProps) {
  const roleKey = role as SystemRole;
  const roleLabel = ROLE_LABELS[roleKey] ?? role;
  const roleCapabilities = PERMISSION_MATRIX[roleKey] ?? [];

  // Map capability keys to human-readable labels
  const capabilityLabels = roleCapabilities
    .map((key) => CAPABILITIES.find((c) => c.key === key)?.label ?? key)
    .filter(Boolean);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerText}>Assigning role:</span>
        <span style={styles.roleBadge}>{roleLabel}</span>
      </div>

      {/* Capabilities list */}
      <p style={styles.bodyText}>This role grants the following permissions:</p>
      <ul style={styles.capabilityList}>
        {capabilityLabels.map((label) => (
          <li key={label} style={styles.capabilityItem}>
            <span style={styles.checkmark}>✓</span>
            <span>{label}</span>
          </li>
        ))}
        {capabilityLabels.length === 0 && (
          <li style={styles.capabilityItem}>
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No special capabilities beyond basic access
            </span>
          </li>
        )}
      </ul>

      {/* Footer actions */}
      <div style={styles.footer}>
        <button style={styles.confirmButton} onClick={onConfirm} type="button">
          Confirm Assignment
        </button>
        <button style={styles.changeButton} onClick={onCancel} type="button">
          Change Role
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: 'rgba(255, 213, 79, 0.08)',
    border: '1px solid rgba(255, 213, 79, 0.3)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    marginTop: '8px',
    animation: 'slideDown 0.2s ease-out',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  } as React.CSSProperties,
  headerText: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  roleBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem',
    fontWeight: 700,
    background: 'rgba(255, 213, 79, 0.2)',
    color: '#b8860b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  bodyText: {
    fontSize: '0.775rem',
    color: 'var(--text-muted)',
    margin: '0 0 6px 0',
  } as React.CSSProperties,
  capabilityList: {
    listStyle: 'none',
    margin: '0 0 12px 0',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,
  capabilityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  checkmark: {
    color: 'var(--color-teal)',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 213, 79, 0.2)',
  } as React.CSSProperties,
  confirmButton: {
    padding: '6px 14px',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    background: 'var(--color-teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  } as React.CSSProperties,
  changeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.775rem',
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    padding: '6px 0',
  } as React.CSSProperties,
};
