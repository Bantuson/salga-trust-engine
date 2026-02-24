/**
 * CompletedTicketsPage — Read-only list of resolved/closed tickets for field workers.
 *
 * Shows tickets completed in the last 30 days.
 * Reuses TicketTable in read-only mode (no onRowClick actions, just detail view).
 */

import { useState, useEffect, useCallback } from 'react';
import type { SortingState, PaginationState } from '@tanstack/react-table';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { fetchTickets } from '../services/api';
import { TicketTable } from '../components/dashboard/TicketTable';
import { TicketDetailModal } from '../components/dashboard/TicketDetailModal';
import type { Ticket } from '../types/dashboard';

export function CompletedTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetchTickets({
        status: 'resolved',
        page: pagination.pageIndex,
        page_size: pagination.pageSize,
        sort_by: sorting[0]?.id ?? 'created_at',
        sort_order: sorting[0]?.desc ? 'desc' : 'asc',
      });
      setTickets(response.tickets);
      setPageCount(response.page_count);
    } catch (err) {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, sorting]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Completed Tickets</h1>
        <span style={styles.subtitle}>Resolved tickets assigned to you</span>
      </header>

      <GlassCard variant="default" style={{ padding: '1.5rem' }}>
        <TicketTable
          tickets={tickets}
          pageCount={pageCount}
          pagination={pagination}
          sorting={sorting}
          onPaginationChange={setPagination}
          onSortingChange={setSorting}
          isLoading={isLoading}
          onRowClick={(ticket) => setSelectedTicket(ticket)}
        />
      </GlassCard>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
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
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
};
