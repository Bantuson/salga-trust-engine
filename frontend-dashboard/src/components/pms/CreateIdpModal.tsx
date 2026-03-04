/**
 * CreateIdpModal — Modal dialog for creating a new IDP cycle.
 *
 * Follows the TeamCreateModal pattern exactly:
 * - Overlay at z-1000, rgba(0,0,0,0.5) blur 4px
 * - glass-pink-frost container, blur medium
 * - Sticky header, body scroll lock, Escape handler, overlay click closes
 *
 * Submit: POST /api/v1/idp/cycles
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface CreateIdpModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateIdpModal({ onClose, onCreated }: CreateIdpModalProps) {
  const { session } = useAuth();

  const [title, setTitle] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [vision, setVision] = useState('');
  const [mission, setMission] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-compute end year = start year + 5
  const handleStartYearChange = (value: string) => {
    setStartYear(value);
    const sy = parseInt(value, 10);
    if (!isNaN(sy) && value.length === 4) {
      setEndYear(String(sy + 5));
    }
  };

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
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!startYear || !endYear) {
      setError('Financial year start and end are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/idp/cycles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          start_year: parseInt(startYear, 10),
          end_year: parseInt(endYear, 10),
          vision: vision.trim() || undefined,
          mission: mission.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create IDP cycle');
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
      aria-label="Create IDP Cycle"
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Create IDP Cycle</h2>
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
            <h3 style={styles.sectionTitle}>IDP Details</h3>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Umsobomvu IDP 2025–2030"
                style={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div style={styles.twoColGrid}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Financial Year Start *</label>
                <input
                  type="number"
                  value={startYear}
                  onChange={(e) => handleStartYearChange(e.target.value)}
                  placeholder="e.g. 2025"
                  style={styles.input}
                  disabled={isSubmitting}
                  min={2000}
                  max={2100}
                />
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Financial Year End *</label>
                <input
                  type="number"
                  value={endYear}
                  onChange={(e) => setEndYear(e.target.value)}
                  placeholder="e.g. 2030"
                  style={styles.input}
                  disabled={isSubmitting}
                  min={2000}
                  max={2100}
                />
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Strategic Direction</h3>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Vision</label>
              <textarea
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="Municipal vision for the IDP cycle period"
                style={styles.textarea}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Mission</label>
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="Municipal mission and mandate"
                style={styles.textarea}
                disabled={isSubmitting}
                rows={3}
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
            {isSubmitting ? 'Creating...' : 'Create IDP Cycle'}
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
  twoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-md)',
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
