import { useState, useEffect, useRef } from 'react';
import { Select } from '@shared/components/ui/Select';
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
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
          Status
        </label>
        <Select
          value={filters.status || ''}
          onChange={(value) => onFilterChange('status', value || undefined)}
          options={[
            { value: '', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'escalated', label: 'Escalated' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ]}
          size="md"
          ariaLabel="Filter by status"
        />
      </div>

      <div style={{ minWidth: '150px' }}>
        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
          Category
        </label>
        <Select
          value={filters.category || ''}
          onChange={(value) => onFilterChange('category', value || undefined)}
          options={[
            { value: '', label: 'All' },
            { value: 'water', label: 'Water' },
            { value: 'roads', label: 'Roads' },
            { value: 'electricity', label: 'Electricity' },
            { value: 'waste', label: 'Waste' },
            { value: 'sanitation', label: 'Sanitation' },
            { value: 'other', label: 'Other' },
          ]}
          size="md"
          ariaLabel="Filter by category"
        />
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
