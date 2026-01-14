import type {
  Region,
  Product,
  ReportData,
  AttainmentRow,
  SourceAttainmentRow,
  FunnelByCategoryRow,
  FunnelBySourceRow,
  PipelineRCARow,
  LossReasonRow,
  ProductTotal,
  GrandTotal,
  ExecutiveCounts,
  ActionItem,
  WinBrightSpot,
  MomentumIndicator,
  TopRiskPocket
} from './types';

const ALL_PRODUCTS: Product[] = ['POR', 'R360'];

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
 * Filter action items - include items with null region (product-wide) or matching region
 */
function filterActionItems(items: ActionItem[], regions: Region[]): ActionItem[] {
  if (regions.length === 0 || regions.length === 3) {
    return items;
  }
  return items.filter(item => item.region === null || regions.includes(item.region as Region));
}

/**
 * Recalculate executive counts based on filtered attainment data
 */
function recalculateExecutiveCounts(
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
 * Check if all products are selected
 */
function isAllProducts(products: Product[]): boolean {
  return products.length === 0 || products.length === 2;
}

/**
 * Check if all regions are selected
 */
function isAllRegions(regions: Region[]): boolean {
  return regions.length === 0 || regions.length === 3;
}

/**
 * Filter all report data by selected regions and products
 */
export function filterReportData(
  data: ReportData,
  regions: Region[],
  products: Product[] = ALL_PRODUCTS
): ReportData {
  const allRegions = isAllRegions(regions);
  const allProducts = isAllProducts(products);

  // If all regions and all products selected, return original data
  if (allRegions && allProducts) {
    return data;
  }

  const includePOR = allProducts || products.includes('POR');
  const includeR360 = allProducts || products.includes('R360');

  // Helper to apply region filter, returning empty array if product not included
  const filterProductRegion = <T extends { region: Region }>(
    items: T[],
    isIncluded: boolean
  ): T[] => {
    if (!isIncluded) return [];
    return allRegions ? items : filterByRegion(items, regions);
  };

  // Filter attainment detail by product and region
  const filteredAttainmentPOR = filterProductRegion(data.attainment_detail.POR, includePOR);
  const filteredAttainmentR360 = filterProductRegion(data.attainment_detail.R360, includeR360);

  // Recalculate product totals (only for included products)
  const emptyProductTotal: ProductTotal = {
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

  const porTotals = includePOR ? recalculateProductTotals(filteredAttainmentPOR) : emptyProductTotal;
  const r360Totals = includeR360 ? recalculateProductTotals(filteredAttainmentR360) : emptyProductTotal;

  // Calculate grand totals based on selected products
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

  // Filter action items by product as well
  const filterActionItemsByProduct = (items: ActionItem[]): ActionItem[] => {
    let filtered = allRegions ? items : filterActionItems(items, regions);
    if (!allProducts) {
      filtered = filtered.filter(item => products.includes(item.product));
    }
    return filtered;
  };

  // Filter top risk pockets by product
  const filterRiskPockets = (pockets: TopRiskPocket[]): TopRiskPocket[] => {
    let filtered = allRegions ? pockets : filterByRegion(pockets, regions);
    if (!allProducts) {
      filtered = filtered.filter(p => products.includes(p.product));
    }
    return filtered;
  };

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
      POR: filterProductRegion(data.source_attainment.POR, includePOR),
      R360: filterProductRegion(data.source_attainment.R360, includeR360),
    },
    funnel_by_category: {
      POR: filterProductRegion(data.funnel_by_category.POR, includePOR),
      R360: filterProductRegion(data.funnel_by_category.R360, includeR360),
    },
    funnel_by_source: {
      POR: filterProductRegion(data.funnel_by_source.POR, includePOR),
      R360: filterProductRegion(data.funnel_by_source.R360, includeR360),
    },
    pipeline_rca: {
      POR: filterProductRegion(data.pipeline_rca.POR, includePOR),
      R360: filterProductRegion(data.pipeline_rca.R360, includeR360),
    },
    loss_reason_rca: {
      POR: filterProductRegion(data.loss_reason_rca.POR, includePOR),
      R360: filterProductRegion(data.loss_reason_rca.R360, includeR360),
    },
    google_ads: {
      POR: filterProductRegion(data.google_ads.POR, includePOR),
      R360: filterProductRegion(data.google_ads.R360, includeR360),
    },
    google_ads_rca: {
      POR: filterProductRegion(data.google_ads_rca.POR, includePOR),
      R360: filterProductRegion(data.google_ads_rca.R360, includeR360),
    },
    // Deal lists for drill-down
    won_deals: data.won_deals ? {
      POR: filterProductRegion(data.won_deals.POR || [], includePOR),
      R360: filterProductRegion(data.won_deals.R360 || [], includeR360),
    } : undefined,
    lost_deals: data.lost_deals ? {
      POR: filterProductRegion(data.lost_deals.POR || [], includePOR),
      R360: filterProductRegion(data.lost_deals.R360 || [], includeR360),
    } : undefined,
    pipeline_deals: data.pipeline_deals ? {
      POR: filterProductRegion(data.pipeline_deals.POR || [], includePOR),
      R360: filterProductRegion(data.pipeline_deals.R360 || [], includeR360),
    } : undefined,
    // Filter insight sections
    wins_bright_spots: data.wins_bright_spots ? {
      POR: filterProductRegion(data.wins_bright_spots.POR || [], includePOR),
      R360: filterProductRegion(data.wins_bright_spots.R360 || [], includeR360),
    } : undefined,
    momentum_indicators: data.momentum_indicators ? {
      POR: filterProductRegion(data.momentum_indicators.POR || [], includePOR),
      R360: filterProductRegion(data.momentum_indicators.R360 || [], includeR360),
    } : undefined,
    top_risk_pockets: data.top_risk_pockets
      ? filterRiskPockets(data.top_risk_pockets)
      : undefined,
    action_items: data.action_items ? {
      immediate: filterActionItemsByProduct(data.action_items.immediate || []),
      short_term: filterActionItemsByProduct(data.action_items.short_term || []),
      strategic: filterActionItemsByProduct(data.action_items.strategic || []),
    } : undefined,
    funnel_rca_insights: {
      POR: filterProductRegion(data.funnel_rca_insights.POR || [], includePOR),
      R360: filterProductRegion(data.funnel_rca_insights.R360 || [], includeR360),
    },
    // Recalculate executive counts based on filtered data
    executive_counts: data.executive_counts ? recalculateExecutiveCounts(
      filteredAttainmentPOR,
      filteredAttainmentR360,
      filterProductRegion(data.momentum_indicators?.POR || [], includePOR),
      filterProductRegion(data.momentum_indicators?.R360 || [], includeR360)
    ) : undefined,
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

/**
 * Parse products from URL search params
 */
export function parseProductsFromURL(searchParams: URLSearchParams): Product[] {
  const productParam = searchParams.get('product');
  if (!productParam || productParam === 'ALL') {
    return ALL_PRODUCTS;
  }

  const products = productParam.split(',').filter(p =>
    ['POR', 'R360'].includes(p)
  ) as Product[];

  return products.length > 0 ? products : ALL_PRODUCTS;
}

/**
 * Build URL search params from regions and products
 */
export function buildFilterURL(regions: Region[], products: Product[]): string {
  const params = new URLSearchParams();

  // Add region param
  if (regions.length === 0 || regions.length === 3) {
    params.set('region', 'ALL');
  } else {
    params.set('region', regions.join(','));
  }

  // Add product param
  if (products.length === 0 || products.length === 2) {
    params.set('product', 'ALL');
  } else {
    params.set('product', products.join(','));
  }

  return `?${params.toString()}`;
}
