'use client';

import { useMemo, useCallback } from 'react';
import { ReportData, Product, SourceAttainmentRow, FunnelByCategoryRow, FunnelBySourceRow } from '@/lib/types';
import { formatCurrency, formatPercent, getRAGClass, getGapColor, getPctClass, getAttainmentColor, getRAGBadgeColor } from '@/lib/formatters';
import { useSortableTable } from '@/lib/useSortableTable';
import SortableHeader from './SortableHeader';

interface SourceAttainmentProps {
  data: ReportData;
}

function SourceACVTable({ product, rows, period }: { product: Product; rows: SourceAttainmentRow[]; period: { as_of_date: string; quarter_pct_complete: number; days_elapsed: number; total_days: number } }) {
  // Default sort by attainment (worst first)
  const defaultSorted = useMemo(() =>
    [...rows].sort((a, b) => (a.attainment_pct || 0) - (b.attainment_pct || 0)),
    [rows]
  );

  const getColumnValue = useCallback((row: SourceAttainmentRow, column: string) => {
    switch (column) {
      case 'region': return row.region;
      case 'source': return row.source;
      case 'q1_target': return row.q1_target || 0;
      case 'qtd_target': return row.qtd_target || 0;
      case 'qtd_acv': return row.qtd_acv || 0;
      case 'attainment_pct': return row.attainment_pct || 0;
      case 'gap': return row.gap || 0;
      case 'rag_status': return row.rag_status || '';
      default: return null;
    }
  }, []);

  const { sortedData, handleSort, getSortDirection } = useSortableTable(rows, defaultSorted, getColumnValue);

  return (
    <>
      <h3>{product} ACV by Source</h3>
      <p style={{ fontSize: '10px', color: '#666', margin: '3px 0' }}>
        As of {period.as_of_date} ({period.quarter_pct_complete.toFixed(1)}% Q1 - Day {period.days_elapsed}/{period.total_days})
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Region" column="region" sortDirection={getSortDirection('region')} onSort={handleSort} />
              <SortableHeader label="Source" column="source" sortDirection={getSortDirection('source')} onSort={handleSort} />
              <SortableHeader label="Q1 Tgt" column="q1_target" sortDirection={getSortDirection('q1_target')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Tgt" column="qtd_target" sortDirection={getSortDirection('qtd_target')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Act" column="qtd_acv" sortDirection={getSortDirection('qtd_acv')} onSort={handleSort} className="right" />
              <SortableHeader label="Att%" column="attainment_pct" sortDirection={getSortDirection('attainment_pct')} onSort={handleSort} className="right" />
              <SortableHeader label="QTD Var" column="gap" sortDirection={getSortDirection('gap')} onSort={handleSort} className="right" />
              <SortableHeader label="RAG" column="rag_status" sortDirection={getSortDirection('rag_status')} onSort={handleSort} className="center" />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const attPct = row.attainment_pct || 0;
              const gap = row.gap || 0;
              const rag = row.rag_status || 'RED';

              return (
                <tr key={`${row.region}-${row.source}-${idx}`}>
                  <td>{row.region}</td>
                  <td>{row.source}</td>
                  <td className="right">{formatCurrency(row.q1_target)}</td>
                  <td className="right">{formatCurrency(row.qtd_target)}</td>
                  <td className="right">{formatCurrency(row.qtd_acv)}</td>
                  <td className="right att-color" style={{ '--att-color': getAttainmentColor(attPct) } as React.CSSProperties}>{formatPercent(attPct)}</td>
                  <td className="right var-color" style={{ '--var-color': getAttainmentColor(attPct) } as React.CSSProperties}>{formatCurrency(gap)}</td>
                  <td className="center">
                    <span className="rag-tile" style={{ backgroundColor: getRAGBadgeColor(rag) }}>{rag}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FunnelByCategoryTable({ product, rows }: { product: Product; rows: FunnelByCategoryRow[] }) {
  // Sort by average pacing % (worst first)
  const defaultSorted = useMemo(() =>
    [...rows].sort((a, b) => {
      const avgA = ((a.mql_pacing_pct || 0) + (a.sql_pacing_pct || 0) + (a.sal_pacing_pct || 0) + (a.sqo_pacing_pct || 0)) / 4;
      const avgB = ((b.mql_pacing_pct || 0) + (b.sql_pacing_pct || 0) + (b.sal_pacing_pct || 0) + (b.sqo_pacing_pct || 0)) / 4;
      return avgA - avgB;
    }),
    [rows]
  );

  const getColumnValue = useCallback((row: FunnelByCategoryRow, column: string) => {
    switch (column) {
      case 'category': return row.category;
      case 'region': return row.region;
      case 'weighted_tof_score': return row.weighted_tof_score || 0;
      default: return null;
    }
  }, []);

  const { sortedData, handleSort, getSortDirection } = useSortableTable(rows, defaultSorted, getColumnValue);

  return (
    <>
      <h4>{product}</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Cat" column="category" sortDirection={getSortDirection('category')} onSort={handleSort} />
              <SortableHeader label="Region" column="region" sortDirection={getSortDirection('region')} onSort={handleSort} />
              <SortableHeader label="TOF Score" column="weighted_tof_score" sortDirection={getSortDirection('weighted_tof_score')} onSort={handleSort} className="right" />
              <th>Stage</th>
              <th className="right">Q1 Tgt</th>
              <th className="right">QTD Tgt</th>
              <th className="right">Actual</th>
              <th className="right">Att%</th>
              <th className="right">QTD Var</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const category = row.category || '';
              const mqlLabel = ['EXPANSION', 'MIGRATION'].includes(category.toUpperCase()) ? 'EQL' : 'MQL';

              const stages: Array<{ label: string; q1: number; qtd: number; actual: number; pct: number; gap: number }> = [];

              if ((row.q1_target_mql || 0) > 0) {
                stages.push({ label: mqlLabel, q1: row.q1_target_mql, qtd: row.qtd_target_mql, actual: row.actual_mql, pct: row.mql_pacing_pct, gap: row.mql_gap });
              }
              if ((row.q1_target_sql || 0) > 0) {
                stages.push({ label: 'SQL', q1: row.q1_target_sql, qtd: row.qtd_target_sql, actual: row.actual_sql, pct: row.sql_pacing_pct, gap: row.sql_gap });
              }
              if ((row.q1_target_sal || 0) > 0) {
                stages.push({ label: 'SAL', q1: row.q1_target_sal, qtd: row.qtd_target_sal, actual: row.actual_sal, pct: row.sal_pacing_pct, gap: row.sal_gap });
              }
              if ((row.q1_target_sqo || 0) > 0) {
                stages.push({ label: 'SQO', q1: row.q1_target_sqo, qtd: row.qtd_target_sqo, actual: row.actual_sqo, pct: row.sqo_pacing_pct, gap: row.sqo_gap });
              }

              if (stages.length === 0) return null;

              return stages.map((stage, stageIdx) => (
                <tr key={`${row.region}-${category}-${stage.label}-${idx}`}>
                  {stageIdx === 0 && (
                    <>
                      <td rowSpan={stages.length}><strong>{category}</strong></td>
                      <td rowSpan={stages.length}>{row.region}</td>
                      <td rowSpan={stages.length} className="right">
                        <span className="rag-tile" style={{ backgroundColor: getAttainmentColor(row.weighted_tof_score), padding: '4px 10px' }}>
                          {formatPercent(row.weighted_tof_score)}
                        </span>
                      </td>
                    </>
                  )}
                  <td>{stage.label}</td>
                  <td className="right">{Math.round(stage.q1 || 0)}</td>
                  <td className="right">{Math.round(stage.qtd || 0)}</td>
                  <td className="right">{Math.round(stage.actual || 0)}</td>
                  <td className="right att-color" style={{ '--att-color': getAttainmentColor(stage.pct) } as React.CSSProperties}>{formatPercent(stage.pct)}</td>
                  <td className="right var-color" style={{ '--var-color': getAttainmentColor(stage.pct) } as React.CSSProperties}>
                    {stage.gap >= 0 ? '+' : ''}{Math.round(stage.gap || 0)}
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function SourceAttainment({ data }: SourceAttainmentProps) {
  const { period, source_attainment, funnel_by_category, funnel_by_source } = data;

  return (
    <section>
      <h2>3. Source Attainment by Channel</h2>

      {/* Source ACV Tables */}
      <SourceACVTable product="POR" rows={source_attainment.POR} period={period} />
      <SourceACVTable product="R360" rows={source_attainment.R360} period={period} />

      {/* Funnel by Category */}
      <h3>Full Funnel Attainment by Category (EQL/MQL → SQO)</h3>
      <p style={{ fontSize: '10px', color: '#666', margin: '3px 0' }}>
        EQL for EXPANSION/MIGRATION, MQL for NEW LOGO/STRATEGIC | TOF Score: POR (10% MQL + 20% SQL + 30% SAL + 40% SQO) | R360 (14% MQL + 29% SQL + 57% SQO - no SAL)
      </p>
      <FunnelByCategoryTable product="POR" rows={funnel_by_category.POR} />
      <FunnelByCategoryTable product="R360" rows={funnel_by_category.R360} />
    </section>
  );
}
