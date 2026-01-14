// Region and Product types
export type Region = 'AMER' | 'EMEA' | 'APAC';
export type Product = 'POR' | 'R360';
export type Category = 'NEW LOGO' | 'EXPANSION' | 'MIGRATION';
export type Source = 'INBOUND' | 'OUTBOUND' | 'AE SOURCED' | 'AM SOURCED' | 'TRADESHOW' | 'PARTNERSHIPS';
export type RAGStatus = 'GREEN' | 'YELLOW' | 'RED';

// Period information
export interface Period {
  as_of_date: string;
  quarter_pct_complete: number;
  days_elapsed: number;
  total_days: number;
}

// Grand total metrics
export interface GrandTotal {
  total_q1_target: number;
  total_qtd_target: number;
  total_qtd_acv: number;
  total_qtd_attainment_pct: number;
  total_pipeline_acv: number;
  total_pipeline_coverage_x: number;
  total_win_rate_pct: number;
}

// Product totals
export interface ProductTotal {
  total_q1_target: number;
  total_qtd_target: number;
  total_qtd_acv: number;
  total_qtd_attainment_pct: number;
  total_pipeline_acv: number;
  total_pipeline_coverage_x: number;
  total_win_rate_pct: number;
  total_lost_deals: number;
  total_lost_acv: number;
}

// Attainment detail row
export interface AttainmentRow {
  product: Product;
  region: Region;
  category: Category;
  q1_target: number;
  qtd_target: number;
  qtd_acv: number;
  qtd_attainment_pct: number;
  qtd_gap: number;
  pipeline_acv: number;
  pipeline_coverage_x: number;
  win_rate_pct: number;
  qtd_lost_deals: number;
  qtd_lost_acv: number;
  rag_status: RAGStatus;
}

// Source attainment row
export interface SourceAttainmentRow {
  region: Region;
  source: Source;
  q1_target: number;
  qtd_target: number;
  qtd_acv: number;
  attainment_pct: number;
  gap: number;
  rag_status: RAGStatus;
}

// Funnel by category row
export interface FunnelByCategoryRow {
  category: Category;
  region: Region;
  weighted_tof_score: number;
  q1_target_mql: number;
  qtd_target_mql: number;
  actual_mql: number;
  mql_pacing_pct: number;
  mql_gap: number;
  q1_target_sql: number;
  qtd_target_sql: number;
  actual_sql: number;
  sql_pacing_pct: number;
  sql_gap: number;
  q1_target_sal: number;
  qtd_target_sal: number;
  actual_sal: number;
  sal_pacing_pct: number;
  sal_gap: number;
  q1_target_sqo: number;
  qtd_target_sqo: number;
  actual_sqo: number;
  sqo_pacing_pct: number;
  sqo_gap: number;
}

// Funnel by source row
export interface FunnelBySourceRow extends FunnelByCategoryRow {
  source: Source;
}

// Pipeline RCA row
export interface PipelineRCARow {
  product: Product;
  region: Region;
  category: Category;
  pipeline_acv: number;
  pipeline_coverage_x: number;
  pipeline_avg_age_days: number;
  pipeline_health: 'HEALTHY' | 'ADEQUATE' | 'AT_RISK';
  rca_commentary: string;
  recommended_action: string;
}

