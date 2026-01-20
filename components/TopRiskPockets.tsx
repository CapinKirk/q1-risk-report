import { TopRiskPocket } from '@/lib/types';
import { formatCurrency, formatPercent } from '@/lib/formatters';

interface TopRiskPocketsProps {
  risks: TopRiskPocket[];
}

function getSeverityIcon(attainment: number): string {
  if (attainment < 50) return '!!';
  if (attainment < 70) return '!';
  return '~';
}

function getSeverityColor(attainment: number): string {
  if (attainment < 50) return '#dc2626'; // Critical red
  if (attainment < 70) return '#ea580c'; // Orange
  return '#ca8a04'; // Yellow
}

function getSeverityLabel(attainment: number): string {
  if (attainment < 50) return 'CRITICAL';
  if (attainment < 70) return 'HIGH RISK';
  return 'AT RISK';
}

export default function TopRiskPockets({ risks }: TopRiskPocketsProps) {
  if (!risks || risks.length === 0) {
    return null;
  }

  // Sort by gap (most negative first)
  const sortedRisks = [...risks].sort((a, b) => a.qtd_gap - b.qtd_gap);

  return (
    <section>
      <h2>Top Risk Pockets</h2>
      <div className="risk-pockets-grid">
        {sortedRisks.slice(0, 6).map((risk, idx) => (
          <div key={idx} className="risk-pocket-card">
            <div className="pocket-header">
              <span
                className="severity-badge"
                style={{ backgroundColor: getSeverityColor(risk.qtd_attainment_pct) }}
              >
                {getSeverityIcon(risk.qtd_attainment_pct)} {getSeverityLabel(risk.qtd_attainment_pct)}
              </span>
              <span className="pocket-label">
                {risk.product} {risk.region} {risk.category}
              </span>
            </div>
            <div className="pocket-metrics">
              <div className="metric">
                <span className="metric-value" style={{ color: getSeverityColor(risk.qtd_attainment_pct) }}>
                  {formatPercent(risk.qtd_attainment_pct)}
                </span>
                <span className="metric-label">Attainment</span>
              </div>
              <div className="metric">
                <span className="metric-value gap-negative">
                  {formatCurrency(risk.qtd_gap)}
                </span>
                <span className="metric-label">Gap to Target</span>
              </div>
              <div className="metric">
                <span className="metric-value">{risk.pipeline_coverage_x?.toFixed(1)}x</span>
                <span className="metric-label">Pipeline</span>
              </div>
            </div>
            <div className="pocket-details">
              <div className="detail-row">
                <span>QTD ACV:</span>
                <span>{formatCurrency(risk.qtd_acv)}</span>
              </div>
              <div className="detail-row">
                <span>QTD Target:</span>
                <span>{formatCurrency(risk.qtd_target)}</span>
              </div>
              <div className="detail-row">
                <span>Win Rate:</span>
                <span>{risk.win_rate_pct?.toFixed(0) || 0}%</span>
              </div>
            </div>
            <div className="risk-action">
              <strong>Priority Action:</strong> {
                risk.pipeline_coverage_x < 2
                  ? 'Accelerate pipeline generation'
                  : risk.win_rate_pct < 25
                  ? 'Improve deal conversion'
                  : 'Focus on deal velocity'
              }
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .risk-pockets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .risk-pocket-card {
          background: var(--error-bg);
          border: 1px solid var(--error-border);
          border-radius: 8px;
          padding: 16px;
        }
        .pocket-header {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }
        .severity-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-size: 0.75rem;
          font-weight: bold;
          width: fit-content;
        }
        .pocket-label {
          font-weight: 600;
          color: var(--text-primary);
        }
        .pocket-metrics {
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
        .metric-value.gap-negative {
          color: #dc2626;
        }
        .metric-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
        }
        .pocket-details {
          font-size: 0.875rem;
          margin: 12px 0;
          padding: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
        }
        .risk-action {
          font-size: 0.75rem;
          color: #b91c1c;
          background: rgba(254, 226, 226, 0.5);
          padding: 6px 10px;
          border-radius: 4px;
          margin-top: 8px;
        }
      `}</style>
    </section>
  );
}
