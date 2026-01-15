import { ReportData, AttainmentRow } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getRAGClass, getAttainmentColor, getRAGBadgeColor } from '@/lib/formatters';

interface HitsMissesProps {
  data: ReportData;
}

export default function HitsMisses({ data }: HitsMissesProps) {
  const { attainment_detail, funnel_by_category, loss_reason_rca, pipeline_rca } = data;

  // Combine all attainment data with product info
  const allAttainment = [
    ...attainment_detail.POR.map(a => ({ ...a, product: 'POR' as const })),
    ...attainment_detail.R360.map(a => ({ ...a, product: 'R360' as const }))
  ];

  const hits = allAttainment.filter(a => a.rag_status === 'GREEN');
  const misses = allAttainment.filter(a => a.rag_status === 'RED' || a.rag_status === 'YELLOW');

  // Sort hits by attainment (best first)
  const sortedHits = [...hits].sort((a, b) => (b.qtd_attainment_pct || 0) - (a.qtd_attainment_pct || 0)).slice(0, 5);

  // Sort misses by gap (worst first)
  const sortedMisses = [...misses].sort((a, b) => (a.qtd_gap || 0) - (b.qtd_gap || 0)).slice(0, 10);

  // Generate enhanced RCA for a miss
  const generateRCA = (m: AttainmentRow & { product: 'POR' | 'R360' }) => {
    const rcaParts: string[] = [];
    const actionParts: string[] = [];

    // Get funnel issues for this region
    const funnelData = funnel_by_category[m.product] || [];
    const funnel = funnelData.find(f => f.region === m.region);
    if (funnel) {
      const issues: string[] = [];
      if ((funnel.mql_pacing_pct || 0) < 70) issues.push(`MQL at ${Math.round(funnel.mql_pacing_pct || 0)}%`);
      if ((funnel.sql_pacing_pct || 0) < 70) issues.push(`SQL at ${Math.round(funnel.sql_pacing_pct || 0)}%`);
      if ((funnel.sal_pacing_pct || 0) < 70) issues.push(`SAL at ${Math.round(funnel.sal_pacing_pct || 0)}%`);
      if ((funnel.sqo_pacing_pct || 0) < 70) issues.push(`SQO at ${Math.round(funnel.sqo_pacing_pct || 0)}%`);
      if (issues.length > 0) rcaParts.push(`Funnel gaps: ${issues.slice(0, 2).join(', ')}`);
    }

    // Get loss analysis
    const lossData = loss_reason_rca[m.product] || [];
    const losses = lossData.filter(l => l.region === m.region);
    if (losses.length > 0) {
      const topLosses = losses.slice(0, 2).map(l => l.loss_reason);
      rcaParts.push(`Top losses: ${topLosses.join(', ')}`);
    }

    // Get pipeline RCA
    const pRCA = (pipeline_rca[m.product] || []).find(p => p.region === m.region);
    if (pRCA?.rca_commentary) {
      rcaParts.push(pRCA.rca_commentary);
    }
    if (pRCA?.recommended_action) {
      actionParts.push(pRCA.recommended_action);
    }

    // Default actions based on issues
    if (rcaParts.join(' ').includes('MQL')) actionParts.push('Increase top-of-funnel marketing');
    if (rcaParts.join(' ').includes('SQO')) actionParts.push('Improve qualification process');

    return {
      rca: rcaParts.length > 0 ? rcaParts.slice(0, 3).join('. ') : 'Analysis in progress',
      action: actionParts.length > 0 ? actionParts.slice(0, 2).join('; ') : 'Review pipeline'
    };
  };

  return (
    <section>
      <h2>4. Hits & Misses with RCA</h2>

      {/* Hits Table */}
      {sortedHits.length > 0 && (
        <>
          <h3 style={{ color: '#28a745' }}>HITS - On Track</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Prod</th>
                  <th>Region</th>
                  <th>Cat</th>
                  <th className="right">Att%</th>
                  <th className="right">QTD Act</th>
                  <th className="right">Cov</th>
                  <th className="right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {sortedHits.map((h, idx) => (
                  <tr key={`hit-${idx}`} className="hit-row">
                    <td>{h.product}</td>
                    <td>{h.region}</td>
                    <td>{h.category}</td>
                    <td className="right" style={{ color: getAttainmentColor(h.qtd_attainment_pct), fontWeight: 700 }}>
                      {formatPercent(h.qtd_attainment_pct)}
                    </td>
                    <td className="right">{formatCurrency(h.qtd_acv)}</td>
                    <td className="right">{formatCoverage(h.pipeline_coverage_x)}</td>
                    <td className="right" style={{ color: getAttainmentColor(h.win_rate_pct), fontWeight: 600 }}>
                      {formatPercent(h.win_rate_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Misses Table */}
      {sortedMisses.length > 0 && (
        <>
          <h3 style={{ color: '#dc3545', marginTop: '15px' }}>MISSES - Needs Attention</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '7%' }}>Prod</th>
                  <th style={{ width: '7%' }}>Region</th>
                  <th style={{ width: '9%' }}>Cat</th>
                  <th style={{ width: '7%' }} className="right">Att%</th>
                  <th style={{ width: '9%' }} className="right">Gap</th>
                  <th style={{ width: '7%' }} className="right">Cov</th>
                  <th style={{ width: '54%' }}>RCA / Action (incl. funnel & loss analysis)</th>
                </tr>
              </thead>
              <tbody>
                {sortedMisses.map((m, idx) => {
                  const rag = m.rag_status || 'RED';
                  const rowClass = rag === 'YELLOW' ? 'miss-row yellow' : 'miss-row';
                  const { rca, action } = generateRCA(m);

                  return (
                    <tr key={`miss-${idx}`} className={rowClass}>
                      <td>{m.product}</td>
                      <td>{m.region}</td>
                      <td>{m.category}</td>
                      <td className="right" style={{ color: getAttainmentColor(m.qtd_attainment_pct), fontWeight: 700 }}>
                        {formatPercent(m.qtd_attainment_pct)}
                      </td>
                      <td className="right" style={{ color: '#dc2626' }}>{formatCurrency(m.qtd_gap)}</td>
                      <td className="right">{formatCoverage(m.pipeline_coverage_x)}</td>
                      <td style={{ fontSize: '10px' }}>{rca} → {action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
