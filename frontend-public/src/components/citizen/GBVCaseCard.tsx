/**
 * SALGA Trust Engine — GBV Case Card Component
 * Privacy-preserving display for GBV tickets with limited info
 *
 * LOCKED DECISION: Shows ONLY status, assigned SAPS officer, station info, emergency numbers.
 * NO description, address, photos, or sensitive details.
 */

import React from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import type { CitizenTicket } from '../../hooks/useCitizenReports';

export interface GBVCaseCardProps {
  ticket: CitizenTicket;
}

export const GBVCaseCard: React.FC<GBVCaseCardProps> = ({ ticket }) => {
  const statusDisplay = ticket.status.replace('_', ' ').toUpperCase();

  return (
    <GlassCard
      variant="elevated"
      style={{
        padding: 'var(--spacing-lg)',
        borderLeft: '4px solid var(--color-coral)',
        background: 'linear-gradient(135deg, rgba(255, 107, 74, 0.05) 0%, rgba(10, 14, 26, 0.95) 100%)',
      }}
    >
      {/* Header with Lock Icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          {/* Shield/Alert Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-coral)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            <path d="M12 8v4" />
            <circle cx="12" cy="16" r="0.5" fill="var(--color-coral)" />
          </svg>
          <h3 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--color-coral)',
            margin: 0,
          }}>
            GBV Case (Private)
          </h3>
        </div>
        {/* Lock Icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      {/* Tracking Number */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-2xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Tracking Number
        </div>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          fontWeight: 600,
        }}>
          {ticket.tracking_number}
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-2xs)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Status
        </div>
        <div style={{
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          fontWeight: 600,
        }}>
          {statusDisplay}
        </div>
      </div>

      {/* Assigned SAPS Officer */}
      {ticket.assigned_officer_name && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-2xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Assigned SAPS Officer
          </div>
          <div style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
          }}>
            {ticket.assigned_officer_name}
          </div>
        </div>
      )}

      {/* Police Station */}
      {ticket.station_name && (
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-2xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Police Station
          </div>
          <div style={{
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
          }}>
            {ticket.station_name}
          </div>
        </div>
      )}

      {/* Station Phone */}
      {ticket.station_phone && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-2xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Contact
          </div>
          <a
            href={`tel:${ticket.station_phone}`}
            style={{
              fontSize: 'var(--text-base)',
              color: 'var(--color-teal)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {ticket.station_phone}
          </a>
        </div>
      )}

      {/* Emergency Contacts Section */}
      <div style={{
        marginTop: 'var(--spacing-lg)',
        padding: 'var(--spacing-md)',
        background: 'rgba(255, 107, 74, 0.1)',
        border: '1px solid rgba(255, 107, 74, 0.3)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div style={{
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          color: 'var(--color-coral)',
          marginBottom: 'var(--spacing-sm)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Emergency Contacts
        </div>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Police: </span>
            <a
              href="tel:10111"
              style={{
                color: 'var(--color-teal)',
                fontWeight: 600,
                fontSize: 'var(--text-base)',
                textDecoration: 'none',
              }}
            >
              10111
            </a>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>GBV Helpline: </span>
            <a
              href="tel:0800150150"
              style={{
                color: 'var(--color-teal)',
                fontWeight: 600,
                fontSize: 'var(--text-base)',
                textDecoration: 'none',
              }}
            >
              0800 150 150
            </a>
          </div>
        </div>
      </div>

      {/* Privacy Explanation */}
      <div style={{ marginTop: 'var(--spacing-md)' }}>
        <Button
          variant="ghost"
          size="sm"
          disabled
          style={{
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Details Hidden for Privacy
        </Button>
      </div>
    </GlassCard>
  );
};
