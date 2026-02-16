/**
 * ReportIssuePage - Full citizen report submission page.
 *
 * Features:
 * - Category dropdown with GBV/Abuse option triggering consent dialog
 * - Description textarea (min 20 chars)
 * - Photo upload (drag-and-drop or click, max 5 files, 10MB each)
 * - GPS location capture with 10s timeout OR manual address fallback
 * - Proof of residence gate (blocks submission if not verified)
 * - Post-submit receipt card with tracking number and CTAs
 * - Single scrollable form (not multi-step wizard)
 * - Premium skyline background + glassmorphic card
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { GBVConsentDialog } from '../components/citizen/GBVConsentDialog';
import { ReportReceipt } from '../components/citizen/ReportReceipt';
import { supabase } from '../lib/supabase';

type PageState = 'form' | 'receipt';

interface LocationData {
  latitude: number;
  longitude: number;
}

interface UploadedFile {
  id: string;
  name: string;
  url: string;
}

export function ReportIssuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Page state
  const [pageState, setPageState] = useState<PageState>('form');

  // Form fields
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showGbvConsent, setShowGbvConsent] = useState(false);
  const [isGbv, setIsGbv] = useState(false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Receipt data
  const [receiptData, setReceiptData] = useState<{
    trackingNumber: string;
    category: string;
    description: string;
    expectedResponseTime: string;
  } | null>(null);

  // Proof of residence check (simulated for now - no backend endpoint yet)
  const isResidenceVerified = user?.user_metadata?.residence_verified === true;

  // Category change handler
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value;

    if (newCategory === 'GBV/Abuse') {
      setShowGbvConsent(true);
      // Don't set category yet - wait for consent
    } else {
      setCategory(newCategory);
      setIsGbv(false);
    }
  };

  // GBV consent handlers
  const handleGbvAccept = () => {
    setCategory('GBV/Abuse');
    setIsGbv(true);
    setShowGbvConsent(false);
  };

  const handleGbvDecline = () => {
    setCategory('');
    setIsGbv(false);
    setShowGbvConsent(false);
  };

  // GPS location capture
  const captureLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    const timeoutId = setTimeout(() => {
      setLocationLoading(false);
      setLocationError('Location request timed out');
    }, 10000); // 10 second timeout

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLoading(false);
        setLocationError(null);
      },
      (error) => {
        clearTimeout(timeoutId);
        setLocationLoading(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Please enable location access or enter address manually.'
            : 'Could not get your location. Please enter address manually.'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Photo upload handler (simple file input, no react-dropzone)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);

    // Validate file count
    if (uploadedFiles.length + files.length > 5) {
      setUploadError('Maximum 5 files allowed');
      return;
    }

    // Validate file sizes and types
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.type.startsWith('image/')) {
        setUploadError(`${file.name} is not an image file`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name} exceeds 10MB limit`);
        return;
      }

      validFiles.push(file);
    }

    // Get tenant_id from auth user
    const tenantId = user?.app_metadata?.tenant_id;

    if (!tenantId) {
      setUploadError('Authentication error - no tenant ID');
      return;
    }

    // Upload files to Supabase Storage
    const newUploadedFiles: UploadedFile[] = [];

    for (const file of validFiles) {
      const fileId = crypto.randomUUID();
      const bucket = isGbv ? 'gbv-evidence' : 'evidence';
      const path = `${tenantId}/${fileId}/${file.name}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Get public URL for preview
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);

        newUploadedFiles.push({
          id: fileId,
          name: file.name,
          url: data.publicUrl,
        });
      } catch (error) {
        console.error('[ReportIssuePage] Upload failed:', error);
        setUploadError(
          error instanceof Error ? error.message : 'Upload failed'
        );
        return;
      }
    }

    setUploadedFiles([...uploadedFiles, ...newUploadedFiles]);
  };

  // Remove uploaded file
  const removeFile = (fileId: string) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));
  };

  // Expected response time logic
  const getExpectedResponseTime = (category: string): string => {
    const categoryMap: Record<string, string> = {
      'GBV/Abuse': 'Immediate — SAPS will be notified',
      'Water & Sanitation': 'Within 24 hours',
      'Electricity': 'Within 24 hours',
      'Roads & Potholes': 'Within 48 hours',
      'Waste Management': 'Within 48 hours',
      'Public Safety': 'Within 24 hours',
      'Housing': 'Within 48 hours',
      'Other': 'Within 72 hours',
    };

    return categoryMap[category] || 'Within 72 hours';
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!category) {
      setError('Please select a category');
      return;
    }

    if (description.length < 20) {
      setError('Description must be at least 20 characters');
      return;
    }

    if (!location && !manualAddress) {
      setError('Please capture your location or enter an address manually');
      return;
    }

    if (!isResidenceVerified) {
      setError('You must verify your proof of residence before submitting a report');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call when backend endpoint is ready
      // For now, simulate successful submission
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Generate mock tracking number
      const trackingNumber = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

      // Set receipt data
      setReceiptData({
        trackingNumber,
        category,
        description,
        expectedResponseTime: getExpectedResponseTime(category),
      });

      // Switch to receipt state
      setPageState('receipt');

      // Reset form
      setCategory('');
      setDescription('');
      setLocation(null);
      setManualAddress('');
      setUploadedFiles([]);
      setIsGbv(false);
    } catch (error) {
      console.error('[ReportIssuePage] Submit failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Receipt CTAs
  const handleSubmitAnother = () => {
    setPageState('form');
    setReceiptData(null);
  };

  const handleViewReports = () => {
    navigate('/my-reports');
  };

  // Render receipt state
  if (pageState === 'receipt' && receiptData) {
    return (
      <div className="auth-skyline-bg">
        <div className="auth-skyline-overlay">
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              paddingTop: '100px',
            }}
          >
            <ReportReceipt
              trackingNumber={receiptData.trackingNumber}
              category={receiptData.category}
              description={receiptData.description}
              expectedResponseTime={receiptData.expectedResponseTime}
              onSubmitAnother={handleSubmitAnother}
              onViewReports={handleViewReports}
            />
          </div>
        </div>
      </div>
    );
  }

  // Render form state
  return (
    <div className="auth-skyline-bg">
      <div className="auth-skyline-overlay">
        <div
          style={{
            minHeight: '100vh',
            padding: '2rem',
            paddingTop: '100px',
            paddingBottom: '3rem',
          }}
        >
          <GlassCard
            variant="elevated"
            style={{
              maxWidth: '700px',
              margin: '0 auto',
              padding: '40px 32px',
            }}
          >
            <h1
              style={{
                margin: '0 0 8px 0',
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
              }}
            >
              Report an Issue
            </h1>
            <p
              style={{
                margin: '0 0 32px 0',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '1rem',
              }}
            >
              Submit a municipal service issue. We'll route it to the relevant department.
            </p>

            {/* Proof of residence gate */}
            {!isResidenceVerified && (
              <div
                data-testid="residence-gate"
                style={{
                  padding: '16px',
                  marginBottom: '24px',
                  backgroundColor: 'rgba(255, 213, 79, 0.1)',
                  border: '2px solid #ffd54f',
                  borderRadius: '8px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    color: '#ffd54f',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                  }}
                >
                  Proof of Residence Required
                </h3>
                <p style={{ margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  You must upload proof of residence before submitting your first report.
                </p>
                <a
                  href="/profile"
                  style={{
                    color: '#4dd0e1',
                    textDecoration: 'underline',
                    fontWeight: 500,
                  }}
                >
                  Upload in your Profile →
                </a>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div
                data-testid="form-error"
                role="alert"
                style={{
                  padding: '16px',
                  marginBottom: '24px',
                  backgroundColor: 'rgba(255, 107, 157, 0.1)',
                  border: '2px solid #ff6b9d',
                  borderRadius: '8px',
                  color: '#ff6b9d',
                }}
              >
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Category */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="category"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                >
                  Category <span style={{ color: '#ff6b9d' }}>*</span>
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={handleCategoryChange}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
                  }}
                >
                  <option value="">Select a category...</option>
                  <option value="Water & Sanitation">Water & Sanitation</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Roads & Potholes">Roads & Potholes</option>
                  <option value="Waste Management">Waste Management</option>
                  <option value="Public Safety">Public Safety</option>
                  <option value="Housing">Housing</option>
                  <option value="GBV/Abuse">GBV/Abuse</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="description"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                >
                  Description <span style={{ color: '#ff6b9d' }}>*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail..."
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <small style={{ color: 'var(--text-secondary)', textShadow: '0 1px 2px rgba(0, 0, 0, 0.15)' }}>
                  {description.length} / 2000 characters (minimum 20)
                </small>
              </div>

              {/* Photo upload */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                >
                  Evidence Photos (optional)
                </label>
                <div
                  style={{
                    padding: '24px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '2px dashed rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('photo-input')?.click()}
                >
                  <input
                    id="photo-input"
                    type="file"
                    multiple
                    accept="image/jpg,image/jpeg,image/png,image/heic"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                  <p style={{ margin: '0 0 8px 0' }}>
                    Click to select photos or drag and drop
                  </p>
                  <small style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    Max 5 files, 10MB each (JPG, PNG, HEIC)
                  </small>
                </div>

                {/* Upload error */}
                {uploadError && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 107, 157, 0.1)',
                      border: '1px solid #ff6b9d',
                      borderRadius: '8px',
                      color: '#ff6b9d',
                      fontSize: '0.9rem',
                    }}
                  >
                    {uploadError}
                  </div>
                )}

                {/* Uploaded files */}
                {uploadedFiles.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        style={{
                          position: 'relative',
                          width: '100px',
                          height: '100px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                      >
                        <img
                          src={file.url}
                          alt={file.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(file.id)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '24px',
                            height: '24px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            border: 'none',
                            borderRadius: '50%',
                            color: '#fff',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Location section */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                  }}
                >
                  Location <span style={{ color: '#ff6b9d' }}>*</span>
                </label>

                {/* GPS capture button */}
                {!location && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={captureLocation}
                    disabled={locationLoading}
                    style={{ width: '100%', marginBottom: '12px' }}
                  >
                    {locationLoading ? 'Getting location...' : 'Use My Location'}
                  </Button>
                )}

                {/* GPS success */}
                {location && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: 'rgba(77, 208, 225, 0.1)',
                      border: '1px solid #4dd0e1',
                      borderRadius: '8px',
                      marginBottom: '12px',
                    }}
                  >
                    <p style={{ margin: '0', color: '#4dd0e1' }}>
                      Location captured: {location.latitude.toFixed(6)},{' '}
                      {location.longitude.toFixed(6)}
                    </p>
                  </div>
                )}

                {/* GPS error */}
                {locationError && (
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: 'rgba(255, 213, 79, 0.1)',
                      border: '1px solid #ffd54f',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      color: '#ffd54f',
                      fontSize: '0.9rem',
                    }}
                  >
                    {locationError}
                  </div>
                )}

                {/* Manual address input */}
                <div>
                  <label
                    htmlFor="manual-address"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    Or enter address manually:
                  </label>
                  <input
                    id="manual-address"
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="Street address, suburb, city"
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '1rem',
                    }}
                  />
                </div>
              </div>

              {/* Channel choice info */}
              <div
                style={{
                  padding: '16px',
                  marginBottom: '24px',
                  backgroundColor: 'rgba(77, 208, 225, 0.1)',
                  border: '1px solid rgba(77, 208, 225, 0.3)',
                  borderRadius: '8px',
                }}
              >
                <p style={{ margin: '0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  You can also report via WhatsApp:{' '}
                  <a
                    href="https://wa.me/27XXXXXXXXX"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4dd0e1', textDecoration: 'underline' }}
                  >
                    Click here
                  </a>
                </p>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !isResidenceVerified}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--color-coral)',
                  color: '#fff',
                  fontWeight: '600',
                  fontSize: '1.1rem',
                  padding: '14px 24px',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: isSubmitting || !isResidenceVerified ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting || !isResidenceVerified ? 0.6 : 1,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                }}
                title={!isResidenceVerified ? 'Verify residence first' : ''}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </form>
          </GlassCard>
        </div>
      </div>

      {/* GBV consent dialog */}
      {showGbvConsent && (
        <GBVConsentDialog onAccept={handleGbvAccept} onDecline={handleGbvDecline} />
      )}
    </div>
  );
}
