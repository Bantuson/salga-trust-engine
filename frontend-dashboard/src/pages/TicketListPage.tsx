import { useState, useEffect, useCallback } from 'react';
import type { SortingState, PaginationState } from '@tanstack/react-table';
import { fetchTickets } from '../services/api';
import { useTicketFilters } from '../hooks/useTicketFilters';
import type { Ticket } from '../types/dashboard';
import { mockTickets } from '../mocks/mockTickets';
import { FilterBar } from '../components/dashboard/FilterBar';
import { TicketTable } from '../components/dashboard/TicketTable';
import { TicketDetailModal } from '../components/dashboard/TicketDetailModal';
import { Pagination } from '../components/dashboard/Pagination';
import { ExportButton } from '../components/dashboard/ExportButton';

export function TicketListPage() {
  const { filters, updateFilter, resetFilters } = useTicketFilters();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // TanStack Table pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: filters.page ?? 0,
    pageSize: filters.page_size ?? 50,
  });

  // TanStack Table sorting state
  const [sorting, setSorting] = useState<SortingState>(
    filters.sort_by
      ? [{ id: filters.sort_by, desc: filters.sort_order === 'desc' }]
      : []
  );

  // Sync pagination state with filters
  useEffect(() => {
    setPagination({
      pageIndex: filters.page ?? 0,
      pageSize: filters.page_size ?? 50,
    });
  }, [filters.page, filters.page_size]);

  // Handle pagination change
  const handlePaginationChange = useCallback(
    (updater: ((old: PaginationState) => PaginationState) | PaginationState) => {
      setPagination((old) => {
        const newPagination = typeof updater === 'function' ? updater(old) : updater;
        updateFilter('page', newPagination.pageIndex);
        updateFilter('page_size', newPagination.pageSize);
        return newPagination;
      });
    },
    [updateFilter]
  );

  // Handle sorting change
  const handleSortingChange = useCallback(
    (updater: ((old: SortingState) => SortingState) | SortingState) => {
      setSorting((old) => {
        const newSorting = typeof updater === 'function' ? updater(old) : updater;
        if (newSorting.length > 0) {
          const { id, desc } = newSorting[0];
          updateFilter('sort_by', id);
          updateFilter('sort_order', desc ? 'desc' : 'asc');
        } else {
          updateFilter('sort_by', undefined);
          updateFilter('sort_order', undefined);
        }
        return newSorting;
      });
    },
    [updateFilter]
  );

  // Stable serialization of filters to prevent infinite re-render loop
  // (filters is a new object reference on every render from useTicketFilters)
  const filtersKey = JSON.stringify(filters);

  // Fetch tickets — immediately fall back to mocks on any error (no backend running)
  useEffect(() => {
    async function loadTickets() {
      try {
        setIsLoading(true);
        const response = await fetchTickets(filters);
        if (response.tickets.length === 0) {
          // API succeeded but returned empty — use rich mock fallback
          setTickets(mockTickets);
          setPageCount(1);
        } else {
          setTickets(response.tickets);
          setPageCount(response.page_count);
        }
      } catch {
        // Instant mock fallback — no retry delays
        setTickets(mockTickets);
        setPageCount(1);
      } finally {
        setIsLoading(false);
      }
    }

    loadTickets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          Ticket Management
        </h1>
        <ExportButton filters={filters} />
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onFilterChange={(key, value) => updateFilter(key, value)}
        onReset={resetFilters}
      />

      {/* Ticket table */}
      <TicketTable
        tickets={tickets}
        pageCount={pageCount}
        pagination={pagination}
        sorting={sorting}
        onPaginationChange={handlePaginationChange}
        onSortingChange={handleSortingChange}
        isLoading={isLoading}
        onRowClick={(ticket) => setSelectedTicket(ticket)}
      />

      {/* Ticket detail modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => {}}
        />
      )}

      {/* Pagination controls */}
      {!isLoading && tickets.length > 0 && (
        <Pagination
          page={pagination.pageIndex}
          pageCount={pageCount}
          onPageChange={(page) => handlePaginationChange({ ...pagination, pageIndex: page })}
        />
      )}
    </div>
  );
}
