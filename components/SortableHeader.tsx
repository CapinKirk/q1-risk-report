'use client';

import { SortDirection } from '@/lib/useSortableTable';

interface SortableHeaderProps {
  label: string;
  column: string;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Sortable table header with arrow indicators
 * Shows no arrow on default, up arrow for asc, down arrow for desc
 */
export default function SortableHeader({
  label,
  column,
  sortDirection,
  onSort,
  className = '',
  style,
}: SortableHeaderProps) {
  return (
    <th
      className={`sortable-header ${className}`}
      style={style}
      onClick={() => onSort(column)}
    >
      <span className="header-content">
        {label}
        {sortDirection && (
          <span className="sort-arrow">
            {sortDirection === 'asc' ? ' ▲' : ' ▼'}
          </span>
        )}
      </span>
      <style jsx>{`
        .sortable-header {
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
        }
        .sortable-header:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        .header-content {
          display: inline-flex;
          align-items: center;
          gap: 2px;
        }
        .sort-arrow {
          font-size: 0.6em;
          opacity: 0.9;
        }
      `}</style>
    </th>
  );
}
