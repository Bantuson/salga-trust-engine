/**
 * DataExportSection — Ticket data export for CSV and Excel.
 *
 * Per requirement OPS-02: Municipal manager can export issue data to Excel/CSV.
 * GBV/sensitive tickets excluded per privacy policy (enforced at backend).
 */

import React, { useState } from 'react';
import { SettingsSection } from './SettingsSection';
import { exportTicketsCSV, exportTicketsExcel } from '../../services/api';
import type { TicketFilters } from '../../types/dashboard';

/** Default empty filters for full export */
const EXPORT_FILTERS: TicketFilters = {
  page: 0,
  page_size: 9999,
};

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataExportSection() {
  const [csvLoading, setCsvLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportCSV = async () => {
    setCsvLoading(true);
    setError(null);
    try {
      const blob = await exportTicketsCSV(EXPORT_FILTERS);
      const date = new Date().toISOString().split('T')[0];
      triggerBlobDownload(blob, `tickets-export-${date}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExcelLoading(true);
    setError(null);
    try {
      const blob = await exportTicketsExcel(EXPORT_FILTERS);
      const date = new Date().toISOString().split('T')[0];
      triggerBlobDownload(blob, `tickets-export-${date}.xlsx`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExcelLoading(false);
    }
  };

  return (
    <SettingsSection
      id="data-export"
      title="Data Export"
      description="Export all ticket data for your municipality. GBV/sensitive tickets are excluded per privacy policy."
      onSave={async () => {}}
      isDirty={false}
      isSaving={false}
    >
      <div style={styles.buttonRow}>
        {/* CSV Export */}
        <button
          onClick={handleExportCSV}
          disabled={csvLoading || excelLoading}
          style={{
            ...styles.exportButton,
            ...(csvLoading || excelLoading ? styles.exportButtonDisabled : {}),
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.icon}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          {csvLoading ? 'Exporting...' : 'Export to CSV'}
        </button>

        {/* Excel Export */}
        <button
          onClick={handleExportExcel}
          disabled={csvLoading || excelLoading}
          style={{
            ...styles.exportButton,
            ...styles.exportButtonExcel,
            ...(csvLoading || excelLoading ? styles.exportButtonDisabled : {}),
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.icon}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M8 13l2 4 2-4 2 4 2-4" />
          </svg>
          {excelLoading ? 'Exporting...' : 'Export to Excel'}
        </button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </SettingsSection>
  );
}

const styles: Record<string, React.CSSProperties> = {
  buttonRow: {
    display: 'flex',
    gap: 'var(--space-md)',
    flexWrap: 'wrap',
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '0.875rem 1.5rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    fontFamily: 'var(--font-body)',
  },
  exportButtonExcel: {
    backgroundColor: 'rgba(0, 191, 165, 0.12)',
    borderColor: 'rgba(0, 191, 165, 0.3)',
    color: 'var(--color-teal)',
  },
  exportButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  icon: {
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: 'var(--space-md)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'rgba(229, 115, 115, 0.12)',
    border: '1px solid rgba(229, 115, 115, 0.3)',
    color: '#e57373',
    fontSize: '0.875rem',
  },
};
