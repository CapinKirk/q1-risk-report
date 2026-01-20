'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

/**
 * Reusable pagination component
 * Shows: "Showing X-Y of Z items" + Previous/Next buttons
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  onPrevious,
  onNext,
  className = '',
}: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className={`pagination-info ${className}`} style={{ padding: '8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
        Showing {totalItems} {totalItems === 1 ? 'item' : 'items'}
      </div>
    );
  }

  return (
    <div
      className={`pagination ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        fontSize: '13px',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>
        Showing {startIndex}-{endIndex} of {totalItems} items
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onPrevious}
          disabled={currentPage === 1}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: currentPage === 1 ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--text-primary)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          }}
        >
          Previous
        </button>
        <span style={{ color: 'var(--text-secondary)' }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={currentPage === totalPages}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: currentPage === totalPages ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            color: currentPage === totalPages ? 'var(--text-disabled)' : 'var(--text-primary)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/**
 * Compact pagination for smaller spaces
 */
export function CompactPagination({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  className = '',
}: {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={`pagination-compact ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
      }}
    >
      <button
        onClick={onPrevious}
        disabled={currentPage === 1}
        style={{
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'transparent',
          color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--text-primary)',
          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
        }}
      >
        ←
      </button>
      <span style={{ color: 'var(--text-secondary)', minWidth: '60px', textAlign: 'center' }}>
        {currentPage}/{totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        style={{
          padding: '2px 8px',
          borderRadius: '4px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'transparent',
          color: currentPage === totalPages ? 'var(--text-disabled)' : 'var(--text-primary)',
          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
        }}
      >
        →
      </button>
    </div>
  );
}
