import { MomentumIndicator } from '@/lib/types';

interface MomentumTrackerProps {
  momentum: {
    POR: MomentumIndicator[];
    R360: MomentumIndicator[];
  };
}

function getTrendArrow(trend: string): string {
  switch (trend) {
    case 'UP': return '↑';
    case 'DOWN': return '↓';
    case 'FLAT': return '→';
    default: return '•';
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'UP': return '#16a34a';
    case 'DOWN': return '#dc2626';
    case 'FLAT': return '#6b7280';
    default: return '#6b7280';
  }
}

function getMomentumTierStyle(tier: string): { bg: string; text: string; border: string } {
  switch (tier) {
    case 'STRONG_MOMENTUM':
      return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
    case 'MODERATE_MOMENTUM':
      return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
    case 'NO_MOMENTUM':
      return { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' };
    case 'DECLINING':
      return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
    default:
      return { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' };
  }
}

function TrendIndicator({ label, trend, wowPct }: { label: string; trend: string; wowPct: number }) {
  const color = getTrendColor(trend);
  return (
    <div className="trend-indicator">
      <span className="trend-label">{label}</span>
      <span className="trend-value" style={{ color }}>
        {getTrendArrow(trend)} {wowPct > 0 ? '+' : ''}{wowPct}%
      </span>
      <style jsx>{`
        .trend-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px;
          min-width: 60px;
        }
        .trend-label {
          font-size: 0.625rem;
          color: #6b7280;
          text-transform: uppercase;
        }
        .trend-value {
          font-size: 0.875rem;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

export default function MomentumTracker({ momentum }: MomentumTrackerProps) {
  const allIndicators = [...(momentum.POR || []), ...(momentum.R360 || [])];

  if (allIndicators.length === 0) {
    return null;
  }

  // Sort by momentum tier (strong first)
  const tierOrder = { 'STRONG_MOMENTUM': 0, 'MODERATE_MOMENTUM': 1, 'NO_MOMENTUM': 2, 'DECLINING': 3 };
  const sorted = allIndicators.sort((a, b) =>
    (tierOrder[a.momentum_tier as keyof typeof tierOrder] || 4) -
    (tierOrder[b.momentum_tier as keyof typeof tierOrder] || 4)
  );

  return (
    <section>
      <h2>Momentum Tracker</h2>
      <div className="momentum-grid">
        {sorted.map((indicator, idx) => {
          const style = getMomentumTierStyle(indicator.momentum_tier);
          return (
            <div
              key={idx}
              className="momentum-card"
              style={{
                backgroundColor: style.bg,
                borderColor: style.border,
              }}
            >
              <div className="momentum-header">
                <span className="region-label">
                  {indicator.product} {indicator.region}
                </span>
                <span
                  className="momentum-tier"
                  style={{ color: style.text }}
                >
                  {indicator.momentum_tier.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="trend-row">
                <TrendIndicator
                  label="MQL"
                  trend={indicator.mql_trend}
                  wowPct={indicator.mql_wow_pct}
                />
                <TrendIndicator
                  label="SQL"
                  trend={indicator.sql_trend}
                  wowPct={indicator.sql_wow_pct}
                />
              </div>
              <p className="momentum-commentary">{indicator.momentum_commentary}</p>
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .momentum-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .momentum-card {
          border: 1px solid;
          border-radius: 8px;
          padding: 16px;
        }
        .momentum-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .region-label {
          font-weight: 600;
          color: #1f2937;
        }
        .momentum-tier {
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .trend-row {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 12px;
          background: rgba(255,255,255,0.5);
          border-radius: 6px;
          padding: 8px;
        }
        .momentum-commentary {
          font-size: 0.75rem;
          color: #4b5563;
          margin: 0;
          text-align: center;
        }
      `}</style>
    </section>
  );
}
