import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export interface UseSortableTableResult<T> {
  sortedData: T[];
  sortState: SortState;
  handleSort: (column: string) => void;
  getSortDirection: (column: string) => SortDirection;
}

/**
 * Custom hook for sortable tables
 * Click 1: ascending, Click 2: descending, Click 3: reset to default
 */
export function useSortableTable<T>(
  data: T[],
  defaultSortedData: T[],
  getColumnValue: (item: T, column: string) => any
): UseSortableTableResult<T> {
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  const handleSort = useCallback((column: string) => {
    setSortState(prev => {
      if (prev.column !== column) {
        // New column: start with ascending
        return { column, direction: 'asc' };
      }
      if (prev.direction === 'asc') {
        // Was ascending: switch to descending
        return { column, direction: 'desc' };
      }
      // Was descending: reset to default
      return { column: null, direction: null };
    });
  }, []);

  const getSortDirection = useCallback((column: string): SortDirection => {
    if (sortState.column === column) {
      return sortState.direction;
    }
    return null;
  }, [sortState]);

  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return defaultSortedData;
    }

    return [...data].sort((a, b) => {
      const aVal = getColumnValue(a, sortState.column!);
      const bVal = getColumnValue(b, sortState.column!);

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortState.direction === 'asc' ? -1 : 1;
      if (bVal == null) return sortState.direction === 'asc' ? 1 : -1;

      // Handle strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortState.direction === 'asc' ? comparison : -comparison;
      }

      // Handle numbers
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, defaultSortedData, sortState, getColumnValue]);

  return { sortedData, sortState, handleSort, getSortDirection };
}
