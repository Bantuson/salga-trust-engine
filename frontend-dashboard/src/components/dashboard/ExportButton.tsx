import { useState } from 'react';
import { exportTicketsCSV, exportTicketsExcel } from '../../services/api';
import type { TicketFilters } from '../../types/dashboard';

interface ExportButtonProps {
  filters: TicketFilters;
}

export function ExportButton({ filters }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function downloadExport(format: 'csv' | 'excel') {
    try {
      setIsExporting(true);

      // Call appropriate export function (already includes auth via axios interceptor)
      const blob = format === 'csv'
        ? await exportTicketsCSV(filters)
        : await exportTicketsExcel(filters);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `tickets_export.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button
        onClick={() => downloadExport('csv')}
        disabled={isExporting}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isExporting ? '#9ca3af' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          cursor: isExporting ? 'not-allowed' : 'pointer',
          fontWeight: '500'
        }}
        onMouseOver={(e) => !isExporting && (e.currentTarget.style.backgroundColor = '#059669')}
        onMouseOut={(e) => !isExporting && (e.currentTarget.style.backgroundColor = '#10b981')}
      >
        Export CSV
      </button>

      <button
        onClick={() => downloadExport('excel')}
        disabled={isExporting}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isExporting ? '#9ca3af' : '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          cursor: isExporting ? 'not-allowed' : 'pointer',
          fontWeight: '500'
        }}
        onMouseOver={(e) => !isExporting && (e.currentTarget.style.backgroundColor = '#059669')}
        onMouseOut={(e) => !isExporting && (e.currentTarget.style.backgroundColor = '#10b981')}
      >
        Export Excel
      </button>
    </div>
  );
}
