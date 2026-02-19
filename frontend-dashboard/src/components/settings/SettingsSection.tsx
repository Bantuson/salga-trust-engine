/**
 * SettingsSection — Reusable section wrapper for the Settings page.
 *
 * Provides consistent layout with a section header (title + description)
 * and a Save button on the right. Each section saves independently.
 *
 * Usage:
 *   <SettingsSection id="municipality-profile" title="Municipality Profile" onSave={handleSave} isDirty={dirty} isSaving={saving}>
 *     ... form fields ...
 *   </SettingsSection>
 */

import React from 'react';

interface SettingsSectionProps {
  /** HTML id for anchor navigation targeting */
  id: string;
  /** Section heading */
  title: string;
  /** Optional subtext below the title */
  description?: string;
  /** Section content */
  children: React.ReactNode;
  /** Called when "Save Changes" is clicked */
  onSave: () => Promise<void>;
  /** Whether the section has unsaved changes */
  isDirty: boolean;
  /** Whether save is in progress */
  isSaving: boolean;
  /** If true, section is only shown for admin users (visibility gated by parent) */
  adminOnly?: boolean;
}

export function SettingsSection({
  id,
  title,
  description,
  children,
  onSave,
  isDirty,
  isSaving,
}: SettingsSectionProps) {
  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    try {
      await onSave();
    } catch (err) {
      console.error(`[SettingsSection] Save failed for "${id}":`, err);
    }
  };

  return (
    <section id={id} style={styles.section}>
      <div style={styles.header}>
        <div style={styles.headerText}>
          <h2 style={styles.title}>{title}</h2>
          {description && <p style={styles.description}>{description}</p>}
        </div>
        {isDirty !== false && (
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            style={{
              ...styles.saveButton,
              ...((!isDirty || isSaving) ? styles.saveButtonDisabled : styles.saveButtonActive),
            }}
          >
            {isSaving ? (
              <span style={styles.savingContent}>
                <span style={styles.spinner} />
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        )}
      </div>

      <div style={styles.content}>{children}</div>

      <div style={styles.divider} />
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: 'var(--space-2xl)',
    scrollMarginTop: '80px', // offset for sticky anchor nav
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-lg)',
    gap: 'var(--space-md)',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-display)',
    marginBottom: '0.25rem',
  },
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  saveButton: {
    flexShrink: 0,
    padding: '0.5rem 1.25rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    fontFamily: 'var(--font-body)',
  },
  saveButtonActive: {
    backgroundColor: 'var(--color-teal)',
    color: '#0a1a1a',
  },
  saveButtonDisabled: {
    backgroundColor: 'var(--surface-higher)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  },
  savingContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(10,26,26,0.3)',
    borderTop: '2px solid #0a1a1a',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  content: {
    marginBottom: 'var(--space-lg)',
  },
  divider: {
    borderBottom: '1px solid var(--glass-border)',
    marginTop: 'var(--space-sm)',
  },
};
