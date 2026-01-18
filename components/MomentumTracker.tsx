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

function getTrendClass(trend: string, isEarlyQuarter: boolean): string {
  const prefix = isEarlyQuarter ? 'trend-muted-' : 'trend-';
  switch (trend) {
    case 'UP': return `${prefix}up`;
    case 'DOWN': return `${prefix}down`;
    case 'FLAT': return `${prefix}flat`;
    default: return `${prefix}flat`;
  }
}

function getMomentumTierClass(tier: string): string {
  switch (tier) {
    case 'STRONG_MOMENTUM':
      return 'momentum-strong';
    case 'MODERATE_MOMENTUM':
      return 'momentum-moderate';
    case 'NO_MOMENTUM':
      return 'momentum-none';
    case 'DECLINING':
      return 'momentum-declining';
    default:
      return 'momentum-default';
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
  const trendClass = getTrendClass(trend, isEarlyQuarter);
  return (
    <div className="trend-indicator">
      <span className="trend-label">{label}</span>
      <span className={`trend-value ${trendClass}`}>
        {getTrendArrow(trend)} {wowPct > 0 ? '+' : ''}{wowPct}%
      </span>
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

  // Sort by momentum tier (strong first), then by attainment (closest to green first)
  const tierOrder = { 'STRONG_MOMENTUM': 0, 'MODERATE_MOMENTUM': 1 };
  const sorted = allIndicators.sort((a, b) => {
    const tierDiff = (tierOrder[a.momentum_tier as keyof typeof tierOrder] || 2) -
      (tierOrder[b.momentum_tier as keyof typeof tierOrder] || 2);
    if (tierDiff !== 0) return tierDiff;
    // Within same tier, sort by gap_to_green (smaller gap = closer to GREEN)
    return (a.gap_to_green || 0) - (b.gap_to_green || 0);
  });

  return (
    <section className="momentum-section">
      <h2>Areas with Momentum</h2>
      <p className="momentum-subtitle">
        YELLOW status areas (70-89%) trending toward GREEN based on strong pipeline (≥2x) or funnel pacing (≥90%)
      </p>
      {isEarlyQuarter && (
        <p className="momentum-caveat">
          Limited data ({quarterPct.toFixed(0)}% of quarter) - trends may not be statistically significant
        </p>
      )}
      <div className="momentum-grid">
        {sorted.map((indicator, idx) => {
          const tierClass = getMomentumTierClass(indicator.momentum_tier);
          const improvedCommentary = improveCommentary(indicator.momentum_commentary, quarterPct);
          const attainmentPct = indicator.current_attainment_pct?.toFixed(0) || '?';
          const gapToGreen = indicator.gap_to_green || 0;
          const pipelineCoverage = indicator.pipeline_coverage_x?.toFixed(1) || '?';

          return (
            <div
              key={idx}
              className={`momentum-card ${tierClass}`}
            >
              <div className="momentum-header">
                <span className="region-label">
                  {indicator.product} {indicator.region}
                </span>
                <span className="momentum-tier-label">
                  {indicator.momentum_tier === 'STRONG_MOMENTUM' ? '🚀 STRONG' : '📈 MODERATE'}
                </span>
              </div>
              <div className="category-label">{indicator.category}</div>
              <div className="attainment-row">
                <div className="attainment-stat">
                  <span className="stat-value stat-yellow">{attainmentPct}%</span>
                  <span className="stat-label">Attainment</span>
                </div>
                <div className="attainment-stat">
                  <span className="stat-value">{gapToGreen}%</span>
                  <span className="stat-label">Gap to GREEN</span>
                </div>
                <div className="attainment-stat">
                  <span className="stat-value">{pipelineCoverage}x</span>
                  <span className="stat-label">Pipeline</span>
                </div>
              </div>
              <div className="trend-row">
                <TrendIndicator
                  label="MQL/EQL"
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
    </section>
  );
}
