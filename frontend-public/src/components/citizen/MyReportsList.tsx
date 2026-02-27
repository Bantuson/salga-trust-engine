/**
 * SALGA Trust Engine — My Reports List Component
 * Displays citizen's tickets with filter tabs and conditional rendering for GBV privacy
 */

import React, { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { TicketCard } from './TicketCard';
import { GBVCaseCard } from './GBVCaseCard';
import type { CitizenTicket } from '../../hooks/useCitizenReports';

export interface MyReportsListProps {
  reports: CitizenTicket[];
  loading?: boolean;
}

export const MyReportsList: React.FC<MyReportsListProps> = ({ reports, loading }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Filter reports based on active tab
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
        <p style={{ color: '#555', fontSize: '0.875rem' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: 'var(--spacing-sm)',
        width: '100%',
      }}>
        <button
          onClick={() => setActiveFilter('all')}
          className="filter-tab"
          style={{
            flex: 1,
            padding: '10px 16px',
            background: activeFilter === 'all' ? 'rgba(0, 217, 166, 0.2)' : 'transparent',
            color: activeFilter === 'all' ? 'var(--color-teal)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-base)',
          }}
        >
          All Reports
        </button>
        <button
          onClick={() => setActiveFilter('open')}
          className="filter-tab"
          style={{
            flex: 1,
            padding: '10px 16px',
            background: activeFilter === 'open' ? 'rgba(0, 217, 166, 0.2)' : 'transparent',
            color: activeFilter === 'open' ? 'var(--color-teal)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-base)',
          }}
        >
          Open
        </button>
        <button
          onClick={() => setActiveFilter('resolved')}
          className="filter-tab"
          style={{
            flex: 1,
            padding: '10px 16px',
            background: activeFilter === 'resolved' ? 'rgba(0, 217, 166, 0.2)' : 'transparent',
            color: activeFilter === 'resolved' ? 'var(--color-teal)' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-base)',
          }}
        >
          Resolved
        </button>
      </div>

      {/* Empty State */}
      {filteredReports.length === 0 && (
        <GlassCard variant="default" className="empty-state-card" style={{
          padding: 'var(--spacing-xl)',
          textAlign: 'center',
          marginTop: '0px',
          minHeight: '360px',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: '0 auto var(--spacing-lg)' }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h3 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 600,
            color: '#1a1a1a',
            margin: '0 0 var(--spacing-md)',
          }}>
            {activeFilter === 'all' ? 'No reports yet' : `No ${activeFilter} reports`}
          </h3>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: '#555',
            margin: 0,
          }}>
            {activeFilter === 'all'
              ? 'Report your first issue to get started.'
              : `You don't have any ${activeFilter} reports at the moment.`}
          </p>
        </GlassCard>
      )}

      {/* Tickets List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}>
        {filteredReports.map((ticket) => (
          <React.Fragment key={ticket.tracking_number}>
            {ticket.is_sensitive ? (
              <GBVCaseCard ticket={ticket} />
            ) : (
              <TicketCard ticket={ticket} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
