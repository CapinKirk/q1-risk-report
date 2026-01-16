/**
 * Centralized dimension mappings - Single source of truth
 * Used by: SQL queries, API routes, frontend filters
 */

// Region mappings (Salesforce Division → Report Region)
export const REGION_MAP = {
  'US': 'AMER',
  'UK': 'EMEA',
  'AU': 'APAC',
} as const;

export const REGION_REVERSE_MAP = {
  'AMER': 'US',
  'EMEA': 'UK',
  'APAC': 'AU',
} as const;

export type Region = keyof typeof REGION_REVERSE_MAP;
export const ALL_REGIONS: Region[] = ['AMER', 'EMEA', 'APAC'];

// Product mappings (por_record__c field)
export type Product = 'POR' | 'R360';
export const ALL_PRODUCTS: Product[] = ['POR', 'R360'];

// Category mappings (Salesforce Type → Report Category)
export const CATEGORY_MAP = {
  'New Business': 'NEW LOGO',
  'Existing Business': 'EXPANSION',
  'Migration': 'MIGRATION',
  'Renewal': 'RENEWAL',
} as const;

export const CATEGORY_REVERSE_MAP = {
  'NEW LOGO': 'New Business',
  'EXPANSION': 'Existing Business',
  'MIGRATION': 'Migration',
  'RENEWAL': 'Renewal',
} as const;

export type Category = keyof typeof CATEGORY_REVERSE_MAP;
export const ALL_CATEGORIES: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION', 'RENEWAL'];

// Categories excluding renewals (for existing queries that filter out renewals)
export const CORE_CATEGORIES: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION'];

// Source mappings (SDRSource field)
export const SOURCE_MAP = {
  'INBOUND': 'INBOUND',
  'OUTBOUND': 'OUTBOUND',
  'AE_SOURCED': 'AE SOURCED',
  'AE SOURCED': 'AE SOURCED',
  'AM_SOURCED': 'AM SOURCED',
  'AM SOURCED': 'AM SOURCED',
  'TRADESHOW': 'TRADESHOW',
  'PARTNERSHIPS': 'PARTNERSHIPS',
} as const;

export type Source = 'INBOUND' | 'OUTBOUND' | 'AE SOURCED' | 'AM SOURCED' | 'TRADESHOW' | 'PARTNERSHIPS';
export const ALL_SOURCES: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];

// Funnel Type to Category mapping (for DailyRevenueFunnel)
export const FUNNEL_TYPE_MAP = {
  'INBOUND': 'NEW LOGO',
  'R360 INBOUND': 'NEW LOGO',
  'NEW LOGO': 'NEW LOGO',
  'R360 NEW LOGO': 'NEW LOGO',
  'EXPANSION': 'EXPANSION',
  'R360 EXPANSION': 'EXPANSION',
  'MIGRATION': 'MIGRATION',
  'R360 MIGRATION': 'MIGRATION',
} as const;

// RAG Status thresholds
export const RAG_THRESHOLDS = {
  GREEN: 90,   // >= 90% attainment
  YELLOW: 70,  // >= 70% attainment
  RED: 0,      // < 70% attainment
} as const;

export type RAGStatus = 'GREEN' | 'YELLOW' | 'RED';

export function getRAGStatus(attainmentPct: number): RAGStatus {
  if (attainmentPct >= RAG_THRESHOLDS.GREEN) return 'GREEN';
  if (attainmentPct >= RAG_THRESHOLDS.YELLOW) return 'YELLOW';
  return 'RED';
}

// Color constants for UI
export const COLORS = {
  GREEN: '#16a34a',
  YELLOW: '#ca8a04',
  RED: '#dc2626',
  BLUE: '#2563eb',
  GRAY: '#6b7280',
} as const;

export function getRAGColor(status: RAGStatus): string {
  return COLORS[status];
}

// BigQuery project and datasets
export const BIGQUERY_CONFIG = {
  PROJECT_ID: 'data-analytics-306119',
  DATASETS: {
    SFDC: 'sfdc',
    MARKETING_FUNNEL: 'MarketingFunnel',
    STAGING: 'Staging',
    GOOGLE_ADS_POR: 'GoogleAds_POR_8275359090',
    GOOGLE_ADS_R360: 'GoogleAds_Record360_3799591491',
  },
  TABLES: {
    OPPORTUNITY: 'OpportunityViewTable',
    SOP: 'StrategicOperatingPlan',
    INBOUND_FUNNEL: 'InboundFunnel',
    R360_INBOUND_FUNNEL: 'R360InboundFunnel',
    DAILY_REVENUE_FUNNEL: 'DailyRevenueFunnel',
  },
} as const;


// Helper to build SQL CASE for region mapping
export function getSQLRegionCase(columnName: string = 'Division'): string {
  return `CASE ${columnName}
    WHEN 'US' THEN 'AMER'
    WHEN 'UK' THEN 'EMEA'
    WHEN 'AU' THEN 'APAC'
  END`;
}

// Helper to build SQL CASE for category mapping
export function getSQLCategoryCase(columnName: string = 'Type'): string {
  return `CASE ${columnName}
    WHEN 'New Business' THEN 'NEW LOGO'
    WHEN 'Existing Business' THEN 'EXPANSION'
    WHEN 'Migration' THEN 'MIGRATION'
  END`;
}
