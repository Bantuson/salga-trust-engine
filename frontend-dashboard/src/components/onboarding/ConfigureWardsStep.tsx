/**
 * Onboarding Wizard — Configure Wards Step (Step 3, Skippable)
 *
 * Simple list-based ward configuration.
 * No interactive map (too complex for this plan).
 */

import React, { useState, useEffect } from 'react';
import { Input } from '@shared/components/ui/Input';
import { Button } from '@shared/components/ui/Button';

export interface Ward {
  name: string;
  boundaryDescription: string;
}

export interface ConfigureWardsData {
  wards: Ward[];
}

interface ConfigureWardsStepProps {
  initialData?: Partial<ConfigureWardsData>;
  onDataChange: (data: ConfigureWardsData) => void;
}

export const ConfigureWardsStep: React.FC<ConfigureWardsStepProps> = ({
  initialData,
  onDataChange,
}) => {
  const [wards, setWards] = useState<Ward[]>(
    initialData?.wards && initialData.wards.length > 0
      ? initialData.wards
      : [{ name: '', boundaryDescription: '' }]
  );

  // Notify parent of changes
  useEffect(() => {
    onDataChange({ wards });
  }, [wards, onDataChange]);

  const handleAddWard = () => {
    setWards([...wards, { name: '', boundaryDescription: '' }]);
  };

  const handleRemoveWard = (index: number) => {
    if (wards.length === 1) return; // Keep at least one row
    setWards(wards.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof Ward, value: string) => {
    const updated = [...wards];
    updated[index] = { ...updated[index], [field]: value };
    setWards(updated);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Configure Your Wards</h2>
      <p style={styles.description}>
        Wards help route tickets to the right teams. Add your municipality's wards below.
        You can refine this later in Settings.
      </p>

      <div style={styles.wardList}>
        {wards.map((ward, index) => (
          <div key={index} style={styles.wardCard}>
            <div style={styles.wardHeader}>
              <span style={styles.wardNumber}>Ward {index + 1}</span>
              <button
                type="button"
                onClick={() => handleRemoveWard(index)}
                style={styles.removeButton}
                disabled={wards.length === 1}
              >
                Remove
              </button>
            </div>

            <div style={styles.wardFields}>
              <Input
                label="Ward Name"
                type="text"
                placeholder="e.g., Ward 1, Central Business District"
                value={ward.name}
                onChange={(e) => handleChange(index, 'name', e.target.value)}
              />

              <div>
                <label htmlFor={`boundary-${index}`} style={styles.label}>
                  Boundary Description (Optional)
                </label>
                <textarea
                  id={`boundary-${index}`}
                  placeholder="e.g., Bounded by Main St, River Rd, Oak Ave, and Pine St"
                  value={ward.boundaryDescription}
                  onChange={(e) => handleChange(index, 'boundaryDescription', e.target.value)}
                  style={styles.textarea}
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={handleAddWard} style={styles.addButton}>
        + Add Ward
      </Button>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
  } as React.CSSProperties,
  title: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    marginBottom: '2rem',
    lineHeight: 1.5,
  } as React.CSSProperties,
  wardList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  wardCard: {
    padding: '1.5rem',
    backgroundColor: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
  } as React.CSSProperties,
  wardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  } as React.CSSProperties,
  wardNumber: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  removeButton: {
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    backgroundColor: 'transparent',
    color: 'var(--color-coral)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
  wardFields: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-body)',
    background: 'var(--surface-base)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
  addButton: {
    alignSelf: 'flex-start',
  } as React.CSSProperties,
};
