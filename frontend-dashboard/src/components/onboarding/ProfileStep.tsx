/**
 * Onboarding Wizard — Profile Step (Step 1, Required)
 *
 * Municipality details form.
 * Pre-fills from access request if available.
 */

import React, { useState, useEffect } from 'react';
import { Input } from '@shared/components/ui/Input';

const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

export interface ProfileData {
  municipalityName: string;
  municipalityCode: string;
  province: string;
  contactEmail: string;
  contactPhone: string;
  contactPersonName: string;
  contactPersonTitle: string;
}

interface ProfileStepProps {
  initialData?: Partial<ProfileData>;
  onDataChange: (data: ProfileData) => void;
}

export const ProfileStep: React.FC<ProfileStepProps> = ({ initialData, onDataChange }) => {
  const [formData, setFormData] = useState<ProfileData>({
    municipalityName: initialData?.municipalityName || '',
    municipalityCode: initialData?.municipalityCode || '',
    province: initialData?.province || '',
    contactEmail: initialData?.contactEmail || '',
    contactPhone: initialData?.contactPhone || '',
    contactPersonName: initialData?.contactPersonName || '',
    contactPersonTitle: initialData?.contactPersonTitle || '',
  });

  // Notify parent of changes
  useEffect(() => {
    onDataChange(formData);
  }, [formData, onDataChange]);

  const handleChange = (field: keyof ProfileData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Municipality Profile</h2>
      <p style={styles.description}>
        Set up your municipality's basic information.
      </p>

      <div style={styles.form}>
        <Input
          label="Full Municipality Name *"
          type="text"
          value={formData.municipalityName}
          onChange={(e) => handleChange('municipalityName', e.target.value)}
          placeholder="e.g., City of Johannesburg Metropolitan Municipality"
        />

        <Input
          label="Municipality Code *"
          type="text"
          value={formData.municipalityCode}
          onChange={(e) => handleChange('municipalityCode', e.target.value.toUpperCase())}
          placeholder="e.g., JHB, CPT, EKU"
        />

        <div>
          <label htmlFor="province" style={styles.label}>
            Province *
          </label>
          <select
            id="province"
            value={formData.province}
            onChange={(e) => handleChange('province', e.target.value)}
            style={styles.select}
          >
            <option value="">Select province</option>
            {SA_PROVINCES.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Contact Email *"
          type="email"
          value={formData.contactEmail}
          onChange={(e) => handleChange('contactEmail', e.target.value)}
          placeholder="contact@municipality.gov.za"
        />

        <Input
          label="Contact Phone *"
          type="tel"
          value={formData.contactPhone}
          onChange={(e) => handleChange('contactPhone', e.target.value)}
          placeholder="+27123456789"
        />

        <Input
          label="Primary Contact Person Name *"
          type="text"
          value={formData.contactPersonName}
          onChange={(e) => handleChange('contactPersonName', e.target.value)}
          placeholder="Full name"
        />

        <Input
          label="Primary Contact Person Title"
          type="text"
          value={formData.contactPersonTitle}
          onChange={(e) => handleChange('contactPersonTitle', e.target.value)}
          placeholder="e.g., Municipal Manager, IT Director"
        />
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '600px',
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
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.5rem',
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-body)',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
};
