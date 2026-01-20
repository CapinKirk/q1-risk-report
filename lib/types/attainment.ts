// Attainment and metrics types
import { Product, Region, Category, Source, RAGStatus } from './core';

// Grand total metrics
export interface GrandTotal {
  total_fy_target: number;
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
  total_fy_target: number;
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
  fy_target?: number;
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
  reason?: string;
  metric?: string;
  metricValue?: number;
  metricTarget?: number;
  attainmentPct?: number;
  recommendedAction?: string;
}

// Momentum Indicator
export interface MomentumIndicator {
  product: Product;
  region: Region;
  category: Category;
  momentum_tier: 'STRONG_MOMENTUM' | 'MODERATE_MOMENTUM';
  positive_momentum_count: number;
  momentum_commentary: string;
  mql_trend: 'UP' | 'DOWN' | 'FLAT';
  mql_wow_pct: number;
  sql_trend: 'UP' | 'DOWN' | 'FLAT';
  sql_wow_pct: number;
  current_attainment_pct: number;
  pipeline_coverage_x: number;
  gap_to_green: number;
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
