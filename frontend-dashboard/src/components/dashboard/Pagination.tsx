interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  const isFirstPage = page === 0;
  const isLastPage = page >= pageCount - 1 || pageCount === 0;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '1rem',
      padding: '1rem',
      borderTop: '1px solid var(--glass-border)'
    }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={isFirstPage}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isFirstPage ? 'var(--surface-elevated)' : 'var(--color-teal)',
          color: isFirstPage ? 'var(--text-muted)' : 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          cursor: isFirstPage ? 'not-allowed' : 'pointer',
          fontWeight: '500'
        }}
      >
        Previous
      </button>

      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Page {page + 1} of {Math.max(pageCount, 1)}
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={isLastPage}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: isLastPage ? 'var(--surface-elevated)' : 'var(--color-teal)',
          color: isLastPage ? 'var(--text-muted)' : 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          cursor: isLastPage ? 'not-allowed' : 'pointer',
          fontWeight: '500'
        }}
      >
        Next
      </button>
    </div>
  );
}
