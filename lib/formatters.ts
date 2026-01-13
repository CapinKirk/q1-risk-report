/**
 * Format a number as currency (USD)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '0%';
  return `${Math.round(value)}%`;
}

/**
 * Format a number with decimal as percentage (for CTR etc)
 */
export function formatPercentDecimal(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format coverage multiplier
 */
export function formatCoverage(value: number | null | undefined): string {
  if (value == null) return '0.0x';
  return `${value.toFixed(1)}x`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

/**
 * Get CSS class for RAG status
 */
export function getRAGClass(rag: string | null | undefined): string {
  if (!rag) return 'text-red-500';
  switch (rag.toUpperCase()) {
    case 'GREEN':
      return 'text-green-600 font-semibold';
    case 'YELLOW':
      return 'text-yellow-600 font-semibold';
    case 'RED':
      return 'text-red-500 font-semibold';
    default:
      return 'text-red-500';
  }
}

/**
 * Get inline style color for RAG status
 */
export function getRAGColor(rag: string | null | undefined): string {
  if (!rag) return '#dc3545';
  switch (rag.toUpperCase()) {
    case 'GREEN':
      return '#28a745';
    case 'YELLOW':
      return '#ffc107';
    case 'RED':
      return '#dc3545';
    default:
      return '#dc3545';
  }
}

/**
 * Get percentage class based on threshold
 */
export function getPctClass(pct: number | null | undefined): string {
  if (pct == null) return 'red';
  if (pct >= 90) return 'green';
  if (pct >= 70) return 'yellow';
  return 'red';
}

/**
 * Get gap color (green for positive, red for negative)
 */
export function getGapColor(gap: number | null | undefined): string {
  if (gap == null || gap < 0) return '#dc3545';
  return '#28a745';
}
