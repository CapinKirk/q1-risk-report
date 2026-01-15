'use client';

import { useMemo, useState } from 'react';
import { Region, Product, FunnelByCategoryRow, FunnelBySourceActuals, RAGStatus } from '@/lib/types';

interface FunnelMilestoneAttainmentProps {
  funnelData: {
    POR: FunnelByCategoryRow[];
    R360: FunnelByCategoryRow[];
  };
  funnelBySource?: {
    POR: FunnelBySourceActuals[];
    R360: FunnelBySourceActuals[];
  };
}

interface RegionMilestoneData {
  region: Region;
  mqlActual: number;
  mqlTarget: number;
  mqlAttainmentPct: number;
  mqlRag: RAGStatus;
  sqlActual: number;
  sqlTarget: number;
  sqlAttainmentPct: number;
  sqlRag: RAGStatus;
  salActual: number;
  salTarget: number;
  salAttainmentPct: number;
  salRag: RAGStatus;
  sqoActual: number;
  sqoTarget: number;
  sqoAttainmentPct: number;
  sqoRag: RAGStatus;
  funnelScore: number;
}

interface SourceMilestoneData {
  source: string;
  region: Region;
  product: Product;
  // Actuals
  mqlActual: number;
  sqlActual: number;
  salActual: number;
  sqoActual: number;
  // Targets
  mqlTarget: number;
  sqlTarget: number;
  salTarget: number;
  sqoTarget: number;
  // Pacing percentages
  mqlPacingPct: number;
  sqlPacingPct: number;
  salPacingPct: number;
  sqoPacingPct: number;
  // Conversion rates
  mqlToSqlRate: number;
  sqlToSalRate: number;
  salToSqoRate: number;
}

/**
 * Get RAG status based on attainment percentage
 */
function getRAG(pct: number): RAGStatus {
  if (pct >= 90) return 'GREEN';
  if (pct >= 70) return 'YELLOW';
  return 'RED';
}

/**
 * Get RAG color
 */
function getRagColor(rag: RAGStatus): string {
  switch (rag) {
    case 'GREEN': return '#16a34a';
    case 'YELLOW': return '#ca8a04';
    case 'RED': return '#dc2626';
    default: return '#6b7280';
  }
}

/**
 * Get color for conversion rate
 */
function getConversionColor(rate: number): string {
  if (rate >= 30) return '#16a34a';
  if (rate >= 15) return '#ca8a04';
  return '#dc2626';
}

/**
 * Calculate funnel score - weighted average of milestone attainment
 */
function calculateFunnelScore(mql: number, sql: number, sal: number, sqo: number): number {
  // Weighted average: MQL 15%, SQL 25%, SAL 30%, SQO 30%
  return (mql * 0.15) + (sql * 0.25) + (sal * 0.30) + (sqo * 0.30);
}

