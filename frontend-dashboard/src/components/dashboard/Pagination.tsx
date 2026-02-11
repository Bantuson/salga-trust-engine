interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem',
      borderTop: '1px solid #e5e7eb'
    }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: page === 0 ? '#e5e7eb' : '#3b82f6',
          color: page === 0 ? '#9ca3af' : 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          cursor: page === 0 ? 'not-allowed' : 'pointer',
          fontWeight: '500'
        }}
      >
        Previous
      </button>

      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
        Page {page + 1} of {Math.max(pageCount, 1)}
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount - 1 || pageCount === 0}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: (page >= pageCount - 1 || pageCount === 0) ? '#e5e7eb' : '#3b82f6',
          color: (page >= pageCount - 1 || pageCount === 0) ? '#9ca3af' : 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          cursor: (page >= pageCount - 1 || pageCount === 0) ? 'not-allowed' : 'pointer',
          fontWeight: '500'
        }}
      >
        Next
      </button>
    </div>
  );
}
