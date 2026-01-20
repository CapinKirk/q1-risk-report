import type {
  Region,
  Product,
  Category,
  Source,
  ReportData,
  AttainmentRow,
  SourceAttainmentRow,
  FunnelByCategoryRow,
  FunnelBySourceRow,
  FunnelBySourceActuals,
  PipelineRCARow,
  LossReasonRow,
  MQLDetailRow,
  SQLDetailRow,
  ProductTotal,
  GrandTotal,
  ExecutiveCounts,
  ActionItem,
  WinBrightSpot,
  MomentumIndicator,
  TopRiskPocket
} from './types';

const ALL_PRODUCTS: Product[] = ['POR', 'R360'];
const ALL_CATEGORIES: Category[] = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION', 'RENEWAL'];
const ALL_SOURCES: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];

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
 * Filter array by categories
 */
function filterByCategory<T extends { category: Category }>(
  items: T[],
  categories: Category[]
): T[] {
  if (categories.length === 0 || categories.length === 5) {
    return items; // All categories selected
  }
  return items.filter(item => categories.includes(item.category));
}

/**
 * Filter array by sources
 */
function filterBySource<T extends { source: Source }>(
  items: T[],
  sources: Source[]
): T[] {
  if (sources.length === 0 || sources.length === 6) {
    return items; // All sources selected
  }
  return items.filter(item => sources.includes(item.source));
}

/**
 * Check if all categories are selected
 */
function isAllCategories(categories: Category[]): boolean {
  return categories.length === 0 || categories.length === 4;
}

/**
 * Check if all sources are selected
 */
