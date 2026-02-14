/**
 * Municipality Request Access Page
 *
 * Public form for municipalities to request platform access (not open signup).
 * Request goes through admin approval before invitation is sent.
 *
 * Features:
 * - Municipal details form with SA province dropdown
 * - Supporting document upload to Supabase Storage
 * - Auto-save draft to localStorage
 * - Submit to POST /api/v1/access-requests backend API
 * - Success confirmation state
 */

import { useState, useEffect, useRef } from 'react';
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

const DRAFT_KEY = 'salga_access_request_draft';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 3;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface FormData {
  municipalityName: string;
  province: string;
  municipalityCode: string;
  contactName: string;
  contactEmail: string;
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
    province: '',
    municipalityCode: '',
    contactName: '',
    contactEmail: '',
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
      } catch (err) {
        console.error('Failed to parse draft:', err);
      }
    }
  }, []);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (
      state === 'idle' &&
      (formData.municipalityName ||
        formData.contactName ||
        formData.contactEmail)
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
      });
    },
    { scope: containerRef }
  );

  const handleInputChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
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

    // Validate file count
    if (uploadedFiles.length + files.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    // Validate each file
    const validFiles: UploadedFile[] = [];
    for (const file of files) {
      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type (PDF, JPG, PNG only)`);
        continue;
      }

      // Check file size
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

    if (!formData.province) {
      errors.province = 'Province is required';
    }

    if (!formData.contactName.trim()) {
      errors.contactName = 'Contact name is required';
    }

    if (!formData.contactEmail.trim()) {
      errors.contactEmail = 'Contact email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
      errors.contactEmail = 'Invalid email format';
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

      const { error } = await supabase.storage
        .from('access-request-docs')
        .upload(filePath, uploadedFile.file);

      if (error) {
        throw new Error(`Failed to upload ${uploadedFile.file.name}: ${error.message}`);
      }

      storagePaths.push(filePath);
    }

    return storagePaths;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!validateForm()) {
      setError('Please fix the validation errors');
      return;
    }

    try {
      // Step 1: Upload files to Supabase Storage
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
          province: formData.province,
          municipality_code: formData.municipalityCode || null,
          contact_name: formData.contactName,
          contact_email: formData.contactEmail,
          contact_phone: formData.contactPhone || null,
          notes: formData.notes || null,
          supporting_docs: storagePaths.length > 0 ? JSON.stringify(storagePaths) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).detail || 'Failed to submit request');
      }

      // Success!
      setState('success');
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  // Success state
  if (state === 'success') {
    return (
      <div ref={containerRef} style={styles.container}>
        {/* Skyline background layers */}
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
            <h1 style={styles.successTitle}>Request Submitted!</h1>
            <p style={styles.successText}>
              Thank you for your request! Our team will review it and contact you within{' '}
              <strong>5 business days</strong>.
            </p>
            <p style={styles.successText}>
              You'll receive an email invitation at <strong>{formData.contactEmail}</strong>{' '}
              once approved.
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
        <div style={styles.header}>
          <h1 style={styles.title}>Request Municipal Access</h1>
          <p style={styles.subtitle}>
            Join the SALGA Trust Engine platform. Your request will be reviewed by our team.
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form} className="request-access-form">
          {/* Municipality Name */}
          <Input
            label="Municipality Name *"
            type="text"
            value={formData.municipalityName}
            onChange={(e) => handleInputChange('municipalityName', e.target.value)}
            placeholder="e.g., City of Johannesburg"
            error={validationErrors.municipalityName}
            disabled={state === 'uploading' || state === 'submitting'}
          />

          {/* Province */}
          <div>
            <label htmlFor="province" style={styles.label}>
              Province *
            </label>
            <select
              id="province"
              value={formData.province}
              onChange={(e) => handleInputChange('province', e.target.value)}
              className="province-select"
              style={{
                ...styles.select,
                ...(validationErrors.province ? { borderColor: 'var(--color-coral)' } : {}),
              }}
              disabled={state === 'uploading' || state === 'submitting'}
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

          {/* Municipality Code */}
          <Input
            label="Municipality Code (Optional)"
            type="text"
            value={formData.municipalityCode}
            onChange={(e) => handleInputChange('municipalityCode', e.target.value.toUpperCase())}
            placeholder="e.g., JHB, CPT"
            disabled={state === 'uploading' || state === 'submitting'}
          />

          {/* Contact Person Name */}
          <Input
            label="Contact Person Name *"
            type="text"
            value={formData.contactName}
            onChange={(e) => handleInputChange('contactName', e.target.value)}
            placeholder="Full name"
            error={validationErrors.contactName}
            disabled={state === 'uploading' || state === 'submitting'}
          />

          {/* Contact Email */}
          <Input
            label="Contact Email *"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => handleInputChange('contactEmail', e.target.value)}
            placeholder="email@municipality.gov.za"
            error={validationErrors.contactEmail}
            disabled={state === 'uploading' || state === 'submitting'}
          />

          {/* Contact Phone */}
          <Input
            label="Contact Phone (Optional)"
            type="tel"
            value={formData.contactPhone}
            onChange={(e) => handleInputChange('contactPhone', e.target.value)}
            placeholder="+27123456789"
            disabled={state === 'uploading' || state === 'submitting'}
          />

          {/* Supporting Documents */}
          <div>
            <label htmlFor="documents" style={styles.label}>
              Supporting Documents (Optional)
            </label>
            <div style={styles.uploadArea}>
              <input
                id="documents"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                style={styles.fileInput}
                disabled={state === 'uploading' || state === 'submitting' || uploadedFiles.length >= MAX_FILES}
              />
              <label htmlFor="documents" style={styles.uploadLabel}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload documentation proving municipal authority</span>
                <small style={styles.uploadHint}>PDF, JPG, PNG (max 10MB each, up to 3 files)</small>
              </label>
            </div>

            {/* File list */}
            {uploadedFiles.length > 0 && (
              <div style={styles.fileList}>
                {uploadedFiles.map((uploadedFile, index) => (
                  <div key={index} style={styles.fileItem}>
                    <span style={styles.fileName}>{uploadedFile.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      style={styles.removeButton}
                      disabled={state === 'uploading' || state === 'submitting'}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label htmlFor="notes" style={styles.label}>
              Additional Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional information..."
              style={styles.textarea}
              rows={4}
              disabled={state === 'uploading' || state === 'submitting'}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={state === 'uploading' || state === 'submitting'}
            className="request-access-submit"
            style={{
              width: '100%',
              padding: 'var(--space-lg) var(--space-2xl)',
              background: 'var(--color-accent-gold)',
              color: '#333',
              fontWeight: '600',
              fontSize: '1.125rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: state === 'uploading' || state === 'submitting' ? 'not-allowed' : 'pointer',
              opacity: state === 'uploading' || state === 'submitting' ? 0.6 : 1,
              transition: 'var(--transition-base)',
              boxShadow: '0 0 20px rgba(255, 213, 79, 0.2), 0 0 60px rgba(255, 213, 79, 0.08)',
            }}
          >
            {state === 'uploading'
              ? 'Uploading documents...'
              : state === 'submitting'
              ? 'Submitting request...'
              : 'Submit Request'}
          </button>
        </form>

        {/* Navigation Links */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Already have an invite?{' '}
            <Link to="/login" style={styles.link}>
              Sign In
            </Link>
          </p>
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

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '600px',
    padding: '3rem 2.5rem',
    position: 'relative' as const,
    zIndex: 2,
  } as React.CSSProperties,
  header: {
    marginBottom: '2rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  title: {
    fontSize: '2rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
    background: 'linear-gradient(135deg, var(--color-accent-gold), var(--color-teal))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
  } as React.CSSProperties,
  errorBox: {
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
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
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffd54f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2.5rem',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    fontFamily: 'var(--font-body)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'var(--transition-base)',
  } as React.CSSProperties,
  fieldError: {
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: 'var(--color-coral)',
  } as React.CSSProperties,
  uploadArea: {
    position: 'relative' as const,
  } as React.CSSProperties,
  fileInput: {
    position: 'absolute' as const,
    opacity: 0,
    width: '1px',
    height: '1px',
  } as React.CSSProperties,
  uploadLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '2rem',
    border: '2px dashed var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  uploadHint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  fileList: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } as React.CSSProperties,
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem',
    backgroundColor: 'var(--surface-higher)',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  fileName: {
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
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
  footer: {
    marginTop: '2rem',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } as React.CSSProperties,
  footerText: {
    fontSize: '0.875rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  link: {
    color: 'var(--color-accent-gold)',
    textDecoration: 'underline',
    fontWeight: '500',
  } as React.CSSProperties,
  successContent: {
    textAlign: 'center' as const,
  } as React.CSSProperties,
  successIcon: {
    marginBottom: '1.5rem',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  successTitle: {
    fontSize: '2rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  } as React.CSSProperties,
  successText: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
    lineHeight: 1.6,
  } as React.CSSProperties,
  successActions: {
    marginTop: '2rem',
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
};
