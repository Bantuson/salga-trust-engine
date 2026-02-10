import { useState, useEffect, useCallback } from 'react';
import type { SortingState, PaginationState } from '@tanstack/react-table';
import { fetchTickets } from '../services/api';
import { useTicketFilters } from '../hooks/useTicketFilters';
import type { Ticket } from '../types/dashboard';
import { FilterBar } from '../components/dashboard/FilterBar';
import { TicketTable } from '../components/dashboard/TicketTable';
import { Pagination } from '../components/dashboard/Pagination';
import { ExportButton } from '../components/dashboard/ExportButton';

export function TicketListPage() {
  const { filters, updateFilter, resetFilters } = useTicketFilters();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch tickets whenever filters change
  useEffect(() => {
    async function loadTickets() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchTickets(filters);
        setTickets(response.tickets);
        setPageCount(response.page_count);
      } catch (err) {
        console.error('[TicketListPage] Failed to fetch tickets:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tickets');
        setTickets([]);
        setPageCount(0);
      } finally {
        setIsLoading(false);
      }
    }

    loadTickets();
  }, [filters]);

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
        <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#111827', margin: 0 }}>
          Ticket Management
        </h1>
        <ExportButton filters={filters} />
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            color: '#991b1b',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

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
      />

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
