import type {
  Region,
  ReportData,
  AttainmentRow,
  SourceAttainmentRow,
  FunnelByCategoryRow,
  FunnelBySourceRow,
  PipelineRCARow,
  LossReasonRow,
  ProductTotal,
  GrandTotal
} from './types';

/**
 * Filter array by regions
 */
function filterByRegion<T extends { region: Region }>(
  items: T[],
  regions: Region[]
): T[] {
  if (regions.length === 0 || regions.length === 3) {
    return items; // All regions selected
  }
  return items.filter(item => regions.includes(item.region));
}

/**
 * Recalculate product totals based on filtered attainment data
 */
function recalculateProductTotals(
  attainmentRows: AttainmentRow[]
): ProductTotal {
  const q1Target = attainmentRows.reduce((sum, row) => sum + (row.q1_target || 0), 0);
  const qtdTarget = attainmentRows.reduce((sum, row) => sum + (row.qtd_target || 0), 0);
  const qtdAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_acv || 0), 0);
  const pipelineAcv = attainmentRows.reduce((sum, row) => sum + (row.pipeline_acv || 0), 0);
  const lostDeals = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_deals || 0), 0);
  const lostAcv = attainmentRows.reduce((sum, row) => sum + (row.qtd_lost_acv || 0), 0);

  const remaining = q1Target - qtdAcv;

  return {
    total_q1_target: q1Target,
    total_qtd_target: qtdTarget,
    total_qtd_acv: qtdAcv,
    total_qtd_attainment_pct: qtdTarget > 0 ? (qtdAcv / qtdTarget) * 100 : 0,
    total_pipeline_acv: pipelineAcv,
    total_pipeline_coverage_x: remaining > 0 ? pipelineAcv / remaining : 0,
    total_win_rate_pct: 0, // Would need deal counts to calculate
    total_lost_deals: lostDeals,
    total_lost_acv: lostAcv,
  };
}

/**
 * Filter all report data by selected regions
 */
export function filterReportData(
  data: ReportData,
  regions: Region[]
): ReportData {
  // If all regions selected, return original data
  if (regions.length === 0 || regions.length === 3) {
    return data;
  }

  // Filter attainment detail
  const filteredAttainmentPOR = filterByRegion(data.attainment_detail.POR, regions);
  const filteredAttainmentR360 = filterByRegion(data.attainment_detail.R360, regions);

  // Recalculate product totals
  const porTotals = recalculateProductTotals(filteredAttainmentPOR);
  const r360Totals = recalculateProductTotals(filteredAttainmentR360);

  // Calculate grand totals
  const grandTotal: GrandTotal = {
    total_q1_target: porTotals.total_q1_target + r360Totals.total_q1_target,
    total_qtd_target: porTotals.total_qtd_target + r360Totals.total_qtd_target,
    total_qtd_acv: porTotals.total_qtd_acv + r360Totals.total_qtd_acv,
    total_qtd_attainment_pct: (porTotals.total_qtd_target + r360Totals.total_qtd_target) > 0
      ? ((porTotals.total_qtd_acv + r360Totals.total_qtd_acv) / (porTotals.total_qtd_target + r360Totals.total_qtd_target)) * 100
      : 0,
    total_pipeline_acv: porTotals.total_pipeline_acv + r360Totals.total_pipeline_acv,
    total_pipeline_coverage_x: 0, // Calculated below
    total_win_rate_pct: 0,
  };

  const totalRemaining = grandTotal.total_q1_target - grandTotal.total_qtd_acv;
  grandTotal.total_pipeline_coverage_x = totalRemaining > 0
    ? grandTotal.total_pipeline_acv / totalRemaining
    : 0;

  return {
    ...data,
    grand_total: grandTotal,
    product_totals: {
      POR: porTotals,
      R360: r360Totals,
    },
    attainment_detail: {
      POR: filteredAttainmentPOR,
      R360: filteredAttainmentR360,
    },
    source_attainment: {
      POR: filterByRegion(data.source_attainment.POR, regions),
      R360: filterByRegion(data.source_attainment.R360, regions),
    },
    funnel_by_category: {
      POR: filterByRegion(data.funnel_by_category.POR, regions),
      R360: filterByRegion(data.funnel_by_category.R360, regions),
    },
    funnel_by_source: {
      POR: filterByRegion(data.funnel_by_source.POR, regions),
      R360: filterByRegion(data.funnel_by_source.R360, regions),
    },
    pipeline_rca: {
      POR: filterByRegion(data.pipeline_rca.POR, regions),
      R360: filterByRegion(data.pipeline_rca.R360, regions),
    },
    loss_reason_rca: {
      POR: filterByRegion(data.loss_reason_rca.POR, regions),
      R360: filterByRegion(data.loss_reason_rca.R360, regions),
    },
    google_ads: {
      POR: filterByRegion(data.google_ads.POR, regions),
      R360: filterByRegion(data.google_ads.R360, regions),
    },
    // Deal lists for drill-down
    won_deals: data.won_deals ? {
      POR: filterByRegion(data.won_deals.POR || [], regions),
      R360: filterByRegion(data.won_deals.R360 || [], regions),
    } : undefined,
    lost_deals: data.lost_deals ? {
      POR: filterByRegion(data.lost_deals.POR || [], regions),
      R360: filterByRegion(data.lost_deals.R360 || [], regions),
    } : undefined,
    pipeline_deals: data.pipeline_deals ? {
      POR: filterByRegion(data.pipeline_deals.POR || [], regions),
      R360: filterByRegion(data.pipeline_deals.R360 || [], regions),
    } : undefined,
  };
}

/**
 * Parse regions from URL search params
 */
export function parseRegionsFromURL(searchParams: URLSearchParams): Region[] {
  const regionParam = searchParams.get('region');
  if (!regionParam || regionParam === 'ALL') {
    return ['AMER', 'EMEA', 'APAC'];
  }

  const regions = regionParam.split(',').filter(r =>
    ['AMER', 'EMEA', 'APAC'].includes(r)
  ) as Region[];

  return regions.length > 0 ? regions : ['AMER', 'EMEA', 'APAC'];
}

/**
 * Build URL search params from regions
 */
export function buildRegionURL(regions: Region[]): string {
  if (regions.length === 0 || regions.length === 3) {
    return '?region=ALL';
  }
  return `?region=${regions.join(',')}`;
}