// Loss reason RCA row
export interface LossReasonRow {
  product: Product;
  region: Region;
  loss_reason: string;
  deal_count: number;
  lost_acv: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// Google Ads data
export interface GoogleAdsData {
  impressions: number;
  clicks: number;
  ctr_pct: number;
  ad_spend_usd: number;
  cpc_usd: number;
  conversions: number;
  cpa_usd: number;
}

// Google Ads data with region (for filtering)
export interface GoogleAdsRegionalData extends GoogleAdsData {
  region: Region;
}

// Google Ads RCA (now includes region for filtering)
export interface GoogleAdsRCA {
  product: Product;
  region: Region;
  ctr_pct: number;
  ctr_performance: string;
  cpa_usd: number;
  cpa_performance: string;
  rca_commentary: string;
  recommended_action: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// Funnel RCA Insights
export interface FunnelRCAInsight {
  region: Region;
  rca_commentary: string;
  recommended_action: string;
}

// Complete report data structure
export interface ReportData {
  report_date: string;
  query_version: string;
  period: Period;
  grand_total: GrandTotal;
  product_totals: {
    POR: ProductTotal;
    R360: ProductTotal;
  };
  attainment_detail: {
    POR: AttainmentRow[];
    R360: AttainmentRow[];
  };
  source_attainment: {
    POR: SourceAttainmentRow[];
    R360: SourceAttainmentRow[];
  };
  funnel_by_category: {
    POR: FunnelByCategoryRow[];
    R360: FunnelByCategoryRow[];
  };
  funnel_by_source: {
    POR: FunnelBySourceRow[];
    R360: FunnelBySourceRow[];
  };
  pipeline_rca: {
    POR: PipelineRCARow[];
    R360: PipelineRCARow[];
  };
  loss_reason_rca: {
    POR: LossReasonRow[];
    R360: LossReasonRow[];
  };
  google_ads: {
    POR: GoogleAdsRegionalData[];
    R360: GoogleAdsRegionalData[];
  };
  google_ads_rca: {
    POR: GoogleAdsRCA[];
    R360: GoogleAdsRCA[];
  };
  funnel_rca_insights: {
    POR: FunnelRCAInsight[];
    R360: FunnelRCAInsight[];
  };
  // New insight sections
  executive_counts?: ExecutiveCounts;
  wins_bright_spots?: {
    POR: WinBrightSpot[];
    R360: WinBrightSpot[];
  };
  action_items?: {
    immediate: ActionItem[];
    short_term: ActionItem[];
    strategic: ActionItem[];
  };
  momentum_indicators?: {
    POR: MomentumIndicator[];
    R360: MomentumIndicator[];
  };
  top_risk_pockets?: TopRiskPocket[];
  // Deal lists for drill-down
  won_deals?: {
    POR: DealDetail[];
    R360: DealDetail[];
  };
  lost_deals?: {
    POR: DealDetail[];
    R360: DealDetail[];
  };
  pipeline_deals?: {
    POR: DealDetail[];
    R360: DealDetail[];
  };
}

// Executive Summary Counts
export interface ExecutiveCounts {
  areas_exceeding_target: number;
  areas_at_risk: number;
  areas_needing_attention: number;
  areas_with_momentum: number;
}

// Wins / Bright Spots
export interface WinBrightSpot {
  product: Product;
  region: Region;
  category: Category;
  qtd_attainment_pct: number;
  qtd_acv: number;
  qtd_target: number;
  performance_tier: 'EXCEPTIONAL' | 'ON_TRACK' | 'NEEDS_ATTENTION';
  success_commentary: string;
  contributing_factor: string;
  pipeline_coverage_x: number;
  win_rate_pct: number;
}

// Action Item
export interface ActionItem {
  urgency: 'IMMEDIATE' | 'SHORT_TERM' | 'STRATEGIC';
  category: string;
  product: Product;
  region: Region | null;
  issue: string;
  action: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// Momentum Indicator
export interface MomentumIndicator {
  product: Product;
  region: Region;
  momentum_tier: 'STRONG_MOMENTUM' | 'MODERATE_MOMENTUM' | 'NO_MOMENTUM' | 'DECLINING';
  positive_momentum_count: number;
  momentum_commentary: string;
  mql_trend: 'UP' | 'DOWN' | 'FLAT';
  mql_wow_pct: number;
  sql_trend: 'UP' | 'DOWN' | 'FLAT';
  sql_wow_pct: number;
}

// Top Risk Pocket
export interface TopRiskPocket {
  product: Product;
  region: Region;
  category: Category;
  qtd_target: number;
  qtd_acv: number;
  qtd_gap: number;
  qtd_attainment_pct: number;
  rag_status: RAGStatus;
  win_rate_pct: number;
  pipeline_acv: number;
  pipeline_coverage_x: number;
}

// Deal Detail for drill-down
export interface DealDetail {
  opportunity_id: string;
  account_name: string;
  opportunity_name: string;
  product: Product;
  region: Region;
  category: Category;
  deal_type: string;
  acv: number;
  close_date: string;
  stage: string;
  is_won: boolean;
  is_closed: boolean;
  loss_reason: string | null;
  source: Source;
  owner_name: string;
  owner_id: string;
  salesforce_url: string;
}

// Filter state
export interface FilterState {
  regions: Region[];
  products: Product[];
}

// ============================================================================
// TREND ANALYSIS TYPES
// ============================================================================

// Date range for trend analysis
export interface DateRange {
  startDate: string;  // ISO format: YYYY-MM-DD
  endDate: string;    // ISO format: YYYY-MM-DD
}

// Period comparison metadata
export interface TrendPeriodInfo {
  current: DateRange;
  previous: DateRange;
  daysInPeriod: number;
}

// Single metric with period comparison
export interface MetricComparison<T = number> {
  current: T;
  previous: T;
  delta: T;           // current - previous
  deltaPercent: number; // ((current - previous) / previous) * 100
  trend: 'UP' | 'DOWN' | 'FLAT';
}

// Revenue trend data by dimension
export interface RevenueTrendRow {
  product: Product;
  region: Region;
  category: Category;
  acv: MetricComparison<number>;
  deals: MetricComparison<number>;
  winRate: MetricComparison<number>;
}

// Funnel trend data by dimension
export interface FunnelTrendRow {
  product: Product;
  region: Region;
  mql: MetricComparison<number>;
  sql: MetricComparison<number>;
  sal: MetricComparison<number>;
  sqo: MetricComparison<number>;
}

// Time series data point for charts
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  periodType: 'current' | 'previous';
}

// Chart data structure
export interface TrendChartData {
  metricName: string;
  currentPeriod: TimeSeriesDataPoint[];
  previousPeriod: TimeSeriesDataPoint[];
}

// Complete trend analysis response
export interface TrendAnalysisData {
  generatedAt: string;
  periodInfo: TrendPeriodInfo;
  filters: {
    products: Product[];
    regions: Region[];
  };
  revenueSummary: {
    totalACV: MetricComparison<number>;
    wonDeals: MetricComparison<number>;
    pipelineACV: MetricComparison<number>;
    avgDealSize: MetricComparison<number>;
  };
  funnelSummary: {
    totalMQL: MetricComparison<number>;
    totalSQL: MetricComparison<number>;
    totalSAL: MetricComparison<number>;
    totalSQO: MetricComparison<number>;
  };
  revenueByDimension: RevenueTrendRow[];
  funnelByDimension: FunnelTrendRow[];
  charts: {
    acvTimeSeries: TrendChartData;
    mqlTimeSeries: TrendChartData;
    sqlTimeSeries: TrendChartData;
  };
}

// API request parameters
export interface TrendAnalysisRequest {
  startDate: string;
  endDate: string;
  products: Product[];
  regions: Region[];
}
