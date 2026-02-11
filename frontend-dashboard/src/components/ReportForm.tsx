/**
 * ReportForm component for complete report submission.
 *
 * Combines FileUpload, GeolocationCapture, and form fields into a
 * complete citizen report submission interface.
 */

import React, { useState } from 'react';
import { FileUpload } from './FileUpload';
import { GeolocationCapture } from './GeolocationCapture';
import { submitReport } from '../services/api';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: string;
}

export function ReportForm() {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [mediaFileIds, setMediaFileIds] = useState<string[]>([]);
  const [language, setLanguage] = useState('en');
  const [isGbv, setIsGbv] = useState(false);
  const [showGbvConsent, setShowGbvConsent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    tracking_number: string;
    message: string;
  } | null>(null);

  const handleGbvToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;

    if (checked) {
      setShowGbvConsent(true);
    } else {
      setIsGbv(false);
      setShowGbvConsent(false);
    }
  };

  const handleGbvConsent = (accept: boolean) => {
    if (accept) {
      setIsGbv(true);
      setShowGbvConsent(false);
    } else {
      setIsGbv(false);
      setShowGbvConsent(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate inputs
    if (description.length < 10) {
      setSubmitError('Description must be at least 10 characters');
      return;
    }

    if (!location && !manualAddress) {
      setSubmitError('Either GPS location or manual address is required');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const result = await submitReport({
        description,
        category: category || undefined,
        location: location || undefined,
        manual_address: manualAddress || undefined,
        media_file_ids: mediaFileIds,
        language,
        is_gbv: isGbv,
      });

      setSubmitSuccess({
        tracking_number: result.tracking_number,
        message: result.message,
      });

      // Clear form
      setDescription('');
      setCategory('');
      setLocation(null);
      setManualAddress('');
      setMediaFileIds([]);
      setIsGbv(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Submit a Report</h1>

      {submitSuccess && (
        <div style={{ padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>Report Submitted Successfully!</h3>
          <p style={{ margin: 0 }}>{submitSuccess.message}</p>
          <p style={{ margin: '8px 0 0 0', fontWeight: 'bold' }}>
            Tracking Number: {submitSuccess.tracking_number}
          </p>
        </div>
      )}

      {submitError && (
        <div style={{ padding: '16px', backgroundColor: '#ffebee', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ margin: 0, color: '#c62828' }}>{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="description" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Description (required):
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail (minimum 10 characters)"
            required
            minLength={10}
            maxLength={5000}
            rows={5}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'inherit',
            }}
          />
          <small>{description.length} / 5000 characters</small>
        </div>

        {/* Category */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="category" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Category (optional - AI will classify if not selected):
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value="">Let AI classify</option>
            <option value="water">Water</option>
            <option value="roads">Roads</option>
            <option value="electricity">Electricity</option>
            <option value="waste">Waste</option>
            <option value="sanitation">Sanitation</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Location */}
        <div style={{ marginBottom: '16px' }}>
          <GeolocationCapture
            onLocationCaptured={setLocation}
            onAddressEntered={setManualAddress}
          />
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '16px' }}>
          <h3>Evidence Photos (optional)</h3>
          <FileUpload onFilesUploaded={setMediaFileIds} isGbv={isGbv} />
        </div>

        {/* Language */}
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="language" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Language:
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value="en">English</option>
            <option value="zu">isiZulu</option>
            <option value="af">Afrikaans</option>
          </select>
        </div>

        {/* GBV Toggle */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isGbv}
              onChange={handleGbvToggle}
              style={{ marginRight: '8px' }}
            />
            <span>This is a gender-based violence or abuse report</span>
          </label>
        </div>

        {/* GBV Consent Dialog */}
        {showGbvConsent && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '500px',
            }}>
              <h3>GBV Report Consent</h3>
              <p>
                By submitting a GBV (gender-based violence) report:
              </p>
              <ul>
                <li>Your report will be securely encrypted</li>
                <li>SAPS (South African Police Service) will be notified</li>
                <li>Your information will be handled with strict confidentiality</li>
              </ul>
              <p>
                <strong>Emergency Contact:</strong> If you are in immediate danger, call 10111 or the GBV Command Centre at 0800 150 150.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => handleGbvConsent(true)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#2e7d32',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  I Understand, Continue
                </button>
                <button
                  type="button"
                  onClick={() => handleGbvConsent(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#ccc',
                    color: 'black',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: isSubmitting ? '#ccc' : '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}
