import { useState, useMemo, useCallback } from 'react';
import { Product, Region } from '@/lib/types';

export interface UseFiltersState {
  selectedProduct: Product | 'ALL';
  selectedRegion: Region | 'ALL';
  selectedStatus: string;
  searchTerm: string;
}

export interface UseFiltersResult {
  filters: UseFiltersState;
  setSelectedProduct: (product: Product | 'ALL') => void;
  setSelectedRegion: (region: Region | 'ALL') => void;
  setSelectedStatus: (status: string) => void;
  setSearchTerm: (term: string) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: UseFiltersState = {
  selectedProduct: 'ALL',
  selectedRegion: 'ALL',
  selectedStatus: 'ALL',
  searchTerm: '',
};

/**
 * Custom hook for managing filter state
 * Common pattern across detail components
 */
export function useFilters(
  initialFilters: Partial<UseFiltersState> = {}
): UseFiltersResult {
  const [filters, setFilters] = useState<UseFiltersState>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });

  const setSelectedProduct = useCallback((product: Product | 'ALL') => {
    setFilters(prev => ({ ...prev, selectedProduct: product }));
  }, []);

  const setSelectedRegion = useCallback((region: Region | 'ALL') => {
    setFilters(prev => ({ ...prev, selectedRegion: region }));
  }, []);

  const setSelectedStatus = useCallback((status: string) => {
    setFilters(prev => ({ ...prev, selectedStatus: status }));
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setFilters(prev => ({ ...prev, searchTerm: term }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    setSelectedProduct,
    setSelectedRegion,
    setSelectedStatus,
    setSearchTerm,
    resetFilters,
  };
}

/**
 * Generic filter function for product-based data
 * Combines data from POR and R360 based on selected product
 */
export function filterByProduct<T>(
  data: { POR: T[]; R360: T[] },
  selectedProduct: Product | 'ALL'
): T[] {
  if (selectedProduct === 'ALL') {
    return [...data.POR, ...data.R360];
  }
  return data[selectedProduct];
}

/**
 * Generic filter function for region
 */
export function filterByRegion<T extends { region: Region }>(
  data: T[],
  selectedRegion: Region | 'ALL'
): T[] {
  if (selectedRegion === 'ALL') {
    return data;
  }
  return data.filter(item => item.region === selectedRegion);
}

/**
 * Generic search filter
 */
export function filterBySearch<T>(
  data: T[],
  searchTerm: string,
  getSearchableFields: (item: T) => string[]
): T[] {
  if (!searchTerm) {
    return data;
  }
  const term = searchTerm.toLowerCase();
  return data.filter(item =>
    getSearchableFields(item).some(field =>
      field && field.toLowerCase().includes(term)
    )
  );
}
