/**
 * MunicipalityProfile — Settings section for editing municipality contact info.
 *
 * Editable: name, contact_email, contact_phone
 * Read-only: code, province (managed by SALGA admin)
 *
 * Tracks dirty state by comparing local form to original profile values.
 */

import React, { useState, useEffect } from 'react';
import { SettingsSection } from './SettingsSection';
import type { MunicipalityProfile as Profile } from '../../types/settings';

interface MunicipalityProfileProps {
  profile: Profile | null;
  onSave: (data: Partial<Profile>) => Promise<void>;
}

interface ProfileForm {
  name: string;
  code: string;
  province: string;
  contact_email: string;
  contact_phone: string;
}

function formFromProfile(profile: Profile | null): ProfileForm {
  return {
    name: profile?.name ?? '',
    code: profile?.code ?? '',
    province: profile?.province ?? '',
    contact_email: profile?.contact_email ?? '',
    contact_phone: profile?.contact_phone ?? '',
  };
}

export function MunicipalityProfile({ profile, onSave }: MunicipalityProfileProps) {
  const [form, setForm] = useState<ProfileForm>(formFromProfile(profile));
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when profile loads / changes
  useEffect(() => {
    setForm(formFromProfile(profile));
  }, [profile]);

  const original = formFromProfile(profile);
  const isDirty =
    form.name !== original.name ||
    form.contact_email !== original.contact_email ||
    form.contact_phone !== original.contact_phone;

  const handleChange = (field: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        name: form.name,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection
      id="municipality-profile"
      title="Municipality Profile"
      description="Update your municipality's display name and contact information."
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={isSaving}
    >
      <div style={styles.grid}>
        <div style={styles.field}>
          <label style={styles.label}>Municipality Name</label>
          <input
            type="text"
            value={form.name}
            onChange={handleChange('name')}
            style={styles.input}
            placeholder="e.g. City of Johannesburg"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Municipality Code</label>
          <input
            type="text"
            value={form.code}
            readOnly
            style={{ ...styles.input, ...styles.inputReadOnly }}
            title="Municipality code is managed by SALGA administration"
          />
          <span style={styles.hint}>Managed by SALGA administration</span>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Province</label>
          <input
            type="text"
            value={form.province}
            readOnly
            style={{ ...styles.input, ...styles.inputReadOnly }}
            title="Province is managed by SALGA administration"
          />
          <span style={styles.hint}>Managed by SALGA administration</span>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Contact Email</label>
          <input
            type="email"
            value={form.contact_email}
            onChange={handleChange('contact_email')}
            style={styles.input}
            placeholder="contact@municipality.gov.za"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Contact Phone</label>
          <input
            type="tel"
            value={form.contact_phone}
            onChange={handleChange('contact_phone')}
            style={styles.input}
            placeholder="+27 11 123 4567"
          />
        </div>
      </div>
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 'var(--space-md)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  },
  input: {
    padding: '0.625rem 0.875rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    transition: 'var(--transition-fast)',
  },
  inputReadOnly: {
    opacity: 0.7,
    cursor: 'not-allowed',
    backgroundColor: 'var(--surface-higher)',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginTop: '0.125rem',
  },
};
