'use client';

import { useMemo, useState } from 'react';
import { Region, Product, Category, FunnelByCategoryRow, FunnelBySourceActuals, RAGStatus } from '@/lib/types';

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRAG(pct: number): RAGStatus {
  if (pct >= 90) return 'GREEN';
  if (pct >= 70) return 'YELLOW';
  return 'RED';
}

function getRagColor(rag: RAGStatus): string {
  switch (rag) {
    case 'GREEN': return '#16a34a';
    case 'YELLOW': return '#ca8a04';
    case 'RED': return '#dc2626';
    default: return '#6b7280';
  }
}

/**
 * TOF Score: Weighted attainment across funnel stages
 * EQL/MQL=10%, SQL=20%, SAL=30%, SQO=40%
 */
function calculateTOFScore(mql: number, sql: number, sal: number, sqo: number): number {
  return Math.round((mql * 0.10) + (sql * 0.20) + (sal * 0.30) + (sqo * 0.40));
}

function getLeadStageLabel(category: Category): 'MQL' | 'EQL' {
  return category === 'NEW LOGO' ? 'MQL' : 'EQL';
}

// ============================================================================
// INTERFACES
// ============================================================================

interface CategoryMilestoneData {
  category: Category;
  leadStageLabel: 'MQL' | 'EQL';
  mqlActual: number;
  mqlTarget: number;
  mqlPacingPct: number;
  sqlActual: number;
  sqlTarget: number;
  sqlPacingPct: number;
  salActual: number;
  salTarget: number;
  salPacingPct: number;
  sqoActual: number;
  sqoTarget: number;
  sqoPacingPct: number;
  tofScore: number;
}

interface SourceMilestoneData {
  source: string;
  mqlActual: number;
  mqlTarget: number;
  mqlPacingPct: number;
  sqlActual: number;
  sqlTarget: number;
  sqlPacingPct: number;
  salActual: number;
  salTarget: number;
  salPacingPct: number;
  sqoActual: number;
  sqoTarget: number;
  sqoPacingPct: number;
  tofScore: number;
}

