// API types - ReportData, Google Ads, Deals, AI Analysis
import { Product, Region, Category, Source, Period } from './core';
import { GrandTotal, ProductTotal, AttainmentRow, SourceAttainmentRow, ExecutiveCounts, WinBrightSpot, ActionItem, MomentumIndicator, TopRiskPocket } from './attainment';
import { FunnelByCategoryRow, FunnelBySourceRow, FunnelBySourceActuals, PipelineRCARow, LossReasonRow, FunnelRCAInsight, MQLDetailRow, SQLDetailRow, SALDetailRow, SQODetailRow } from './funnel';

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

// Google Ads data with region
export interface GoogleAdsRegionalData extends GoogleAdsData {
  region: Region;
}

// Google Ads RCA
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

// AI Analysis tile state
export interface AIAnalysisTile {
  id: string;
  product: Product;
  region: Region;
  loading: boolean;
  analysis: string | null;
  error: string | null;
  generatedAt: string | null;
}

// AI Analysis filter state
export interface AIAnalysisFilterState {
  products: Product[];
  regions: Region[];
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
  mql_details?: {
    POR: MQLDetailRow[];
    R360: MQLDetailRow[];
  };
  sql_details?: {
    POR: SQLDetailRow[];
    R360: SQLDetailRow[];
  };
  sal_details?: {
    POR: SALDetailRow[];
    R360: SALDetailRow[];
  };
  sqo_details?: {
    POR: SQODetailRow[];
    R360: SQODetailRow[];
  };
}
