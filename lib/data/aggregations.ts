/**
 * Aggregation and recalculation functions for report data
 * These functions compute totals and derived values from filtered data
 */

import type {
  AttainmentRow,
  ProductTotal,
  GrandTotal,
  ExecutiveCounts,
  MomentumIndicator
} from '../types';

/**
 * Empty product total for when a product is not included
 */
export const EMPTY_PRODUCT_TOTAL: ProductTotal = {
  total_fy_target: 0,
  total_q1_target: 0,
  total_qtd_target: 0,
  total_qtd_acv: 0,
  total_qtd_attainment_pct: 0,
  total_pipeline_acv: 0,
  total_pipeline_coverage_x: 0,
  total_win_rate_pct: 0,
  total_lost_deals: 0,
  total_lost_acv: 0,
};

/**
 * Recalculate product totals based on filtered attainment data
 */
export function recalculateProductTotals(
  attainmentRows: AttainmentRow[]
): ProductTotal {
  const fyTarget = attainmentRows.reduce((sum, row) => sum + (row.fy_target || 0), 0);
  const q1Target = attainmentRows.reduce((sum, row) => sum + (row.q1_target || 0), 0);
  const qtdTarget = attainmentRows.reduce((sum, row) => sum + (row.qtd_target || 0), 0);
  const qtdAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_acv || 0), 0);
  const pipelineAcv = attainmentRows.reduce((sum, row) => sum + (row.pipeline_acv || 0), 0);
  const lostDeals = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_deals || 0), 0);
  const lostAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_acv || 0), 0);

  const remaining = q1Target - qtdAcv;

  return {
    total_fy_target: fyTarget,
    total_q1_target: q1Target,
    total_qtd_target: qtdTarget,
    total_qtd_acv: qtdAcv,
    // Logic: target=0 means 100% attainment (met zero target). Rounded for display.
    total_qtd_attainment_pct: qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 100) : 100,
    total_pipeline_acv: pipelineAcv,
    total_pipeline_coverage_x: remaining > 0 ? Math.round((pipelineAcv / remaining) * 10) / 10 : 0,
    total_win_rate_pct: 0, // Would need deal counts to calculate
    total_lost_deals: lostDeals,
    total_lost_acv: lostAcv,
  };
}

/**
 * Recalculate executive counts based on filtered attainment data
 */
export function recalculateExecutiveCounts(
  porRows: AttainmentRow[],
  r360Rows: AttainmentRow[],
  porMomentum: MomentumIndicator[],
  r360Momentum: MomentumIndicator[]
): ExecutiveCounts {
  const allRows = [...porRows, ...r360Rows];
  const allMomentum = [...porMomentum, ...r360Momentum];

  return {
    areas_exceeding_target: allRows.filter(r => r.qtd_attainment_pct >= 100).length,
    areas_at_risk: allRows.filter(r => r.rag_status === 'RED').length,
    areas_needing_attention: allRows.filter(r => r.rag_status === 'YELLOW').length,
    areas_with_momentum: allMomentum.filter(m =>
      m.momentum_tier === 'STRONG_MOMENTUM' || m.momentum_tier === 'MODERATE_MOMENTUM'
    ).length,
  };
}

/**
 * Calculate grand totals from two product totals
 */
export function calculateGrandTotal(
  porTotals: ProductTotal,
  r360Totals: ProductTotal
): GrandTotal {
  const combinedQtdTarget = porTotals.total_qtd_target + r360Totals.total_qtd_target;
  const combinedQtdAcv = porTotals.total_qtd_acv + r360Totals.total_qtd_acv;
  const combinedQ1Target = porTotals.total_q1_target + r360Totals.total_q1_target;
  const combinedPipelineAcv = porTotals.total_pipeline_acv + r360Totals.total_pipeline_acv;

  const totalRemaining = combinedQ1Target - combinedQtdAcv;

  return {
    total_fy_target: porTotals.total_fy_target + r360Totals.total_fy_target,
    total_q1_target: combinedQ1Target,
    total_qtd_target: combinedQtdTarget,
    total_qtd_acv: combinedQtdAcv,
    // Logic: target=0 means 100% attainment. Rounded for display.
    total_qtd_attainment_pct: combinedQtdTarget > 0
      ? Math.round((combinedQtdAcv / combinedQtdTarget) * 100)
      : 100,
    total_pipeline_acv: combinedPipelineAcv,
    total_pipeline_coverage_x: totalRemaining > 0
      ? Math.round((combinedPipelineAcv / totalRemaining) * 10) / 10
      : 0,
    total_win_rate_pct: 0,
  };
}
