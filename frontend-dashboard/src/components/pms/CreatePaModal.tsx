/**
 * CreatePaModal — Modal dialog for creating a new Performance Agreement.
 *
 * Follows the TeamCreateModal pattern exactly:
 * - Overlay at z-1000, rgba(0,0,0,0.5) blur 4px
 * - glass-pink-frost container, blur medium
 * - Sticky header, body scroll lock, Escape handler, overlay click closes
 *
 * Submit: POST /api/v1/performance-agreements
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface CreatePaModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePaModal({ onClose, onCreated }: CreatePaModalProps) {
  const { session } = useAuth();

  const [financialYear, setFinancialYear] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [description, setDescription] = useState('');
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
    if (!financialYear) {
      setError('Financial year is required');
      return;
    }
    if (!managerEmail.trim()) {
      setError('Section 57 Manager email is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/performance-agreements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          financial_year: parseInt(financialYear, 10),
          manager_email: managerEmail.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create performance agreement');
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
      aria-label="Create Performance Agreement"
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Create Performance Agreement</h2>
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
        <div data-lenis-prevent style={styles.body}>
          {error && <div style={styles.errorBanner}>{error}</div>}

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Agreement Details</h3>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Financial Year *</label>
              <input
                type="number"
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                placeholder="e.g. 2025"
                style={styles.input}
                disabled={isSubmitting}
                min={2000}
                max={2100}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Section 57 Manager Email *</label>
              <input
                type="email"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="e.g. manager@municipality.gov.za"
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of performance agreement scope and objectives"
                style={styles.textarea}
                disabled={isSubmitting}
                rows={4}
              />
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
            }}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Agreement'}
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
    flexShrink: 0,
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
  textarea: {
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
    resize: 'vertical' as const,
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--glass-card-padding)',
    borderTop: '1px solid var(--glass-border)',
    flexShrink: 0,
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
