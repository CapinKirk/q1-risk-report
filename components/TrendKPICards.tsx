'use client';

import type { MetricComparison } from '@/lib/types';

interface TrendKPICardsProps {
  revenueSummary: {
    totalACV: MetricComparison<number>;
    wonDeals: MetricComparison<number>;
    pipelineACV: MetricComparison<number>;
    avgDealSize: MetricComparison<number>;
  };
  funnelSummary: {
    totalMQL: MetricComparison<number>;
    totalSQL: MetricComparison<number>;
    totalSAL: MetricComparison<number>;
    totalSQO: MetricComparison<number>;
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function getTrendIcon(trend: 'UP' | 'DOWN' | 'FLAT'): string {
  switch (trend) {
    case 'UP': return '↑';
    case 'DOWN': return '↓';
    case 'FLAT': return '→';
  }
}

function getTrendColor(trend: 'UP' | 'DOWN' | 'FLAT', isPositiveGood: boolean = true): string {
  if (trend === 'FLAT') return '#6b7280';
  if (trend === 'UP') return isPositiveGood ? '#16a34a' : '#dc2626';
  return isPositiveGood ? '#dc2626' : '#16a34a';
}

interface KPICardProps {
  title: string;
  metric: MetricComparison<number>;
  format: 'currency' | 'number';
  isPositiveGood?: boolean;
}

function KPICard({ title, metric, format, isPositiveGood = true }: KPICardProps) {
  const formatFn = format === 'currency' ? formatCurrency : formatNumber;
  const trendColor = getTrendColor(metric.trend, isPositiveGood);
  const trendIcon = getTrendIcon(metric.trend);
  const bgColor = metric.trend === 'UP'
    ? (isPositiveGood ? 'rgba(22, 163, 74, 0.05)' : 'rgba(220, 38, 38, 0.05)')
    : metric.trend === 'DOWN'
    ? (isPositiveGood ? 'rgba(220, 38, 38, 0.05)' : 'rgba(22, 163, 74, 0.05)')
    : 'rgba(107, 114, 128, 0.05)';

  return (
    <div className="kpi-card" style={{ backgroundColor: bgColor }}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{formatFn(metric.current)}</div>
      <div className="kpi-comparison">
        <span className="kpi-previous">vs {formatFn(metric.previous)}</span>
        <span className="kpi-delta" style={{ color: trendColor }}>
          {trendIcon} {metric.deltaPercent >= 0 ? '+' : ''}{metric.deltaPercent.toFixed(1)}%
        </span>
      </div>
      <style jsx>{`
        .kpi-card {
          padding: 16px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
        }
        .kpi-title {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .kpi-value {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 8px;
        }
        .kpi-comparison {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .kpi-previous {
          font-size: 12px;
          color: #94a3b8;
        }
        .kpi-delta {
          font-size: 13px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 2px;
        }
      `}</style>
    </div>
  );
}

export default function TrendKPICards({ revenueSummary, funnelSummary }: TrendKPICardsProps) {
  return (
    <div className="trend-kpi-section" data-testid="trend-kpi-cards">
      <div className="kpi-group">
        <h4 className="kpi-group-title">Revenue Metrics</h4>
        <div className="kpi-grid">
          <KPICard
            title="Total ACV"
            metric={revenueSummary.totalACV}
            format="currency"
          />
          <KPICard
            title="Won Deals"
            metric={revenueSummary.wonDeals}
            format="number"
          />
          <KPICard
            title="Pipeline ACV"
            metric={revenueSummary.pipelineACV}
            format="currency"
          />
          <KPICard
            title="Avg Deal Size"
            metric={revenueSummary.avgDealSize}
            format="currency"
          />
        </div>
      </div>

      <div className="kpi-group">
        <h4 className="kpi-group-title">Funnel Metrics</h4>
        <div className="kpi-grid">
          <KPICard
            title="Total MQL"
            metric={funnelSummary.totalMQL}
            format="number"
          />
          <KPICard
            title="Total SQL"
            metric={funnelSummary.totalSQL}
            format="number"
          />
          <KPICard
            title="Total SAL"
            metric={funnelSummary.totalSAL}
            format="number"
          />
          <KPICard
            title="Total SQO"
            metric={funnelSummary.totalSQO}
            format="number"
          />
        </div>
      </div>

      <style jsx>{`
        .trend-kpi-section {
          margin-bottom: 24px;
        }
        .kpi-group {
          margin-bottom: 20px;
        }
        .kpi-group-title {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 500px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
