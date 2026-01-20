'use client';

export interface StatItem {
  label: string;
  value: string | number;
  color?: string;
  subtext?: string;
}

interface StatsBarProps {
  stats: StatItem[];
  layout?: 'horizontal' | 'grid';
  className?: string;
}

/**
 * Reusable stats bar component
 * Displays a row of statistic items with optional colors
 */
export default function StatsBar({ stats, layout = 'horizontal', className = '' }: StatsBarProps) {
  if (layout === 'grid') {
    return (
      <div
        className={`stats-bar stats-grid ${className}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
          gap: '12px',
          padding: '12px 0',
        }}
      >
        {stats.map((stat, index) => (
          <StatCard key={index} stat={stat} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`stats-bar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '8px 0',
        flexWrap: 'wrap',
      }}
    >
      {stats.map((stat, index) => (
        <StatInline key={index} stat={stat} />
      ))}
    </div>
  );
}

function StatInline({ stat }: { stat: StatItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.label}:</span>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: stat.color || 'var(--text-primary)',
        }}
      >
        {stat.value}
      </span>
      {stat.subtext && (
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({stat.subtext})</span>
      )}
    </div>
  );
}

function StatCard({ stat }: { stat: StatItem }) {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {stat.label}
      </div>
      <div
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: stat.color || 'var(--text-primary)',
        }}
      >
        {stat.value}
      </div>
      {stat.subtext && (
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
          {stat.subtext}
        </div>
      )}
    </div>
  );
}

/**
 * Convenience component for displaying counts with RAG coloring
 */
export function RAGStatsBar({
  active,
  converted,
  lost,
  stalled,
  total,
  className = '',
}: {
  active?: number;
  converted?: number;
  lost?: number;
  stalled?: number;
  total: number;
  className?: string;
}) {
  const stats: StatItem[] = [
    { label: 'Total', value: total },
  ];

  if (active !== undefined) {
    stats.push({ label: 'Active', value: active, color: '#059669' });
  }
  if (converted !== undefined) {
    stats.push({ label: 'Converted', value: converted, color: '#2563eb' });
  }
  if (stalled !== undefined) {
    stats.push({ label: 'Stalled', value: stalled, color: '#ca8a04' });
  }
  if (lost !== undefined) {
    stats.push({ label: 'Lost', value: lost, color: '#dc2626' });
  }

  return <StatsBar stats={stats} className={className} />;
}
