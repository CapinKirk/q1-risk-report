'use client';

import type {
  RevenueTrendRow,
  FunnelTrendRow,
  MetricComparison,
  Product,
  Region,
} from '@/lib/types';

interface TrendComparisonTableProps {
  type: 'revenue' | 'funnel';
  revenueData?: RevenueTrendRow[];
  funnelData?: FunnelTrendRow[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getTrendIcon(trend: 'UP' | 'DOWN' | 'FLAT'): string {
  switch (trend) {
    case 'UP': return '↑';
    case 'DOWN': return '↓';
    case 'FLAT': return '→';
  }
}

function getTrendColor(trend: 'UP' | 'DOWN' | 'FLAT', isPositiveGood: boolean = true): string {
  if (trend === 'FLAT') return 'var(--text-secondary)';
  if (trend === 'UP') return isPositiveGood ? '#16a34a' : '#dc2626';
  return isPositiveGood ? '#dc2626' : '#16a34a';
}

interface MetricCellProps {
  metric: MetricComparison<number>;
  format: 'currency' | 'number' | 'percent';
  isPositiveGood?: boolean;
}

function MetricCell({ metric, format, isPositiveGood = true }: MetricCellProps) {
  const formatFn = format === 'currency' ? formatCurrency
    : format === 'percent' ? formatPercent
    : formatNumber;

  const trendColor = getTrendColor(metric.trend, isPositiveGood);
  const trendIcon = getTrendIcon(metric.trend);

  return (
    <td className="metric-cell">
      <div className="current-value">{formatFn(metric.current)}</div>
      <div className="previous-value">prev: {formatFn(metric.previous)}</div>
      <div className="delta-value" style={{ color: trendColor }}>
        <span className="trend-icon">{trendIcon}</span>
        <span className="delta-pct">
          {metric.deltaPercent >= 0 ? '+' : ''}{metric.deltaPercent.toFixed(1)}%
        </span>
      </div>
      <style jsx>{`
        .metric-cell {
          text-align: right;
          padding: 12px;
        }
        .current-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .previous-value {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .delta-value {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .trend-icon {
          font-size: 14px;
        }
      `}</style>
    </td>
  );
}

function getProductLabel(product: Product): string {
  return product === 'POR' ? 'Point of Rental' : 'Record360';
}

export default function TrendComparisonTable({
  type,
  revenueData,
  funnelData
}: TrendComparisonTableProps) {

  if (type === 'revenue' && revenueData) {
    return (
      <div className="trend-table-container" data-testid="trend-comparison-table">
        <table className="trend-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Region</th>
              <th>Category</th>
              <th className="metric-header">ACV</th>
              <th className="metric-header">Deals</th>
              <th className="metric-header">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {revenueData.map((row, index) => (
              <tr key={`${row.product}-${row.region}-${row.category}-${index}`}>
                <td className="product-cell">{getProductLabel(row.product)}</td>
                <td className="region-cell">{row.region}</td>
                <td className="category-cell">{row.category}</td>
                <MetricCell metric={row.acv} format="currency" />
                <MetricCell metric={row.deals} format="number" />
                <MetricCell metric={row.winRate} format="percent" />
              </tr>
            ))}
          </tbody>
        </table>
        <style jsx>{`
          .trend-table-container {
            overflow-x: auto;
            background: var(--bg-secondary);
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .trend-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .trend-table th {
            background: var(--bg-tertiary);
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: var(--text-secondary);
            border-bottom: 2px solid var(--border-primary);
            white-space: nowrap;
          }
          .trend-table th.metric-header {
            text-align: right;
          }
          .trend-table td {
            padding: 12px;
            border-bottom: 1px solid var(--border-primary);
            vertical-align: top;
          }
          .trend-table tbody tr:hover {
            background: var(--bg-tertiary);
          }
          .product-cell {
            font-weight: 500;
            color: var(--text-primary);
          }
          .region-cell {
            color: var(--text-secondary);
          }
          .category-cell {
            color: var(--text-secondary);
            font-size: 12px;
          }
        `}</style>
      </div>
    );
  }

  if (type === 'funnel' && funnelData) {
    return (
      <div className="trend-table-container" data-testid="trend-comparison-table">
        <table className="trend-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Region</th>
              <th className="metric-header">MQL</th>
              <th className="metric-header">SQL</th>
              <th className="metric-header">SAL</th>
              <th className="metric-header">SQO</th>
            </tr>
          </thead>
          <tbody>
            {funnelData.map((row, index) => (
              <tr key={`${row.product}-${row.region}-${index}`}>
                <td className="product-cell">{getProductLabel(row.product)}</td>
                <td className="region-cell">{row.region}</td>
                <MetricCell metric={row.mql} format="number" />
                <MetricCell metric={row.sql} format="number" />
                <MetricCell metric={row.sal} format="number" />
                <MetricCell metric={row.sqo} format="number" />
              </tr>
            ))}
          </tbody>
        </table>
        <style jsx>{`
          .trend-table-container {
            overflow-x: auto;
            background: var(--bg-secondary);
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .trend-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          .trend-table th {
            background: var(--bg-tertiary);
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: var(--text-secondary);
            border-bottom: 2px solid var(--border-primary);
            white-space: nowrap;
          }
          .trend-table th.metric-header {
            text-align: right;
          }
          .trend-table td {
            padding: 12px;
            border-bottom: 1px solid var(--border-primary);
            vertical-align: top;
          }
          .trend-table tbody tr:hover {
            background: var(--bg-tertiary);
          }
          .product-cell {
            font-weight: 500;
            color: var(--text-primary);
          }
          .region-cell {
            color: var(--text-secondary);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="empty-state" data-testid="trend-comparison-table-empty">
      <p>No data available for the selected filters.</p>
      <style jsx>{`
        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-primary);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
