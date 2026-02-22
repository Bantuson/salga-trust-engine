/**
 * SALGA Trust Engine — Citizen Profile Page
 *
 * Full citizen profile management page with:
 * - Personal information (name, email, phone, municipality)
 * - Edit mode for profile updates
 * - Proof of residence upload and verification status
 * - Premium styling with animated gradient background
 *
 * Per plan: Proof of residence is required before first report submission,
 * but NOT at signup. This page is where citizens complete that step.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AnimatedGradientBg } from '@shared/components/AnimatedGradientBg';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { ProofOfResidence } from '../components/citizen/ProofOfResidence';
import { supabase } from '../lib/supabase';

const PILOT_MUNICIPALITIES = [
  'City of Johannesburg',
  'City of Tshwane',
  'City of Cape Town',
  'eThekwini Municipality',
  'Ekurhuleni Metropolitan Municipality',
];

export function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [municipality, setMunicipality] = useState('');

  // Read-only fields
  const email = user?.email || '';
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString() : '';

  // Verification status
  const isVerified = user?.user_metadata?.residence_verified === true;
  const documentUrl = user?.user_metadata?.residence_document_url;

  // Load initial values from user metadata
  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.phone || user.user_metadata?.phone || '');
      setMunicipality(user.user_metadata?.municipality || '');
    }
  }, [user]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const handleEdit = () => {
    setIsEditing(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCancel = () => {
    // Revert to original values
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.phone || user.user_metadata?.phone || '');
      setMunicipality(user.user_metadata?.municipality || '');
    }
    setIsEditing(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone: phone,
          municipality: municipality,
        },
      });

      if (error) throw error;

      setSuccessMessage('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!user) return;

    setIsUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // 1. Upload file to Supabase Storage
      const fileName = `${user.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`residence/${fileName}`, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(`residence/${fileName}`);

      const documentUrl = urlData.publicUrl;

      // 3. Update user metadata
      // Note: residence_verified starts false — the backend OCR endpoint will
      // set it to true via Supabase admin API after successful verification.
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          residence_verified: false, // Will be set to true by backend OCR verification
          residence_document_url: documentUrl,
          residence_upload_date: new Date().toISOString(),
        },
      });

      if (updateError) throw updateError;

      setSuccessMessage('Document uploaded. Verification pending.');

      // Refresh session to pick up updated user_metadata after backend verification
      // The backend OCR endpoint sets residence_verified=true via Supabase admin API.
      // This refresh ensures the ReportIssuePage gate unlocks without manual page reload
      // if OCR runs fast enough during the same session. On next visit the session
      // will naturally reflect the updated metadata.
      await supabase.auth.refreshSession();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-primary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <AnimatedGradientBg />

      <div
        style={{
          minHeight: '100vh',
          paddingTop: '100px',
          paddingBottom: '3rem',
        }}
      >
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '0 1rem',
          }}
        >
          {/* Page title */}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 700,
              marginBottom: '2rem',
              background: 'linear-gradient(135deg, var(--color-coral), var(--color-teal))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            My Profile
          </h1>

          {/* Verification status badge */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderRadius: '12px',
              marginBottom: '2rem',
              background: isVerified ? 'rgba(130, 211, 192, 0.1)' : 'rgba(255, 213, 79, 0.1)',
              border: `2px solid ${isVerified ? 'var(--color-teal)' : 'var(--color-gold)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isVerified ? 'var(--color-teal)' : 'var(--color-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isVerified ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {isVerified ? 'Verified Citizen' : 'Verification Pending'}
              </p>
              {!isVerified && (
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Upload proof of residence below
                </p>
              )}
            </div>
          </div>

          {/* Success/Error messages */}
          {successMessage && (
            <div
              style={{
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                background: 'rgba(130, 211, 192, 0.1)',
                border: '2px solid var(--color-teal)',
                color: 'var(--text-primary)',
              }}
            >
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              style={{
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                background: 'rgba(205, 94, 129, 0.1)',
                border: '2px solid var(--color-coral)',
                color: 'var(--text-primary)',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Personal Information */}
          <GlassCard style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Personal Information
              </h2>

              {!isEditing && (
                <Button variant="secondary" onClick={handleEdit}>
                  Edit Profile
                </Button>
              )}
            </div>

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Full Name */}
              <div>
                <label
                  htmlFor="fullName"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid var(--border-subtle)',
                    background: isEditing ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                />
              </div>

              {/* Email (readonly) */}
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-secondary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)',
                    cursor: 'not-allowed',
                  }}
                />
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Email cannot be changed (authentication identifier)
                </p>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isEditing}
                  placeholder="+27XXXXXXXXX"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid var(--border-subtle)',
                    background: isEditing ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    cursor: isEditing ? 'text' : 'not-allowed',
                  }}
                />
              </div>

              {/* Municipality */}
              <div>
                <label
                  htmlFor="municipality"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  Municipality
                </label>
                <select
                  id="municipality"
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  disabled={!isEditing}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid var(--border-subtle)',
                    background: isEditing ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    cursor: isEditing ? 'pointer' : 'not-allowed',
                  }}
                >
                  <option value="">Select your municipality (optional)</option>
                  {PILOT_MUNICIPALITIES.map((muni) => (
                    <option key={muni} value={muni}>
                      {muni}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Created (readonly) */}
              <div>
                <label
                  htmlFor="createdAt"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                    fontSize: '0.9rem',
                  }}
                >
                  Account Created
                </label>
                <input
                  id="createdAt"
                  type="text"
                  value={createdAt}
                  disabled
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '2px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-secondary)',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-body)',
                    cursor: 'not-allowed',
                  }}
                />
              </div>
            </div>

            {/* Edit mode buttons */}
            {isEditing && (
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} loading={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </GlassCard>

          {/* Proof of Residence */}
          <ProofOfResidence
            isVerified={isVerified}
            documentUrl={documentUrl}
            onUpload={handleUpload}
            isUploading={isUploading}
          />
        </div>
      </div>
    </>
  );
}
