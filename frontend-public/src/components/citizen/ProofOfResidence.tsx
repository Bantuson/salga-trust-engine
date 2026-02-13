/**
 * SALGA Trust Engine — ProofOfResidence Component
 *
 * Displays proof of residence upload and verification status.
 * Two states:
 * 1. Verified — shows success badge with optional document link
 * 2. Not verified — shows warning + drag-and-drop upload area
 *
 * Per plan: Citizens must upload proof of residence before first report submission,
 * but NOT at signup. This component guides citizens through the upload process.
 */

import React, { useState, useRef } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';

interface ProofOfResidenceProps {
  isVerified: boolean;
  documentUrl?: string;
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
}

export function ProofOfResidence({
  isVerified,
  documentUrl,
  onUpload,
  isUploading = false,
}: ProofOfResidenceProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  // Verified state
  if (isVerified) {
    return (
      <GlassCard
        variant="elevated"
        style={{
          border: '2px solid var(--color-teal)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          {/* Success icon */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--color-teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 600,
                color: 'var(--color-teal)',
              }}
            >
              Verified
            </h3>
            <p
              style={{
                margin: '0.5rem 0',
                color: 'var(--text-primary)',
                opacity: 0.9,
              }}
            >
              Your residence has been confirmed
            </p>
            {documentUrl && (
              <a
                href={documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '0.5rem',
                  color: 'var(--color-teal)',
                  textDecoration: 'underline',
                  fontSize: '0.9rem',
                }}
              >
                View Document
              </a>
            )}
          </div>
        </div>
      </GlassCard>
    );
  }

  // Not verified state
  return (
    <GlassCard>
      <h3
        style={{
          margin: '0 0 1rem 0',
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        Proof of Residence
      </h3>

      {/* Warning box */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '8px',
          background: 'rgba(255, 213, 79, 0.1)',
          border: '2px solid var(--color-gold)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          {/* Warning icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p
            style={{
              margin: 0,
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            You must upload proof of residence before submitting your first report
          </p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onClick={handleBrowseClick}
        style={{
          border: `2px dashed ${isDragActive ? 'var(--color-teal)' : 'var(--border-subtle)'}`,
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          background: isDragActive ? 'rgba(130, 211, 192, 0.1)' : 'transparent',
          transition: 'all 0.3s ease',
          position: 'relative',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          disabled={isUploading}
          style={{ display: 'none' }}
        />

        {isUploading ? (
          <div>
            {/* Spinner */}
            <div
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 1rem',
                border: '4px solid rgba(255, 255, 255, 0.2)',
                borderTop: '4px solid var(--color-teal)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p
              style={{
                margin: 0,
                color: 'var(--text-primary)',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Uploading...
            </p>
          </div>
        ) : (
          <>
            {/* Upload icon */}
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto 1rem', display: 'block' }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>

            <p
              style={{
                margin: '0 0 0.5rem 0',
                color: 'var(--text-primary)',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              Drag & drop proof of residence here
            </p>
            <p
              style={{
                margin: 0,
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
              }}
            >
              or click to browse (PDF, JPG, PNG)
            </p>
          </>
        )}
      </div>

      {/* Accepted formats note */}
      <p
        style={{
          marginTop: '1rem',
          marginBottom: 0,
          color: 'var(--text-secondary)',
          fontSize: '0.85rem',
          lineHeight: 1.5,
        }}
      >
        <strong>Accepted:</strong> Utility bill, bank statement, lease agreement, rates notice (max 90 days old)
      </p>

      {/* Keyframes for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </GlassCard>
  );
}
