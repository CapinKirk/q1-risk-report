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

// Google Ads RCA
export interface GoogleAdsRCA {
  ctr_pct: number;
  ctr_performance: string;
  cpa_usd: number;
  cpa_performance: string;
  rca_commentary: string;
  recommended_action: string;
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
    POR: GoogleAdsData;
    R360: GoogleAdsData;
  };
  google_ads_rca: {
    POR: GoogleAdsRCA;
    R360: GoogleAdsRCA;
  };
  funnel_rca_insights: {
    POR: FunnelRCAInsight[];
    R360: FunnelRCAInsight[];
  };
}

// Filter state
export interface FilterState {
  regions: Region[];
}
