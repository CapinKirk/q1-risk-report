import { WinBrightSpot } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { getWinRateColor } from '@/lib/constants/dimensions';

interface BrightSpotsProps {
  wins: {
    POR: WinBrightSpot[];
    R360: WinBrightSpot[];
  };
}

function getTierIcon(tier: string): string {
  switch (tier) {
    case 'EXCEPTIONAL': return '★';
    case 'ON_TRACK': return '✓';
    default: return '○';
  }
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'EXCEPTIONAL': return '#16a34a';
    case 'ON_TRACK': return '#2563eb';
    default: return '#6b7280';
  }
}

export default function BrightSpots({ wins }: BrightSpotsProps) {
  const allWins = [...(wins.POR || []), ...(wins.R360 || [])];

  if (allWins.length === 0) {
    return null;
  }

  // Sort by attainment descending
  const sortedWins = allWins.sort((a, b) => b.qtd_attainment_pct - a.qtd_attainment_pct);

  return (
    <section>
      <h2>Wins & Bright Spots</h2>
      <div className="bright-spots-grid">
        {sortedWins.slice(0, 6).map((win, idx) => (
          <div key={idx} className="bright-spot-card card-success">
            <div className="spot-header">
              <span
                className="tier-badge"
                style={{ backgroundColor: getTierColor(win.performance_tier) }}
              >
                {getTierIcon(win.performance_tier)} {win.performance_tier.replace('_', ' ')}
              </span>
              <span className="spot-label">
                {win.product} {win.region} {win.category}
              </span>
            </div>
            <div className="spot-metrics">
              <div className="metric">
                <span className="metric-value" style={{ color: getTierColor(win.performance_tier) }}>
                  {formatPercent(win.qtd_attainment_pct)}
                </span>
                <span className="metric-label">Attainment</span>
              </div>
              <div className="metric">
                <span className="metric-value">{formatCurrency(win.qtd_acv)}</span>
                <span className="metric-label">QTD ACV</span>
              </div>
              <div className="metric">
                <span className="metric-value" style={{ color: getWinRateColor(win.win_rate_pct, win.product, win.category) }}>{win.win_rate_pct}%</span>
                <span className="metric-label">Win Rate</span>
              </div>
            </div>
            <p className="spot-commentary">{win.success_commentary}</p>
            <div className="contributing-factor">
              <strong>Key Factor:</strong> {win.contributing_factor}
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .bright-spots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .bright-spot-card {
          background: var(--success-bg);
          border: 1px solid var(--success-border);
          border-radius: 8px;
          padding: 16px;
        }
        .spot-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }
        .tier-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          color: var(--bg-secondary);
          font-size: 0.75rem;
          font-weight: bold;
          width: fit-content;
        }
        .spot-label {
          font-weight: 600;
          color: var(--text-primary);
        }
        .spot-metrics {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }
        .metric {
          display: flex;
          flex-direction: column;
        }
        .metric-value {
          font-size: 1.25rem;
          font-weight: bold;
        }
        .metric-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .spot-commentary {
          font-size: 0.875rem;
          color: var(--text-primary);
          margin: 8px 0;
          line-height: 1.4;
        }
        .contributing-factor {
          font-size: 0.75rem;
          color: var(--success-text);
          background: var(--bg-tertiary);
          padding: 6px 10px;
          border-radius: 4px;
        }
      `}</style>
    </section>
  );
}
