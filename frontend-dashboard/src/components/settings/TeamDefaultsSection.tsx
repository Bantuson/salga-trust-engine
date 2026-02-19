/**
 * TeamDefaultsSection — Default configuration for new team creation.
 *
 * Saves to localStorage (no backend endpoint for team defaults).
 * TODO: Wire to backend team defaults endpoint when available.
 */

import React, { useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { CATEGORY_CONFIG } from '../../constants/categories';

interface TeamDefaults {
  default_sla_category: string;
  auto_assign_manager: boolean;
}

const STORAGE_KEY = 'salga_team_defaults';

const DEFAULTS: TeamDefaults = {
  default_sla_category: 'other',
  auto_assign_manager: false,
};

function loadDefaults(): TeamDefaults {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULTS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULTS };
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIG)
  .filter(([key]) => key !== 'gbv')
  .map(([key, cfg]) => ({ value: key, label: cfg.label }));

export function TeamDefaultsSection() {
  const [defaults, setDefaults] = useState<TeamDefaults>(loadDefaults);
  const [savedDefaults, setSavedDefaults] = useState<TeamDefaults>(loadDefaults);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = JSON.stringify(defaults) !== JSON.stringify(savedDefaults);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Wire to backend team defaults endpoint when available
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      setSavedDefaults({ ...defaults });
      await new Promise((resolve) => setTimeout(resolve, 300));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection
      id="team-defaults"
      title="Team Defaults"
      description="Configure default settings applied when creating new teams."
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={isSaving}
    >
      <div style={styles.form}>
        {/* Default SLA template */}
        <div style={styles.field}>
          <label htmlFor="default-sla-category" style={styles.label}>
            Default SLA Template
          </label>
          <p style={styles.fieldDescription}>
            The SLA configuration applied to new teams by default. Team managers can override this.
          </p>
          <select
            id="default-sla-category"
            value={defaults.default_sla_category}
            onChange={(e) =>
              setDefaults((prev) => ({ ...prev, default_sla_category: e.target.value }))
            }
            style={styles.select}
          >
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-assign manager */}
        <div style={styles.field}>
          <div style={styles.toggleRow}>
            <div>
              <span style={styles.label}>Auto-assign team manager</span>
              <p style={styles.fieldDescription}>
                Automatically assign the current user as team manager when creating a new team.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={defaults.auto_assign_manager}
              onClick={() =>
                setDefaults((prev) => ({
                  ...prev,
                  auto_assign_manager: !prev.auto_assign_manager,
                }))
              }
              style={{
                ...styles.toggle,
                ...(defaults.auto_assign_manager ? styles.toggleOn : styles.toggleOff),
              }}
            >
              <span
                style={{
                  ...styles.toggleKnob,
                  transform: defaults.auto_assign_manager ? 'translateX(22px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      <p style={styles.hint}>
        Defaults saved locally. Backend team defaults endpoint coming soon.
      </p>
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-lg)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-md)',
  },
  label: {
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
  },
  fieldDescription: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    margin: '0.25rem 0 0.5rem',
    lineHeight: 1.4,
  },
  select: {
    padding: '0.625rem 0.875rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    cursor: 'pointer',
    maxWidth: '320px',
  },
  toggle: {
    flexShrink: 0,
    position: 'relative',
    width: '46px',
    height: '26px',
    borderRadius: '999px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color var(--transition-base)',
    padding: 0,
  },
  toggleOn: {
    backgroundColor: 'var(--color-teal)',
  },
  toggleOff: {
    backgroundColor: 'var(--surface-higher)',
  },
  toggleKnob: {
    position: 'absolute',
    top: '3px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform var(--transition-base)',
    display: 'block',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: 'var(--space-sm)',
    fontStyle: 'italic',
  },
};
