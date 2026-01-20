'use client';

import { useMemo, useCallback } from 'react';
import { ReportData, AttainmentRow } from '@/lib/types';
import { formatCurrency, formatPercent, formatCoverage, getGapColor, getAttainmentColor } from '@/lib/formatters';
import SortableHeader from './SortableHeader';
import { useSortableTable } from '@/lib/useSortableTable';

interface ExecutiveSummaryProps {
  data: ReportData;
}

type DetailRow = {
  product: string;
  region: string;
  fy_target: number;
  q1_target: number;
  qtd_target: number;
  qtd_actual: number;
  qtd_var: number;
  attainment_pct: number;
  pipeline_acv: number;
  pipeline_coverage: number;
  win_rate_pct: number;
};

export default function ExecutiveSummary({ data }: ExecutiveSummaryProps) {
  const { period, grand_total, product_totals, attainment_detail } = data;

  // Check which products have data
  const hasPOR = attainment_detail.POR.length > 0;
  const hasR360 = attainment_detail.R360.length > 0;

  // Calculate hits and misses
  const allAttainment = [
    ...attainment_detail.POR.map(a => ({ ...a, product: 'POR' as const })),
    ...attainment_detail.R360.map(a => ({ ...a, product: 'R360' as const }))
  ];
  const hits = allAttainment.filter(a => a.rag_status === 'GREEN');
  const misses = allAttainment.filter(a => a.rag_status === 'RED' || a.rag_status === 'YELLOW');

  const qtdAtt = grand_total.total_qtd_attainment_pct || 0;
  const cov = grand_total.total_pipeline_coverage_x || 0;

  const por = product_totals.POR;
  const porAtt = por?.total_qtd_attainment_pct || 0;

  const r360 = product_totals.R360;
  const r360Att = r360?.total_qtd_attainment_pct || 0;

  // Create detailed breakdown data for sorting
  const detailRows = useMemo<DetailRow[]>(() => {
    const rows: DetailRow[] = [];

    // Aggregate POR by region
    if (hasPOR) {
      const porByRegion = attainment_detail.POR.reduce((acc, row) => {
        const region = row.region;
        if (!acc[region]) {
          acc[region] = {
            fy_target: 0,
            q1_target: 0,
            qtd_target: 0,
            qtd_actual: 0,
            pipeline_acv: 0,
            win_rate_total: 0,
            count: 0,
          };
        }
        acc[region].fy_target += (row as any).fy_target || 0;
        acc[region].q1_target += row.q1_target || 0;
        acc[region].qtd_target += row.qtd_target || 0;
        acc[region].qtd_actual += row.qtd_acv || 0;
        acc[region].pipeline_acv += row.pipeline_acv || 0;
        acc[region].win_rate_total += row.win_rate_pct || 0;
        acc[region].count += 1;
        return acc;
      }, {} as Record<string, any>);

      Object.entries(porByRegion).forEach(([region, data]) => {
        // Calculate remaining Q1 gap - use Q1 target, not QTD target
        const remainingQ1Gap = Math.max(0, data.q1_target - data.qtd_actual);
        // Coverage = pipeline / remaining gap. If no gap (target met), coverage = 0
        const coverage = remainingQ1Gap > 0 ? data.pipeline_acv / remainingQ1Gap : 0;
        rows.push({
          product: 'POR',
          region,
          fy_target: data.fy_target,
          q1_target: data.q1_target,
          qtd_target: data.qtd_target,
          qtd_actual: data.qtd_actual,
          qtd_var: data.qtd_actual - data.qtd_target,
          attainment_pct: data.qtd_target > 0 ? (data.qtd_actual / data.qtd_target) * 100 : 0,
          pipeline_acv: data.pipeline_acv,
          pipeline_coverage: coverage,
          win_rate_pct: data.count > 0 ? data.win_rate_total / data.count : 0,
        });
      });
    }

    // Aggregate R360 by region
    if (hasR360) {
      const r360ByRegion = attainment_detail.R360.reduce((acc, row) => {
        const region = row.region;
        if (!acc[region]) {
          acc[region] = {
            fy_target: 0,
            q1_target: 0,
            qtd_target: 0,
            qtd_actual: 0,
            pipeline_acv: 0,
            win_rate_total: 0,
            count: 0,
          };
        }
        acc[region].fy_target += (row as any).fy_target || 0;
        acc[region].q1_target += row.q1_target || 0;
        acc[region].qtd_target += row.qtd_target || 0;
        acc[region].qtd_actual += row.qtd_acv || 0;
        acc[region].pipeline_acv += row.pipeline_acv || 0;
        acc[region].win_rate_total += row.win_rate_pct || 0;
        acc[region].count += 1;
        return acc;
      }, {} as Record<string, any>);

      Object.entries(r360ByRegion).forEach(([region, data]) => {
        // Calculate remaining Q1 gap - use Q1 target, not QTD target
        const remainingQ1Gap = Math.max(0, data.q1_target - data.qtd_actual);
        // Coverage = pipeline / remaining gap. If no gap (target met), coverage = 0
        const coverage = remainingQ1Gap > 0 ? data.pipeline_acv / remainingQ1Gap : 0;
        rows.push({
          product: 'R360',
          region,
          fy_target: data.fy_target,
          q1_target: data.q1_target,
          qtd_target: data.qtd_target,
          qtd_actual: data.qtd_actual,
          qtd_var: data.qtd_actual - data.qtd_target,
          attainment_pct: data.qtd_target > 0 ? (data.qtd_actual / data.qtd_target) * 100 : 0,
          pipeline_acv: data.pipeline_acv,
          pipeline_coverage: coverage,
          win_rate_pct: data.count > 0 ? data.win_rate_total / data.count : 0,
        });
      });
    }

    return rows;
  }, [attainment_detail, hasPOR, hasR360]);

  // Default sort by attainment % (worst first)
  const defaultSorted = useMemo(() =>
    [...detailRows].sort((a, b) => a.attainment_pct - b.attainment_pct),
    [detailRows]
  );

  const getColumnValue = useCallback((row: DetailRow, column: string) => {
    switch (column) {
      case 'product': return row.product;
      case 'region': return row.region;
      case 'fy_target': return row.fy_target;
      case 'q1_target': return row.q1_target;
      case 'qtd_target': return row.qtd_target;
      case 'qtd_actual': return row.qtd_actual;
      case 'qtd_var': return row.qtd_var;
      case 'attainment_pct': return row.attainment_pct;
      case 'pipeline_acv': return row.pipeline_acv;
      case 'pipeline_coverage': return row.pipeline_coverage;
      case 'win_rate_pct': return row.win_rate_pct;
      default: return null;
    }
  }, []);

  const { sortedData, handleSort, getSortDirection } = useSortableTable(
    detailRows,
    defaultSorted,
    getColumnValue
  );

  return (
    <section>
      <h2>1. Executive Summary</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th className="right">Total</th>
            {hasPOR && <th className="right">POR</th>}
            {hasR360 && <th className="right">R360</th>}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>FY Target</td>
            <td className="right">{formatCurrency(grand_total.total_fy_target)}</td>
            {hasPOR && <td className="right">{formatCurrency(por?.total_fy_target)}</td>}
            {hasR360 && <td className="right">{formatCurrency(r360?.total_fy_target)}</td>}
          </tr>
          <tr>
            <td>Q1 Target</td>
            <td className="right">{formatCurrency(grand_total.total_q1_target)}</td>
            {hasPOR && <td className="right">{formatCurrency(por?.total_q1_target)}</td>}
            {hasR360 && <td className="right">{formatCurrency(r360?.total_q1_target)}</td>}
          </tr>
          <tr>
            <td>QTD Target</td>
            <td className="right">{formatCurrency(grand_total.total_qtd_target)}</td>
            {hasPOR && <td className="right">{formatCurrency(por?.total_qtd_target)}</td>}
            {hasR360 && <td className="right">{formatCurrency(r360?.total_qtd_target)}</td>}
          </tr>
          <tr>
            <td>QTD Actual</td>
            <td className="right"><strong>{formatCurrency(grand_total.total_qtd_acv)}</strong></td>
            {hasPOR && <td className="right"><strong>{formatCurrency(por?.total_qtd_acv)}</strong></td>}
            {hasR360 && <td className="right"><strong>{formatCurrency(r360?.total_qtd_acv)}</strong></td>}
          </tr>
          <tr>
            <td>QTD Attainment</td>
            <td className={`right attainment-cell ${qtdAtt >= 90 ? 'status-green' : qtdAtt >= 70 ? 'status-yellow' : 'status-red'}`}>
              <strong>{formatPercent(qtdAtt)}</strong>
            </td>
            {hasPOR && (
              <td className={`right attainment-cell ${porAtt >= 90 ? 'status-green' : porAtt >= 70 ? 'status-yellow' : 'status-red'}`}>
                <strong>{formatPercent(porAtt)}</strong>
              </td>
            )}
            {hasR360 && (
              <td className={`right attainment-cell ${r360Att >= 90 ? 'status-green' : r360Att >= 70 ? 'status-yellow' : 'status-red'}`}>
                <strong>{formatPercent(r360Att)}</strong>
              </td>
            )}
          </tr>
          <tr>
            <td>Pipeline Coverage</td>
            <td className={`right coverage-cell ${cov >= 3 ? 'status-green' : cov >= 2 ? 'status-yellow' : 'status-red'}`}>
              <strong>{formatCoverage(cov)}</strong>
            </td>
            {hasPOR && (
              <td className={`right coverage-cell ${(por?.total_pipeline_coverage_x || 0) >= 3 ? 'status-green' : (por?.total_pipeline_coverage_x || 0) >= 2 ? 'status-yellow' : 'status-red'}`}>
                {formatCoverage(por?.total_pipeline_coverage_x)}
              </td>
            )}
            {hasR360 && (
              <td className={`right coverage-cell ${(r360?.total_pipeline_coverage_x || 0) >= 3 ? 'status-green' : (r360?.total_pipeline_coverage_x || 0) >= 2 ? 'status-yellow' : 'status-red'}`}>
                {formatCoverage(r360?.total_pipeline_coverage_x)}
              </td>
            )}
          </tr>
          <tr>
            <td>Win Rate</td>
            <td className="right">
              {((grand_total as any).total_won_deals || 0) + ((grand_total as any).total_lost_deals || 0) === 0
                ? <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8em' }}>N/A (no deals)</span>
                : ((grand_total as any).total_lost_deals || 0) === 0
                  ? <span style={{ color: '#16a34a' }}>100% <span style={{ fontSize: '0.75em', color: 'var(--text-tertiary)' }}>(no losses)</span></span>
                  : <span style={{ color: getAttainmentColor(grand_total.total_win_rate_pct), fontWeight: 600 }}>{formatPercent(grand_total.total_win_rate_pct)}</span>}
            </td>
            {hasPOR && (
              <td className="right">
                {((por as any)?.total_won_deals || 0) + ((por as any)?.total_lost_deals || 0) === 0
                  ? <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8em' }}>N/A (no deals)</span>
                  : ((por as any)?.total_lost_deals || 0) === 0
                    ? <span style={{ color: '#16a34a' }}>100% <span style={{ fontSize: '0.75em', color: 'var(--text-tertiary)' }}>(no losses)</span></span>
                    : <span style={{ color: getAttainmentColor(por?.total_win_rate_pct), fontWeight: 600 }}>{formatPercent(por?.total_win_rate_pct)}</span>}
              </td>
            )}
            {hasR360 && (
              <td className="right">
                {((r360 as any)?.total_won_deals || 0) + ((r360 as any)?.total_lost_deals || 0) === 0
                  ? <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8em' }}>N/A (no deals)</span>
                  : ((r360 as any)?.total_lost_deals || 0) === 0
                    ? <span style={{ color: '#16a34a' }}>100% <span style={{ fontSize: '0.75em', color: 'var(--text-tertiary)' }}>(no losses)</span></span>
                    : <span style={{ color: getAttainmentColor(r360?.total_win_rate_pct), fontWeight: 600 }}>{formatPercent(r360?.total_win_rate_pct)}</span>}
              </td>
            )}
          </tr>
          <tr>
            <td>Hits / Misses</td>
            <td className="right" colSpan={1 + (hasPOR ? 1 : 0) + (hasR360 ? 1 : 0)}>
              <strong>{hits.length}</strong> on track / <strong>{misses.length}</strong> need attention
            </td>
          </tr>
        </tbody>
      </table>

      {detailRows.length > 0 && (
        <>
          <h3 style={{ marginTop: '24px', marginBottom: '8px' }}>Regional Breakdown</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortableHeader
                    label="Product"
                    column="product"
                    sortDirection={getSortDirection('product')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Region"
                    column="region"
                    sortDirection={getSortDirection('region')}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="FY Target"
                    column="fy_target"
                    sortDirection={getSortDirection('fy_target')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="Q1 Target"
                    column="q1_target"
                    sortDirection={getSortDirection('q1_target')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="QTD Target"
                    column="qtd_target"
                    sortDirection={getSortDirection('qtd_target')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="QTD Actual"
                    column="qtd_actual"
                    sortDirection={getSortDirection('qtd_actual')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="QTD Var"
                    column="qtd_var"
                    sortDirection={getSortDirection('qtd_var')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="Attainment %"
                    column="attainment_pct"
                    sortDirection={getSortDirection('attainment_pct')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="Pipeline ACV"
                    column="pipeline_acv"
                    sortDirection={getSortDirection('pipeline_acv')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="Pipeline Coverage"
                    column="pipeline_coverage"
                    sortDirection={getSortDirection('pipeline_coverage')}
                    onSort={handleSort}
                    className="right"
                  />
                  <SortableHeader
                    label="Win Rate %"
                    column="win_rate_pct"
                    sortDirection={getSortDirection('win_rate_pct')}
                    onSort={handleSort}
                    className="right"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, idx) => {
                  const attClass = row.attainment_pct >= 90 ? 'status-green' : row.attainment_pct >= 70 ? 'status-yellow' : 'status-red';
                  const covClass = row.pipeline_coverage >= 3 ? 'status-green' : row.pipeline_coverage >= 2 ? 'status-yellow' : 'status-red';
                  const winClass = row.win_rate_pct >= 90 ? 'status-green' : row.win_rate_pct >= 70 ? 'status-yellow' : 'status-red';

                  return (
                    <tr key={`${row.product}-${row.region}-${idx}`}>
                      <td>{row.product}</td>
                      <td>{row.region}</td>
                      <td className="right">{formatCurrency(row.fy_target)}</td>
                      <td className="right">{formatCurrency(row.q1_target)}</td>
                      <td className="right">{formatCurrency(row.qtd_target)}</td>
                      <td className="right"><strong>{formatCurrency(row.qtd_actual)}</strong></td>
                      <td className="right" style={{ color: getGapColor(row.qtd_var), fontWeight: 600 }}>
                        {formatCurrency(row.qtd_var)}
                      </td>
                      <td className={`right attainment-cell ${attClass}`}>
                        <strong>{formatPercent(row.attainment_pct)}</strong>
                      </td>
                      <td className="right">{formatCurrency(row.pipeline_acv)}</td>
                      <td className={`right coverage-cell ${covClass}`}>
                        <strong>{formatCoverage(row.pipeline_coverage)}</strong>
                      </td>
                      <td className={`right ${winClass}`}>
                        {formatPercent(row.win_rate_pct)}
                      </td>
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
