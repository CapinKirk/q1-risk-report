'use client';

import { Product, Region } from '@/lib/types';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  // Product filter
  showProductFilter?: boolean;
  selectedProduct?: Product | 'ALL';
  onProductChange?: (product: Product | 'ALL') => void;

  // Region filter
  showRegionFilter?: boolean;
  selectedRegion?: Region | 'ALL';
  onRegionChange?: (region: Region | 'ALL') => void;

  // Status filter
  showStatusFilter?: boolean;
  selectedStatus?: string;
  statusOptions?: FilterOption[];
  onStatusChange?: (status: string) => void;

  // Category filter
  showCategoryFilter?: boolean;
  selectedCategories?: string[];
  categoryOptions?: FilterOption[];
  onCategoryToggle?: (category: string) => void;

  // Search
  showSearch?: boolean;
  searchTerm?: string;
  searchPlaceholder?: string;
  onSearchChange?: (term: string) => void;

  className?: string;
}

const PRODUCT_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'All Products' },
  { value: 'POR', label: 'POR' },
  { value: 'R360', label: 'R360' },
];

const REGION_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'All Regions' },
  { value: 'AMER', label: 'AMER' },
  { value: 'EMEA', label: 'EMEA' },
  { value: 'APAC', label: 'APAC' },
];

/**
 * Reusable filter bar component
 * Combines product, region, status filters and search in a consistent UI
 */
export default function FilterBar({
  showProductFilter = true,
  selectedProduct = 'ALL',
  onProductChange,
  showRegionFilter = true,
  selectedRegion = 'ALL',
  onRegionChange,
  showStatusFilter = false,
  selectedStatus = 'ALL',
  statusOptions = [],
  onStatusChange,
  showCategoryFilter = false,
  selectedCategories = [],
  categoryOptions = [],
  onCategoryToggle,
  showSearch = true,
  searchTerm = '',
  searchPlaceholder = 'Search...',
  onSearchChange,
  className = '',
}: FilterBarProps) {
  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    minWidth: '120px',
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    minWidth: '200px',
  };

  const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    backgroundColor: active ? 'var(--accent-color)' : 'var(--bg-secondary)',
    color: active ? '#ffffff' : 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  return (
    <div
      className={`filter-bar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 0',
        flexWrap: 'wrap',
      }}
    >
      {showProductFilter && onProductChange && (
        <select
          value={selectedProduct}
          onChange={(e) => onProductChange(e.target.value as Product | 'ALL')}
          style={selectStyle}
        >
          {PRODUCT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {showRegionFilter && onRegionChange && (
        <select
          value={selectedRegion}
          onChange={(e) => onRegionChange(e.target.value as Region | 'ALL')}
          style={selectStyle}
        >
          {REGION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {showStatusFilter && onStatusChange && statusOptions.length > 0 && (
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          style={selectStyle}
        >
          <option value="ALL">All Statuses</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {showCategoryFilter && onCategoryToggle && categoryOptions.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Type:</span>
          {categoryOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onCategoryToggle(opt.value)}
              style={toggleButtonStyle(selectedCategories.includes(opt.value))}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {showSearch && onSearchChange && (
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={inputStyle}
        />
      )}
    </div>
  );
}

/**
 * Simplified filter bar for common use case
 */
export function SimpleFilterBar({
  selectedProduct,
  onProductChange,
  selectedRegion,
  onRegionChange,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search by company or email...',
}: {
  selectedProduct: Product | 'ALL';
  onProductChange: (product: Product | 'ALL') => void;
  selectedRegion: Region | 'ALL';
  onRegionChange: (region: Region | 'ALL') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <FilterBar
      showProductFilter
      selectedProduct={selectedProduct}
      onProductChange={onProductChange}
      showRegionFilter
      selectedRegion={selectedRegion}
      onRegionChange={onRegionChange}
      showSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
    />
  );
}
