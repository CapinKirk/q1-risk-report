// Region and Product types
export type Region = 'AMER' | 'EMEA' | 'APAC';
export type Product = 'POR' | 'R360';
export type Category = 'NEW LOGO' | 'EXPANSION' | 'MIGRATION' | 'RENEWAL';
export type Source = 'INBOUND' | 'OUTBOUND' | 'AE SOURCED' | 'AM SOURCED' | 'TRADESHOW' | 'PARTNERSHIPS';
export type RAGStatus = 'GREEN' | 'YELLOW' | 'RED';

// ============================================================================
// RENEWALS TYPES (Salesforce Contract + BQ Renewal Opportunities)
// ============================================================================

// Salesforce Contract (from real-time SF CLI query)
export interface SalesforceContract {
  Id: string;
  ContractNumber: string;
  AccountId: string;
  AccountName: string;
  StartDate: string;
  EndDate: string;
  ContractTerm: number;
  Status: string;
  AutoRenewal: boolean;
  CurrentACV: number;
  EndingACV: number;
  UpliftAmount: number;
  UpliftPct: number;
  Product: Product;
  Region: Region;
  DaysUntilRenewal: number;
  IsAtRisk: boolean;
  RenewalOpportunityId?: string;
  RenewalOpportunityName?: string;
  SalesforceUrl?: string;
}

// Renewal Opportunity (from BigQuery Type='Renewal')
export interface RenewalOpportunity {
  opportunity_id: string;
  account_id: string;
  account_name: string;
  opportunity_name: string;
  product: Product;
  region: Region;
  acv: number;
  close_date: string;
  stage: string;
  is_won: boolean;
  is_closed: boolean;
  loss_reason: string | null;
  owner_name: string;
  salesforce_url: string;
  contract_id?: string;
  uplift_amount?: number;
  prior_acv?: number;
}

// Renewal summary metrics
export interface RenewalSummary {
  renewalCount: number;
  renewalACV: number;
  autoRenewalCount: number;
  autoRenewalACV: number;
  manualRenewalCount: number;
  manualRenewalACV: number;
  avgUpliftPct: number;
  totalUpliftAmount: number;
  atRiskCount: number;
  atRiskACV: number;
  upcomingRenewals30: number;
  upcomingRenewals30ACV: number;
  upcomingRenewals60: number;
  upcomingRenewals60ACV: number;
  upcomingRenewals90: number;
  upcomingRenewals90ACV: number;
  wonRenewalCount: number;
  wonRenewalACV: number;
  lostRenewalCount: number;
  lostRenewalACV: number;
  pipelineRenewalCount: number;
  pipelineRenewalACV: number;
  // Renewal Risk Calculation: (Expected Renewal ACV with uplift) vs Target
  expectedRenewalACV: number;       // Upcoming ACV with 5% uplift applied
  expectedRenewalACVWithUplift: number; // Same but explicitly named
  renewalRiskGap: number;           // Expected - Target (negative = at risk)
  renewalRiskPct: number;           // Pacing percentage vs target
  // NEW: Target-based RAG assessment
  q1Target: number;                 // Full Q1 renewal bookings target (P75)
  qtdTarget: number;                // Same as q1Target for renewals (no prorating)
  qtdAttainmentPct: number;         // (Won renewals + Expected uplift) / Q1 Target * 100
  forecastedBookings: number;       // Won ACV + Expected uplift from upcoming contracts
  ragStatus: RAGStatus;             // GREEN/YELLOW/RED based on Q1 attainment
  // NEW: Missing uplift tracking
  missingUpliftCount: number;       // Contracts with ACV > 0 but UpliftAmount = 0
  missingUpliftACV: number;         // Total ACV of contracts missing uplift
  potentialLostUplift: number;      // ACV * 5% that should have been booked
}

