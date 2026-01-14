'use client';

import { useMemo } from 'react';
import { Region, Product, FunnelByCategoryRow, RAGStatus } from '@/lib/types';

interface FunnelMilestoneAttainmentProps {
  funnelData: {
    POR: FunnelByCategoryRow[];
    R360: FunnelByCategoryRow[];
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
 * Calculate funnel score - weighted average of milestone attainment
 */
function calculateFunnelScore(mql: number, sql: number, sal: number, sqo: number): number {
  // Weighted average: MQL 15%, SQL 25%, SAL 30%, SQO 30%
  return (mql * 0.15) + (sql * 0.25) + (sal * 0.30) + (sqo * 0.30);
}

export default function FunnelMilestoneAttainment({ funnelData }: FunnelMilestoneAttainmentProps) {
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

  if (regionData.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>Pipeline Milestone Attainment</h2>
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
      <style jsx>{`
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
        .region-cell {
          text-align: left;
          font-weight: 500;
        }
        .number-cell {
          font-family: monospace;
        }
        .rag-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          color: white;
          font-size: 0.6rem;
          font-weight: bold;
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
      `}</style>
    </section>
  );
}
