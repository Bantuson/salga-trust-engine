/**
 * SLATargetsSection — Per-category SLA configuration editor.
 *
 * Displays each service category with editable response/resolution hours
 * and warning threshold. Each category row saves independently.
 *
 * GBV category is excluded from SLA targets per SEC-05 (SAPS-managed).
 */

import React, { useState, useEffect } from 'react';
import { SettingsSection } from './SettingsSection';
import { CATEGORY_CONFIG } from '../../constants/categories';
import type { SLAConfig } from '../../types/settings';

interface SLATargetsSectionProps {
  slaConfigs: SLAConfig[];
  onSave: (
    category: string,
    data: { response_hours: number; resolution_hours: number; warning_threshold_pct: number }
  ) => Promise<void>;
}

interface CategorySLAState {
  response_hours: number;
  resolution_hours: number;
  warning_threshold_pct: number;
}

type CategorySLAMap = Record<string, CategorySLAState>;

const DEFAULTS: CategorySLAState = {
  response_hours: 24,
  resolution_hours: 168,
  warning_threshold_pct: 80,
};

/** Categories shown in the SLA editor (GBV excluded per SEC-05) */
const SLA_CATEGORIES = Object.keys(CATEGORY_CONFIG).filter((c) => c !== 'gbv');

function buildStateFromConfigs(configs: SLAConfig[]): CategorySLAMap {
  const result: CategorySLAMap = {};
  for (const cat of SLA_CATEGORIES) {
    const match = configs.find((c) => c.category === cat || (cat === 'other' && c.category === null));
    result[cat] = match
      ? {
          response_hours: match.response_hours,
          resolution_hours: match.resolution_hours,
          warning_threshold_pct: match.warning_threshold_pct,
        }
      : { ...DEFAULTS };
  }
  return result;
}

export function SLATargetsSection({ slaConfigs, onSave }: SLATargetsSectionProps) {
  const [localState, setLocalState] = useState<CategorySLAMap>(() =>
    buildStateFromConfigs(slaConfigs)
  );
  const [dirtyCategories, setDirtyCategories] = useState<Set<string>>(new Set());
  const [savingCategories, setSavingCategories] = useState<Set<string>>(new Set());

  // Sync when slaConfigs change from parent
  useEffect(() => {
    const fresh = buildStateFromConfigs(slaConfigs);
    setLocalState(fresh);
    setDirtyCategories(new Set());
  }, [slaConfigs]);

  const handleFieldChange = (
    category: string,
    field: keyof CategorySLAState,
    value: number
  ) => {
    setLocalState((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
    setDirtyCategories((prev) => new Set(prev).add(category));
  };

  const handleSaveCategory = async (category: string) => {
    setSavingCategories((prev) => new Set(prev).add(category));
    try {
      await onSave(category, localState[category]);
      setDirtyCategories((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    } finally {
      setSavingCategories((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    }
  };

  // The outer SettingsSection wrapper: no top-level save (each row saves itself)
  return (
    <SettingsSection
      id="sla-targets"
      title="SLA Targets"
      description="Configure response and resolution time targets per service category. Each category saves independently."
      onSave={async () => {}}
      isDirty={false}
      isSaving={false}
    >
      <div style={styles.table}>
        {/* Header row */}
        <div style={styles.tableHeader}>
          <span style={{ ...styles.col, ...styles.colCategory }}>Category</span>
          <span style={{ ...styles.col, ...styles.colHours }}>Response Hours</span>
          <span style={{ ...styles.col, ...styles.colHours }}>Resolution Hours</span>
          <span style={{ ...styles.col, ...styles.colThreshold }}>Warning %</span>
          <span style={{ ...styles.col, ...styles.colAction }} />
        </div>

        {SLA_CATEGORIES.map((category) => {
          const cfg = CATEGORY_CONFIG[category];
          const state = localState[category] ?? { ...DEFAULTS };
          const isDirty = dirtyCategories.has(category);
          const isSaving = savingCategories.has(category);

          return (
            <div key={category} style={styles.tableRow}>
              {/* Category badge */}
              <div style={{ ...styles.col, ...styles.colCategory }}>
                <span
                  style={{
                    ...styles.badge,
                    backgroundColor: `${cfg.color}22`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}44`,
                  }}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Response hours */}
              <div style={{ ...styles.col, ...styles.colHours }}>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={state.response_hours}
                  onChange={(e) =>
                    handleFieldChange(category, 'response_hours', parseInt(e.target.value, 10) || 0)
                  }
                  style={styles.numberInput}
                />
                <span style={styles.unit}>hrs</span>
              </div>

              {/* Resolution hours */}
              <div style={{ ...styles.col, ...styles.colHours }}>
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={state.resolution_hours}
                  onChange={(e) =>
                    handleFieldChange(
                      category,
                      'resolution_hours',
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  style={styles.numberInput}
                />
                <span style={styles.unit}>hrs</span>
              </div>

              {/* Warning threshold */}
              <div style={{ ...styles.col, ...styles.colThreshold }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={state.warning_threshold_pct}
                  onChange={(e) =>
                    handleFieldChange(
                      category,
                      'warning_threshold_pct',
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                  style={styles.numberInput}
                />
                <span style={styles.unit}>%</span>
              </div>

              {/* Per-row Save button */}
              <div style={{ ...styles.col, ...styles.colAction }}>
                <button
                  onClick={() => handleSaveCategory(category)}
                  disabled={!isDirty || isSaving}
                  style={{
                    ...styles.rowSaveButton,
                    ...(!isDirty || isSaving ? styles.rowSaveDisabled : styles.rowSaveActive),
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p style={styles.note}>
        GBV / Safety tickets are excluded from SLA monitoring per SAPS privacy protocols.
      </p>
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    overflowX: 'auto',
  },
  tableHeader: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-higher)',
  },
  tableRow: {
    display: 'flex',
    gap: 'var(--space-sm)',
    alignItems: 'center',
    padding: '0.625rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-elevated)',
  },
  col: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  },
  colCategory: {
    flex: '0 0 180px',
    minWidth: 0,
    fontWeight: 500,
  },
  colHours: {
    flex: '0 0 130px',
  },
  colThreshold: {
    flex: '0 0 110px',
  },
  colAction: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  numberInput: {
    width: '72px',
    padding: '0.375rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-higher)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    textAlign: 'right',
  },
  unit: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  rowSaveButton: {
    padding: '0.375rem 0.875rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    fontFamily: 'var(--font-body)',
  },
  rowSaveActive: {
    backgroundColor: 'var(--color-teal)',
    color: '#0a1a1a',
  },
  rowSaveDisabled: {
    backgroundColor: 'var(--surface-higher)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  },
  note: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: 'var(--space-sm)',
    fontStyle: 'italic',
  },
};
