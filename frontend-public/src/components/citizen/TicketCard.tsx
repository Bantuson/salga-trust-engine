/**
 * SALGA Trust Engine — Ticket Card Component
 * Full details card for regular municipal tickets (non-GBV)
 */

import React from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Badge, TicketStatus } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import type { CitizenTicket } from '../../hooks/useCitizenReports';

export interface TicketCardProps {
  ticket: CitizenTicket;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket }) => {
  // Format relative date
  const getRelativeDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown date';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  // Format category for display
  const formatCategory = (category: string | undefined): string => {
    if (!category) return 'General';
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Map status string to Badge status type
  const getBadgeStatus = (status: string): TicketStatus => {
    const statusMap: Record<string, TicketStatus> = {
      'open': 'open',
      'in_progress': 'in_progress',
      'escalated': 'escalated',
      'resolved': 'resolved',
      'closed': 'closed',
    };
    return statusMap[status] || 'open';
  };

  return (
    <GlassCard
      variant="interactive"
      style={{
        padding: 'var(--spacing-lg)',
      }}
    >
      {/* Header Row: Tracking Number + Status Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
        flexWrap: 'wrap',
        gap: 'var(--spacing-sm)',
      }}>
        <div style={{
          fontFamily: 'monospace',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}>
          {ticket.tracking_number}
        </div>
        <Badge status={getBadgeStatus(ticket.status)} />
      </div>

      {/* Category Title */}
      <h3 style={{
        fontSize: 'var(--text-xl)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: 0,
        marginBottom: 'var(--spacing-sm)',
      }}>
        {formatCategory(ticket.category)}
      </h3>

      {/* Address */}
      {ticket.address && (
        <div style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-xs)',
        }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {ticket.address}
          </span>
        </div>
      )}

      {/* Metadata Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        marginBottom: 'var(--spacing-md)',
        flexWrap: 'wrap',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)',
      }}>
        {/* Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {getRelativeDate(ticket.created_at)}
        </div>

        {/* Severity */}
        {ticket.severity && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            background: ticket.severity === 'high' ? 'rgba(255, 107, 74, 0.2)'
              : ticket.severity === 'medium' ? 'rgba(251, 191, 36, 0.2)'
              : 'rgba(156, 163, 175, 0.2)',
            color: ticket.severity === 'high' ? 'var(--color-coral)'
              : ticket.severity === 'medium' ? '#FBBF24'
              : 'var(--text-secondary)',
          }}>
            {ticket.severity}
          </div>
        )}

        {/* Media Count */}
        {ticket.media_count && ticket.media_count > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            {ticket.media_count} {ticket.media_count === 1 ? 'attachment' : 'attachments'}
          </div>
        )}
      </div>

      {/* Assignment Info */}
      {(ticket.assigned_to_name || ticket.assigned_team_name) && (
        <div style={{
          marginBottom: 'var(--spacing-md)',
          padding: 'var(--spacing-sm)',
          background: 'rgba(0, 217, 166, 0.05)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(0, 217, 166, 0.2)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-2xs)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Assigned To
          </div>
          <div style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
          }}>
            {ticket.assigned_to_name && <div style={{ fontWeight: 600 }}>{ticket.assigned_to_name}</div>}
            {ticket.assigned_team_name && <div style={{ color: 'var(--text-secondary)' }}>{ticket.assigned_team_name}</div>}
          </div>
        </div>
      )}

      {/* View Details Button */}
      <div style={{ marginTop: 'var(--spacing-md)' }}>
        <Button variant="ghost" size="sm" style={{ width: '100%' }}>
          View Details
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
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Button>
      </div>
    </GlassCard>
  );
};
