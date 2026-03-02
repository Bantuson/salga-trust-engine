/**
 * RequestAccessPage — Municipality Onboarding Registration (Step 1 of 2)
 *
 * Public form for municipalities to request platform access (not open signup).
 * Request goes through SALGA admin approval before an invitation is sent.
 *
 * Features:
 * - PMS-framed "Municipality Onboarding" heading with 2-step progress indicator
 * - Municipality name, demarcation code, province, category, MM name/email
 * - Contact phone (optional)
 * - Council Resolution document upload (optional)
 * - Auto-save draft to localStorage
 * - POST to /api/v1/access-requests
 * - Success state with PMS-specific messaging
 *
 * Styling: inline CSS variables (Phase 27-03 CSS lock — no Tailwind).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { supabase } from '../lib/supabase';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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

const MUNICIPALITY_CATEGORIES = [
  { value: 'A', label: 'A — Metropolitan Municipality' },
  { value: 'B', label: 'B — Local Municipality' },
  { value: 'C', label: 'C — District Municipality' },
];

const DRAFT_KEY = 'salga_access_request_draft_v2';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 3;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface FormData {
  municipalityName: string;
  demarcationCode: string;
  province: string;
  category: string;
  municipalManagerName: string;
  municipalManagerEmail: string;
  contactPhone: string;
  notes: string;
}

interface UploadedFile {
  file: File;
  storagePath?: string;
}

type SubmissionState = 'idle' | 'uploading' | 'submitting' | 'success' | 'error';

export function RequestAccessPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    municipalityName: '',
    demarcationCode: '',
    province: '',
    category: '',
    municipalManagerName: '',
    municipalManagerEmail: '',
    contactPhone: '',
    notes: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [state, setState] = useState<SubmissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Animation refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setFormData(parsed);
      } catch {
        // non-critical
      }
    }
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (
      state === 'idle' &&
      (formData.municipalityName || formData.municipalManagerEmail || formData.demarcationCode)
    ) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    }
  }, [formData, state]);

  // Entrance animation
  useGSAP(
    () => {
      const tl = gsap.timeline();
      tl.from(cardRef.current, {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'back.out(1.7)',
        clearProps: 'opacity,transform',
      });
    },
    { scope: containerRef }
  );

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const errors: string[] = [];

    if (uploadedFiles.length + files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const validFiles: UploadedFile[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type (PDF, JPG, PNG only)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }
      validFiles.push({ file });
    }

    if (errors.length > 0) {
      setError(errors.join('; '));
    } else {
      setError(null);
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);
    e.target.value = ''; // Reset input
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.municipalityName.trim()) {
      errors.municipalityName = 'Municipality name is required';
    }
    if (!formData.demarcationCode.trim()) {
      errors.demarcationCode = 'Demarcation code is required (MDB official code)';
    }
    if (!formData.province) {
      errors.province = 'Province is required';
    }
    if (!formData.category) {
      errors.category = 'Municipality category is required';
    }
    if (!formData.municipalManagerName.trim()) {
      errors.municipalManagerName = 'Municipal Manager name is required';
    }
    if (!formData.municipalManagerEmail.trim()) {
      errors.municipalManagerEmail = 'Municipal Manager email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.municipalManagerEmail)) {
      errors.municipalManagerEmail = 'Invalid email format';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const uploadFilesToStorage = async (): Promise<string[]> => {
    const storagePaths: string[] = [];

    for (const uploadedFile of uploadedFiles) {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `${timestamp}-${randomStr}-${uploadedFile.file.name}`;
      const filePath = `access-requests/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('access-request-docs')
        .upload(filePath, uploadedFile.file);

      if (uploadError) {
        throw new Error(`Failed to upload ${uploadedFile.file.name}: ${uploadError.message}`);
      }

      storagePaths.push(filePath);
    }

    return storagePaths;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      setError('Please fix the validation errors below');
      return;
    }

    try {
      // Step 1: Upload files if any
      let storagePaths: string[] = [];
      if (uploadedFiles.length > 0) {
        setState('uploading');
        storagePaths = await uploadFilesToStorage();
      }

      // Step 2: Submit to backend API
      setState('submitting');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v1/access-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          municipality_name: formData.municipalityName,
          demarcation_code: formData.demarcationCode,
          province: formData.province,
          category: formData.category,
          municipality_code: formData.demarcationCode || null, // backward compat
          contact_name: formData.municipalManagerName,
          contact_email: formData.municipalManagerEmail,
          contact_phone: formData.contactPhone || null,
          notes: formData.notes || null,
          supporting_docs: storagePaths.length > 0 ? JSON.stringify(storagePaths) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { detail?: string }).detail || 'Failed to submit request');
      }

      // Success
      setState('success');
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const isDisabled = state === 'uploading' || state === 'submitting';

  // Success state
  if (state === 'success') {
    return (
      <div ref={containerRef} style={styles.container}>
        <div className="auth-skyline-bg" />
        <div className="auth-skyline-overlay" />
        <div>
          <GlassCard glow="teal" style={styles.card}>
            <div style={styles.successContent}>
              <div style={styles.successIcon}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-teal)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <h1 style={styles.successTitle}>Registration Submitted!</h1>
              <p style={styles.successText}>
                Your registration for <strong>{formData.municipalityName}</strong> has been submitted successfully.
              </p>
              <p style={styles.successText}>
                Your Municipal Manager (<strong>{formData.municipalManagerEmail}</strong>) will receive an email
                invitation within <strong>5 business days</strong> once approved by SALGA.
              </p>
              <p style={styles.successText}>
                Once approved, you will complete onboarding through the platform wizard.
              </p>
              <div style={styles.successActions}>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Go to Login
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Skyline background layers */}
      <div className="auth-skyline-bg" />
      <div className="auth-skyline-overlay" />
      <div className="auth-skyline-frame" />

      <div ref={cardRef}>
        <GlassCard style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title}>Municipality Onboarding — Registration</h1>
            <p style={styles.subtitle}>
              Join the SALGA Trust Engine platform. Your request will be reviewed by our team.
            </p>

            {/* 2-step progress indicator */}
            <div style={styles.progressBar}>
              <div style={styles.progressStep}>
                <div style={{ ...styles.progressCircle, ...styles.progressCircleActive }}>1</div>
                <span style={{ ...styles.progressLabel, color: 'var(--color-teal)' }}>Submit Registration</span>
              </div>
              <div style={styles.progressConnector} />
              <div style={styles.progressStep}>
                <div style={styles.progressCircle}>2</div>
                <span style={styles.progressLabel}>Complete Onboarding</span>
              </div>
            </div>
            <p style={styles.progressNote}>
              Step 2 is completed after SALGA approves your registration and sends an invitation.
            </p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* === Municipality Information === */}
            <div style={styles.sectionHeader}>Municipality Information</div>

            <Input
              label="Municipality Name *"
              type="text"
              value={formData.municipalityName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('municipalityName', e.target.value)}
              placeholder="e.g., City of Johannesburg"
              error={validationErrors.municipalityName}
              disabled={isDisabled}
              autoComplete="organization"
            />

            <Input
              label="Demarcation Code *"
              type="text"
              value={formData.demarcationCode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('demarcationCode', e.target.value.toUpperCase())}
              placeholder="e.g., EKU, WC011 (MDB official code)"
              error={validationErrors.demarcationCode}
              disabled={isDisabled}
            />

            <div>
              <label htmlFor="province" style={styles.label}>
                Province *
              </label>
              <select
                id="province"
                value={formData.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                style={{
                  ...styles.select,
                  ...(validationErrors.province ? { borderColor: 'var(--color-coral)' } : {}),
                }}
                disabled={isDisabled}
                autoComplete="address-level1"
              >
                <option value="">Select province</option>
                {SA_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
              {validationErrors.province && (
                <div style={styles.fieldError}>{validationErrors.province}</div>
              )}
            </div>

            <div>
              <label htmlFor="category" style={styles.label}>
                Municipality Category *
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                style={{
                  ...styles.select,
                  ...(validationErrors.category ? { borderColor: 'var(--color-coral)' } : {}),
                }}
                disabled={isDisabled}
              >
                <option value="">Select category</option>
                {MUNICIPALITY_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              {validationErrors.category && (
                <div style={styles.fieldError}>{validationErrors.category}</div>
              )}
            </div>

            {/* === Municipal Manager Details === */}
            <div style={{ ...styles.sectionHeader, marginTop: '1.5rem' }}>Municipal Manager Details</div>

            <Input
              label="Municipal Manager Name *"
              type="text"
              value={formData.municipalManagerName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('municipalManagerName', e.target.value)}
              placeholder="Full name"
              error={validationErrors.municipalManagerName}
              disabled={isDisabled}
              autoComplete="name"
            />

            <Input
              label="Municipal Manager Email *"
              type="email"
              value={formData.municipalManagerEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('municipalManagerEmail', e.target.value)}
              placeholder="mm@municipality.gov.za"
              error={validationErrors.municipalManagerEmail}
              disabled={isDisabled}
              autoComplete="email"
            />

            <Input
              label="Contact Phone (Optional)"
              type="tel"
              value={formData.contactPhone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('contactPhone', e.target.value)}
              placeholder="+27123456789"
              disabled={isDisabled}
              autoComplete="tel"
            />

            {/* === Supporting Documentation === */}
            <div style={{ ...styles.sectionHeader, marginTop: '1.5rem' }}>Supporting Documentation</div>

            <div>
              <label htmlFor="documents" style={styles.label}>
                Council Resolution Document (Optional)
              </label>
              <div style={styles.uploadArea}>
                <input
                  id="documents"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  style={styles.fileInput}
                  disabled={isDisabled || uploadedFiles.length >= MAX_FILES}
                />
                <label htmlFor="documents" style={styles.uploadLabel}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload council resolution or authority documentation</span>
                  <small style={styles.uploadHint}>PDF, JPG, PNG (max 10MB each, up to 3 files)</small>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div style={styles.fileList}>
                  {uploadedFiles.map((uploadedFile, index) => (
                    <div key={index} style={styles.fileItem}>
                      <span style={styles.fileName}>{uploadedFile.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        style={styles.removeButton}
                        disabled={isDisabled}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="notes" style={styles.label}>
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional context for SALGA reviewers..."
                style={styles.textarea}
                rows={3}
                disabled={isDisabled}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isDisabled}
              style={{
                width: '100%',
                padding: 'var(--space-lg) var(--space-2xl)',
                background: 'var(--color-teal)',
                color: 'white',
                fontWeight: '600',
                fontSize: '1.0625rem',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.6 : 1,
                transition: 'var(--transition-base)',
                boxShadow: '0 0 20px rgba(0, 191, 165, 0.2), 0 0 60px rgba(0, 191, 165, 0.06)',
              }}
            >
              {state === 'uploading'
                ? 'Uploading documents...'
                : state === 'submitting'
                ? 'Submitting registration...'
                : 'Submit Registration'}
            </button>
          </form>

          {/* Navigation Links */}
          <div style={styles.footer}>
            <p style={styles.footerText}>
              Already have an account?{' '}
              <Link to="/login" style={styles.link}>
                Sign In
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    maxWidth: '640px',
    padding: '3rem 2.5rem',
    position: 'relative',
    zIndex: 2,
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.85rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
    background: 'linear-gradient(135deg, var(--color-teal), var(--color-coral))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  progressBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0',
    marginBottom: '0.5rem',
  },
  progressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  progressCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    background: 'var(--surface-elevated)',
    border: '2px solid var(--border-subtle)',
    color: 'var(--text-muted)',
  },
  progressCircleActive: {
    background: 'rgba(0, 191, 165, 0.15)',
    border: '2px solid var(--color-teal)',
    color: 'var(--color-teal)',
  },
  progressLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  progressConnector: {
    width: '60px',
    height: '2px',
    background: 'var(--border-subtle)',
    marginBottom: '18px',
  },
  progressNote: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    margin: '0.25rem 0 0 0',
    lineHeight: 1.4,
  },
  sectionHeader: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid var(--border-subtle)',
    marginBottom: '1rem',
  },
  errorBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  select: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    fontFamily: 'var(--font-body)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: 'var(--text-primary)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'var(--transition-base)',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffd54f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2.5rem',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-body)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    resize: 'vertical',
    transition: 'var(--transition-base)',
  },
  fieldError: {
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: 'var(--color-coral)',
  },
  uploadArea: {
    position: 'relative',
  },
  fileInput: {
    position: 'absolute',
    opacity: 0,
    width: '1px',
    height: '1px',
  },
  uploadLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '1.5rem',
    border: '2px dashed var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    textAlign: 'center',
    fontSize: '0.875rem',
  },
  uploadHint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  fileList: {
    marginTop: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.5rem 0.75rem',
    backgroundColor: 'var(--surface-higher)',
    borderRadius: 'var(--radius-sm)',
  },
  fileName: {
    fontSize: '0.8rem',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  removeButton: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    backgroundColor: 'transparent',
    color: 'var(--color-coral)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    flexShrink: 0,
    marginLeft: '0.5rem',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
  },
  link: {
    color: 'var(--color-accent-gold)',
    textDecoration: 'underline',
    fontWeight: '500',
  },
  successContent: {
    textAlign: 'center',
    padding: '1rem 0',
  },
  successIcon: {
    marginBottom: '1.5rem',
    display: 'flex',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  },
  successText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.75rem',
    lineHeight: 1.6,
  },
  successActions: {
    marginTop: '2rem',
    display: 'flex',
    justifyContent: 'center',
  },
};
