/**
 * SALGA Trust Engine — Ticket Card Component
 * Compact card for responsive grid display of regular municipal tickets
 */

import React from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Badge, TicketStatus } from '@shared/components/ui/Badge';
import type { CitizenTicket } from '../../hooks/useCitizenReports';

export interface TicketCardProps {
  ticket: CitizenTicket;
  onViewDetails?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, onViewDetails }) => {
  const getRelativeDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  const formatCategory = (category: string | undefined): string => {
    if (!category) return 'General';
    return category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getBadgeStatus = (status: string): TicketStatus => {
    const map: Record<string, TicketStatus> = {
      open: 'open', in_progress: 'in_progress', escalated: 'escalated',
      resolved: 'resolved', closed: 'closed',
    };
    return map[status] || 'open';
  };

  const getSeverityStyle = (sev: string) => {
    if (sev === 'high') return { bg: 'rgba(255, 107, 74, 0.25)', color: '#FF8A6A' };
    if (sev === 'medium') return { bg: 'rgba(251, 191, 36, 0.25)', color: '#FCD34D' };
    return { bg: 'rgba(156, 163, 175, 0.2)', color: '#B0B8C4' };
  };

  return (
    <GlassCard
      variant="interactive"
      onClick={onViewDetails}
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        cursor: 'pointer',
      }}
    >
      {/* Row 1: Category + Status Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <h3 style={{
          fontSize: '1.0625rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          {formatCategory(ticket.category)}
        </h3>
        <Badge status={getBadgeStatus(ticket.status)} />
      </div>

      {/* Row 2: Address (single line, truncated) */}
      {ticket.address && (
        <div style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflow: 'hidden',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {ticket.address}
          </span>
        </div>
      )}

      {/* Row 3: Metadata pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '14px',
      }}>
        {/* Date chip */}
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {getRelativeDate(ticket.created_at)}
        </span>

        {/* Severity chip */}
        {ticket.severity && (() => {
          const s = getSeverityStyle(ticket.severity);
          return (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '1px 8px',
              borderRadius: '9999px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              background: s.bg,
              color: s.color,
            }}>
              {ticket.severity}
            </span>
          );
        })()}

        {/* Attachments */}
        {ticket.media_count && ticket.media_count > 0 && (
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {ticket.media_count}
          </span>
        )}
      </div>

      {/* Spacer to push assignment + button to bottom */}
      <div style={{ flex: 1 }} />

      {/* Row 4: Assignment (compact) */}
      <div style={{
        marginBottom: '12px',
        padding: '8px 10px',
        background: 'rgba(0, 191, 165, 0.1)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(0, 191, 165, 0.25)',
        fontSize: '0.8125rem',
        minHeight: '36px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        {ticket.assigned_to_name ? (
          <div style={{ fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
            {ticket.assigned_to_name}
          </div>
        ) : (
          <div style={{ fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.3, fontStyle: 'italic' }}>
            Unassigned
          </div>
        )}
        {ticket.assigned_team_name && (
          <div style={{ color: '#d0e8e4', fontSize: '0.75rem', lineHeight: 1.3, fontWeight: 500 }}>
            {ticket.assigned_team_name}
          </div>
        )}
      </div>

      {/* Row 5: Tracking number + View Details link */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
      }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: '0.6875rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.02em',
        }}>
          {ticket.tracking_number}
        </span>
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: '#00F0B8',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 10px',
          borderRadius: '9999px',
          background: 'rgba(0, 191, 165, 0.15)',
        }}>
          Details
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </GlassCard>
  );
};