export default function FunnelMilestoneAttainment({ funnelData, funnelBySource }: FunnelMilestoneAttainmentProps) {
  const [viewMode, setViewMode] = useState<'region' | 'source'>('source');
  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');

  const regionData = useMemo(() => {
    const allRows = [...funnelData.POR, ...funnelData.R360];

    // Aggregate by region
    const regionMap = new Map<Region, {
      mqlActual: number;
      mqlTarget: number;
      sqlActual: number;
      sqlTarget: number;
      salActual: number;
      salTarget: number;
      sqoActual: number;
      sqoTarget: number;
    }>();

    allRows.forEach(row => {
      const existing = regionMap.get(row.region) || {
        mqlActual: 0, mqlTarget: 0,
        sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0,
        sqoActual: 0, sqoTarget: 0,
      };

      regionMap.set(row.region, {
        mqlActual: existing.mqlActual + (row.actual_mql || 0),
        mqlTarget: existing.mqlTarget + (row.qtd_target_mql || 0),
        sqlActual: existing.sqlActual + (row.actual_sql || 0),
        sqlTarget: existing.sqlTarget + (row.qtd_target_sql || 0),
        salActual: existing.salActual + (row.actual_sal || 0),
        salTarget: existing.salTarget + (row.qtd_target_sal || 0),
        sqoActual: existing.sqoActual + (row.actual_sqo || 0),
        sqoTarget: existing.sqoTarget + (row.qtd_target_sqo || 0),
      });
    });

    // Calculate attainment and funnel score for each region
    const result: RegionMilestoneData[] = [];
    regionMap.forEach((data, region) => {
      const mqlAttainmentPct = data.mqlTarget > 0 ? (data.mqlActual / data.mqlTarget) * 100 : 0;
      const sqlAttainmentPct = data.sqlTarget > 0 ? (data.sqlActual / data.sqlTarget) * 100 : 0;
      const salAttainmentPct = data.salTarget > 0 ? (data.salActual / data.salTarget) * 100 : 0;
      const sqoAttainmentPct = data.sqoTarget > 0 ? (data.sqoActual / data.sqoTarget) * 100 : 0;

      result.push({
        region,
        mqlActual: data.mqlActual,
        mqlTarget: data.mqlTarget,
        mqlAttainmentPct,
        mqlRag: getRAG(mqlAttainmentPct),
        sqlActual: data.sqlActual,
        sqlTarget: data.sqlTarget,
        sqlAttainmentPct,
        sqlRag: getRAG(sqlAttainmentPct),
        salActual: data.salActual,
        salTarget: data.salTarget,
        salAttainmentPct,
        salRag: getRAG(salAttainmentPct),
        sqoActual: data.sqoActual,
        sqoTarget: data.sqoTarget,
        sqoAttainmentPct,
        sqoRag: getRAG(sqoAttainmentPct),
        funnelScore: calculateFunnelScore(mqlAttainmentPct, sqlAttainmentPct, salAttainmentPct, sqoAttainmentPct),
      });
    });

    // Sort by funnel score (worst first)
    return result.sort((a, b) => a.funnelScore - b.funnelScore);
  }, [funnelData]);

  // Process funnel by source data
  const sourceData = useMemo(() => {
    if (!funnelBySource) return [];

    const result: SourceMilestoneData[] = [];

    // Add POR data
    if (selectedProduct === 'ALL' || selectedProduct === 'POR') {
      for (const row of funnelBySource.POR) {
        result.push({
          source: row.source,
          region: row.region,
          product: 'POR',
          mqlActual: row.actual_mql,
          sqlActual: row.actual_sql,
          salActual: row.actual_sal,
          sqoActual: row.actual_sqo,
          mqlTarget: row.target_mql,
          sqlTarget: row.target_sql,
          salTarget: row.target_sal,
          sqoTarget: row.target_sqo,
          mqlPacingPct: row.mql_pacing_pct,
          sqlPacingPct: row.sql_pacing_pct,
          salPacingPct: row.sal_pacing_pct,
          sqoPacingPct: row.sqo_pacing_pct,
          mqlToSqlRate: row.mql_to_sql_rate,
          sqlToSalRate: row.sql_to_sal_rate,
          salToSqoRate: row.sal_to_sqo_rate,
        });
      }
    }

    // Add R360 data
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') {
      for (const row of funnelBySource.R360) {
        result.push({
          source: row.source,
          region: row.region,
          product: 'R360',
          mqlActual: row.actual_mql,
          sqlActual: row.actual_sql,
          salActual: row.actual_sal,
          sqoActual: row.actual_sqo,
          mqlTarget: row.target_mql,
          sqlTarget: row.target_sql,
          salTarget: row.target_sal,
          sqoTarget: row.target_sqo,
          mqlPacingPct: row.mql_pacing_pct,
          sqlPacingPct: row.sql_pacing_pct,
          salPacingPct: row.sal_pacing_pct,
          sqoPacingPct: row.sqo_pacing_pct,
          mqlToSqlRate: row.mql_to_sql_rate,
          sqlToSalRate: row.sql_to_sal_rate,
          salToSqoRate: row.sal_to_sqo_rate,
        });
      }
    }

    // Sort by MQL count (highest first)
    return result.sort((a, b) => b.mqlActual - a.mqlActual);
  }, [funnelBySource, selectedProduct]);

  // Aggregate source data by source (totals across regions)
  const sourceAggregated = useMemo(() => {
    const sourceMap = new Map<string, {
      mqlActual: number;
      sqlActual: number;
      salActual: number;
      sqoActual: number;
      mqlTarget: number;
      sqlTarget: number;
      salTarget: number;
      sqoTarget: number;
    }>();

    sourceData.forEach(row => {
      const existing = sourceMap.get(row.source) || {
        mqlActual: 0, sqlActual: 0, salActual: 0, sqoActual: 0,
        mqlTarget: 0, sqlTarget: 0, salTarget: 0, sqoTarget: 0,
      };
      sourceMap.set(row.source, {
        mqlActual: existing.mqlActual + row.mqlActual,
        sqlActual: existing.sqlActual + row.sqlActual,
        salActual: existing.salActual + row.salActual,
        sqoActual: existing.sqoActual + row.sqoActual,
        mqlTarget: existing.mqlTarget + row.mqlTarget,
        sqlTarget: existing.sqlTarget + row.sqlTarget,
        salTarget: existing.salTarget + row.salTarget,
        sqoTarget: existing.sqoTarget + row.sqoTarget,
      });
    });

    const result: {
      source: string;
      mqlActual: number;
      sqlActual: number;
      salActual: number;
      sqoActual: number;
      mqlTarget: number;
      sqlTarget: number;
      salTarget: number;
      sqoTarget: number;
      mqlPacingPct: number;
      sqlPacingPct: number;
      salPacingPct: number;
      sqoPacingPct: number;
      funnelScore: number;
      mqlToSqlRate: number;
      sqlToSalRate: number;
      salToSqoRate: number;
    }[] = [];

    sourceMap.forEach((data, source) => {
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 0;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 0;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 0;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 0;

      result.push({
        source,
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        funnelScore: calculateFunnelScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
        mqlToSqlRate: data.mqlActual > 0 ? Math.round((data.sqlActual / data.mqlActual) * 1000) / 10 : 0,
        sqlToSalRate: data.sqlActual > 0 ? Math.round((data.salActual / data.sqlActual) * 1000) / 10 : 0,
        salToSqoRate: data.salActual > 0 ? Math.round((data.sqoActual / data.salActual) * 1000) / 10 : 0,
      });
    });

    // Sort by funnel score (worst first)
    return result.sort((a, b) => a.funnelScore - b.funnelScore);
  }, [sourceData]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = regionData.reduce((acc, row) => ({
      mqlActual: acc.mqlActual + row.mqlActual,
      mqlTarget: acc.mqlTarget + row.mqlTarget,
      sqlActual: acc.sqlActual + row.sqlActual,
      sqlTarget: acc.sqlTarget + row.sqlTarget,
      salActual: acc.salActual + row.salActual,
      salTarget: acc.salTarget + row.salTarget,
      sqoActual: acc.sqoActual + row.sqoActual,
      sqoTarget: acc.sqoTarget + row.sqoTarget,
    }), {
      mqlActual: 0, mqlTarget: 0,
      sqlActual: 0, sqlTarget: 0,
      salActual: 0, salTarget: 0,
      sqoActual: 0, sqoTarget: 0,
    });

    const mqlPct = total.mqlTarget > 0 ? (total.mqlActual / total.mqlTarget) * 100 : 0;
    const sqlPct = total.sqlTarget > 0 ? (total.sqlActual / total.sqlTarget) * 100 : 0;
    const salPct = total.salTarget > 0 ? (total.salActual / total.salTarget) * 100 : 0;
    const sqoPct = total.sqoTarget > 0 ? (total.sqoActual / total.sqoTarget) * 100 : 0;

    return {
      mqlPct,
      mqlRag: getRAG(mqlPct),
      sqlPct,
      sqlRag: getRAG(sqlPct),
      salPct,
      salRag: getRAG(salPct),
      sqoPct,
      sqoRag: getRAG(sqoPct),
      funnelScore: calculateFunnelScore(mqlPct, sqlPct, salPct, sqoPct),
    };
  }, [regionData]);

  // Source totals
  const sourceTotals = useMemo(() => {
    const totals = sourceAggregated.reduce((acc, row) => ({
      mqlActual: acc.mqlActual + row.mqlActual,
      sqlActual: acc.sqlActual + row.sqlActual,
      salActual: acc.salActual + row.salActual,
      sqoActual: acc.sqoActual + row.sqoActual,
      mqlTarget: acc.mqlTarget + row.mqlTarget,
      sqlTarget: acc.sqlTarget + row.sqlTarget,
      salTarget: acc.salTarget + row.salTarget,
      sqoTarget: acc.sqoTarget + row.sqoTarget,
    }), {
      mqlActual: 0, sqlActual: 0, salActual: 0, sqoActual: 0,
      mqlTarget: 0, sqlTarget: 0, salTarget: 0, sqoTarget: 0,
    });

    const mqlPacingPct = totals.mqlTarget > 0 ? Math.round((totals.mqlActual / totals.mqlTarget) * 100) : 0;
    const sqlPacingPct = totals.sqlTarget > 0 ? Math.round((totals.sqlActual / totals.sqlTarget) * 100) : 0;
    const salPacingPct = totals.salTarget > 0 ? Math.round((totals.salActual / totals.salTarget) * 100) : 0;
    const sqoPacingPct = totals.sqoTarget > 0 ? Math.round((totals.sqoActual / totals.sqoTarget) * 100) : 0;

    return {
      ...totals,
      mqlPacingPct,
      sqlPacingPct,
      salPacingPct,
      sqoPacingPct,
      funnelScore: calculateFunnelScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
    };
  }, [sourceAggregated]);

  if (regionData.length === 0 && sourceAggregated.length === 0) {
    return null;
  }

  const hasPOR = funnelBySource?.POR && funnelBySource.POR.length > 0;
  const hasR360 = funnelBySource?.R360 && funnelBySource.R360.length > 0;

  return (
    <section>
      <h2>Full Funnel Attainment (MQL → SQO)</h2>

      {/* View Mode Toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'source' ? 'active' : ''}`}
          onClick={() => setViewMode('source')}
        >
          By Source
        </button>
        <button
          className={`toggle-btn ${viewMode === 'region' ? 'active' : ''}`}
          onClick={() => setViewMode('region')}
        >
          By Region
        </button>
        {viewMode === 'source' && (
          <select
            className="product-filter"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value as Product | 'ALL')}
          >
            <option value="ALL">All Products</option>
            {hasPOR && <option value="POR">POR</option>}
            {hasR360 && <option value="R360">R360</option>}
          </select>
        )}
      </div>

      {viewMode === 'source' && sourceAggregated.length > 0 && (
        <>
          <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
            Sorted by funnel score (worst first) | Weights: MQL 15%, SQL 25%, SAL 30%, SQO 30%
          </p>
          <div className="milestone-table-container">
            <table className="milestone-table source-table">
              <thead>
                <tr>
                  <th rowSpan={2}>Source</th>
                  <th colSpan={3}>MQL</th>
                  <th colSpan={3}>SQL</th>
                  <th colSpan={3}>SAL</th>
                  <th colSpan={3}>SQO</th>
                  <th rowSpan={2}>Funnel<br/>Score</th>
                </tr>
                <tr className="sub-header">
                  <th>Actual</th>
                  <th>Target</th>
                  <th>Pacing</th>
                  <th>Actual</th>
                  <th>Target</th>
                  <th>Pacing</th>
                  <th>Actual</th>
                  <th>Target</th>
                  <th>Pacing</th>
                  <th>Actual</th>
                  <th>Target</th>
                  <th>Pacing</th>
                </tr>
              </thead>
              <tbody>
                {sourceAggregated.map(row => (
                  <tr key={row.source}>
                    <td className="source-cell">
                      <span className={`source-badge ${row.source.toLowerCase().replace(/\s+/g, '-')}`}>
                        {row.source}
                      </span>
                    </td>
                    {/* MQL */}
                    <td className="number-cell">{row.mqlActual.toLocaleString()}</td>
                    <td className="number-cell target-cell">{row.mqlTarget.toLocaleString()}</td>
                    <td className="pacing-cell">
                      <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(row.mqlPacingPct)) }}>
                        {row.mqlPacingPct}%
                      </span>
                    </td>
                    {/* SQL */}
                    <td className="number-cell">{row.sqlActual.toLocaleString()}</td>
                    <td className="number-cell target-cell">{row.sqlTarget.toLocaleString()}</td>
                    <td className="pacing-cell">
                      <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(row.sqlPacingPct)) }}>
                        {row.sqlPacingPct}%
                      </span>
                    </td>
                    {/* SAL */}
                    <td className="number-cell">{row.salActual.toLocaleString()}</td>
                    <td className="number-cell target-cell">{row.salTarget.toLocaleString()}</td>
                    <td className="pacing-cell">
                      <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(row.salPacingPct)) }}>
                        {row.salPacingPct}%
                      </span>
                    </td>
                    {/* SQO */}
                    <td className="number-cell">{row.sqoActual.toLocaleString()}</td>
                    <td className="number-cell target-cell">{row.sqoTarget.toLocaleString()}</td>
                    <td className="pacing-cell">
                      <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(row.sqoPacingPct)) }}>
                        {row.sqoPacingPct}%
                      </span>
                    </td>
                    {/* Funnel Score */}
                    <td className="funnel-score-cell">
                      <span
                        className="funnel-score"
                        style={{ backgroundColor: getRagColor(getRAG(row.funnelScore)) }}
                      >
                        {row.funnelScore.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td className="source-cell"><strong>TOTAL</strong></td>
                  {/* MQL */}
                  <td className="number-cell"><strong>{sourceTotals.mqlActual.toLocaleString()}</strong></td>
                  <td className="number-cell target-cell"><strong>{sourceTotals.mqlTarget.toLocaleString()}</strong></td>
                  <td className="pacing-cell">
                    <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(sourceTotals.mqlPacingPct)) }}>
                      <strong>{sourceTotals.mqlPacingPct}%</strong>
                    </span>
                  </td>
                  {/* SQL */}
                  <td className="number-cell"><strong>{sourceTotals.sqlActual.toLocaleString()}</strong></td>
                  <td className="number-cell target-cell"><strong>{sourceTotals.sqlTarget.toLocaleString()}</strong></td>
                  <td className="pacing-cell">
                    <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(sourceTotals.sqlPacingPct)) }}>
                      <strong>{sourceTotals.sqlPacingPct}%</strong>
                    </span>
                  </td>
                  {/* SAL */}
                  <td className="number-cell"><strong>{sourceTotals.salActual.toLocaleString()}</strong></td>
                  <td className="number-cell target-cell"><strong>{sourceTotals.salTarget.toLocaleString()}</strong></td>
                  <td className="pacing-cell">
                    <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(sourceTotals.salPacingPct)) }}>
                      <strong>{sourceTotals.salPacingPct}%</strong>
                    </span>
                  </td>
                  {/* SQO */}
                  <td className="number-cell"><strong>{sourceTotals.sqoActual.toLocaleString()}</strong></td>
                  <td className="number-cell target-cell"><strong>{sourceTotals.sqoTarget.toLocaleString()}</strong></td>
                  <td className="pacing-cell">
                    <span className="pacing-badge" style={{ backgroundColor: getRagColor(getRAG(sourceTotals.sqoPacingPct)) }}>
                      <strong>{sourceTotals.sqoPacingPct}%</strong>
                    </span>
                  </td>
                  {/* Funnel Score */}
                  <td className="funnel-score-cell">
                    <span
                      className="funnel-score"
                      style={{ backgroundColor: getRagColor(getRAG(sourceTotals.funnelScore)) }}
                    >
                      <strong>{sourceTotals.funnelScore.toFixed(0)}%</strong>
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {viewMode === 'region' && (
        <>
          <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '8px' }}>
            Sorted by funnel score (worst first) | Weights: MQL 15%, SQL 25%, SAL 30%, SQO 30%
          </p>
          <div className="milestone-table-container">
            <table className="milestone-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th colSpan={2}>MQL</th>
                  <th colSpan={2}>SQL</th>
                  <th colSpan={2}>SAL</th>
                  <th colSpan={2}>SQO</th>
                  <th>Funnel Score</th>
                </tr>
                <tr className="sub-header">
                  <th></th>
                  <th>Att%</th>
                  <th>RAG</th>
                  <th>Att%</th>
                  <th>RAG</th>
                  <th>Att%</th>
                  <th>RAG</th>
                  <th>Att%</th>
                  <th>RAG</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {regionData.map(row => (
                  <tr key={row.region}>
                    <td className="region-cell">{row.region}</td>
                    <td className="number-cell">{row.mqlAttainmentPct.toFixed(0)}%</td>
                    <td>
                      <span className="rag-badge" style={{ backgroundColor: getRagColor(row.mqlRag) }}>
                        {row.mqlRag}
                      </span>
                    </td>
                    <td className="number-cell">{row.sqlAttainmentPct.toFixed(0)}%</td>
                    <td>
                      <span className="rag-badge" style={{ backgroundColor: getRagColor(row.sqlRag) }}>
                        {row.sqlRag}
                      </span>
                    </td>
                    <td className="number-cell">{row.salAttainmentPct.toFixed(0)}%</td>
                    <td>
                      <span className="rag-badge" style={{ backgroundColor: getRagColor(row.salRag) }}>
                        {row.salRag}
                      </span>
                    </td>
                    <td className="number-cell">{row.sqoAttainmentPct.toFixed(0)}%</td>
                    <td>
                      <span className="rag-badge" style={{ backgroundColor: getRagColor(row.sqoRag) }}>
                        {row.sqoRag}
                      </span>
                    </td>
                    <td className="funnel-score-cell">
                      <span
                        className="funnel-score"
                        style={{ backgroundColor: getRagColor(getRAG(row.funnelScore)) }}
                      >
                        {row.funnelScore.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td className="region-cell"><strong>TOTAL</strong></td>
                  <td className="number-cell"><strong>{totals.mqlPct.toFixed(0)}%</strong></td>
                  <td>
                    <span className="rag-badge" style={{ backgroundColor: getRagColor(totals.mqlRag) }}>
                      {totals.mqlRag}
                    </span>
                  </td>
                  <td className="number-cell"><strong>{totals.sqlPct.toFixed(0)}%</strong></td>
                  <td>
                    <span className="rag-badge" style={{ backgroundColor: getRagColor(totals.sqlRag) }}>
                      {totals.sqlRag}
                    </span>
                  </td>
                  <td className="number-cell"><strong>{totals.salPct.toFixed(0)}%</strong></td>
                  <td>
                    <span className="rag-badge" style={{ backgroundColor: getRagColor(totals.salRag) }}>
                      {totals.salRag}
                    </span>
                  </td>
                  <td className="number-cell"><strong>{totals.sqoPct.toFixed(0)}%</strong></td>
                  <td>
                    <span className="rag-badge" style={{ backgroundColor: getRagColor(totals.sqoRag) }}>
                      {totals.sqoRag}
                    </span>
                  </td>
                  <td className="funnel-score-cell">
                    <span
                      className="funnel-score"
                      style={{ backgroundColor: getRagColor(getRAG(totals.funnelScore)) }}
                    >
                      <strong>{totals.funnelScore.toFixed(0)}%</strong>
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <style jsx>{`
        .view-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          align-items: center;
        }
        .toggle-btn {
          padding: 6px 12px;
          font-size: 0.75rem;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-btn:hover {
          background: #f3f4f6;
        }
        .toggle-btn.active {
          background: #1a1a2e;
          color: white;
          border-color: #1a1a2e;
        }
        .product-filter {
          margin-left: 12px;
          padding: 6px 8px;
          font-size: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          background: white;
        }
        .milestone-table-container {
          overflow-x: auto;
          margin-top: 12px;
        }
        .milestone-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .milestone-table th,
        .milestone-table td {
          padding: 8px 6px;
          border: 1px solid #e5e7eb;
          text-align: center;
        }
        .milestone-table th {
          background-color: #1a1a2e;
          color: white;
          font-weight: 600;
        }
        .sub-header th {
          background-color: #2d2d44;
          color: white;
          font-weight: 500;
          font-size: 0.65rem;
        }
        .region-cell,
        .source-cell {
          text-align: left;
          font-weight: 500;
        }
        .number-cell {
          font-family: monospace;
        }
        .rate-cell {
          font-family: monospace;
          font-weight: 600;
        }
        .rag-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          font-size: 0.6rem;
          font-weight: bold;
        }
        .source-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          background: #e5e7eb;
          color: #1f2937;
        }
        .source-badge.inbound {
          background: #dbeafe;
          color: #1e40af;
        }
        .source-badge.outbound {
          background: #fef3c7;
          color: #92400e;
        }
        .source-badge.ae-sourced {
          background: #dcfce7;
          color: #166534;
        }
        .source-badge.am-sourced {
          background: #f3e8ff;
          color: #7c3aed;
        }
        .source-badge.tradeshow {
          background: #ffe4e6;
          color: #be123c;
        }
        .source-badge.partnerships {
          background: #e0e7ff;
          color: #3730a3;
        }
        .funnel-score-cell {
          background-color: #f9fafb;
        }
        .funnel-score {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          color: white;
          font-weight: bold;
          font-size: 0.75rem;
        }
        .totals-row {
          background-color: #f3f4f6;
        }
        .source-table th {
          font-size: 0.65rem;
        }
        .target-cell {
          color: #6b7280;
          font-size: 0.65rem;
        }
        .pacing-cell {
          padding: 4px;
        }
        .pacing-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          font-size: 0.65rem;
          font-weight: bold;
          min-width: 36px;
          text-align: center;
        }
      `}</style>
    </section>
  );
}
