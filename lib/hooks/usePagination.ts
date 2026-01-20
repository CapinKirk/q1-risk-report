import { useState, useMemo, useCallback } from 'react';

export interface UsePaginationResult<T> {
  paginatedData: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  setCurrentPage: (page: number) => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  resetPagination: () => void;
}

/**
 * Custom hook for paginated data
 * @param data - The full array of items to paginate
 * @param itemsPerPage - Number of items per page (default: 25)
 */
export function usePagination<T>(
  data: T[],
  itemsPerPage: number = 25
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // Reset to page 1 if current page is out of bounds
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  const goToNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    paginatedData,
    currentPage: validCurrentPage,
    totalPages,
    totalItems,
    startIndex: startIndex + 1, // 1-indexed for display
    endIndex,
    setCurrentPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    resetPagination,
  };
}