interface RegionMilestoneData {
  region: Region;
  mqlActual: number;
  mqlTarget: number;
  mqlPacingPct: number;
  sqlActual: number;
  sqlTarget: number;
  sqlPacingPct: number;
  salActual: number;
  salTarget: number;
  salPacingPct: number;
  sqoActual: number;
  sqoTarget: number;
  sqoPacingPct: number;
  tofScore: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FunnelMilestoneAttainment({ funnelData, funnelBySource }: FunnelMilestoneAttainmentProps) {
  const [viewMode, setViewMode] = useState<'category' | 'source' | 'region'>('category');
  const [selectedProduct, setSelectedProduct] = useState<Product | 'ALL'>('ALL');

  // Process by CATEGORY (NEW LOGO=MQL, EXPANSION/MIGRATION=EQL)
  const categoryData = useMemo(() => {
    const allRows = [...funnelData.POR, ...funnelData.R360];
    const funnelCategories: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION'];

    const categoryMap = new Map<Category, {
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    allRows.forEach(row => {
      if (!funnelCategories.includes(row.category)) return;
      const existing = categoryMap.get(row.category) || {
        mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
      };
      categoryMap.set(row.category, {
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

    const result: CategoryMilestoneData[] = [];
    categoryMap.forEach((data, category) => {
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 100;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 100;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 100;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 100;

      result.push({
        category,
        leadStageLabel: getLeadStageLabel(category),
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [funnelData]);

  // Process by SOURCE
  const sourceData = useMemo(() => {
    if (!funnelBySource) return [];

    const sourceMap = new Map<string, {
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    const processProduct = (rows: FunnelBySourceActuals[]) => {
      rows.forEach(row => {
        const existing = sourceMap.get(row.source) || {
          mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
          salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
        };
        sourceMap.set(row.source, {
          mqlActual: existing.mqlActual + row.actual_mql,
          mqlTarget: existing.mqlTarget + row.target_mql,
          sqlActual: existing.sqlActual + row.actual_sql,
          sqlTarget: existing.sqlTarget + row.target_sql,
          salActual: existing.salActual + row.actual_sal,
          salTarget: existing.salTarget + row.target_sal,
          sqoActual: existing.sqoActual + row.actual_sqo,
          sqoTarget: existing.sqoTarget + row.target_sqo,
        });
      });
    };

    if (selectedProduct === 'ALL' || selectedProduct === 'POR') processProduct(funnelBySource.POR);
    if (selectedProduct === 'ALL' || selectedProduct === 'R360') processProduct(funnelBySource.R360);

    const result: SourceMilestoneData[] = [];
    sourceMap.forEach((data, source) => {
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 100;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 100;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 100;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 100;

      // Skip sources with no targets
      if (data.mqlTarget === 0 && data.sqlTarget === 0 && data.salTarget === 0 && data.sqoTarget === 0) return;

      result.push({
        source,
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [funnelBySource, selectedProduct]);

  // Process by REGION
  const regionData = useMemo(() => {
    const allRows = [...funnelData.POR, ...funnelData.R360];

    const regionMap = new Map<Region, {
      mqlActual: number; mqlTarget: number;
      sqlActual: number; sqlTarget: number;
      salActual: number; salTarget: number;
      sqoActual: number; sqoTarget: number;
    }>();

    allRows.forEach(row => {
      const existing = regionMap.get(row.region) || {
        mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
        salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
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

    const result: RegionMilestoneData[] = [];
    regionMap.forEach((data, region) => {
      const mqlPacingPct = data.mqlTarget > 0 ? Math.round((data.mqlActual / data.mqlTarget) * 100) : 100;
      const sqlPacingPct = data.sqlTarget > 0 ? Math.round((data.sqlActual / data.sqlTarget) * 100) : 100;
      const salPacingPct = data.salTarget > 0 ? Math.round((data.salActual / data.salTarget) * 100) : 100;
      const sqoPacingPct = data.sqoTarget > 0 ? Math.round((data.sqoActual / data.sqoTarget) * 100) : 100;

      result.push({
        region,
        ...data,
        mqlPacingPct,
        sqlPacingPct,
        salPacingPct,
        sqoPacingPct,
        tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
      });
    });

    return result.sort((a, b) => a.tofScore - b.tofScore);
  }, [funnelData]);

  // Calculate totals for footer
  const totals = useMemo(() => {
    const data = viewMode === 'category' ? categoryData : viewMode === 'source' ? sourceData : regionData;
    const total = data.reduce((acc, row) => ({
      mqlActual: acc.mqlActual + row.mqlActual,
      mqlTarget: acc.mqlTarget + row.mqlTarget,
      sqlActual: acc.sqlActual + row.sqlActual,
      sqlTarget: acc.sqlTarget + row.sqlTarget,
      salActual: acc.salActual + row.salActual,
      salTarget: acc.salTarget + row.salTarget,
      sqoActual: acc.sqoActual + row.sqoActual,
      sqoTarget: acc.sqoTarget + row.sqoTarget,
    }), {
      mqlActual: 0, mqlTarget: 0, sqlActual: 0, sqlTarget: 0,
      salActual: 0, salTarget: 0, sqoActual: 0, sqoTarget: 0,
    });

    const mqlPacingPct = total.mqlTarget > 0 ? Math.round((total.mqlActual / total.mqlTarget) * 100) : 100;
    const sqlPacingPct = total.sqlTarget > 0 ? Math.round((total.sqlActual / total.sqlTarget) * 100) : 100;
    const salPacingPct = total.salTarget > 0 ? Math.round((total.salActual / total.salTarget) * 100) : 100;
    const sqoPacingPct = total.sqoTarget > 0 ? Math.round((total.sqoActual / total.sqoTarget) * 100) : 100;

    return {
      ...total,
      mqlPacingPct,
      sqlPacingPct,
      salPacingPct,
      sqoPacingPct,
      tofScore: calculateTOFScore(mqlPacingPct, sqlPacingPct, salPacingPct, sqoPacingPct),
    };
  }, [viewMode, categoryData, sourceData, regionData]);

  if (categoryData.length === 0 && sourceData.length === 0 && regionData.length === 0) {
    return null;
  }

  const hasPOR = funnelBySource?.POR && funnelBySource.POR.length > 0;
  const hasR360 = funnelBySource?.R360 && funnelBySource.R360.length > 0;

  // Reusable table row renderer
  const renderStageColumns = (row: { mqlActual: number; mqlTarget: number; mqlPacingPct: number; sqlActual: number; sqlTarget: number; sqlPacingPct: number; salActual: number; salTarget: number; salPacingPct: number; sqoActual: number; sqoTarget: number; sqoPacingPct: number; tofScore: number }, isBold = false) => (
    <>
      <td className="number-cell">{isBold ? <strong>{row.mqlActual.toLocaleString()}</strong> : row.mqlActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.mqlTarget.toLocaleString()}</strong> : row.mqlTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.mqlPacingPct)) }}>
          {isBold ? <strong>{row.mqlPacingPct}%</strong> : `${row.mqlPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">{isBold ? <strong>{row.sqlActual.toLocaleString()}</strong> : row.sqlActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.sqlTarget.toLocaleString()}</strong> : row.sqlTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.sqlPacingPct)) }}>
          {isBold ? <strong>{row.sqlPacingPct}%</strong> : `${row.sqlPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">{isBold ? <strong>{row.salActual.toLocaleString()}</strong> : row.salActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.salTarget.toLocaleString()}</strong> : row.salTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.salPacingPct)) }}>
          {isBold ? <strong>{row.salPacingPct}%</strong> : `${row.salPacingPct}%`}
        </span>
      </td>
      <td className="number-cell">{isBold ? <strong>{row.sqoActual.toLocaleString()}</strong> : row.sqoActual.toLocaleString()}</td>
      <td className="number-cell target-cell">{isBold ? <strong>{row.sqoTarget.toLocaleString()}</strong> : row.sqoTarget.toLocaleString()}</td>
      <td className="pacing-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.sqoPacingPct)) }}>
          {isBold ? <strong>{row.sqoPacingPct}%</strong> : `${row.sqoPacingPct}%`}
        </span>
      </td>
      <td className="tof-score-cell">
        <span className="rag-tile" style={{ backgroundColor: getRagColor(getRAG(row.tofScore)), padding: '4px 10px' }}>
          {isBold ? <strong>{row.tofScore}%</strong> : `${row.tofScore}%`}
        </span>
      </td>
    </>
  );

  return (
    <section>
      <h2>Full Funnel Pacing (EQL/MQL → SQO)</h2>
      <p className="section-subtitle">
        <span className="lead-label mql">MQL</span> Marketing Qualified Lead (NEW LOGO)
        <span className="separator">|</span>
        <span className="lead-label eql">EQL</span> Existing Qualified Lead (EXPANSION, MIGRATION)
        <span className="separator">|</span>
        <span className="tof-label">TOF Score</span> = 10% EQL/MQL + 20% SQL + 30% SAL + 40% SQO
      </p>

      {/* View Mode Toggle */}
      <div className="view-toggle">
        <button className={`toggle-btn ${viewMode === 'category' ? 'active' : ''}`} onClick={() => setViewMode('category')}>
          By Category
        </button>
        <button className={`toggle-btn ${viewMode === 'source' ? 'active' : ''}`} onClick={() => setViewMode('source')}>
          By Source
        </button>
        <button className={`toggle-btn ${viewMode === 'region' ? 'active' : ''}`} onClick={() => setViewMode('region')}>
          By Region
        </button>
        {viewMode === 'source' && (
          <select className="product-filter" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value as Product | 'ALL')}>
            <option value="ALL">All Products</option>
            {hasPOR && <option value="POR">POR</option>}
            {hasR360 && <option value="R360">R360</option>}
          </select>
        )}
      </div>

      <div className="table-container">
        <table className="funnel-table">
          <thead>
            <tr>
              <th rowSpan={2}>{viewMode === 'category' ? 'Category' : viewMode === 'source' ? 'Source' : 'Region'}</th>
              <th colSpan={3}>EQL/MQL</th>
              <th colSpan={3}>SQL</th>
              <th colSpan={3}>SAL</th>
              <th colSpan={3}>SQO</th>
              <th rowSpan={2}>TOF<br/>Score</th>
            </tr>
            <tr className="sub-header">
              <th>Act</th><th>Tgt</th><th>Pace</th>
              <th>Act</th><th>Tgt</th><th>Pace</th>
              <th>Act</th><th>Tgt</th><th>Pace</th>
              <th>Act</th><th>Tgt</th><th>Pace</th>
            </tr>
          </thead>
          <tbody>
            {viewMode === 'category' && categoryData.map(row => (
              <tr key={row.category}>
                <td className="label-cell">
                  <span className={`category-badge ${row.category.toLowerCase().replace(/\s+/g, '-')}`}>
                    {row.category}
                  </span>
                  <span className={`lead-badge ${row.leadStageLabel.toLowerCase()}`}>{row.leadStageLabel}</span>
                </td>
                {renderStageColumns(row)}
              </tr>
            ))}
            {viewMode === 'source' && sourceData.map(row => (
              <tr key={row.source}>
                <td className="label-cell">
                  <span className={`source-badge ${row.source.toLowerCase().replace(/\s+/g, '-')}`}>
                    {row.source}
                  </span>
                </td>
                {renderStageColumns(row)}
              </tr>
            ))}
            {viewMode === 'region' && regionData.map(row => (
              <tr key={row.region}>
                <td className="label-cell region">{row.region}</td>
                {renderStageColumns(row)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="totals-row">
              <td className="label-cell"><strong>TOTAL</strong></td>
              {renderStageColumns(totals, true)}
            </tr>
          </tfoot>
        </table>
      </div>

      <style jsx>{`
        .section-subtitle {
          font-size: 10px;
          color: #6b7280;
          margin: -4px 0 12px 0;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .lead-label {
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 9px;
        }
        .lead-label.mql { background: #dbeafe; color: #1e40af; }
        .lead-label.eql { background: #dcfce7; color: #166534; }
        .tof-label { font-weight: 600; color: #374151; }
        .separator { color: #d1d5db; }

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
        .toggle-btn:hover { background: #f3f4f6; }
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

        .table-container {
          overflow-x: auto;
        }
        .funnel-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.7rem;
        }
        .funnel-table th,
        .funnel-table td {
          padding: 6px 4px;
          border: 1px solid #e5e7eb;
          text-align: center;
        }
        .funnel-table th {
          background-color: #1a1a2e;
          color: white;
          font-weight: 600;
          font-size: 0.65rem;
        }
        .sub-header th {
          background-color: #2d2d44;
          font-weight: 500;
          font-size: 0.6rem;
          padding: 4px 2px;
        }
        .label-cell {
          text-align: left;
          font-weight: 500;
          white-space: nowrap;
        }
        .label-cell.region {
          font-weight: 600;
        }
        .number-cell {
          font-family: monospace;
          font-size: 0.65rem;
        }
        .target-cell {
          color: #9ca3af;
        }
        .pacing-cell {
          padding: 3px;
        }
        .tof-score-cell {
          background-color: #f9fafb;
          padding: 3px;
        }
        .totals-row {
          background-color: #f3f4f6;
        }

        /* Category badges */
        .category-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.6rem;
          font-weight: 600;
          margin-right: 4px;
        }
        .category-badge.new-logo { background: #dbeafe; color: #1e40af; }
        .category-badge.expansion { background: #dcfce7; color: #166534; }
        .category-badge.migration { background: #fef3c7; color: #92400e; }

        .lead-badge {
          display: inline-block;
          padding: 1px 5px;
          border-radius: 10px;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.3px;
        }
        .lead-badge.mql { background: #dbeafe; color: #1e40af; }
        .lead-badge.eql { background: #dcfce7; color: #166534; }

        /* Source badges */
        .source-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.6rem;
          font-weight: 600;
          background: #e5e7eb;
          color: #1f2937;
        }
        .source-badge.inbound { background: #dbeafe; color: #1e40af; }
        .source-badge.outbound { background: #fef3c7; color: #92400e; }
        .source-badge.ae-sourced { background: #dcfce7; color: #166534; }
        .source-badge.am-sourced { background: #f3e8ff; color: #7c3aed; }
        .source-badge.tradeshow { background: #ffe4e6; color: #be123c; }
        .source-badge.partnerships { background: #e0e7ff; color: #3730a3; }
      `}</style>
    </section>
  );
}
