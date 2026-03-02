/**
 * CreateDepartmentModal — Full modal for creating or editing a department.
 *
 * Follows TeamCreateModal shell pattern exactly:
 *   - Overlay: position fixed, inset 0, rgba(0,0,0,0.5), blur(4px), zIndex 1000
 *   - Modal: glass-pink-frost, blur medium, border glass-border, radius-xl, max-w 560px, max-h 85vh
 *   - Sticky header/footer, body scroll lock, Escape close, overlay click close
 *
 * Fields:
 *   - Department Name (text, required)
 *   - Department Code (text, required, uppercase hint e.g. "CORP")
 *   - Parent Department (optional dropdown, populated from existing departments)
 *
 * Submit: POST /api/v1/departments (create) or PATCH /api/v1/departments/{id} (edit)
 *
 * Styling: inline CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export interface CreateDepartmentModalProps {
  onClose: () => void;
  onCreated: () => void;
  /** If provided, the modal enters edit mode and pre-fills fields */
  editDepartment?: {
    id: string;
    name: string;
    code: string;
    parent_department_id?: string | null;
  };
  /** Existing departments for parent dropdown (excluding the one being edited) */
  existingDepartments?: DepartmentOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateDepartmentModal({
  onClose,
  onCreated,
  editDepartment,
  existingDepartments = [],
}: CreateDepartmentModalProps) {
  const { session, getTenantId } = useAuth();

  const isEditing = !!editDepartment;

  const [name, setName] = useState(editDepartment?.name ?? '');
  const [code, setCode] = useState(editDepartment?.code ?? '');
  const [parentId, setParentId] = useState<string>(editDepartment?.parent_department_id ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Department name is required');
      return;
    }
    if (!code.trim()) {
      setError('Department code is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const token = session?.access_token;
    const tenantId = getTenantId();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    };

    const body = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      ...(parentId ? { parent_department_id: parentId } : {}),
    };

    try {
      const url = isEditing
        ? `${apiUrl}/api/v1/departments/${editDepartment!.id}`
        : `${apiUrl}/api/v1/departments`;
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.detail === 'string' ? data.detail : `Error ${res.status}`
        );
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter out the department being edited from the parent options (can't be its own parent)
  const parentOptions = existingDepartments.filter(
    (d) => !isEditing || d.id !== editDepartment!.id
  );

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit department' : 'Create new department'}
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>
            {isEditing ? `Edit Department — ${editDepartment!.name}` : 'Create Department'}
          </h2>
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

          <div style={styles.section}>
            {/* Department Name */}
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="dept-name">
                Department Name *
              </label>
              <input
                id="dept-name"
                type="text"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="e.g. Corporate Services"
                style={styles.input}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {/* Department Code */}
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="dept-code">
                Department Code *
              </label>
              <input
                id="dept-code"
                type="text"
                value={code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCode(e.target.value.toUpperCase())
                }
                placeholder="e.g. CORP"
                style={styles.input}
                disabled={isSubmitting}
                maxLength={10}
              />
              <span style={styles.fieldHint}>
                Short uppercase code, max 10 characters (e.g. CORP, FIN, TECH)
              </span>
            </div>

            {/* Parent Department (optional) */}
            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="dept-parent">
                Parent Department (optional)
              </label>
              <select
                id="dept-parent"
                value={parentId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setParentId(e.target.value)
                }
                style={styles.select}
                disabled={isSubmitting}
              >
                <option value="">— None (top-level department) —</option>
                {parentOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <span style={styles.fieldHint}>
                Set a parent only if this is a sub-department
              </span>
            </div>
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
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isEditing
                ? 'Saving...'
                : 'Creating...'
              : isEditing
              ? 'Save Changes'
              : 'Create Department'}
          </button>
        </div>
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
  fieldHint: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    marginTop: '2px',
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
    boxSizing: 'border-box',
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
  createButton: {
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
