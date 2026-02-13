/**
 * ReportReceipt - Post-submission success card for citizen reports.
 *
 * Shows glassmorphic receipt with:
 * - Tracking number (monospace/code font)
 * - Category and description summary
 * - Expected response time
 * - WhatsApp notification opt-in (separate checkbox per WhatsApp Business Policy)
 * - Two CTAs: Submit Another Report, View My Reports
 */

import React, { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';

interface ReportReceiptProps {
  trackingNumber: string;
  category: string;
  description: string;
  expectedResponseTime: string;
  onSubmitAnother: () => void;
  onViewReports: () => void;
}

export function ReportReceipt({
  trackingNumber,
  category,
  description,
  expectedResponseTime,
  onSubmitAnother,
  onViewReports,
}: ReportReceiptProps) {
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);

  // Truncate description to 100 characters
  const truncatedDescription =
    description.length > 100 ? description.substring(0, 100) + '...' : description;

  return (
    <GlassCard
      variant="elevated"
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px 32px',
        textAlign: 'center',
      }}
    >
      {/* Success checkmark icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 24px',
          borderRadius: '50%',
          backgroundColor: 'rgba(77, 208, 225, 0.2)',
          border: '3px solid #4dd0e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4dd0e1"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Title */}
      <h2
        style={{
          margin: '0 0 8px 0',
          fontSize: '1.75rem',
          fontWeight: 600,
          color: '#fff',
        }}
      >
        Report Submitted Successfully
      </h2>

      {/* Subtitle */}
      <p
        style={{
          margin: '0 0 32px 0',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '1rem',
        }}
      >
        Your issue has been logged and assigned to the relevant municipality
      </p>

      {/* Info rows */}
      <div
        style={{
          textAlign: 'left',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Tracking Number */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '4px',
            }}
          >
            Tracking Number
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#4dd0e1',
              letterSpacing: '0.5px',
            }}
          >
            {trackingNumber}
          </div>
        </div>

        {/* Category */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '4px',
            }}
          >
            Category
          </div>
          <div style={{ fontSize: '1rem', color: '#fff' }}>{category}</div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '4px',
            }}
          >
            Description
          </div>
          <div style={{ fontSize: '1rem', color: '#fff', lineHeight: 1.5 }}>
            {truncatedDescription}
          </div>
        </div>

        {/* Expected Response */}
        <div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '4px',
            }}
          >
            Expected Response
          </div>
          <div style={{ fontSize: '1rem', color: '#ffd54f', fontWeight: 500 }}>
            {expectedResponseTime}
          </div>
        </div>
      </div>

      {/* WhatsApp opt-in section */}
      <div
        style={{
          marginBottom: '32px',
          padding: '16px',
          backgroundColor: 'rgba(77, 208, 225, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(77, 208, 225, 0.3)',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <input
            type="checkbox"
            checked={whatsappOptIn}
            onChange={(e) => setWhatsappOptIn(e.target.checked)}
            style={{
              marginTop: '4px',
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            }}
          />
          <span style={{ flex: 1, fontSize: '0.95rem', lineHeight: 1.5 }}>
            <span style={{ marginRight: '8px' }}>📱</span>
            Receive WhatsApp notifications for status updates on this report
          </span>
        </label>
      </div>

      {/* CTAs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="secondary"
          onClick={onSubmitAnother}
          style={{
            flex: '1 1 200px',
          }}
        >
          Submit Another Report
        </Button>
        <Button
          variant="primary"
          onClick={onViewReports}
          style={{
            flex: '1 1 200px',
          }}
        >
          View My Reports
        </Button>
      </div>
    </GlassCard>
  );
}
