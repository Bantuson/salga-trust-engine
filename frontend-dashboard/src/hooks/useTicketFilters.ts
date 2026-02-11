import { useState, useCallback } from 'react';
import type { TicketFilters } from '../types/dashboard';

const DEFAULT_FILTERS: TicketFilters = {
  page: 0,
  page_size: 50,
  sort_by: 'created_at',
  sort_order: 'desc',
};

export function useTicketFilters(initialWardId?: string) {
  const [filters, setFilters] = useState<TicketFilters>({
    ...DEFAULT_FILTERS,
    ward_id: initialWardId,
  });

  const updateFilter = useCallback((key: keyof TicketFilters, value: string | number | undefined) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
      // Reset to page 0 when filters change (not when page changes)
      ...(key !== 'page' ? { page: 0 } : {}),
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS, ward_id: initialWardId });
  }, [initialWardId]);

  return { filters, updateFilter, resetFilters, setFilters };
}
