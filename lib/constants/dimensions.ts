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

// Historical win rate benchmarks (2024-2025 average from OpportunityViewTable)
// Used for win-rate-specific RAG coloring: green = above avg, yellow = near avg, red = below avg
export const WIN_RATE_BENCHMARKS: Record<string, number> = {
  'POR-NEW LOGO': 46.4,    // 613/1322
  'POR-EXPANSION': 62.8,   // 2432/3870
  'POR-MIGRATION': 42.3,   // 360/852
  'POR-RENEWAL': 99.9,     // 8449/8459
  'R360-NEW LOGO': 23.4,   // 391/1668
  'R360-EXPANSION': 84.8,  // 792/934
  'R360-RENEWAL': 100.0,   // 343/343
  'POR': 56.3,     // weighted average across POR non-renewal categories
  'R360': 45.5,    // weighted average across R360 non-renewal categories
  'ALL': 53,       // overall weighted average
};

// Get win rate color based on historical benchmark (±15pp of average = yellow band)
export function getWinRateColor(winRate: number | null | undefined, product?: string, category?: string): string {
  if (winRate == null || winRate === 0) return '#6b7280'; // gray for no data / no deals

  const key = product && category ? `${product}-${category}` : product || 'ALL';
  const benchmark = WIN_RATE_BENCHMARKS[key] ?? WIN_RATE_BENCHMARKS[product || 'ALL'] ?? WIN_RATE_BENCHMARKS['ALL'];

  // Renewals / very high benchmarks: use absolute thresholds
  if (benchmark >= 90) {
    if (winRate >= 90) return '#16a34a';   // green
    if (winRate >= 70) return '#ca8a04';   // yellow
    return '#dc2626';                       // red
  }

  // ±15 percentage points around the historical average
  const upperBand = benchmark + 15;
  const lowerBand = benchmark - 15;
  if (winRate >= upperBand) return '#16a34a';  // green - above average
  if (winRate >= lowerBand) return '#ca8a04';  // yellow - near average
  return '#dc2626';                             // red - below average
}

// Get win rate CSS class based on historical benchmark
export function getWinRateClass(winRate: number | null | undefined, product?: string, category?: string): string {
  if (winRate == null || winRate === 0) return 'gray';

  const key = product && category ? `${product}-${category}` : product || 'ALL';
  const benchmark = WIN_RATE_BENCHMARKS[key] ?? WIN_RATE_BENCHMARKS[product || 'ALL'] ?? WIN_RATE_BENCHMARKS['ALL'];

  if (benchmark >= 90) {
    if (winRate >= 90) return 'green';
    if (winRate >= 70) return 'yellow';
    return 'red';
  }

  const upperBand = benchmark + 15;
  const lowerBand = benchmark - 15;
  if (winRate >= upperBand) return 'green';
  if (winRate >= lowerBand) return 'yellow';
  return 'red';
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
    // Legacy tables
    OPPORTUNITY: 'OpportunityViewTable',
    SOP: 'StrategicOperatingPlan',
    INBOUND_FUNNEL: 'InboundFunnel',
    R360_INBOUND_FUNNEL: 'R360InboundFunnel',

    // RevOps Architecture (Layer 0 - Raw Data)
    RAW_2026_PLAN_BY_MONTH: 'RAW_2026_Plan_by_Month',
    MONTHLY_REVENUE_FUNNEL: 'MonthlyRevenueFunnel',
    DAILY_REVENUE_FUNNEL: 'DailyRevenueFunnel',

    // RevOps Architecture (Layer 1 - Processed Sources)
    SOURCE_PLAN_BY_MONTH_2026: 'SourcePlanByMonth2026',
    SOURCE_TARGET_RATES: 'SourceTargetRates',
    SOURCE_BOOKINGS_ALLOCATIONS: 'SourceBookingsAllocations',
    SALES_CYCLE_LAGS_2026: 'SalesCycleLags2026',

    // RevOps Architecture (Layer 2-5 - Model & Reports)
    REVOPS_MODEL: 'RevOpsModel',      // Layer 2: Wide data framework
    REVOPS_PLAN: 'RevOpsPlan',        // Layer 3: Vertical format for metrics
    REVOPS_PERFORMANCE: 'RevOpsPerformance', // Layer 4: Daily pacing
    REVOPS_REPORT: 'RevOpsReport',    // Layer 5: WTD, MTD, QTD, YTD reporting (PRIMARY)
  },
} as const;

// RevOps Risk Profile levels
export type RiskProfile = 'P50' | 'P75' | 'P90';
export const DEFAULT_RISK_PROFILE: RiskProfile = 'P90';

// RevOps Horizon levels for reporting
export type Horizon = 'WTD' | 'MTD' | 'QTD' | 'YTD';

// OpportunityType to Category mapping (for RevOps tables)
export const OPPORTUNITY_TYPE_MAP = {
  'New Business': 'NEW LOGO',
  'Existing Business': 'EXPANSION',
  'Migration': 'MIGRATION',
  'Renewal': 'RENEWAL',
} as const;

export const OPPORTUNITY_TYPE_REVERSE_MAP = {
  'NEW LOGO': 'New Business',
  'EXPANSION': 'Existing Business',
  'MIGRATION': 'Migration',
  'RENEWAL': 'Renewal',
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