// Full renewals data structure
export interface RenewalsData {
  summary: { POR: RenewalSummary; R360: RenewalSummary };
  wonRenewals: { POR: RenewalOpportunity[]; R360: RenewalOpportunity[] };
  lostRenewals: { POR: RenewalOpportunity[]; R360: RenewalOpportunity[] };
  pipelineRenewals: { POR: RenewalOpportunity[]; R360: RenewalOpportunity[] };
  upcomingContracts: { POR: SalesforceContract[]; R360: SalesforceContract[] };
  atRiskContracts: { POR: SalesforceContract[]; R360: SalesforceContract[] };
  missingUpliftContracts: { POR: SalesforceContract[]; R360: SalesforceContract[] };
  sfAvailable: boolean; // Whether real-time SF data was fetched
  bqDataOnly: boolean;  // Fallback flag if SF unavailable
}

// ============================================================================
// AI ANALYSIS TILE TYPES
// ============================================================================

// AI Analysis tile state (for tile-based UI)
export interface AIAnalysisTile {
  id: string;
  product: Product;
  region: Region;
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

// AI Analysis filter state (local to AI component)
export interface AIAnalysisFilterState {
  products: Product[];
  regions: Region[];
}

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

// Funnel by source row (extends category row)
export interface FunnelBySourceRow extends FunnelByCategoryRow {
  source: Source;
}

// Funnel by source with actuals, targets, and pacing
export interface FunnelBySourceActuals {
  region: Region;
  source: string;
  // Actuals
  actual_mql: number;
  actual_sql: number;
  actual_sal: number;
  actual_sqo: number;
  // Targets (from StrategicOperatingPlan)
  target_mql: number;
  target_sql: number;
  target_sal: number;
  target_sqo: number;
  // Pacing percentages (actual vs target)
  mql_pacing_pct: number;
  sql_pacing_pct: number;
  sal_pacing_pct: number;
  sqo_pacing_pct: number;
  // Conversion rates
  mql_to_sql_rate: number;
  sql_to_sal_rate: number;
  sal_to_sqo_rate: number;
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
  funnel_by_source_actuals?: {
    POR: FunnelBySourceActuals[];
    R360: FunnelBySourceActuals[];
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
  // MQL details for funnel drill-down
  mql_details?: {
    POR: MQLDetailRow[];
    R360: MQLDetailRow[];
  };
  // SQL details for funnel drill-down
  sql_details?: {
    POR: SQLDetailRow[];
    R360: SQLDetailRow[];
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
  // Enhanced fields for detailed action items
  reason?: string;              // Why this issue is occurring
  metric?: string;              // Specific metric driving the action (e.g., "Pipeline Coverage")
  metricValue?: number;         // Current metric value
  metricTarget?: number;        // Target value
  attainmentPct?: number;       // Attainment percentage (for sorting)
  recommendedAction?: string;   // Specific next steps
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

// MQL Detail row for drill-down
export interface MQLDetailRow {
  product: Product;
  region: Region;
  record_id: string;
  salesforce_url: string;
  company_name: string;
  email: string;
  source: string;
  mql_date: string;
  converted_to_sql: 'Yes' | 'No';
  // Enhanced disqualification fields
  mql_status?: 'ACTIVE' | 'CONVERTED' | 'REVERTED' | 'STALLED';
  was_reverted?: boolean;
  days_in_stage?: number;
}

// SQL Detail row for drill-down
export interface SQLDetailRow {
  product: Product;
  region: Region;
  record_id: string;
  salesforce_url: string;
  company_name: string;
  email: string;
  source: string;
  sql_date: string;
  mql_date: string;
  days_mql_to_sql: number;
  converted_to_sal: 'Yes' | 'No';
  converted_to_sqo: 'Yes' | 'No';
  has_opportunity: 'Yes' | 'No';
  // Disqualification fields
  sql_status: 'ACTIVE' | 'CONVERTED_SAL' | 'CONVERTED_SQO' | 'WON' | 'STALLED' | 'LOST';
  opportunity_id?: string;
  opportunity_name?: string;
  opportunity_stage?: string;
  opportunity_acv?: number;
  loss_reason?: string;
  days_in_stage?: number;
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
  categories: Category[];
  sources: Source[];
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

// Attainment detail with period comparison
export interface AttainmentTrendRow {
  product: Product;
  region: Region;
  category: Category;
  qtdTarget: MetricComparison<number>;
  qtdAcv: MetricComparison<number>;
  qtdAttainmentPct: MetricComparison<number>;
  qtdGap: MetricComparison<number>;
  qtdDeals: MetricComparison<number>;
  winRatePct: MetricComparison<number>;
  pipelineAcv: MetricComparison<number>;
  pipelineCoverageX: MetricComparison<number>;
  qtdLostDeals: MetricComparison<number>;
  qtdLostAcv: MetricComparison<number>;
  ragStatus: { current: RAGStatus; previous: RAGStatus };
}

// Source attainment with period comparison
export interface SourceAttainmentTrendRow {
  product: Product;
  region: Region;
  source: Source;
  qtdTarget: MetricComparison<number>;
  qtdAcv: MetricComparison<number>;
  qtdDeals: MetricComparison<number>;
  attainmentPct: MetricComparison<number>;
  gap: MetricComparison<number>;
  ragStatus: { current: RAGStatus; previous: RAGStatus };
}

// Funnel health with period comparison
export interface FunnelHealthTrendRow {
  product: Product;
  region: Region;
  actualMql: MetricComparison<number>;
  actualSql: MetricComparison<number>;
  actualSal: MetricComparison<number>;
  actualSqo: MetricComparison<number>;
  mqlPacingPct: MetricComparison<number>;
  sqlPacingPct: MetricComparison<number>;
  salPacingPct: MetricComparison<number>;
  sqoPacingPct: MetricComparison<number>;
  mqlToSqlRate: MetricComparison<number>;
  sqlToSalRate: MetricComparison<number>;
  salToSqoRate: MetricComparison<number>;
  primaryBottleneck: { current: string; previous: string };
}

// Funnel by category with period comparison
export interface FunnelByCategoryTrendRow {
  product: Product;
  region: Region;
  category: Category;
  actualMql: MetricComparison<number>;
  actualSql: MetricComparison<number>;
  actualSal: MetricComparison<number>;
  actualSqo: MetricComparison<number>;
  mqlPacingPct: MetricComparison<number>;
  sqlPacingPct: MetricComparison<number>;
  salPacingPct: MetricComparison<number>;
  sqoPacingPct: MetricComparison<number>;
  weightedTofScore: MetricComparison<number>;
}

// Funnel by source with period comparison
export interface FunnelBySourceTrendRow extends FunnelByCategoryTrendRow {
  source: Source;
}

// Pipeline RCA with period comparison
export interface PipelineRCATrendRow {
  product: Product;
  region: Region;
  category: Category;
  pipelineAcv: MetricComparison<number>;
  pipelineCoverageX: MetricComparison<number>;
  pipelineOpps: MetricComparison<number>;
  pipelineAvgAgeDays: MetricComparison<number>;
  pipelineHealth: { current: string; previous: string };
  severity: { current: string; previous: string };
  rcaCommentary: { current: string; previous: string };
  recommendedAction: { current: string; previous: string };
}

// Loss reason with period comparison
export interface LossReasonTrendRow {
  product: Product;
  region: Region;
  lossReason: string;
  dealCount: MetricComparison<number>;
  lostAcv: MetricComparison<number>;
  pctOfRegionalLoss: MetricComparison<number>;
  severity: { current: string; previous: string };
}

// Google Ads with period comparison
export interface GoogleAdsTrendRow {
  product: Product;
  region: Region;
  impressions: MetricComparison<number>;
  clicks: MetricComparison<number>;
  adSpendUsd: MetricComparison<number>;
  conversions: MetricComparison<number>;
  ctrPct: MetricComparison<number>;
  cpcUsd: MetricComparison<number>;
  cpaUsd: MetricComparison<number>;
}

// Google Ads RCA with period comparison
export interface GoogleAdsRCATrendRow {
  product: Product;
  region: Region;
  ctrPct: MetricComparison<number>;
  cpaUsd: MetricComparison<number>;
  ctrPerformance: { current: string; previous: string };
  cpaPerformance: { current: string; previous: string };
  severity: { current: string; previous: string };
  rcaCommentary: { current: string; previous: string };
  recommendedAction: { current: string; previous: string };
}

// Executive counts with period comparison
export interface ExecutiveCountsTrend {
  areasExceedingTarget: MetricComparison<number>;
  areasAtRisk: MetricComparison<number>;
  areasNeedingAttention: MetricComparison<number>;
  areasWithMomentum: MetricComparison<number>;
}

// Wins/Bright spots with period comparison
export interface WinBrightSpotTrend {
  product: Product;
  region: Region;
  category: Category;
  qtdAttainmentPct: MetricComparison<number>;
  qtdAcv: MetricComparison<number>;
  qtdTarget: MetricComparison<number>;
  pipelineCoverageX: MetricComparison<number>;
  winRatePct: MetricComparison<number>;
  performanceTier: { current: string; previous: string };
  successCommentary: { current: string; previous: string };
}

// Momentum indicators with period comparison
export interface MomentumIndicatorTrend {
  product: Product;
  region: Region;
  momentumTier: { current: string; previous: string };
  positiveMomentumCount: MetricComparison<number>;
  mqlWowPct: MetricComparison<number>;
  sqlWowPct: MetricComparison<number>;
  mqlTrend: { current: string; previous: string };
  sqlTrend: { current: string; previous: string };
  momentumCommentary: { current: string; previous: string };
}

// Top risk pockets with period comparison
export interface TopRiskPocketTrend {
  product: Product;
  region: Region;
  category: Category;
  qtdTarget: MetricComparison<number>;
  qtdAcv: MetricComparison<number>;
  qtdGap: MetricComparison<number>;
  qtdAttainmentPct: MetricComparison<number>;
  winRatePct: MetricComparison<number>;
  pipelineAcv: MetricComparison<number>;
  pipelineCoverageX: MetricComparison<number>;
  ragStatus: { current: RAGStatus; previous: RAGStatus };
}

// Funnel RCA insights with period comparison
export interface FunnelRCAInsightTrend {
  product: Product;
  region: Region;
  primaryBottleneck: { current: string; previous: string };
  severity: { current: string; previous: string };
  rcaCommentary: { current: string; previous: string };
  recommendedAction: { current: string; previous: string };
  mqlPacingPct: MetricComparison<number>;
  sqlPacingPct: MetricComparison<number>;
  salPacingPct: MetricComparison<number>;
  sqoPacingPct: MetricComparison<number>;
}

// Funnel trends with period comparison (WoW trends)
export interface FunnelTrendWoWRow {
  product: Product;
  region: Region;
  mqlCurrent7d: MetricComparison<number>;
  sqlCurrent7d: MetricComparison<number>;
  salCurrent7d: MetricComparison<number>;
  sqoCurrent7d: MetricComparison<number>;
  mqlWowPct: MetricComparison<number>;
  sqlWowPct: MetricComparison<number>;
  salWowPct: MetricComparison<number>;
  sqoWowPct: MetricComparison<number>;
  mqlTrend: { current: string; previous: string };
  sqlTrend: { current: string; previous: string };
  salTrend: { current: string; previous: string };
  sqoTrend: { current: string; previous: string };
}

// Action item with period context
export interface ActionItemTrend {
  urgency: 'IMMEDIATE' | 'SHORT_TERM' | 'STRATEGIC';
  category: string;
  product: Product;
  region: Region | null;
  issue: string;
  reason?: string; // Why this issue is occurring
  action: string;
  metric?: string; // Specific metric driving the action item
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  isNew: boolean; // true if this action item didn't exist in previous period
  isResolved: boolean; // true if this action item existed in previous but not current
}

// Funnel milestone attainment for date range
export interface FunnelMilestoneAttainmentRow {
  product: Product;
  region: Region;
  mqlTarget: MetricComparison<number>;
  mqlActual: MetricComparison<number>;
  mqlAttainmentPct: MetricComparison<number>;
  mqlRag: { current: RAGStatus; previous: RAGStatus };
  sqlTarget: MetricComparison<number>;
  sqlActual: MetricComparison<number>;
  sqlAttainmentPct: MetricComparison<number>;
  sqlRag: { current: RAGStatus; previous: RAGStatus };
  salTarget: MetricComparison<number>;
  salActual: MetricComparison<number>;
  salAttainmentPct: MetricComparison<number>;
  salRag: { current: RAGStatus; previous: RAGStatus };
  sqoTarget: MetricComparison<number>;
  sqoActual: MetricComparison<number>;
  sqoAttainmentPct: MetricComparison<number>;
  sqoRag: { current: RAGStatus; previous: RAGStatus };
  funnelScore: MetricComparison<number>;
  funnelScoreRag: { current: RAGStatus; previous: RAGStatus };
}

// Deal detail for trend comparison
export interface DealDetailTrend {
  opportunityId: string;
  accountName: string;
  opportunityName: string;
  product: Product;
  region: Region;
  category: Category;
  dealType: string;
  acv: number;
  closeDate: string;
  stage: string;
  isWon: boolean;
  isClosed: boolean;
  lossReason: string | null;
  source: Source;
  ownerName: string;
  ownerId?: string;
  salesforceUrl: string;
  periodType: 'current' | 'previous';
}

// Complete trend analysis response - COMPREHENSIVE
// Period info for quarter pacing
export interface QuarterPeriodInfo {
  quarterStart: string;
  asOfDate: string;
  daysElapsed: number;
  daysRemaining: number;
  totalDays: number;
  quarterPctComplete: number;
}

// Quarterly targets
export interface QuarterlyTargets {
  POR_Q1_target: number;
  R360_Q1_target: number;
  combined_Q1_target: number;
}

// Grand total with trend comparison
export interface GrandTotalTrend {
  product: string;
  totalQ1Target: number;
  totalQtdTarget: MetricComparison<number>;
  totalQtdDeals: MetricComparison<number>;
  totalQtdAcv: MetricComparison<number>;
  totalQtdAttainmentPct: MetricComparison<number>;
  totalQ1ProgressPct: MetricComparison<number>;
  totalQtdGap: MetricComparison<number>;
  totalLostDeals: MetricComparison<number>;
  totalLostAcv: MetricComparison<number>;
  totalWinRatePct: MetricComparison<number>;
  totalPipelineAcv: MetricComparison<number>;
  totalPipelineCoverageX: MetricComparison<number>;
}

// Product total with trend comparison
export interface ProductTotalTrend {
  product: Product;
  totalQ1Target: number;
  totalQtdTarget: MetricComparison<number>;
  totalQtdDeals: MetricComparison<number>;
  totalQtdAcv: MetricComparison<number>;
  totalQtdAttainmentPct: MetricComparison<number>;
  totalQ1ProgressPct: MetricComparison<number>;
  totalQtdGap: MetricComparison<number>;
  totalLostDeals: MetricComparison<number>;
  totalLostAcv: MetricComparison<number>;
  totalWinRatePct: MetricComparison<number>;
  totalPipelineAcv: MetricComparison<number>;
  totalPipelineCoverageX: MetricComparison<number>;
}

// Funnel pacing row with targets
export interface FunnelPacingTrendRow {
  product: Product;
  region: Region;
  sourceChannel: string;
  actualMql: MetricComparison<number>;
  targetMql: MetricComparison<number>;
  mqlPacingPct: MetricComparison<number>;
  mqlRag: { current: RAGStatus; previous: RAGStatus };
  actualSql: MetricComparison<number>;
  targetSql: MetricComparison<number>;
  sqlPacingPct: MetricComparison<number>;
  sqlRag: { current: RAGStatus; previous: RAGStatus };
  actualSal: MetricComparison<number>;
  targetSal: MetricComparison<number>;
  salPacingPct: MetricComparison<number>;
  salRag: { current: RAGStatus; previous: RAGStatus };
  actualSqo: MetricComparison<number>;
  targetSqo: MetricComparison<number>;
  sqoPacingPct: MetricComparison<number>;
  sqoRag: { current: RAGStatus; previous: RAGStatus };
  inboundTargetAcv: MetricComparison<number>;
  mqlToSqlRate: MetricComparison<number>;
  sqlToSalRate: MetricComparison<number>;
  salToSqoRate: MetricComparison<number>;
}

// Pipeline attainment row
export interface PipelineAttainmentTrendRow {
  product: Product;
  region: Region;
  category: Category;
  q1Target: MetricComparison<number>;
  qtdTarget: MetricComparison<number>;
  qtdAcv: MetricComparison<number>;
  qtdAttainmentPct: MetricComparison<number>;
  q1ProgressPct: MetricComparison<number>;
  qtdGap: MetricComparison<number>;
  pipelineAcv: MetricComparison<number>;
  pipelineCoverageX: MetricComparison<number>;
  pipelineOpps: MetricComparison<number>;
  pipelineAvgAgeDays: MetricComparison<number>;
  requiredRunRate: MetricComparison<number>;
  ragStatus: { current: RAGStatus; previous: RAGStatus };
}

export interface TrendAnalysisData {
  generatedAt: string;
  periodInfo: TrendPeriodInfo;
  filters: {
    products: Product[];
    regions: Region[];
  };

  // QUARTER PACING INFO
  period: QuarterPeriodInfo;
  quarterlyTargets: QuarterlyTargets;
  grandTotal: GrandTotalTrend;
  productTotals: Record<string, ProductTotalTrend>;

  // SUMMARY METRICS
  revenueSummary: {
    totalACV: MetricComparison<number>;
    wonDeals: MetricComparison<number>;
    pipelineACV: MetricComparison<number>;
    avgDealSize: MetricComparison<number>;
    lostDeals: MetricComparison<number>;
    lostACV: MetricComparison<number>;
    winRatePct: MetricComparison<number>;
  };
  funnelSummary: {
    totalMQL: MetricComparison<number>;
    totalSQL: MetricComparison<number>;
    totalSAL: MetricComparison<number>;
    totalSQO: MetricComparison<number>;
  };

  // EXECUTIVE OVERVIEW
  executiveCounts: ExecutiveCountsTrend;
  winsBrightSpots: WinBrightSpotTrend[];
  momentumIndicators: MomentumIndicatorTrend[];
  topRiskPockets: TopRiskPocketTrend[];

  // DETAILED BREAKDOWNS
  revenueByDimension: RevenueTrendRow[];
  funnelByDimension: FunnelTrendRow[];
  attainmentDetail: AttainmentTrendRow[];
  sourceAttainment: SourceAttainmentTrendRow[];

  // FUNNEL DETAILS
  funnelHealth: FunnelHealthTrendRow[];
  funnelByCategory: FunnelByCategoryTrendRow[];
  funnelBySource: FunnelBySourceTrendRow[];
  funnelTrends: FunnelTrendWoWRow[];
  funnelPacing: FunnelPacingTrendRow[];
  funnelMilestoneAttainment: FunnelMilestoneAttainmentRow[];
  funnelRCAInsights: FunnelRCAInsightTrend[];

  // PIPELINE & ATTAINMENT
  pipelineAttainment: PipelineAttainmentTrendRow[];

  // PIPELINE & LOSS ANALYSIS
  pipelineRCA: PipelineRCATrendRow[];
  lossReasonRCA: LossReasonTrendRow[];

  // GOOGLE ADS
  googleAds: GoogleAdsTrendRow[];
  googleAdsRCA: GoogleAdsRCATrendRow[];

  // ACTION ITEMS
  actionItems: {
    immediate: ActionItemTrend[];
    shortTerm: ActionItemTrend[];
    strategic: ActionItemTrend[];
  };

  // DEAL LISTS
  wonDeals: DealDetailTrend[];
  lostDeals: DealDetailTrend[];
  pipelineDeals: DealDetailTrend[];

  // CHARTS
  charts: {
    acvTimeSeries: TrendChartData;
    mqlTimeSeries: TrendChartData;
    sqlTimeSeries: TrendChartData;
    pipelineTimeSeries: TrendChartData;
  };
}

// API request parameters
export interface TrendAnalysisRequest {
  startDate: string;
  endDate: string;
  products: Product[];
  regions: Region[];
}
