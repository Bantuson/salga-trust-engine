/**
 * SALGA Trust Engine — GBV Case Card Component
 * Privacy-preserving display for GBV tickets with limited info
 *
 * LOCKED DECISION: Shows ONLY status, assigned SAPS officer, station info, emergency numbers.
 * NO description, address, photos, or sensitive details.
 */

import React from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
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
        padding: '20px',
        borderLeft: '4px solid var(--color-coral)',
        background: 'linear-gradient(135deg, rgba(255, 107, 74, 0.05) 0%, rgba(205, 94, 129, 0.95) 100%)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with Lock Icon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-coral)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            <path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="var(--color-coral)" />
          </svg>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-coral)', margin: 0 }}>
            GBV Case (Private)
          </h3>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <InfoRow label="Tracking Number" value={ticket.tracking_number} mono />
        <InfoRow label="Status" value={statusDisplay} bold />
        {ticket.assigned_officer_name && <InfoRow label="SAPS Officer" value={ticket.assigned_officer_name} />}
        {ticket.station_name && <InfoRow label="Station" value={ticket.station_name} />}
        {ticket.station_phone && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={labelStyle}>Contact</span>
            <a href={`tel:${ticket.station_phone}`} style={{ fontSize: '0.875rem', color: 'var(--color-teal)', textDecoration: 'none', fontWeight: 600 }}>
              {ticket.station_phone}
            </a>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Emergency Contacts */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(255, 107, 74, 0.1)',
        border: '1px solid rgba(255, 107, 74, 0.25)',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '10px',
      }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-coral)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
          Emergency Contacts
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
          <span>
            <span style={{ color: 'var(--text-secondary)' }}>Police: </span>
            <a href="tel:10111" style={{ color: 'var(--color-teal)', fontWeight: 600, textDecoration: 'none' }}>10111</a>
          </span>
          <span>
            <span style={{ color: 'var(--text-secondary)' }}>GBV: </span>
            <a href="tel:0800150150" style={{ color: 'var(--color-teal)', fontWeight: 600, textDecoration: 'none' }}>0800 150 150</a>
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'var(--text-muted)',
        fontSize: '0.75rem',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        Details hidden for privacy
      </div>
    </GlassCard>
  );
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

function InfoRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={labelStyle}>{label}</span>
      <span style={{
        fontSize: '0.875rem',
        color: 'var(--text-primary)',
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}
