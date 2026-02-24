import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import type { Ticket } from '../../types/dashboard';

interface TicketTableProps {
  tickets: Ticket[];
  pageCount: number;
  pagination: PaginationState;
  sorting: SortingState;
  onPaginationChange: (updater: ((old: PaginationState) => PaginationState) | PaginationState) => void;
  onSortingChange: (updater: ((old: SortingState) => SortingState) | SortingState) => void;
  isLoading: boolean;
  onRowClick?: (ticket: Ticket) => void;
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'open': return 'var(--color-teal)';
    case 'in_progress': return '#FBBF24'; // amber
    case 'escalated': return 'var(--color-coral)';
    case 'resolved': return 'var(--color-teal)';
    case 'closed': return 'var(--text-muted)';
    default: return 'var(--text-muted)';
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
  } catch {
    return dateString;
  }
}

function isNearDeadline(deadline: string | null): boolean {
  if (!deadline) return false;
  try {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const hoursUntilDeadline = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilDeadline <= 24 && hoursUntilDeadline > 0;
  } catch {
    return false;
  }
}

export function TicketTable({
  tickets,
  pageCount,
  pagination,
  sorting,
  onPaginationChange,
  onSortingChange,
  isLoading,
  onRowClick,
}: TicketTableProps) {
  const columns = useMemo<ColumnDef<Ticket>[]>(
    () => [
      {
        accessorKey: 'tracking_number',
        header: 'Tracking #',
        enableSorting: false,
        cell: (info) => (
          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        enableSorting: true,
        cell: (info) => (
          <span style={{ textTransform: 'capitalize' }}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: true,
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <span
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.5rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'white',
                backgroundColor: getStatusBadgeColor(status),
                textTransform: 'capitalize',
              }}
            >
              {status.replace('_', ' ')}
            </span>
          );
        },
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        enableSorting: true,
        cell: (info) => (
          <span style={{ textTransform: 'capitalize' }}>
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        enableSorting: true,
        cell: (info) => formatDate(info.getValue() as string),
      },
      {
        accessorKey: 'sla_resolution_deadline',
        header: 'SLA Deadline',
        enableSorting: false,
        cell: (info) => {
          const deadline = info.getValue() as string | null;
          const isNear = isNearDeadline(deadline);
          return (
            <span style={{ color: isNear ? '#ef4444' : 'inherit', fontWeight: isNear ? '600' : 'normal' }}>
              {formatDate(deadline)}
            </span>
          );
        },
      },
      {
        accessorKey: 'address',
        header: 'Address',
        enableSorting: false,
        cell: (info) => {
          const address = info.getValue() as string | null;
          return (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {address || '-'}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: tickets,
    columns,
    pageCount,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  if (isLoading) {
    return (
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
        <SkeletonTheme>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--surface-elevated)' }}>
              <tr>
                {['Tracking #', 'Category', 'Status', 'Priority', 'Created', 'Updated', 'Deadline'].map((header, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, rowIndex) => (
                <tr key={rowIndex} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {Array.from({ length: 7 }).map((_, cellIndex) => (
                    <td key={cellIndex} style={{ padding: '0.75rem 1rem' }}>
                      <Skeleton height={20} width={cellIndex === 0 ? '120px' : cellIndex === 2 ? '80px' : '100%'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </SkeletonTheme>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        No tickets found
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: 'var(--surface-elevated)' }}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none',
                    borderBottom: '1px solid var(--glass-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <span style={{ opacity: 0.5 }}>
                        {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ' ↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              style={{
                borderBottom: '1px solid var(--glass-border)',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onClick={() => onRowClick?.(row.original)}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
