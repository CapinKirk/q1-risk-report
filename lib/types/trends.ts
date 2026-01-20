// Trend analysis types - period comparisons
import { Product, Region, Category, Source, RAGStatus } from './core';

// Date range for trend analysis
export interface DateRange {
  startDate: string;
  endDate: string;
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
  delta: T;
  deltaPercent: number;
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
  reason?: string;
  action: string;
  metric?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  isNew: boolean;
  isResolved: boolean;
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

// Quarter period info
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

// Complete trend analysis response
export interface TrendAnalysisData {
  generatedAt: string;
  periodInfo: TrendPeriodInfo;
  filters: {
    products: Product[];
    regions: Region[];
  };
  period: QuarterPeriodInfo;
  quarterlyTargets: QuarterlyTargets;
  grandTotal: GrandTotalTrend;
  productTotals: Record<string, ProductTotalTrend>;
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
  executiveCounts: ExecutiveCountsTrend;
  winsBrightSpots: WinBrightSpotTrend[];
  momentumIndicators: MomentumIndicatorTrend[];
  topRiskPockets: TopRiskPocketTrend[];
  revenueByDimension: RevenueTrendRow[];
  funnelByDimension: FunnelTrendRow[];
  attainmentDetail: AttainmentTrendRow[];
  sourceAttainment: SourceAttainmentTrendRow[];
  funnelHealth: FunnelHealthTrendRow[];
  funnelByCategory: FunnelByCategoryTrendRow[];
  funnelBySource: FunnelBySourceTrendRow[];
  funnelTrends: FunnelTrendWoWRow[];
  funnelPacing: FunnelPacingTrendRow[];
  funnelMilestoneAttainment: FunnelMilestoneAttainmentRow[];
  funnelRCAInsights: FunnelRCAInsightTrend[];
  pipelineAttainment: PipelineAttainmentTrendRow[];
  pipelineRCA: PipelineRCATrendRow[];
  lossReasonRCA: LossReasonTrendRow[];
  googleAds: GoogleAdsTrendRow[];
  googleAdsRCA: GoogleAdsRCATrendRow[];
  actionItems: {
    immediate: ActionItemTrend[];
    shortTerm: ActionItemTrend[];
    strategic: ActionItemTrend[];
  };
  wonDeals: DealDetailTrend[];
  lostDeals: DealDetailTrend[];
  pipelineDeals: DealDetailTrend[];
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
