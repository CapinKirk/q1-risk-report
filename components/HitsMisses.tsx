'use client';

import { useMemo, useCallback } from 'react';
import { ReportData, AttainmentRow } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getRAGClass, getAttainmentColor, getRAGBadgeColor } from '@/lib/formatters';
import { getWinRateColor } from '@/lib/constants/dimensions';
import { useSortableTable } from '@/lib/useSortableTable';
import SortableHeader from './SortableHeader';
import RegionBadge from './RegionBadge';

interface HitsMissesProps {
  data: ReportData;
}

type AttainmentWithProduct = AttainmentRow & { product: 'POR' | 'R360' };

function HitsTable({ hits }: { hits: AttainmentWithProduct[] }) {
  // Default sort by attainment (best first)
  const defaultSorted = useMemo(() =>
    [...hits].sort((a, b) => (b.qtd_attainment_pct || 0) - (a.qtd_attainment_pct || 0)),
    [hits]
  );

  const getColumnValue = useCallback((row: AttainmentWithProduct, column: string) => {
    switch (column) {
      case 'product': return row.product;
      case 'region': return row.region;
      case 'category': return row.category;
      case 'qtd_attainment_pct': return row.qtd_attainment_pct || 0;
      case 'qtd_acv': return row.qtd_acv || 0;
      case 'pipeline_coverage_x': return row.pipeline_coverage_x || 0;
      case 'win_rate_pct': return row.win_rate_pct || 0;
      default: return null;
    }
  }, []);

  const { sortedData, handleSort, getSortDirection } = useSortableTable(hits, defaultSorted, getColumnValue);

  if (sortedData.length === 0) return null;

  return (
    <>
      <h3 style={{ color: '#28a745' }}>HITS - On Track</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Prod" column="product" sortDirection={getSortDirection('product')} onSort={handleSort} />
              <SortableHeader label="Region" column="region" sortDirection={getSortDirection('region')} onSort={handleSort} />
              <SortableHeader label="Cat" column="category" sortDirection={getSortDirection('category')} onSort={handleSort} />
              <SortableHeader label="Att%" column="qtd_attainment_pct" sortDirection={getSortDirection('qtd_attainment_pct')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Act" column="qtd_acv" sortDirection={getSortDirection('qtd_acv')} onSort={handleSort} className="right" />
              <SortableHeader label="Coverage" column="pipeline_coverage_x" sortDirection={getSortDirection('pipeline_coverage_x')} onSort={handleSort} className="right" />
              <SortableHeader label="Win Rate" column="win_rate_pct" sortDirection={getSortDirection('win_rate_pct')} onSort={handleSort} className="right" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((h, idx) => (
              <tr key={`hit-${idx}`} className="hit-row">
                <td>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: h.product === 'POR' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#ffffff',
                  }}>
                    {h.product}
                  </span>
                </td>
                <td><RegionBadge region={h.region} /></td>
                <td>{h.category}</td>
                <td className="right" style={{ color: getAttainmentColor(h.qtd_attainment_pct), fontWeight: 700 }}>
                  {formatPercent(h.qtd_attainment_pct)}
                </td>
                <td className="right">{formatCurrency(h.qtd_acv)}</td>
                <td className={`right coverage-cell ${(h.pipeline_coverage_x || 0) >= 3 ? 'status-green' : (h.pipeline_coverage_x || 0) >= 2 ? 'status-yellow' : 'status-red'}`}>
                  <strong>{formatCoverage(h.pipeline_coverage_x)}</strong>
                </td>
                <td className="right win-rate-color" style={{ '--win-rate-color': getWinRateColor(h.win_rate_pct, h.product, h.category) } as React.CSSProperties}>
                  {formatPercent(h.win_rate_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MissesTable({
  misses,
  generateRCA,
}: {
  misses: AttainmentWithProduct[];
  generateRCA: (m: AttainmentWithProduct) => { rca: string; action: string };
}) {
  // Default sort by gap (worst first)
  const defaultSorted = useMemo(() =>
    [...misses].sort((a, b) => (a.qtd_gap || 0) - (b.qtd_gap || 0)),
    [misses]
  );

  const getColumnValue = useCallback((row: AttainmentWithProduct, column: string) => {
    switch (column) {
      case 'product': return row.product;
      case 'region': return row.region;
      case 'category': return row.category;
      case 'qtd_attainment_pct': return row.qtd_attainment_pct || 0;
      case 'qtd_gap': return row.qtd_gap || 0;
      case 'pipeline_coverage_x': return row.pipeline_coverage_x || 0;
      default: return null;
    }
  }, []);

  const { sortedData, handleSort, getSortDirection } = useSortableTable(misses, defaultSorted, getColumnValue);

  if (sortedData.length === 0) return null;

  return (
    <>
      <h3 style={{ color: '#dc3545', marginTop: '15px' }}>MISSES - Needs Attention</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Prod" column="product" sortDirection={getSortDirection('product')} onSort={handleSort} style={{ width: '7%' }} />
              <SortableHeader label="Region" column="region" sortDirection={getSortDirection('region')} onSort={handleSort} style={{ width: '7%' }} />
              <SortableHeader label="Cat" column="category" sortDirection={getSortDirection('category')} onSort={handleSort} style={{ width: '9%' }} />
              <SortableHeader label="Att%" column="qtd_attainment_pct" sortDirection={getSortDirection('qtd_attainment_pct')} onSort={handleSort} className="right" style={{ width: '7%' }} />
              <SortableHeader label="QTD Var" column="qtd_gap" sortDirection={getSortDirection('qtd_gap')} onSort={handleSort} className="right" style={{ width: '9%' }} />
              <SortableHeader label="Cov" column="pipeline_coverage_x" sortDirection={getSortDirection('pipeline_coverage_x')} onSort={handleSort} className="right" style={{ width: '7%' }} />
              <th style={{ width: '54%' }}>RCA / Action (incl. funnel & loss analysis)</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((m, idx) => {
              const rag = m.rag_status || 'RED';
              const rowClass = rag === 'YELLOW' ? 'miss-row yellow' : 'miss-row';
              const { rca, action } = generateRCA(m);

              return (
                <tr key={`miss-${idx}`} className={rowClass}>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: m.product === 'POR' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: '#ffffff',
                    }}>
                      {m.product}
                    </span>
                  </td>
                  <td><RegionBadge region={m.region} /></td>
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
  );
}

export default function HitsMisses({ data }: HitsMissesProps) {
  const { attainment_detail, funnel_by_category, loss_reason_rca, pipeline_rca } = data;

  // Combine all attainment data with product info
  const allAttainment = useMemo(() => [
    ...attainment_detail.POR.map(a => ({ ...a, product: 'POR' as const })),
    ...attainment_detail.R360.map(a => ({ ...a, product: 'R360' as const }))
  ], [attainment_detail]);

  const hits = useMemo(() =>
    allAttainment.filter(a => a.rag_status === 'GREEN').slice(0, 5),
    [allAttainment]
  );

  const misses = useMemo(() =>
    allAttainment.filter(a => a.rag_status === 'RED' || a.rag_status === 'YELLOW').slice(0, 10),
    [allAttainment]
  );

  // Generate enhanced RCA for a miss
  const generateRCA = useCallback((m: AttainmentWithProduct) => {
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
  }, [funnel_by_category, loss_reason_rca, pipeline_rca]);

  return (
    <section>
      <h2>4. Hits & Misses with RCA</h2>
      <HitsTable hits={hits} />
      <MissesTable misses={misses} generateRCA={generateRCA} />
    </section>
  );
}
