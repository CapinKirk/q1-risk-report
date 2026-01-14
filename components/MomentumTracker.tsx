import { MomentumIndicator, Period } from '@/lib/types';

interface MomentumTrackerProps {
  momentum: {
    POR: MomentumIndicator[];
    R360: MomentumIndicator[];
  };
  period: Period;
}

function getTrendArrow(trend: string): string {
  switch (trend) {
    case 'UP': return '↑';
    case 'DOWN': return '↓';
    case 'FLAT': return '→';
    default: return '•';
  }
}

function getTrendColor(trend: string, isEarlyQuarter: boolean): string {
  // Mute colors if early quarter (less reliable data)
  if (isEarlyQuarter) {
    switch (trend) {
      case 'UP': return '#4ade80'; // lighter green
      case 'DOWN': return '#f87171'; // lighter red
      case 'FLAT': return '#9ca3af';
      default: return '#9ca3af';
    }
  }
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

/**
 * Improve commentary based on sample size
 */
function improveCommentary(commentary: string, quarterPct: number): string {
  if (!commentary) return '';

  // Clean up generic commentary
  let improved = commentary
    .replace(/showing positive momentum across multiple funnel stages\./gi, 'has positive funnel trends.')
    .replace(/showing strong MQL momentum/gi, 'MQL trending up')
    .replace(/Lead generation accelerating\./gi, '')
    .trim();

  // Add sample size caveat if early quarter
  if (quarterPct < 25 && improved.length > 0) {
    improved += ' (early quarter - monitor trends)';
  }

  return improved;
}

function TrendIndicator({
  label,
  trend,
  wowPct,
  isEarlyQuarter
}: {
  label: string;
  trend: string;
  wowPct: number;
  isEarlyQuarter: boolean;
}) {
  const color = getTrendColor(trend, isEarlyQuarter);
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
          padding: 6px;
          min-width: 55px;
        }
        .trend-label {
          font-size: 0.6rem;
          color: #6b7280;
          text-transform: uppercase;
        }
        .trend-value {
          font-size: 0.8rem;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
}

export default function MomentumTracker({ momentum, period }: MomentumTrackerProps) {
  const allIndicators = [...(momentum.POR || []), ...(momentum.R360 || [])];
  const quarterPct = period.quarter_pct_complete || 0;
  const isEarlyQuarter = quarterPct < 25;

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
      <h2>Momentum Tracker (WoW)</h2>
      {isEarlyQuarter && (
        <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
          Limited data ({quarterPct.toFixed(0)}% of quarter) - trends may not be statistically significant
        </p>
      )}
      <div className="momentum-grid">
        {sorted.map((indicator, idx) => {
          const style = getMomentumTierStyle(indicator.momentum_tier);
          const improvedCommentary = improveCommentary(indicator.momentum_commentary, quarterPct);

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
                  isEarlyQuarter={isEarlyQuarter}
                />
                <TrendIndicator
                  label="SQL"
                  trend={indicator.sql_trend}
                  wowPct={indicator.sql_wow_pct}
                  isEarlyQuarter={isEarlyQuarter}
                />
              </div>
              {improvedCommentary && (
                <p className="momentum-commentary">{improvedCommentary}</p>
              )}
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .momentum-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .momentum-card {
          border: 1px solid;
          border-radius: 8px;
          padding: 12px;
        }
        .momentum-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .region-label {
          font-weight: 600;
          font-size: 0.85rem;
          color: #1f2937;
        }
        .momentum-tier {
          font-size: 0.65rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .trend-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 8px;
          background: rgba(255,255,255,0.5);
          border-radius: 6px;
          padding: 6px;
        }
        .momentum-commentary {
          font-size: 0.7rem;
          color: #4b5563;
          margin: 0;
          text-align: center;
          line-height: 1.3;
        }
      `}</style>
    </section>
  );
}
