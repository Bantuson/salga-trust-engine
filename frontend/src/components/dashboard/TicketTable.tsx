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
import type { Ticket } from '../../types/dashboard';

interface TicketTableProps {
  tickets: Ticket[];
  pageCount: number;
  pagination: PaginationState;
  sorting: SortingState;
  onPaginationChange: (updater: ((old: PaginationState) => PaginationState) | PaginationState) => void;
  onSortingChange: (updater: ((old: SortingState) => SortingState) | SortingState) => void;
  isLoading: boolean;
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'open': return '#3b82f6'; // blue
    case 'in_progress': return '#f59e0b'; // amber
    case 'escalated': return '#ef4444'; // red
    case 'resolved': return '#10b981'; // green
    case 'closed': return '#6b7280'; // gray
    default: return '#9ca3af'; // gray-400
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
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
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
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading tickets...
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        No tickets found
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: '#f9fafb' }}>
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
                    color: '#6b7280',
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none',
                    borderBottom: '1px solid #e5e7eb',
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
                borderBottom: '1px solid #e5e7eb',
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    color: '#111827',
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
