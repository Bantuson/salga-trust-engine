/**
 * SALGA Trust Engine — My Reports List Component
 * Responsive grid of citizen tickets with filter tabs and GBV privacy
 */

import React, { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { TicketCard } from './TicketCard';
import { GBVCaseCard } from './GBVCaseCard';
import { ReportDetailModal } from './ReportDetailModal';
import type { CitizenTicket } from '../../hooks/useCitizenReports';

export interface MyReportsListProps {
  reports: CitizenTicket[];
  loading?: boolean;
}

const filters = [
  { key: 'all' as const, label: 'All Reports' },
  { key: 'open' as const, label: 'Open' },
  { key: 'resolved' as const, label: 'Resolved' },
];

export const MyReportsList: React.FC<MyReportsListProps> = ({ reports, loading }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedTicket, setSelectedTicket] = useState<CitizenTicket | null>(null);

  const filteredReports = reports.filter((ticket) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'open') {
      return ticket.status === 'open' || ticket.status === 'in_progress' || ticket.status === 'escalated';
    }
    if (activeFilter === 'resolved') {
      return ticket.status === 'resolved' || ticket.status === 'closed';
    }
    return true;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px', gap: '12px' }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid rgba(0,0,0,0.1)',
          borderTopColor: 'var(--color-teal)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading your reports...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs — pill style */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '24px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-md)',
        padding: '4px',
      }}>
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: activeFilter === key ? 'rgba(0, 191, 165, 0.2)' : 'transparent',
              color: activeFilter === key ? 'var(--color-teal)' : 'var(--text-secondary)',
              border: activeFilter === key ? '1px solid rgba(0, 191, 165, 0.3)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
              fontFamily: 'inherit',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <GlassCard variant="default" style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginBottom: '16px', opacity: 0.6 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 8px',
          }}>
            {activeFilter === 'all' ? 'No reports yet' : `No ${activeFilter} reports`}
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            margin: 0,
          }}>
            {activeFilter === 'all'
              ? 'Report your first issue to get started.'
              : `You don't have any ${activeFilter} reports at the moment.`}
          </p>
        </GlassCard>
      )}

      {/* Responsive Card Grid */}
      {filteredReports.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {filteredReports.map((ticket) => (
            <React.Fragment key={ticket.tracking_number}>
              {ticket.is_sensitive ? (
                <GBVCaseCard ticket={ticket} />
              ) : (
                <TicketCard ticket={ticket} onViewDetails={() => setSelectedTicket(ticket)} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedTicket && (
        <ReportDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
};
