/**
 * FieldWorkerTicketsPage — Card-based view of tickets assigned to the current field worker.
 *
 * Mobile-friendly card layout (not table) showing:
 * - Tracking #, category, severity, status, address, SLA deadline
 * - Filter pills: All, Open, In Progress, Escalated
 * - Click card -> TicketDetailModal with field worker action panel
 *
 * Data source: fetchTickets() — backend auto-filters by assigned_to = current_user.id
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { fetchTickets } from '../services/api';
import { TicketDetailModal } from '../components/dashboard/TicketDetailModal';
import type { Ticket } from '../types/dashboard';

type FilterStatus = 'all' | 'open' | 'in_progress' | 'escalated';

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return 'var(--color-teal)';
    case 'in_progress': return '#FBBF24';
    case 'escalated': return 'var(--color-coral)';
    case 'resolved': return 'var(--color-teal)';
    case 'closed': return 'var(--text-muted)';
    default: return 'var(--text-muted)';
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high': return 'var(--color-coral)';
    case 'medium': return '#FBBF24';
    case 'low': return 'var(--color-teal)';
    default: return 'var(--text-muted)';
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'MMM dd, HH:mm');
  } catch {
    return dateString;
  }
}

function isNearDeadline(deadline: string | null): boolean {
  if (!deadline) return false;
  try {
    const d = new Date(deadline);
    const now = new Date();
    const hours = (d.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hours <= 24 && hours > 0;
  } catch {
    return false;
  }
}

export function FieldWorkerTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      // Backend auto-filters by assigned_to for field workers
      const response = await fetchTickets({ page: 0, page_size: 200 });
      setTickets(response.tickets);
    } catch (err) {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    if (activeFilter === 'all') return tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed');
    return tickets.filter(t => t.status === activeFilter);
  }, [tickets, activeFilter]);

  const filters: { key: FilterStatus; label: string; count: number }[] = useMemo(() => [
    { key: 'all', label: 'Active', count: tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length },
    { key: 'open', label: 'Open', count: tickets.filter(t => t.status === 'open').length },
    { key: 'in_progress', label: 'In Progress', count: tickets.filter(t => t.status === 'in_progress').length },
    { key: 'escalated', label: 'Escalated', count: tickets.filter(t => t.status === 'escalated').length },
  ], [tickets]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>My Tickets</h1>
        <span style={styles.count}>{filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}</span>
      </header>

      {/* Filter pills */}
      <div style={styles.filterRow}>
        {filters.map(f => (
          <button
            key={f.key}
            style={activeFilter === f.key ? styles.filterPillActive : styles.filterPill}
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <SkeletonTheme>
          <div style={styles.cardGrid}>
            {[0, 1, 2, 3].map(i => (
              <GlassCard key={i} variant="default" style={{ padding: '1.25rem' }}>
                <Skeleton height={16} width="60%" style={{ marginBottom: '0.75rem' }} />
                <Skeleton height={12} width="40%" style={{ marginBottom: '0.5rem' }} />
                <Skeleton height={12} width="80%" />
              </GlassCard>
            ))}
          </div>
        </SkeletonTheme>
      )}

      {/* Empty state */}
      {!isLoading && filteredTickets.length === 0 && (
        <GlassCard variant="default" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            No tickets assigned to you{activeFilter !== 'all' ? ` with status "${activeFilter.replace('_', ' ')}"` : ''}.
          </p>
        </GlassCard>
      )}

      {/* Ticket cards */}
      {!isLoading && filteredTickets.length > 0 && (
        <div style={styles.cardGrid}>
          {filteredTickets.map(ticket => (
            <GlassCard
              key={ticket.id}
              variant="interactive"
              glow="teal"
              onClick={() => setSelectedTicket(ticket)}
              style={{ padding: '1.25rem' }}
            >
              {/* Card header */}
              <div style={styles.cardHeader}>
                <span style={styles.trackingNumber}>{ticket.tracking_number}</span>
                <span style={{ ...styles.badge, backgroundColor: getStatusColor(ticket.status) }}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </div>

              {/* Category + severity */}
              <div style={styles.cardMeta}>
                <span style={styles.category}>{ticket.category}</span>
                <span style={{ ...styles.severityDot, backgroundColor: getSeverityColor(ticket.severity) }} />
                <span style={styles.severity}>{ticket.severity}</span>
              </div>

              {/* Address */}
              {ticket.address && (
                <p style={styles.address}>{ticket.address}</p>
              )}

              {/* Footer: date + SLA */}
              <div style={styles.cardFooter}>
                <span style={styles.dateText}>{formatDate(ticket.created_at)}</span>
                {ticket.sla_resolution_deadline && (
                  <span style={{
                    ...styles.dateText,
                    color: isNearDeadline(ticket.sla_resolution_deadline) ? '#ef4444' : 'var(--text-muted)',
                    fontWeight: isNearDeadline(ticket.sla_resolution_deadline) ? '600' : '400',
                  }}>
                    SLA: {formatDate(ticket.sla_resolution_deadline)}
                  </span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={loadTickets}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,
  count: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  filterRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  filterPill: {
    padding: '0.4rem 0.875rem',
    borderRadius: '9999px',
    border: '1px solid var(--glass-border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontWeight: '500' as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  filterPillActive: {
    padding: '0.4rem 0.875rem',
    borderRadius: '9999px',
    border: '1px solid var(--color-teal)',
    background: 'rgba(0, 191, 165, 0.15)',
    color: 'var(--color-teal)',
    fontSize: '0.8125rem',
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem',
  } as React.CSSProperties,
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.625rem',
  } as React.CSSProperties,
  trackingNumber: {
    fontFamily: 'monospace',
    fontWeight: '600' as const,
    fontSize: '0.9375rem',
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: '600' as const,
    color: 'white',
    textTransform: 'capitalize' as const,
  } as React.CSSProperties,
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  category: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    textTransform: 'capitalize' as const,
    fontWeight: '500' as const,
  } as React.CSSProperties,
  severityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginLeft: '0.25rem',
  } as React.CSSProperties,
  severity: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    textTransform: 'capitalize' as const,
  } as React.CSSProperties,
  address: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    margin: '0 0 0.5rem 0',
    lineHeight: '1.4',
  } as React.CSSProperties,
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.5rem',
    borderTop: '1px solid var(--glass-border)',
  } as React.CSSProperties,
  dateText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
};
