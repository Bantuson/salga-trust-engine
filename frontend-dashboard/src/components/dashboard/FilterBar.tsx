import { useState, useEffect, useRef } from 'react';
import type { TicketFilters } from '../../types/dashboard';

interface FilterBarProps {
  filters: TicketFilters;
  onFilterChange: (key: keyof TicketFilters, value: string | undefined) => void;
  onReset: () => void;
}

export function FilterBar({ filters, onFilterChange, onReset }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const timeoutRef = useRef<number | undefined>(undefined);

  // Debounce search input (300ms)
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      onFilterChange('search', searchInput || undefined);
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchInput, onFilterChange]);

  return (
    <div style={{
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      padding: '1rem',
      background: 'var(--glass-white-frost)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-md)',
      marginBottom: '1rem'
    }}>
      <div style={{ flex: 1 }}>
        <label htmlFor="search" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
          Search
        </label>
        <input
          id="search"
          type="text"
          placeholder="Search by tracking number or description..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--glass-border)',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <div style={{ minWidth: '150px' }}>
        <label htmlFor="status" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
          Status
        </label>
        <select
          id="status"
          value={filters.status || ''}
          onChange={(e) => onFilterChange('status', e.target.value || undefined)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--glass-border)',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div style={{ minWidth: '150px' }}>
        <label htmlFor="category" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
          Category
        </label>
        <select
          id="category"
          value={filters.category || ''}
          onChange={(e) => onFilterChange('category', e.target.value || undefined)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--glass-border)',
            borderRadius: '4px',
            fontSize: '0.875rem',
            backgroundColor: 'var(--surface-elevated)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All</option>
          <option value="water">Water</option>
          <option value="roads">Roads</option>
          <option value="electricity">Electricity</option>
          <option value="waste">Waste</option>
          <option value="sanitation">Sanitation</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div style={{ alignSelf: 'flex-end' }}>
        <button
          onClick={onReset}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--surface-higher)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '4px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
