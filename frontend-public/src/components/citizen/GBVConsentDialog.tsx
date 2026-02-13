/**
 * GBVConsentDialog - Modal consent dialog for GBV/Abuse reports.
 *
 * Shows critical information about GBV report handling:
 * - Encryption and confidentiality
 * - SAPS notification
 * - Emergency contact numbers (10111, 0800 150 150)
 * - POPIA compliance
 *
 * Must be acknowledged before allowing GBV category selection.
 */

import React, { useEffect, useRef } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';

interface GBVConsentDialogProps {
  onAccept: () => void;
  onDecline: () => void;
}

export function GBVConsentDialog({ onAccept, onDecline }: GBVConsentDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button for accessibility
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="gbv-consent-overlay"
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <GlassCard
        variant="elevated"
        style={{
          maxWidth: '500px',
          width: '100%',
          padding: '32px',
        }}
      >
        <h2
          style={{
            margin: '0 0 16px 0',
            color: '#ff6b9d',
            fontSize: '1.5rem',
            fontWeight: 600,
          }}
        >
          GBV Report — Important Information
        </h2>

        <p style={{ margin: '0 0 16px 0', lineHeight: 1.6 }}>
          By submitting a gender-based violence report:
        </p>

        <ul style={{ margin: '0 0 24px 0', paddingLeft: '24px', lineHeight: 1.8 }}>
          <li>Your report will be securely encrypted and handled with strict confidentiality</li>
          <li>SAPS (South African Police Service) will be notified</li>
          <li>Only authorized SAPS liaison officers can access your details</li>
          <li>Your information is protected under POPIA</li>
        </ul>

        <div
          style={{
            padding: '16px',
            border: '2px solid #ff6b9d',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 107, 157, 0.1)',
            marginBottom: '24px',
          }}
        >
          <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#ff6b9d' }}>
            If you are in immediate danger, call these numbers NOW:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <a
              href="tel:10111"
              style={{
                color: '#fff',
                textDecoration: 'none',
                padding: '8px 12px',
                backgroundColor: 'rgba(255, 107, 157, 0.3)',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>Police Emergency:</span>
              <strong>10111</strong>
            </a>
            <a
              href="tel:0800150150"
              style={{
                color: '#fff',
                textDecoration: 'none',
                padding: '8px 12px',
                backgroundColor: 'rgba(255, 107, 157, 0.3)',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>GBV Command Centre:</span>
              <strong>0800 150 150</strong>
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onDecline}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAccept}
            style={{
              flex: 1,
              padding: '12px 24px',
              backgroundColor: '#ff6b9d',
              border: '1px solid #ff6b9d',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ff4d85';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff6b9d';
            }}
          >
            I Understand, Continue
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
