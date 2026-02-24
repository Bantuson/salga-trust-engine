/**
 * AuditLogSection — Inline paginated audit log viewer.
 *
 * Admin-only section (visibility gated by SettingsPage).
 * Displays last 50 audit entries in a scrollable table.
 * Supports filter by table_name and operation.
 * "Load More" appends additional pages.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { SettingsSection } from './SettingsSection';
import { GlassSelect } from './GlassSelect';
import { fetchAuditLogs } from '../../services/api';
import type { AuditLogEntry } from '../../types/settings';

const PAGE_SIZE = 50;

const OPERATION_COLORS: Record<string, { bg: string; color: string }> = {
  CREATE: { bg: 'rgba(129, 199, 132, 0.15)', color: '#81c784' },
  UPDATE: { bg: 'rgba(255, 213, 79, 0.15)', color: '#ffd54f' },
  DELETE: { bg: 'rgba(229, 115, 115, 0.15)', color: '#e57373' },
  READ:   { bg: 'rgba(100, 181, 246, 0.15)', color: '#64b5f6' },
};

const TABLE_OPTIONS = [
  '', 'tickets', 'users', 'teams', 'sla_configs', 'municipalities',
  'media_attachments', 'ticket_assignments',
];

const OPERATION_OPTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'READ'];

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [filterTable, setFilterTable] = useState('');
  const [filterOperation, setFilterOperation] = useState('');

  const loadLogs = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setLogs([]);
      }

      try {
        const result = await fetchAuditLogs({
          page: pageNum,
          page_size: PAGE_SIZE,
          ...(filterTable ? { table_name: filterTable } : {}),
          ...(filterOperation ? { operation: filterOperation } : {}),
        });

        setTotal(result.total);
        if (append) {
          setLogs((prev) => [...prev, ...result.logs]);
        } else {
          setLogs(result.logs);
        }
        setHasMore(pageNum * PAGE_SIZE < result.total);
      } catch (err) {
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [filterTable, filterOperation]
  );

  // Initial load + re-load on filter change
  useEffect(() => {
    setPage(1);
    loadLogs(1, false);
  }, [loadLogs]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await loadLogs(nextPage, true);
  };

  const getOperationStyle = (operation: string) => {
    return OPERATION_COLORS[operation.toUpperCase()] ?? OPERATION_COLORS.READ;
  };

  return (
    <SettingsSection
      id="audit-log"
      title="Audit Log"
      description={`Security audit trail. ${total > 0 ? `${total.toLocaleString()} total entries.` : ''}`}
      onSave={async () => {}}
      isDirty={false}
      isSaving={false}
      adminOnly
    >
      {/* Filters */}
      <div style={styles.filters}>
        <GlassSelect
          value={filterTable}
          onChange={setFilterTable}
          ariaLabel="Filter by table"
          options={[
            { value: '', label: 'All tables' },
            ...TABLE_OPTIONS.filter(Boolean).map((t) => ({ value: t, label: t })),
          ]}
        />
        <GlassSelect
          value={filterOperation}
          onChange={setFilterOperation}
          ariaLabel="Filter by operation"
          options={[
            { value: '', label: 'All operations' },
            ...OPERATION_OPTIONS.filter(Boolean).map((op) => ({ value: op, label: op })),
          ]}
        />
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={{ ...styles.th, ...styles.thTimestamp }}>Timestamp</th>
              <th style={{ ...styles.th, ...styles.thOperation }}>Operation</th>
              <th style={{ ...styles.th, ...styles.thTable }}>Table</th>
              <th style={{ ...styles.th, ...styles.thRecord }}>Record ID</th>
              <th style={{ ...styles.th, ...styles.thUser }}>User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={styles.row}>
                  <td style={styles.td}><div style={styles.skeleton} /></td>
                  <td style={styles.td}><div style={{ ...styles.skeleton, width: '60px' }} /></td>
                  <td style={styles.td}><div style={{ ...styles.skeleton, width: '80px' }} /></td>
                  <td style={styles.td}><div style={{ ...styles.skeleton, width: '120px' }} /></td>
                  <td style={styles.td}><div style={{ ...styles.skeleton, width: '140px' }} /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={styles.emptyCell}>
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              logs.map((entry) => {
                const opStyle = getOperationStyle(entry.operation);
                return (
                  <tr key={entry.id} style={styles.row}>
                    <td style={styles.td}>
                      <span style={styles.timestamp}>
                        {format(new Date(entry.timestamp), 'dd MMM yyyy, HH:mm:ss')}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.operationBadge,
                          backgroundColor: opStyle.bg,
                          color: opStyle.color,
                        }}
                      >
                        {entry.operation}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.tableName}>{entry.table_name}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.recordId} title={entry.record_id}>
                        {entry.record_id.slice(0, 8)}…
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.userId}>
                        {entry.user_id ? `${entry.user_id.slice(0, 8)}…` : 'System'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && !isLoading && (
        <div style={styles.loadMoreRow}>
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            style={styles.loadMoreButton}
          >
            {isLoadingMore ? 'Loading...' : `Load More (${logs.length} of ${total})`}
          </button>
        </div>
      )}
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: {
    display: 'flex',
    gap: 'var(--space-sm)',
    marginBottom: 'var(--space-md)',
    flexWrap: 'wrap',
  },
  tableWrapper: {
    maxHeight: '400px',
    overflowY: 'auto',
    overflowX: 'auto',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-body)',
  },
  headerRow: {
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--surface-higher)',
    zIndex: 1,
  },
  th: {
    padding: '0.625rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
  },
  thTimestamp: { minWidth: '160px' },
  thOperation: { minWidth: '90px' },
  thTable: { minWidth: '120px' },
  thRecord: { minWidth: '120px' },
  thUser: { minWidth: '120px' },
  row: {
    borderBottom: '1px solid var(--border-subtle)',
  },
  td: {
    padding: '0.5rem 0.75rem',
    color: 'var(--text-secondary)',
    verticalAlign: 'middle',
  },
  timestamp: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  },
  operationBadge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  tableName: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
  },
  recordId: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  userId: {
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  emptyCell: {
    padding: 'var(--space-xl)',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  },
  skeleton: {
    height: '14px',
    borderRadius: '4px',
    backgroundColor: 'var(--skeleton-base)',
    animation: 'shimmer 1.5s infinite',
    width: '100%',
  },
  loadMoreRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: 'var(--space-md)',
  },
  loadMoreButton: {
    padding: '0.5rem 1.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-secondary)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    transition: 'var(--transition-fast)',
  },
};