function isAllSources(sources: Source[]): boolean {
  return sources.length === 0 || sources.length === 6;
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
 * Filter all report data by selected regions, products, categories, and sources
 */
export function filterReportData(
  data: ReportData,
  regions: Region[],
  products: Product[] = ALL_PRODUCTS,
  categories: Category[] = ALL_CATEGORIES,
  sources: Source[] = ALL_SOURCES
): ReportData {
  const allRegions = isAllRegions(regions);
  const allProducts = isAllProducts(products);
  const allCategories = isAllCategories(categories);
  const allSources = isAllSources(sources);

  // If all filters selected, return original data
  if (allRegions && allProducts && allCategories && allSources) {
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

  // Helper to apply region + category filter for attainment rows
  const filterAttainmentRows = (
    items: AttainmentRow[],
    isIncluded: boolean
  ): AttainmentRow[] => {
    if (!isIncluded) return [];
    let filtered = allRegions ? items : filterByRegion(items, regions);
    if (!allCategories) {
      filtered = filterByCategory(filtered, categories);
    }
    return filtered;
  };

  // Helper to apply region + source filter for source attainment rows
  const filterSourceRows = (
    items: SourceAttainmentRow[],
    isIncluded: boolean
  ): SourceAttainmentRow[] => {
    if (!isIncluded) return [];
    let filtered = allRegions ? items : filterByRegion(items, regions);
    if (!allSources) {
      filtered = filterBySource(filtered, sources);
    }
    return filtered;
  };

  // Helper to apply region + category filter for funnel rows
  const filterFunnelCategoryRows = (
    items: FunnelByCategoryRow[],
    isIncluded: boolean
  ): FunnelByCategoryRow[] => {
    if (!isIncluded) return [];
    let filtered = allRegions ? items : filterByRegion(items, regions);
    if (!allCategories) {
      filtered = filterByCategory(filtered, categories);
    }
    return filtered;
  };

  // Helper to apply region + source filter for funnel by source rows
  const filterFunnelSourceRows = (
    items: FunnelBySourceRow[],
    isIncluded: boolean
  ): FunnelBySourceRow[] => {
    if (!isIncluded) return [];
    let filtered = allRegions ? items : filterByRegion(items, regions);
    if (!allSources) {
      filtered = filterBySource(filtered, sources);
    }
    return filtered;
  };

  // Helper to filter deals by category and source
  const filterDeals = <T extends { region: Region; category?: Category; source?: Source }>(
    items: T[],
    isIncluded: boolean
  ): T[] => {
    if (!isIncluded) return [];
    let filtered = allRegions ? items : items.filter(item => regions.includes(item.region));
    if (!allCategories) {
      filtered = filtered.filter(item => !item.category || categories.includes(item.category));
    }
    if (!allSources) {
      filtered = filtered.filter(item => !item.source || sources.includes(item.source));
    }
    return filtered;
  };

  // Filter attainment detail by product, region, and category
  const filteredAttainmentPOR = filterAttainmentRows(data.attainment_detail.POR, includePOR);
  const filteredAttainmentR360 = filterAttainmentRows(data.attainment_detail.R360, includeR360);

  // Recalculate product totals (only for included products)
  const emptyProductTotal: ProductTotal = {
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

  const porTotals = includePOR ? recalculateProductTotals(filteredAttainmentPOR) : emptyProductTotal;
  const r360Totals = includeR360 ? recalculateProductTotals(filteredAttainmentR360) : emptyProductTotal;

  // Calculate grand totals based on selected products
  const combinedQtdTarget = porTotals.total_qtd_target + r360Totals.total_qtd_target;
  const combinedQtdAcv = porTotals.total_qtd_acv + r360Totals.total_qtd_acv;
  const grandTotal: GrandTotal = {
    total_fy_target: porTotals.total_fy_target + r360Totals.total_fy_target,
    total_q1_target: porTotals.total_q1_target + r360Totals.total_q1_target,
    total_qtd_target: combinedQtdTarget,
    total_qtd_acv: combinedQtdAcv,
    // Logic: target=0 means 100% attainment. Rounded for display.
    total_qtd_attainment_pct: combinedQtdTarget > 0
      ? Math.round((combinedQtdAcv / combinedQtdTarget) * 100)
      : 100,
    total_pipeline_acv: porTotals.total_pipeline_acv + r360Totals.total_pipeline_acv,
    total_pipeline_coverage_x: 0, // Calculated below
    total_win_rate_pct: 0,
  };

  const totalRemaining = grandTotal.total_q1_target - grandTotal.total_qtd_acv;
  grandTotal.total_pipeline_coverage_x = totalRemaining > 0
    ? Math.round((grandTotal.total_pipeline_acv / totalRemaining) * 10) / 10
    : 0;

  // Filter action items by product and region
  // Note: ActionItem.category is a string like "Pipeline Coverage", not the deal Category type
  const filterActionItemsByProduct = (items: ActionItem[]): ActionItem[] => {
    let filtered = allRegions ? items : filterActionItems(items, regions);
    if (!allProducts) {
      filtered = filtered.filter(item => products.includes(item.product));
    }
    return filtered;
  };

  // Filter top risk pockets by product and category
  const filterRiskPockets = (pockets: TopRiskPocket[]): TopRiskPocket[] => {
    let filtered = allRegions ? pockets : filterByRegion(pockets, regions);
    if (!allProducts) {
      filtered = filtered.filter(p => products.includes(p.product));
    }
    if (!allCategories) {
      filtered = filtered.filter(p => categories.includes(p.category));
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
      POR: filterSourceRows(data.source_attainment.POR, includePOR),
      R360: filterSourceRows(data.source_attainment.R360, includeR360),
    },
    funnel_by_category: {
      POR: filterFunnelCategoryRows(data.funnel_by_category.POR, includePOR),
      R360: filterFunnelCategoryRows(data.funnel_by_category.R360, includeR360),
    },
    funnel_by_source: {
      POR: filterFunnelSourceRows(data.funnel_by_source.POR, includePOR),
      R360: filterFunnelSourceRows(data.funnel_by_source.R360, includeR360),
    },
    // Funnel by source actuals for the Full Funnel Pacing "By Source" view
    funnel_by_source_actuals: data.funnel_by_source_actuals ? {
      POR: includePOR
        ? (allRegions ? data.funnel_by_source_actuals.POR || [] : filterByRegion(data.funnel_by_source_actuals.POR || [], regions))
        : [],
      R360: includeR360
        ? (allRegions ? data.funnel_by_source_actuals.R360 || [] : filterByRegion(data.funnel_by_source_actuals.R360 || [], regions))
        : [],
    } : undefined,
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
    // Deal lists for drill-down (filtered by region, category, and source)
    won_deals: data.won_deals ? {
      POR: filterDeals(data.won_deals.POR || [], includePOR),
      R360: filterDeals(data.won_deals.R360 || [], includeR360),
    } : undefined,
    lost_deals: data.lost_deals ? {
      POR: filterDeals(data.lost_deals.POR || [], includePOR),
      R360: filterDeals(data.lost_deals.R360 || [], includeR360),
    } : undefined,
    pipeline_deals: data.pipeline_deals ? {
      POR: filterDeals(data.pipeline_deals.POR || [], includePOR),
      R360: filterDeals(data.pipeline_deals.R360 || [], includeR360),
    } : undefined,
    // MQL details (filter by product and region only)
    mql_details: data.mql_details ? {
      POR: filterProductRegion(data.mql_details.POR || [], includePOR),
      R360: filterProductRegion(data.mql_details.R360 || [], includeR360),
    } : undefined,
    // SQL details (filter by product and region only)
    sql_details: data.sql_details ? {
      POR: filterProductRegion(data.sql_details.POR || [], includePOR),
      R360: filterProductRegion(data.sql_details.R360 || [], includeR360),
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
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!regionParam || regionParam === 'ALL') {
    return [];
  }

  const regions = regionParam.split(',').filter(r =>
    ['AMER', 'EMEA', 'APAC'].includes(r)
  ) as Region[];

  return regions;
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
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!productParam || productParam === 'ALL') {
    return [];
  }

  const products = productParam.split(',').filter(p =>
    ['POR', 'R360'].includes(p)
  ) as Product[];

  return products;
}

/**
 * Parse categories from URL search params
 */
export function parseCategoriesFromURL(searchParams: URLSearchParams): Category[] {
  const categoryParam = searchParams.get('category');
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!categoryParam || categoryParam === 'ALL') {
    return [];
  }

  const categories = categoryParam.split(',').filter(c =>
    ALL_CATEGORIES.includes(c as Category)
  ) as Category[];

  return categories;
}

/**
 * Parse sources from URL search params
 */
export function parseSourcesFromURL(searchParams: URLSearchParams): Source[] {
  const sourceParam = searchParams.get('source');
  // No param or 'ALL' means no filter applied (show all, no checkboxes checked)
  if (!sourceParam || sourceParam === 'ALL') {
    return [];
  }

  const sources = sourceParam.split(',').filter(s =>
    ALL_SOURCES.includes(s as Source)
  ) as Source[];

  return sources;
}

/**
 * Build URL search params from all filters
 */
export function buildFilterURL(
  regions: Region[],
  products: Product[],
  categories: Category[] = ALL_CATEGORIES,
  sources: Source[] = ALL_SOURCES
): string {
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

  // Add category param
  if (categories.length === 0 || categories.length === 3) {
    params.set('category', 'ALL');
  } else {
    params.set('category', categories.join(','));
  }

  // Add source param
  if (sources.length === 0 || sources.length === 6) {
    params.set('source', 'ALL');
  } else {
    params.set('source', sources.join(','));
  }

  return `?${params.toString()}`;
}
