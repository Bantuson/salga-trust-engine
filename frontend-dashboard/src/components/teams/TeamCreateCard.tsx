/**
 * TeamCreateCard — Inline team creation card.
 *
 * Collapsed: dashed border "+" card.
 * Expanded: inline creation form.
 */

import { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { CATEGORY_CONFIG } from '../../constants/categories';
import type { Team } from '../../types/teams';

interface TeamCreateCardProps {
  onCreated: (team: Team) => void;
  createTeam: (data: { name: string; category: string; manager_id?: string }) => Promise<Team>;
}

export function TeamCreateCard({ onCreated, createTeam }: TeamCreateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'water',
    manager_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Team name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: { name: string; category: string; manager_id?: string } = {
        name: form.name.trim(),
        category: form.category,
      };
      if (form.manager_id.trim()) {
        payload.manager_id = form.manager_id.trim();
      }

      const newTeam = await createTeam(payload);
      onCreated(newTeam);

      // Reset and collapse
      setForm({ name: '', category: 'water', manager_id: '' });
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setForm({ name: '', category: 'water', manager_id: '' });
    setError(null);
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <GlassCard
        variant="interactive"
        onClick={() => setIsExpanded(true)}
        style={styles.collapsedCard}
      >
        <div style={styles.collapsedContent}>
          <div style={styles.plusIcon}>+</div>
          <span style={styles.createLabel}>Create Team</span>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="default" style={styles.expandedCard}>
      <h3 style={styles.formTitle}>New Team</h3>

      {error && <div style={styles.errorBox}>{error}</div>}

      <form onSubmit={handleSubmit} style={styles.form}>
        {/* Team Name */}
        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="team-name">
            Team Name
          </label>
          <input
            id="team-name"
            type="text"
            placeholder="e.g. Water & Sanitation Team"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            style={styles.input}
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Category */}
        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="team-category">
            Category
          </label>
          <select
            id="team-category"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
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

        {/* Manager ID (placeholder) */}
        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="team-manager">
            Manager (optional)
          </label>
          <select
            id="team-manager"
            value={form.manager_id}
            onChange={(e) => handleChange('manager_id', e.target.value)}
            style={styles.select}
            disabled={isSubmitting}
          >
            <option value="">— Assign later —</option>
          </select>
          <span style={styles.fieldHint}>
            Assign a manager after inviting team members.
          </span>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Team'}
          </Button>
          <button
            type="button"
            onClick={handleCancel}
            style={styles.cancelLink}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </GlassCard>
  );
}

const styles = {
  collapsedCard: {
    border: '2px dashed var(--glass-border)',
    minHeight: '160px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  collapsedContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 'var(--space-sm)',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,
  plusIcon: {
    fontSize: '48px',
    lineHeight: 1,
    fontWeight: 300,
    color: 'var(--color-teal)',
    opacity: 0.8,
  } as React.CSSProperties,
  createLabel: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  } as React.CSSProperties,
  expandedCard: {
    minHeight: '160px',
  } as React.CSSProperties,
  formTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 var(--space-md) 0',
  } as React.CSSProperties,
  errorBox: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: 'var(--space-md)',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 'var(--space-md)',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,
  label: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-base)',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-body)',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-base)',
    cursor: 'pointer',
  } as React.CSSProperties,
  fieldHint: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    paddingTop: 'var(--space-sm)',
  } as React.CSSProperties,
  cancelLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '4px 0',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    fontFamily: 'var(--font-body)',
  } as React.CSSProperties,
};
