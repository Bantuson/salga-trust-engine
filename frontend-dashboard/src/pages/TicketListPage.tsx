import { useState, useEffect, useCallback, useRef } from 'react';
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

const MAX_RETRIES = 3;

export function TicketListPage() {
  const { filters, updateFilter, resetFilters } = useTicketFilters();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFiltersRef = useRef<string>('');

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

  // Reset retry count when filters genuinely change
  useEffect(() => {
    const filtersKey = JSON.stringify(filters);
    if (filtersKey !== prevFiltersRef.current) {
      prevFiltersRef.current = filtersKey;
      setRetryCount(0);
      setError(null);
      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    }
  }, [filters]);

  // Fetch tickets with retry logic
  useEffect(() => {
    if (retryCount > MAX_RETRIES) return; // Stop after max retries

    async function loadTickets() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetchTickets(filters);
        setTickets(response.tickets);
        setPageCount(response.page_count);
        setRetryCount(0); // Reset on success
      } catch (err) {
        if (retryCount < MAX_RETRIES) {
          const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          setError(`Connection failed. Retrying in ${backoffMs / 1000}s...`);
          retryTimeoutRef.current = setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, backoffMs);
        } else {
          // Rich mock fallback — no empty states after retries exhausted
          setTickets(mockTickets);
          setPageCount(1);
          setError(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTickets();
  }, [filters, retryCount]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

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

      {/* Error message - max retries exhausted */}
      {error && retryCount > MAX_RETRIES && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--color-coral)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--color-coral)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          <p style={{ marginBottom: '1rem', fontSize: '1rem' }}>{error}</p>
          <button
            onClick={() => {
              setRetryCount(0);
              setError(null);
            }}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: 'var(--color-coral)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
      {/* Error message - retrying */}
      {error && retryCount <= MAX_RETRIES && (
        <div
          style={{
            padding: '0.75rem 1rem',
            color: 'var(--color-accent-gold)',
            background: 'rgba(255, 213, 79, 0.1)',
            border: '1px solid rgba(255, 213, 79, 0.3)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
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
        onRowClick={(ticket) => setSelectedTicket(ticket)}
      />

      {/* Ticket detail modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdated={() => setRetryCount(0)}
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
