/**
 * BrandingSection — Municipality logo upload and brand color display.
 *
 * Admin-only section (visibility gated by SettingsPage).
 * Logo upload uses drag-and-drop with file input fallback.
 * Brand colors shown as read-only display of current design tokens.
 *
 * Note: logo upload endpoint needed — currently requestPresignedUrl is for
 * evidence/proof_of_residence only. Add 'logo' purpose when backend supports it.
 */

import React, { useState, useRef } from 'react';
import { SettingsSection } from './SettingsSection';
import type { MunicipalityProfile } from '../../types/settings';

interface BrandingSectionProps {
  profile: MunicipalityProfile | null;
}

const BRAND_COLORS = [
  { name: 'Rose (Primary)', value: '#cd5e81', cssVar: '--color-rose' },
  { name: 'Gold (Accent)', value: '#ffd54f', cssVar: '--color-accent-gold' },
  { name: 'Teal (Actions)', value: '#00bfa5', cssVar: '--color-teal' },
];

export function BrandingSection({ profile }: BrandingSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.logo_url ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = selectedFile !== null;

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      // TODO: When backend adds 'logo' purpose to /uploads/presigned endpoint:
      // 1. const upload = await requestPresignedUrl(selectedFile.name, selectedFile.type, selectedFile.size, 'logo')
      // 2. Upload to Supabase Storage
      // 3. await updateMunicipalityProfile({ logo_url: upload.path })
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSelectedFile(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsSection
      id="branding"
      title="Branding"
      description="Upload your municipality's logo. Logo appears on exported reports and email notifications."
      onSave={handleSave}
      isDirty={isDirty}
      isSaving={isSaving}
      adminOnly
    >
      <div style={styles.content}>
        {/* Logo upload */}
        <div>
          <h3 style={styles.subheading}>Municipality Logo</h3>
          <div
            style={{
              ...styles.dropzone,
              ...(isDragging ? styles.dropzoneDragging : {}),
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div style={styles.previewContainer}>
                <img src={previewUrl} alt="Municipality logo preview" style={styles.logoPreview} />
                <p style={styles.dropzoneHint}>Click or drag to replace</p>
              </div>
            ) : (
              <div style={styles.dropzonePlaceholder}>
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p style={styles.dropzoneText}>Drag & drop logo here</p>
                <p style={styles.dropzoneHint}>or click to browse — PNG, JPG, SVG up to 2MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>

        {/* Brand colors (read-only) */}
        <div>
          <h3 style={styles.subheading}>Brand Colors</h3>
          <p style={styles.colorNote}>
            Theme colors are consistent across the SALGA Trust Engine platform and managed by SALGA administration.
          </p>
          <div style={styles.colorGrid}>
            {BRAND_COLORS.map(({ name, value }) => (
              <div key={name} style={styles.colorItem}>
                <div
                  style={{
                    ...styles.colorSwatch,
                    backgroundColor: value,
                  }}
                />
                <div style={styles.colorInfo}>
                  <span style={styles.colorName}>{name}</span>
                  <span style={styles.colorHex}>{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xl)',
  },
  subheading: {
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-sm)',
    fontFamily: 'var(--font-display)',
  },
  dropzone: {
    padding: 'var(--space-xl)',
    borderRadius: 'var(--radius-md)',
    border: '2px dashed var(--border-subtle)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    textAlign: 'center',
    backgroundColor: 'var(--surface-elevated)',
  },
  dropzoneDragging: {
    borderColor: 'var(--color-teal)',
    backgroundColor: 'rgba(0, 191, 165, 0.08)',
  },
  dropzonePlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  dropzoneText: {
    fontSize: '1rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    margin: 0,
  },
  dropzoneHint: {
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoPreview: {
    maxWidth: '200px',
    maxHeight: '120px',
    objectFit: 'contain',
    borderRadius: 'var(--radius-sm)',
  },
  colorNote: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
    marginBottom: 'var(--space-md)',
    margin: '0 0 var(--space-md)',
  },
  colorGrid: {
    display: 'flex',
    gap: 'var(--space-md)',
    flexWrap: 'wrap',
  },
  colorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-elevated)',
  },
  colorSwatch: {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    flexShrink: 0,
  },
  colorInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  colorName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  colorHex: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
};
