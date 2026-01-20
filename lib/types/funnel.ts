// Funnel detail types for MQL/SQL/SAL/SQO drill-down
import { Product, Region, Category, Source, LeadType } from './core';

// Funnel by category row
export interface FunnelByCategoryRow {
  category: Category;
  region: Region;
  lead_stage_label?: 'MQL' | 'EQL';
  tof_score?: number;
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

// Funnel by source with actuals
export interface FunnelBySourceActuals {
  region: Region;
  source: string;
  actual_mql: number;
  actual_sql: number;
  actual_sal: number;
  actual_sqo: number;
  // Q1 targets
  q1_target_mql: number;
  q1_target_sql: number;
  q1_target_sal: number;
  q1_target_sqo: number;
  // QTD targets (prorated by quarter % complete)
  qtd_target_mql: number;
  qtd_target_sql: number;
  qtd_target_sal: number;
  qtd_target_sqo: number;
  // Pacing percentages (actual vs QTD target)
  mql_pacing_pct: number;
  sql_pacing_pct: number;
  sal_pacing_pct: number;
  sqo_pacing_pct: number;
  // Gaps (actual - QTD target)
  mql_gap: number;
  sql_gap: number;
  sal_gap: number;
  sqo_gap: number;
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

// Funnel RCA Insights
export interface FunnelRCAInsight {
  region: Region;
  rca_commentary: string;
  recommended_action: string;
}

// MQL/EQL Detail row for drill-down
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
  mql_status?: 'ACTIVE' | 'CONVERTED' | 'DISQUALIFIED' | 'STALLED';
  was_reverted?: boolean;
  days_in_stage?: number;
  lost_reason?: string | null;
  lead_type: LeadType;
  category: 'NEW LOGO' | 'EXPANSION' | 'MIGRATION';
  // UTM tracking fields
  utm_source?: string;
  utm_medium?: string;
  utm_keyword?: string;  // UtmTerm from BigQuery
}

// SQL Detail row
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
  sql_status: 'ACTIVE' | 'CONVERTED_SAL' | 'CONVERTED_SQO' | 'WON' | 'STALLED' | 'LOST';
  opportunity_id?: string;
  opportunity_name?: string;
  opportunity_stage?: string;
  opportunity_acv?: number;
  loss_reason?: string;
  days_in_stage?: number;
  category: 'NEW LOGO' | 'EXPANSION' | 'MIGRATION';
}

// SAL Detail row
export interface SALDetailRow {
  product: Product;
  region: Region;
  record_id: string;
  salesforce_url: string;
  company_name: string;
  email: string;
  source: string;
  sal_date: string;
  sql_date: string;
  mql_date: string;
  days_sql_to_sal: number;
  converted_to_sqo: 'Yes' | 'No';
  has_opportunity: 'Yes' | 'No';
  sal_status: 'ACTIVE' | 'CONVERTED_SQO' | 'WON' | 'STALLED' | 'LOST';
  opportunity_id?: string;
  opportunity_name?: string;
  opportunity_stage?: string;
  opportunity_acv?: number;
  loss_reason?: string;
  days_in_stage?: number;
  category: 'NEW LOGO' | 'EXPANSION' | 'MIGRATION';
}

// SQO Detail row
export interface SQODetailRow {
  product: Product;
  region: Region;
  record_id: string;
  salesforce_url: string;
  company_name: string;
  email: string;
  source: string;
  sqo_date: string;
  sal_date: string;
  sql_date: string;
  mql_date: string;
  days_sal_to_sqo: number;
  days_total_cycle: number;
  sqo_status: 'ACTIVE' | 'WON' | 'LOST' | 'STALLED';
  opportunity_id: string;
  opportunity_name: string;
  opportunity_stage: string;
  opportunity_acv: number;
  loss_reason?: string;
  days_in_stage?: number;
  category: 'NEW LOGO' | 'EXPANSION' | 'MIGRATION';
}
