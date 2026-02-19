/**
 * PermissionMatrix — Visual role x capability grid with checkmarks.
 *
 * Per locked decisions:
 * - "Permission matrix: visual grid showing role x capability with checkmarks"
 * - "Permission matrix should be read-only for managers, editable display labels for admins only"
 * - "Municipalities can set display labels for roles"
 *
 * Renders a CSS-grid table with roles as columns and capabilities as rows.
 * When editableLabels=true, role headers become editable inputs (admin-only).
 * Responsive: horizontally scrollable on small screens.
 */

import { useState } from 'react';
import { ROLES, ROLE_LABELS, CAPABILITIES, PERMISSION_MATRIX } from '../../constants/permissions';
import type { SystemRole } from '../../constants/permissions';

interface PermissionMatrixProps {
  /** When true, role column headers are editable inputs (admin-only feature) */
  editableLabels?: boolean;
  /** Called when admin renames a role label */
  onLabelChange?: (role: string, label: string) => void;
}

export function PermissionMatrix({
  editableLabels = false,
  onLabelChange,
}: PermissionMatrixProps) {
  // Local state for editable role labels (initialized from ROLE_LABELS)
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const role of ROLES) {
      initial[role] = ROLE_LABELS[role];
    }
    return initial;
  });

  const handleLabelChange = (role: string, newLabel: string) => {
    setCustomLabels((prev) => ({ ...prev, [role]: newLabel }));
    onLabelChange?.(role, newLabel);
  };

  const columnCount = ROLES.length + 1; // +1 for capability label column

  return (
    <div style={styles.scrollWrapper}>
      <div
        style={{
          ...styles.grid,
          gridTemplateColumns: `200px ${ROLES.map(() => '1fr').join(' ')}`,
        }}
        role="grid"
        aria-label="Role permissions matrix"
      >
        {/* Header row — corner cell + role columns */}
        <div
          style={{
            ...styles.headerCell,
            ...styles.cornerCell,
          }}
          role="columnheader"
        >
          <span style={styles.cornerLabel}>Capability</span>
        </div>

        {ROLES.map((role) => (
          <div
            key={role}
            style={styles.headerCell}
            role="columnheader"
            aria-label={`Role: ${customLabels[role]}`}
          >
            {editableLabels ? (
              <input
                type="text"
                value={customLabels[role]}
                onChange={(e) => handleLabelChange(role, e.target.value)}
                style={styles.labelInput}
                aria-label={`Rename role ${ROLE_LABELS[role as SystemRole]}`}
                title="Rename this role (admin only)"
              />
            ) : (
              <span style={styles.roleLabel}>{customLabels[role]}</span>
            )}
          </div>
        ))}

        {/* Capability rows */}
        {CAPABILITIES.map((capability, rowIndex) => (
          <div key={capability.key} style={{ display: 'contents' }} role="row">
            {/* Capability name cell */}
            <div
              style={{
                ...styles.capabilityCell,
                ...(rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd),
              }}
              role="rowheader"
            >
              {capability.label}
            </div>

            {/* Checkmark cells — one per role */}
            {ROLES.map((role) => {
              const hasPermission = PERMISSION_MATRIX[role as SystemRole]?.includes(capability.key) ?? false;
              return (
                <div
                  key={`${role}-${capability.key}`}
                  style={{
                    ...styles.checkCell,
                    ...(rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd),
                  }}
                  role="gridcell"
                  aria-label={
                    hasPermission
                      ? `${ROLE_LABELS[role as SystemRole]} can ${capability.label}`
                      : `${ROLE_LABELS[role as SystemRole]} cannot ${capability.label}`
                  }
                >
                  {hasPermission ? (
                    <span style={styles.checkmark} aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span style={styles.dash} aria-hidden="true">
                      –
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={styles.footerNote}>
        Permissions are enforced by the database and API.
        {editableLabels && ' Role label changes are display-only and apply to this municipality.'}
      </p>
    </div>
  );
}

const styles = {
  scrollWrapper: {
    overflowX: 'auto' as const,
    // Glassmorphic background
    background: 'var(--glass-white-frost)',
    backdropFilter: 'blur(var(--glass-blur-subtle))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-md)',
    padding: '0',
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    minWidth: '640px',
  } as React.CSSProperties,
  cornerCell: {
    borderRight: '1px solid var(--glass-border)',
    borderBottom: '1px solid var(--glass-border)',
  } as React.CSSProperties,
  headerCell: {
    padding: '10px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottom: '2px solid var(--glass-border)',
    background: 'rgba(205, 94, 129, 0.06)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
  } as React.CSSProperties,
  cornerLabel: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  } as React.CSSProperties,
  roleLabel: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'center' as const,
    lineHeight: 1.3,
  } as React.CSSProperties,
  labelInput: {
    width: '100%',
    padding: '4px 6px',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid var(--color-teal)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    textAlign: 'center' as const,
    minWidth: 0,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  capabilityCell: {
    padding: '10px 12px',
    fontSize: '0.82rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    borderRight: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  checkCell: {
    padding: '10px 4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,
  rowEven: {
    background: 'transparent',
  } as React.CSSProperties,
  rowOdd: {
    background: 'rgba(205, 94, 129, 0.03)',
  } as React.CSSProperties,
  checkmark: {
    color: 'var(--color-teal)',
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1,
  } as React.CSSProperties,
  dash: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    opacity: 0.4,
    lineHeight: 1,
  } as React.CSSProperties,
  footerNote: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    padding: '8px 12px',
    borderTop: '1px solid var(--glass-border)',
    margin: 0,
    lineHeight: 1.4,
  } as React.CSSProperties,
};
