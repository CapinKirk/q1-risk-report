import { NextResponse } from 'next/server';
import { getBigQueryClient } from '@/lib/bigquery-client';
import {
  BIGQUERY_CONFIG,
  REGION_REVERSE_MAP,
  getRAGStatus,
  type RAGStatus,
} from '@/lib/constants/dimensions';

/**
 * Q1 2026 Risk Report API - RevOps Architecture
 *
 * Data Sources (RevOps Layer Architecture):
 * - Layer 5: RevOpsReport - WTD, MTD, QTD, YTD reporting with P90 targets
 * - Layer 4: RevOpsPerformance - Daily pacing with actuals (for trends)
 * - sfdc.OpportunityViewTable - Deal-level details (won, lost, pipeline)
 * - MarketingFunnel - Lead/funnel stage details
 *
 * Key Changes from StrategicOperatingPlan:
 * - Now uses RevOpsReport with RiskProfile='P90' for risk-adjusted targets
 * - Horizon='QTD' for quarter-to-date metrics
 * - Period_Start_Date='2026-01-01' for Q1 2026
 * - OpportunityType maps to Category (New Business->NEW LOGO, etc.)
 */

interface ReportFilters {
  startDate: string;
  endDate: string;
  products: string[];
  regions: string[];
  riskProfile: string;
}

// Helper to get BigQuery client
function getBigQuery() {
  return getBigQueryClient();
}

/**
 * Cap SQO detail records to match RevOpsReport actual_sqo counts.
 * RevOpsReport is the source of truth for funnel counts. Detail records from
 * raw funnel tables may exceed that count due to different dedup logic.
 * We keep the most recent records (by sqo_date DESC) up to the RevOpsReport cap.
 */
function capDetailsToCounts(
  sqoDetails: { POR: any[]; R360: any[] },
  revOpsData: any[]
): { POR: any[]; R360: any[] } {
  // Build cap map from RevOpsReport: product-region-category → actual_sqo
  const capMap = new Map<string, number>();
  const funnelCategories = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'];
  for (const row of revOpsData) {
    if (!funnelCategories.includes(row.category)) continue;
    const key = `${row.product}-${row.region}-${row.category}`;
    capMap.set(key, (capMap.get(key) || 0) + (parseInt(row.actual_sqo) || 0));
  }

  function capProduct(records: any[], product: string): any[] {
    // Group records by region-category
    const groups = new Map<string, any[]>();
    for (const rec of records) {
      const category = rec.category || 'NEW LOGO';
      const key = `${product}-${rec.region}-${category}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    }

    const result: any[] = [];
    for (const [key, recs] of Array.from(groups.entries())) {
      const cap = capMap.get(key);
      if (cap !== undefined) {
        // Records are already ordered by sqo_date DESC from the query
        result.push(...recs.slice(0, cap));
      } else {
        // No cap found in RevOpsReport — include all (category may not exist in RevOps)
        result.push(...recs);
      }
    }
    return result;
  }

  return {
    POR: capProduct(sqoDetails.POR, 'POR'),
    R360: capProduct(sqoDetails.R360, 'R360'),
  };
}

/**
 * Get renewal targets from RevOpsPlan (Layer 3 - AUTHORITATIVE SOURCE)
 * Q1 target = SUM(daily Target_ACV_Won) over ActivityQuarterYear='2026-Q1'
 * RevOpsPlan is the single source of truth for ALL planned targets
 */
async function getRenewalTargetsFromRawPlan(riskProfile: string = 'P90'): Promise<Map<string, number>> {
  try {
    const query = `
      SELECT
        RecordType AS product,
        Region AS region,
        ROUND(SUM(COALESCE(Target_ACV_Won, 0)), 2) AS q1_target
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsPlan\`
      WHERE RiskProfile = '${riskProfile}'
        AND ActivityQuarterYear = '2026-Q1'
        AND OpportunityType = 'Renewal'
      GROUP BY 1, 2
    `;

    const [rows] = await getBigQuery().query({ query });
    const renewalTargetMap = new Map<string, number>();

    for (const row of rows as any[]) {
      const product = row.product;
      const region = row.region;
      const q1Target = parseFloat(row.q1_target) || 0;

      if (product && region) {
        const key = `${product}-${region}-RENEWAL`;
        renewalTargetMap.set(key, q1Target);
      }
    }

    console.log('Renewal targets from RevOpsPlan (P90):', Object.fromEntries(renewalTargetMap));
    return renewalTargetMap;
  } catch (error: any) {
    console.error('Failed to fetch renewal targets from RevOpsPlan:', error.message);
    return new Map();
  }
}

/**
 * Get funnel actuals and targets from RevOpsPerformance (Layer 4).
 * Returns one row per (product, region, category, source) with both actuals and targets.
 * This replaces getFunnelBySource() and getFunnelByCategory() with a single query.
 */
async function getRevOpsPerformanceData(filters: ReportFilters): Promise<{
  period: any[];
  q1: any[];
}> {
  const regionFilter = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const categoryCase = `
    CASE OpportunityType
      WHEN 'New Business' THEN CASE WHEN Segment = 'Strategic' THEN 'STRATEGIC' ELSE 'NEW LOGO' END
      WHEN 'Existing Business' THEN 'EXPANSION'
      WHEN 'Migration' THEN 'MIGRATION'
      WHEN 'Renewal' THEN 'RENEWAL'
    END`;

  const sourceNorm = `
    CASE UPPER(TRIM(Source))
      WHEN 'INBOUND' THEN 'INBOUND'
      WHEN 'OUTBOUND' THEN 'OUTBOUND'
      WHEN 'AE SOURCED' THEN 'AE SOURCED'
      WHEN 'AM SOURCED' THEN 'AM SOURCED'
      WHEN 'TRADESHOW' THEN 'TRADESHOW'
      WHEN 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      WHEN 'N/A' THEN 'INBOUND'
      ELSE UPPER(TRIM(Source))
    END`;

  // Period actuals + targets (date range)
  const periodQuery = `
    SELECT
      RecordType AS product,
      Region AS region,
      ${categoryCase} AS category,
      ${sourceNorm} AS source,
      SUM(COALESCE(Actual_MQL, 0)) AS actual_mql,
      SUM(COALESCE(Actual_SQL, 0)) AS actual_sql,
      SUM(COALESCE(Actual_SAL, 0)) AS actual_sal,
      SUM(COALESCE(Actual_SQO, 0)) AS actual_sqo,
      SUM(COALESCE(Actual_Won, 0)) AS actual_won,
      ROUND(SUM(COALESCE(Actual_Bookings_ACV, 0)), 2) AS actual_acv,
      ROUND(SUM(COALESCE(Target_MQL, 0)), 0) AS target_mql,
      ROUND(SUM(COALESCE(Target_SQL, 0)), 0) AS target_sql,
      ROUND(SUM(COALESCE(Target_SAL, 0)), 0) AS target_sal,
      ROUND(SUM(COALESCE(Target_SQO, 0)), 0) AS target_sqo,
      ROUND(SUM(COALESCE(Target_Won, 0)), 0) AS target_won,
      ROUND(SUM(COALESCE(Target_Bookings_ACV, 0)), 2) AS target_acv
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsPerformance\`
    WHERE RiskProfile = '${filters.riskProfile}'
      AND ActivityDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
      ${regionFilter}
    GROUP BY 1, 2, 3, 4
  `;

  // Q1 full targets (full quarter)
  const q1Query = `
    SELECT
      RecordType AS product,
      Region AS region,
      ${categoryCase} AS category,
      ${sourceNorm} AS source,
      ROUND(SUM(COALESCE(Target_MQL, 0)), 0) AS q1_target_mql,
      ROUND(SUM(COALESCE(Target_SQL, 0)), 0) AS q1_target_sql,
      ROUND(SUM(COALESCE(Target_SAL, 0)), 0) AS q1_target_sal,
      ROUND(SUM(COALESCE(Target_SQO, 0)), 0) AS q1_target_sqo,
      ROUND(SUM(COALESCE(Target_Won, 0)), 0) AS q1_target_won,
      ROUND(SUM(COALESCE(Target_Bookings_ACV, 0)), 2) AS q1_target_acv
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsPerformance\`
    WHERE RiskProfile = '${filters.riskProfile}'
      AND ActivityDate BETWEEN '2026-01-01' AND '2026-03-31'
      ${regionFilter}
    GROUP BY 1, 2, 3, 4
  `;

  try {
    const [[periodRows], [q1Rows]] = await Promise.all([
      getBigQuery().query({ query: periodQuery }),
      getBigQuery().query({ query: q1Query }),
    ]);

    return {
      period: periodRows as any[],
      q1: q1Rows as any[],
    };
  } catch (error) {
    console.warn('RevOpsPerformance query failed:', error);
    return { period: [], q1: [] };
  }
}

/**
 * Get unique opportunity counts for EXPANSION/MIGRATION funnels from DailyRevenueFunnel.
 * DRF is a daily snapshot — the same OpportunityID appears on multiple CaptureDate rows.
 * RevOpsPerformance uses SUM(MQL) which counts person-days (inflated).
 * This query counts DISTINCT OpportunityIDs at each stage for accurate summary counts.
 * Returns Map<key, { mql, sql, sal, sqo }> where key = "product-region-category"
 */
async function getExpMigUniqueOppCounts(filters: ReportFilters): Promise<Map<string, { mql: number; sql: number; sal: number; sqo: number }>> {
  try {
    const regionFilter = filters.regions && filters.regions.length > 0
      ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
      : '';
    const productFilter = filters.products && filters.products.length > 0
      ? `AND d.RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`
      : '';

    const query = `
      SELECT
        CASE d.RecordType WHEN 'POR' THEN 'POR' ELSE 'R360' END AS product,
        d.Region AS region,
        CASE
          WHEN UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
          WHEN UPPER(d.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
        END AS category,
        COUNT(DISTINCT CASE WHEN d.MQL = 1 THEN d.OpportunityID END) AS unique_mql,
        COUNT(DISTINCT CASE WHEN d.\`SQL\` = 1 THEN d.OpportunityID END) AS unique_sql,
        COUNT(DISTINCT CASE WHEN d.SAL = 1 THEN d.OpportunityID END) AS unique_sal,
        COUNT(DISTINCT CASE WHEN d.SQO = 1 THEN d.OpportunityID END) AS unique_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.DailyRevenueFunnel\` d
      WHERE UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION', 'MIGRATION', 'R360 MIGRATION')
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${productFilter}
        ${regionFilter}
      GROUP BY 1, 2, 3
    `;

    const [rows] = await getBigQuery().query({ query });
    const result = new Map<string, { mql: number; sql: number; sal: number; sqo: number }>();
    for (const row of rows as any[]) {
      const key = `${row.product}-${row.region}-${row.category}`;
      result.set(key, {
        mql: parseInt(row.unique_mql) || 0,
        sql: parseInt(row.unique_sql) || 0,
        sal: parseInt(row.unique_sal) || 0,
        sqo: parseInt(row.unique_sqo) || 0,
      });
    }
    return result;
  } catch (error: any) {
    console.warn('ExpMig unique opp counts query failed:', error?.message || error);
    return new Map();
  }
}

/**
 * Get EXPANSION/MIGRATION unique opp counts grouped by SOURCE for funnel_by_source data.
 * Uses COUNT(DISTINCT OpportunityID) instead of SUM() to avoid person-day inflation.
 * Returns Map<key, { mql, sql, sal, sqo }> where key = "product-region-category-source"
 */
async function getExpMigSourceCounts(filters: ReportFilters): Promise<Map<string, { mql: number; sql: number; sal: number; sqo: number }>> {
  try {
    const regionFilter = filters.regions && filters.regions.length > 0
      ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
      : '';
    const productFilter = filters.products && filters.products.length > 0
      ? `AND d.RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`
      : '';

    const query = `
      SELECT
        CASE d.RecordType WHEN 'POR' THEN 'POR' ELSE 'R360' END AS product,
        d.Region AS region,
        CASE
          WHEN UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
          WHEN UPPER(d.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
        END AS category,
        UPPER(COALESCE(NULLIF(d.Source, ''), 'AM SOURCED')) AS source,
        COUNT(DISTINCT CASE WHEN d.MQL = 1 THEN d.OpportunityID END) AS unique_mql,
        COUNT(DISTINCT CASE WHEN d.\`SQL\` = 1 THEN d.OpportunityID END) AS unique_sql,
        COUNT(DISTINCT CASE WHEN d.SAL = 1 THEN d.OpportunityID END) AS unique_sal,
        COUNT(DISTINCT CASE WHEN d.SQO = 1 THEN d.OpportunityID END) AS unique_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.DailyRevenueFunnel\` d
      WHERE UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION', 'MIGRATION', 'R360 MIGRATION')
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${productFilter}
        ${regionFilter}
      GROUP BY 1, 2, 3, 4
    `;

    const [rows] = await getBigQuery().query({ query });
    const result = new Map<string, { mql: number; sql: number; sal: number; sqo: number }>();
    for (const row of rows as any[]) {
      const key = `${row.product}-${row.region}-${row.category}-${row.source}`;
      result.set(key, {
        mql: parseInt(row.unique_mql) || 0,
        sql: parseInt(row.unique_sql) || 0,
        sal: parseInt(row.unique_sal) || 0,
        sqo: parseInt(row.unique_sqo) || 0,
      });
    }
    return result;
  } catch (error: any) {
    console.warn('ExpMig source counts query failed:', error?.message || error);
    return new Map();
  }
}

/**
 * Get unique lead counts for INBOUND (NEW LOGO) funnels from DailyRevenueFunnel.
 * DRF is a daily snapshot — the same LeadID/ContactID appears on multiple CaptureDate rows.
 * RevOpsPerformance uses SUM(Actual_MQL) which counts person-days (inflated).
 * This query counts DISTINCT COALESCE(LeadID, ContactID) at each stage for accurate summary counts.
 * Returns Map<key, { mql, sql, sal, sqo }> where key = "product-region"
 */
async function getInboundUniqueCounts(filters: ReportFilters): Promise<Map<string, { mql: number; sql: number; sal: number; sqo: number }>> {
  try {
    const regionFilter = filters.regions && filters.regions.length > 0
      ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
      : '';
    const productFilter = filters.products && filters.products.length > 0
      ? `AND d.RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`
      : '';

    const query = `
      SELECT
        CASE d.RecordType WHEN 'POR' THEN 'POR' ELSE 'R360' END AS product,
        d.Region AS region,
        COUNT(DISTINCT CASE WHEN d.MQL = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_mql,
        COUNT(DISTINCT CASE WHEN d.\`SQL\` = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_sql,
        COUNT(DISTINCT CASE WHEN d.SAL = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_sal,
        COUNT(DISTINCT CASE WHEN d.SQO = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.DailyRevenueFunnel\` d
      WHERE UPPER(d.FunnelType) IN ('INBOUND', 'R360 INBOUND')
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${productFilter}
        ${regionFilter}
      GROUP BY 1, 2
    `;

    const [rows] = await getBigQuery().query({ query });
    const result = new Map<string, { mql: number; sql: number; sal: number; sqo: number }>();
    for (const row of rows as any[]) {
      const key = `${row.product}-${row.region}`;
      result.set(key, {
        mql: parseInt(row.unique_mql) || 0,
        sql: parseInt(row.unique_sql) || 0,
        sal: parseInt(row.unique_sal) || 0,
        sqo: parseInt(row.unique_sqo) || 0,
      });
    }
    return result;
  } catch (error: any) {
    console.warn('Inbound unique lead counts query failed:', error?.message || error);
    return new Map();
  }
}

/**
 * Get INBOUND (NEW LOGO) unique lead counts grouped by SOURCE for funnel_by_source data.
 * Uses COUNT(DISTINCT COALESCE(LeadID, ContactID)) instead of SUM() to avoid person-day inflation.
 * Returns Map<key, { mql, sql, sal, sqo }> where key = "product-region-source-NEW LOGO"
 */
async function getInboundSourceCounts(filters: ReportFilters): Promise<Map<string, { mql: number; sql: number; sal: number; sqo: number }>> {
  try {
    const regionFilter = filters.regions && filters.regions.length > 0
      ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
      : '';
    const productFilter = filters.products && filters.products.length > 0
      ? `AND d.RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`
      : '';

    const query = `
      SELECT
        CASE d.RecordType WHEN 'POR' THEN 'POR' ELSE 'R360' END AS product,
        d.Region AS region,
        CASE
          WHEN d.Source IS NULL OR TRIM(d.Source) = '' OR UPPER(TRIM(d.Source)) = 'N/A' THEN 'INBOUND'
          ELSE UPPER(TRIM(d.Source))
        END AS source,
        COUNT(DISTINCT CASE WHEN d.MQL = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_mql,
        COUNT(DISTINCT CASE WHEN d.\`SQL\` = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_sql,
        COUNT(DISTINCT CASE WHEN d.SAL = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_sal,
        COUNT(DISTINCT CASE WHEN d.SQO = 1 THEN COALESCE(d.LeadID, d.ContactID) END) AS unique_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.DailyRevenueFunnel\` d
      WHERE UPPER(d.FunnelType) IN ('INBOUND', 'R360 INBOUND')
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${productFilter}
        ${regionFilter}
      GROUP BY 1, 2, 3
    `;

    const [rows] = await getBigQuery().query({ query });
    const result = new Map<string, { mql: number; sql: number; sal: number; sqo: number }>();
    for (const row of rows as any[]) {
      const key = `${row.product}-${row.region}-${row.source}-NEW LOGO`;
      result.set(key, {
        mql: parseInt(row.unique_mql) || 0,
        sql: parseInt(row.unique_sql) || 0,
        sal: parseInt(row.unique_sal) || 0,
        sqo: parseInt(row.unique_sqo) || 0,
      });
    }
    return result;
  } catch (error: any) {
    console.warn('Inbound source counts query failed:', error?.message || error);
    return new Map();
  }
}

/**
 * Get FY (Full Year) targets from RAW_2026_Plan_by_Month
 * This is the source of truth for annual bookings targets from the Excel plan
 * Returns Map<key, fy_target> where key = "product-region-category"
 */
async function getFYTargetsFromPlan(): Promise<Map<string, number>> {
  try {
    const query = `
      SELECT
        CASE
          WHEN Division LIKE '%POR%' THEN 'POR'
          WHEN Division LIKE '%R360%' THEN 'R360'
        END AS product,
        CASE
          WHEN Division LIKE 'AMER%' THEN 'AMER'
          WHEN Division LIKE 'EMEA%' THEN 'EMEA'
          WHEN Division LIKE 'APAC%' THEN 'APAC'
        END AS region,
        CASE
          WHEN Booking_Type = 'New Business SMB' THEN 'NEW LOGO'
          WHEN Booking_Type = 'New Business Strat' THEN 'STRATEGIC'
          WHEN Booking_Type = 'New Business' THEN 'NEW LOGO'
          WHEN Booking_Type = 'New Business - UK' THEN 'NEW LOGO'
          WHEN Booking_Type = 'New Business - EU' THEN 'NEW LOGO'
          WHEN Booking_Type = 'Expansion' THEN 'EXPANSION'
          WHEN Booking_Type = 'Migration' THEN 'MIGRATION'
          WHEN Booking_Type = 'Renewal' THEN 'RENEWAL'
          ELSE Booking_Type
        END AS category,
        ROUND(SUM(CAST(f_2026_Bookings_Target AS FLOAT64)), 2) AS fy_target
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RAW_2026_Plan_by_Month\`
      WHERE Booking_Type IS NOT NULL
        AND Booking_Type != ''
        AND Division NOT LIKE '%Total%'
        AND (Division LIKE 'AMER%' OR Division LIKE 'EMEA%' OR Division LIKE 'APAC%')
      GROUP BY 1, 2, 3
      HAVING product IS NOT NULL AND region IS NOT NULL
    `;

    const [rows] = await getBigQuery().query({ query });
    const fyTargetMap = new Map<string, number>();

    for (const row of rows as any[]) {
      const { product, region, category, fy_target } = row;
      if (product && region && category) {
        const key = `${product}-${region}-${category}`;
        // Aggregate in case of multiple rows per key (e.g., UK + EU → NEW LOGO)
        const existing = fyTargetMap.get(key) || 0;
        fyTargetMap.set(key, existing + (parseFloat(fy_target) || 0));
      }
    }

    // Log totals for verification
    let porTotal = 0, r360Total = 0;
    Array.from(fyTargetMap.entries()).forEach(([key, value]) => {
      if (key.startsWith('POR')) porTotal += value;
      else if (key.startsWith('R360')) r360Total += value;
    });
    console.log(`FY Targets from RAW_2026_Plan_by_Month: POR=$${porTotal.toLocaleString()}, R360=$${r360Total.toLocaleString()}, Total=$${(porTotal + r360Total).toLocaleString()}`);

    return fyTargetMap;
  } catch (error: any) {
    console.error('Failed to fetch FY targets from RAW_2026_Plan_by_Month:', error.message);
    return new Map();
  }
}

/**
 * Get source mix allocations from SourceBookingsAllocations for Q1
 * Used to compute source-level targets from category targets
 * Returns Map<key, source_mix> where key = "product-region-category-source"
 */
async function getSourceMixAllocations(): Promise<Map<string, number>> {
  try {
    const query = `
      SELECT
        RecordType,
        Region,
        OpportunityType,
        Segment,
        Source,
        ROUND(AVG(SourceMix), 4) as avg_source_mix
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.SourceBookingsAllocations\`
      WHERE month_num IN (1, 2, 3)  -- Q1 months
        AND SourceMix > 0
        AND OpportunityType IN ('New Business', 'Existing Business', 'Migration')
      GROUP BY RecordType, Region, OpportunityType, Segment, Source
    `;

    const [rows] = await getBigQuery().query({ query });
    const sourceMixMap = new Map<string, number>();

    for (const row of rows as any[]) {
      // Normalize source names to match actuals (e.g., "Inbound" -> "INBOUND")
      const source = (row.Source || '').toUpperCase().replace(' ', '_');
      const normalizedSource = source === 'AE_SOURCED' ? 'AE SOURCED'
        : source === 'AM_SOURCED' ? 'AM SOURCED'
        : source.replace('_', ' ');

      // Map OpportunityType + Segment to Category
      const category = row.OpportunityType === 'New Business' && row.Segment === 'Strategic' ? 'STRATEGIC'
        : row.OpportunityType === 'New Business' ? 'NEW LOGO'
        : row.OpportunityType === 'Existing Business' ? 'EXPANSION'
        : row.OpportunityType === 'Migration' ? 'MIGRATION'
        : row.OpportunityType;

      const key = `${row.RecordType}-${row.Region}-${category}-${normalizedSource}`;
      sourceMixMap.set(key, parseFloat(row.avg_source_mix) || 0);
    }

    console.log('Source mix allocations loaded:', sourceMixMap.size, 'entries');
    return sourceMixMap;
  } catch (error: any) {
    console.error('Failed to fetch source mix allocations:', error.message);
    return new Map();
  }
}

// Build filter clauses for RevOpsReport queries
function buildRevOpsFilterClause(filters: ReportFilters): string {
  const conditions: string[] = [];

  if (filters.products && filters.products.length > 0 && filters.products.length < 2) {
    conditions.push(`RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`);
  }

  if (filters.regions && filters.regions.length > 0 && filters.regions.length < 3) {
    conditions.push(`Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`);
  }

  return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
}

// Build filter clauses for Opportunity queries (Salesforce data)
function buildOpportunityFilterClause(filters: ReportFilters): {
  productClause: string;
  regionClause: string;
} {
  let productClause = '';
  if (filters.products && filters.products.length > 0) {
    productClause = `AND (
      (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
      (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
    )`;
  }

  let regionClause = '';
  if (filters.regions && filters.regions.length > 0 && filters.regions.length < 3) {
    const divisions = filters.regions.map(r => `'${REGION_REVERSE_MAP[r as keyof typeof REGION_REVERSE_MAP]}'`).join(', ');
    regionClause = `AND Division IN (${divisions})`;
  }

  return { productClause, regionClause };
}

/**
 * Query RevOpsReport for QTD targets and actuals with P90 risk profile
 * This replaces the old StrategicOperatingPlan queries
 */
async function getRevOpsQTDData(filters: ReportFilters) {
  const filterClause = buildRevOpsFilterClause(filters);

  const query = `
    WITH qtd_targets AS (
      -- Q1 full targets + QTD actuals from RevOpsReport QTD horizon
      SELECT
        RecordType AS product,
        Region AS region,
        CASE
          WHEN OpportunityType = 'New Business' AND Segment = 'Strategic' THEN 'STRATEGIC'
          WHEN OpportunityType = 'New Business' THEN 'NEW LOGO'
          WHEN OpportunityType = 'Existing Business' THEN 'EXPANSION'
          WHEN OpportunityType = 'Migration' THEN 'MIGRATION'
          WHEN OpportunityType = 'Renewal' THEN 'RENEWAL'
          ELSE OpportunityType
        END AS category,
        OpportunityType AS opportunity_type,
        ROUND(SUM(COALESCE(Target_ACV, 0)), 2) AS q1_target,
        ROUND(SUM(COALESCE(Target_MQL, 0)), 0) AS q1_target_mql,
        ROUND(SUM(COALESCE(Target_SQL, 0)), 0) AS q1_target_sql,
        ROUND(SUM(COALESCE(Target_SAL, 0)), 0) AS q1_target_sal,
        ROUND(SUM(COALESCE(Target_SQO, 0)), 0) AS q1_target_sqo,
        ROUND(SUM(COALESCE(Target_Won, 0)), 0) AS q1_target_won
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsReport\`
      WHERE Horizon = 'QTD'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date = '2026-01-01'
        AND RecordType IN ('POR', 'R360')
        AND Region IN ('AMER', 'EMEA', 'APAC')
        ${filterClause}
      GROUP BY 1, 2, 3, 4
    ),
    mtd_period_targets AS (
      -- Period-specific targets: sum MTD rows from quarter start through endDate month
      SELECT
        RecordType AS product,
        Region AS region,
        CASE
          WHEN OpportunityType = 'New Business' AND Segment = 'Strategic' THEN 'STRATEGIC'
          WHEN OpportunityType = 'New Business' THEN 'NEW LOGO'
          WHEN OpportunityType = 'Existing Business' THEN 'EXPANSION'
          WHEN OpportunityType = 'Migration' THEN 'MIGRATION'
          WHEN OpportunityType = 'Renewal' THEN 'RENEWAL'
          ELSE OpportunityType
        END AS category,
        OpportunityType AS opportunity_type,
        ROUND(SUM(COALESCE(Target_ACV, 0)), 2) AS period_target,
        ROUND(SUM(COALESCE(Target_MQL, 0)), 2) AS period_target_mql,
        ROUND(SUM(COALESCE(Target_SQL, 0)), 2) AS period_target_sql,
        ROUND(SUM(COALESCE(Target_SAL, 0)), 2) AS period_target_sal,
        ROUND(SUM(COALESCE(Target_SQO, 0)), 2) AS period_target_sqo,
        ROUND(SUM(COALESCE(Target_Won, 0)), 2) AS period_target_won
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsReport\`
      WHERE Horizon = 'MTD'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date >= '2026-01-01'
        AND Period_Start_Date <= DATE_TRUNC(CAST('${filters.endDate}' AS DATE), MONTH)
        AND RecordType IN ('POR', 'R360')
        AND Region IN ('AMER', 'EMEA', 'APAC')
        ${filterClause}
      GROUP BY 1, 2, 3, 4
    ),
    report_actuals AS (
      SELECT
        RecordType AS product,
        Region AS region,
        CASE
          WHEN OpportunityType = 'New Business' AND Segment = 'Strategic' THEN 'STRATEGIC'
          WHEN OpportunityType = 'New Business' THEN 'NEW LOGO'
          WHEN OpportunityType = 'Existing Business' THEN 'EXPANSION'
          WHEN OpportunityType = 'Migration' THEN 'MIGRATION'
          WHEN OpportunityType = 'Renewal' THEN 'RENEWAL'
          ELSE OpportunityType
        END AS category,
        OpportunityType AS opportunity_type,
        ROUND(SUM(COALESCE(Actual_ACV, 0)), 2) AS qtd_actual,
        ROUND(SUM(COALESCE(Actual_MQL, 0)), 0) AS actual_mql,
        ROUND(SUM(COALESCE(Actual_SQL, 0)), 0) AS actual_sql,
        ROUND(SUM(COALESCE(Actual_SAL, 0)), 0) AS actual_sal,
        ROUND(SUM(COALESCE(Actual_SQO, 0)), 0) AS actual_sqo,
        ROUND(SUM(COALESCE(Actual_Won, 0)), 0) AS actual_won,
        ROUND(AVG(COALESCE(MQL_to_SQL_Leakage_Variance, 0)), 1) AS mql_to_sql_leakage,
        ROUND(AVG(COALESCE(SQL_to_SAL_Leakage_Variance, 0)), 1) AS sql_to_sal_leakage,
        ROUND(AVG(COALESCE(SAL_to_SQO_Leakage_Variance, 0)), 1) AS sal_to_sqo_leakage
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsReport\`
      WHERE Horizon = 'QTD'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date = '2026-01-01'
        AND RecordType IN ('POR', 'R360')
        AND Region IN ('AMER', 'EMEA', 'APAC')
        ${filterClause}
      GROUP BY 1, 2, 3, 4
    )
    SELECT
      COALESCE(t.product, a.product) AS product,
      COALESCE(t.region, a.region) AS region,
      COALESCE(t.category, a.category) AS category,
      COALESCE(t.opportunity_type, a.opportunity_type) AS opportunity_type,
      COALESCE(t.q1_target, 0) AS q1_target,
      COALESCE(a.qtd_actual, 0) AS qtd_actual,
      CASE WHEN COALESCE(t.q1_target, 0) > 0
        THEN ROUND(COALESCE(a.qtd_actual, 0) / t.q1_target * 100, 1)
        ELSE 0
      END AS attainment_pct,
      -- Q1 full targets (reference)
      COALESCE(t.q1_target_mql, 0) AS q1_target_mql,
      COALESCE(t.q1_target_sql, 0) AS q1_target_sql,
      COALESCE(t.q1_target_sal, 0) AS q1_target_sal,
      COALESCE(t.q1_target_sqo, 0) AS q1_target_sqo,
      COALESCE(t.q1_target_won, 0) AS q1_target_won,
      -- Period-specific targets (date-range sum for pacing)
      COALESCE(p.period_target_mql, 0) AS target_mql,
      COALESCE(p.period_target_sql, 0) AS target_sql,
      COALESCE(p.period_target_sal, 0) AS target_sal,
      COALESCE(p.period_target_sqo, 0) AS target_sqo,
      COALESCE(p.period_target_won, 0) AS target_won,
      -- Actuals
      COALESCE(a.actual_mql, 0) AS actual_mql,
      COALESCE(a.actual_sql, 0) AS actual_sql,
      COALESCE(a.actual_sal, 0) AS actual_sal,
      COALESCE(a.actual_sqo, 0) AS actual_sqo,
      COALESCE(a.actual_won, 0) AS actual_won,
      COALESCE(a.mql_to_sql_leakage, 0) AS mql_to_sql_leakage,
      COALESCE(a.sql_to_sal_leakage, 0) AS sql_to_sal_leakage,
      COALESCE(a.sal_to_sqo_leakage, 0) AS sal_to_sqo_leakage,
      '${filters.riskProfile}' AS risk_profile
    FROM qtd_targets t
    FULL OUTER JOIN report_actuals a
      ON t.product = a.product AND t.region = a.region AND t.category = a.category
    LEFT JOIN mtd_period_targets p
      ON COALESCE(t.product, a.product) = p.product
      AND COALESCE(t.region, a.region) = p.region
      AND COALESCE(t.category, a.category) = p.category
    ORDER BY product, region, category
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    console.log(`RevOpsReport QTD+MTD data: ${(rows as any[]).length} rows`);
    return rows as any[];
  } catch (error: any) {
    console.error('RevOpsReport QTD+MTD query failed:', error.message);
    return [];
  }
}

/**
 * Query for Q1 full targets (for FY and Q1 progress tracking)
 */
async function getRevOpsQ1Targets(filters: ReportFilters) {
  const filterClause = buildRevOpsFilterClause(filters);

  const query = `
    SELECT
      RecordType AS product,
      Region AS region,
      CASE
        WHEN OpportunityType = 'New Business' AND Segment = 'Strategic' THEN 'STRATEGIC'
        WHEN OpportunityType = 'New Business' THEN 'NEW LOGO'
        WHEN OpportunityType = 'Existing Business' THEN 'EXPANSION'
        WHEN OpportunityType = 'Migration' THEN 'MIGRATION'
        WHEN OpportunityType = 'Renewal' THEN 'RENEWAL'
        ELSE OpportunityType
      END AS category,
      ROUND(SUM(COALESCE(Target_ACV_Won, 0)), 2) AS q1_target
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsPlan\`
    WHERE RiskProfile = '${filters.riskProfile}'
      AND ActivityQuarterYear = '2026-Q1'
      AND RecordType IN ('POR', 'R360')
      AND Region IN ('AMER', 'EMEA', 'APAC')
      ${filterClause}
    GROUP BY 1, 2, 3
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    return rows as any[];
  } catch (error: any) {
    console.error('RevOpsPlan Q1 targets query failed:', error.message);
    return [];
  }
}

// Query for revenue actuals from OpportunityViewTable (for deal-level details)
async function getRevenueActuals(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  const query = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN Type = 'New Business' AND ACV > 100000 THEN 'STRATEGIC'
        WHEN Type = 'Existing Business' THEN 'EXPANSION'
        WHEN Type = 'New Business' THEN 'NEW LOGO'
        WHEN Type = 'Migration' THEN 'MIGRATION'
        WHEN Type = 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
      Type AS deal_type,
      COUNT(*) AS deal_count,
      ROUND(SUM(ACV), 2) AS total_acv,
      ROUND(AVG(ACV), 2) AS avg_acv
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    GROUP BY product, region, category, source, deal_type
    ORDER BY product, region, category
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for Q1 renewal uplift by product/region from Contract table
async function getUpcomingRenewalUplift(): Promise<Map<string, number>> {
  try {
    const query = `
      SELECT
        CASE WHEN CAST(c.r360_record__c AS STRING) = 'true' THEN 'R360' ELSE 'POR' END AS product,
        CASE c.account_division__c
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        COUNT(*) as contract_count,
        SUM(ROUND(
          (COALESCE(c.acv__c, 0) / COALESCE(ct.conversionrate, 1)) *
          (COALESCE(c.sbqq__renewalupliftrate__c, 5) / 100)
        , 2)) AS total_expected_increase_usd
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contract\` c
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.CurrencyType\` ct
        ON LOWER(c.currencyisocode) = LOWER(ct.isocode)
      WHERE c.Status = 'Activated'
        AND DATE(c.EndDate) >= CURRENT_DATE()
        AND DATE(c.EndDate) <= '2026-03-31'
        AND c.account_division__c IN ('US', 'UK', 'AU')
        AND c.acv__c > 0
        AND (c.Renewal_Status__c IS NULL
             OR c.Renewal_Status__c NOT IN ('Non Renewing', 'Success'))
      GROUP BY 1, 2
    `;

    const [rows] = await getBigQuery().query({ query });
    const upliftMap = new Map<string, number>();

    for (const row of rows as any[]) {
      const key = `${row.product}-${row.region}-RENEWAL`;
      const upliftValue = parseFloat(row.total_expected_increase_usd) || 0;
      upliftMap.set(key, upliftValue);
      console.log(`RenewalUplift: ${key} = ${upliftValue}`);
    }

    console.log(`RenewalUpliftMap size: ${upliftMap.size}`);
    return upliftMap;
  } catch (error: any) {
    console.error('Error fetching renewal uplift:', error.message);
    return new Map();
  }
}

async function getFunnelBySource(filters: ReportFilters, product: 'POR' | 'R360') {
  // Source normalization to standard names
  const sourceNormCase = `
    CASE UPPER(TRIM(Source))
      WHEN 'INBOUND' THEN 'INBOUND'
      WHEN 'OUTBOUND' THEN 'OUTBOUND'
      WHEN 'AE SOURCED' THEN 'AE SOURCED'
      WHEN 'AM SOURCED' THEN 'AM SOURCED'
      WHEN 'TRADESHOW' THEN 'TRADESHOW'
      WHEN 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      WHEN 'N/A' THEN 'INBOUND'
      ELSE UPPER(TRIM(Source))
    END`;

  const recordType = product === 'POR' ? 'POR' : 'R360';

  const regionFilter = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // Query RevOpsReport for source-level targets:
  // - MTD rows summed from quarter start through endDate month = period targets
  // - QTD row = full Q1 targets
  const query = `
    WITH mtd_targets AS (
      SELECT
        Region AS region,
        ${sourceNormCase} AS source,
        ROUND(SUM(COALESCE(Target_ACV, 0)), 2) AS period_target_acv,
        ROUND(SUM(COALESCE(Target_MQL, 0))) AS period_target_mql,
        ROUND(SUM(COALESCE(Target_SQL, 0))) AS period_target_sql,
        ROUND(SUM(COALESCE(Target_SAL, 0))) AS period_target_sal,
        ROUND(SUM(COALESCE(Target_SQO, 0))) AS period_target_sqo,
        ROUND(SUM(COALESCE(Target_Won, 0))) AS period_target_won
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE Horizon = 'MTD'
        AND RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date >= '2026-01-01'
        AND Period_Start_Date <= DATE_TRUNC(CAST('${filters.endDate}' AS DATE), MONTH)
        AND OpportunityType != 'Renewal'
        AND Source IS NOT NULL AND Source != ''
        ${regionFilter}
      GROUP BY 1, 2
    ),
    q1_targets AS (
      SELECT
        Region AS region,
        ${sourceNormCase} AS source,
        ROUND(SUM(COALESCE(Target_ACV, 0)), 2) AS q1_target_acv,
        ROUND(SUM(COALESCE(Target_MQL, 0))) AS q1_target_mql,
        ROUND(SUM(COALESCE(Target_SQL, 0))) AS q1_target_sql,
        ROUND(SUM(COALESCE(Target_SAL, 0))) AS q1_target_sal,
        ROUND(SUM(COALESCE(Target_SQO, 0))) AS q1_target_sqo,
        ROUND(SUM(COALESCE(Target_Won, 0))) AS q1_target_won
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE Horizon = 'QTD'
        AND RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date = '2026-01-01'
        AND OpportunityType != 'Renewal'
        AND Source IS NOT NULL AND Source != ''
        ${regionFilter}
      GROUP BY 1, 2
    ),
    plan_targets AS (
      SELECT
        COALESCE(m.region, q.region) AS region,
        COALESCE(m.source, q.source) AS source,
        COALESCE(q.q1_target_acv, 0) AS target_acv,
        COALESCE(q.q1_target_mql, 0) AS target_mql,
        COALESCE(q.q1_target_sql, 0) AS target_sql,
        COALESCE(q.q1_target_sal, 0) AS target_sal,
        COALESCE(q.q1_target_sqo, 0) AS target_sqo,
        COALESCE(q.q1_target_won, 0) AS target_won,
        COALESCE(m.period_target_acv, 0) AS period_target_acv,
        COALESCE(m.period_target_mql, 0) AS period_target_mql,
        COALESCE(m.period_target_sql, 0) AS period_target_sql,
        COALESCE(m.period_target_sal, 0) AS period_target_sal,
        COALESCE(m.period_target_sqo, 0) AS period_target_sqo,
        COALESCE(m.period_target_won, 0) AS period_target_won
      FROM q1_targets q
      FULL OUTER JOIN mtd_targets m ON q.region = m.region AND q.source = m.source
    ),
    -- MQL actuals: NEW LOGO categories only (for MQL sources: INBOUND, OUTBOUND, TRADESHOW, AE SOURCED)
    mql_category_actuals AS (
      SELECT
        Region AS region,
        SUM(COALESCE(Actual_MQL, 0)) AS total_actual_mql
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Horizon = 'QTD'
        AND Period_Start_Date = '2026-01-01'
        AND OpportunityType = 'New Business'
        ${regionFilter}
      GROUP BY 1
    ),
    -- EQL actuals: EXPANSION + MIGRATION categories (for EQL source: AM SOURCED)
    eql_category_actuals AS (
      SELECT
        Region AS region,
        SUM(COALESCE(Actual_MQL, 0)) AS total_actual_eql
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Horizon = 'QTD'
        AND Period_Start_Date = '2026-01-01'
        AND OpportunityType IN ('Existing Business', 'Migration')
        ${regionFilter}
      GROUP BY 1
    ),
    -- All category actuals (for SQL/SAL/SQO allocation across all sources)
    category_actuals AS (
      SELECT
        Region AS region,
        SUM(COALESCE(Actual_SQL, 0)) AS total_actual_sql,
        SUM(COALESCE(Actual_SAL, 0)) AS total_actual_sal,
        SUM(COALESCE(Actual_SQO, 0)) AS total_actual_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Horizon = 'QTD'
        AND Period_Start_Date = '2026-01-01'
        AND OpportunityType != 'Renewal'
        ${regionFilter}
      GROUP BY 1
    ),
    -- Region-level target totals for proportional allocation
    -- MQL targets split by source type: AM SOURCED (EQL) vs others (MQL)
    mql_source_target_totals AS (
      SELECT
        Region AS region,
        SUM(COALESCE(Target_MQL, 0)) AS total_target_mql
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE Horizon = 'MTD'
        AND RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date >= '2026-01-01'
        AND Period_Start_Date <= DATE_TRUNC(CAST('${filters.endDate}' AS DATE), MONTH)
        AND OpportunityType != 'Renewal'
        AND Source IS NOT NULL AND Source != ''
        AND UPPER(TRIM(Source)) != 'AM SOURCED'
        ${regionFilter}
      GROUP BY 1
    ),
    eql_source_target_totals AS (
      SELECT
        Region AS region,
        SUM(COALESCE(Target_MQL, 0)) AS total_target_eql
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE Horizon = 'MTD'
        AND RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date >= '2026-01-01'
        AND Period_Start_Date <= DATE_TRUNC(CAST('${filters.endDate}' AS DATE), MONTH)
        AND OpportunityType != 'Renewal'
        AND UPPER(TRIM(Source)) = 'AM SOURCED'
        ${regionFilter}
      GROUP BY 1
    ),
    region_target_totals AS (
      SELECT
        Region AS region,
        SUM(COALESCE(Target_SQL, 0)) AS total_target_sql,
        SUM(COALESCE(Target_SAL, 0)) AS total_target_sal,
        SUM(COALESCE(Target_SQO, 0)) AS total_target_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE Horizon = 'MTD'
        AND RecordType = '${recordType}'
        AND RiskProfile = '${filters.riskProfile}'
        AND Period_Start_Date >= '2026-01-01'
        AND Period_Start_Date <= DATE_TRUNC(CAST('${filters.endDate}' AS DATE), MONTH)
        AND OpportunityType != 'Renewal'
        AND Source IS NOT NULL AND Source != ''
        ${regionFilter}
      GROUP BY 1
    ),
    combined AS (
      SELECT
        '${product}' AS product,
        t.region,
        t.source,
        -- MQL actuals: AM SOURCED gets EQL actuals, others get MQL actuals
        CASE
          WHEN UPPER(TRIM(t.source)) = 'AM SOURCED' THEN
            CAST(ROUND(CASE WHEN et.total_target_eql > 0
              THEN ea.total_actual_eql * (t.period_target_mql / et.total_target_eql)
              ELSE 0 END) AS INT64)
          ELSE
            CAST(ROUND(CASE WHEN mt.total_target_mql > 0
              THEN ma.total_actual_mql * (t.period_target_mql / mt.total_target_mql)
              ELSE 0 END) AS INT64)
        END AS actual_mql,
        CAST(ROUND(CASE WHEN rt.total_target_sql > 0
          THEN ca.total_actual_sql * (t.period_target_sql / rt.total_target_sql)
          ELSE 0 END) AS INT64) AS actual_sql,
        CAST(ROUND(CASE WHEN rt.total_target_sal > 0
          THEN ca.total_actual_sal * (t.period_target_sal / rt.total_target_sal)
          ELSE 0 END) AS INT64) AS actual_sal,
        CAST(ROUND(CASE WHEN rt.total_target_sqo > 0
          THEN ca.total_actual_sqo * (t.period_target_sqo / rt.total_target_sqo)
          ELSE 0 END) AS INT64) AS actual_sqo,
        CAST(t.target_mql AS INT64) AS target_mql,
        CAST(t.target_sql AS INT64) AS target_sql,
        CAST(t.target_sal AS INT64) AS target_sal,
        CAST(t.target_sqo AS INT64) AS target_sqo,
        t.target_acv,
        CAST(t.period_target_mql AS INT64) AS period_target_mql,
        CAST(t.period_target_sql AS INT64) AS period_target_sql,
        CAST(t.period_target_sal AS INT64) AS period_target_sal,
        CAST(t.period_target_sqo AS INT64) AS period_target_sqo,
        t.period_target_acv
      FROM plan_targets t
      LEFT JOIN region_target_totals rt ON t.region = rt.region
      LEFT JOIN category_actuals ca ON t.region = ca.region
      LEFT JOIN mql_category_actuals ma ON t.region = ma.region
      LEFT JOIN eql_category_actuals ea ON t.region = ea.region
      LEFT JOIN mql_source_target_totals mt ON t.region = mt.region
      LEFT JOIN eql_source_target_totals et ON t.region = et.region
    )
    SELECT *
    FROM combined
    WHERE source NOT IN ('N/A', '')
      AND (actual_sql > 0 OR actual_sal > 0 OR actual_sqo > 0
           OR target_sql > 0 OR target_sal > 0 OR target_sqo > 0
           OR actual_mql > 0 OR target_mql > 0)
    ORDER BY region, source
  `;

  const [rows] = await getBigQuery().query({ query });

  // Add conversion rates and attainment percentages
  return (rows as any[]).map(row => ({
    ...row,
    mql_to_sql_rate: row.actual_mql > 0 ? Math.round((row.actual_sql / row.actual_mql) * 1000) / 10 : 0,
    sql_to_sal_rate: row.actual_sql > 0 ? Math.round((row.actual_sal / row.actual_sql) * 1000) / 10 : 0,
    sal_to_sqo_rate: row.actual_sal > 0 ? Math.round((row.actual_sqo / row.actual_sal) * 1000) / 10 : 0,
    mql_attainment: row.target_mql > 0 ? Math.round((row.actual_mql / row.target_mql) * 100) : 100,
    sql_attainment: row.target_sql > 0 ? Math.round((row.actual_sql / row.target_sql) * 100) : 100,
    sal_attainment: row.target_sal > 0 ? Math.round((row.actual_sal / row.target_sal) * 100) : 100,
    sqo_attainment: row.target_sqo > 0 ? Math.round((row.actual_sqo / row.target_sqo) * 100) : 100,
  }));
}


// Query for funnel actuals by category
// NEW LOGO: Uses InboundFunnel record count (matches MQL Details exactly)
// EXPANSION/MIGRATION: Uses OpportunityViewTable (matches EQL Details exactly)
async function getFunnelByCategory(filters: ReportFilters, product: 'POR' | 'R360') {
  const results: any[] = [];

  if (product === 'POR') {
    const divisionClause = filters.regions && filters.regions.length > 0
      ? `AND Division IN (${filters.regions.map(r => {
          const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
          return `'${map[r]}'`;
        }).join(', ')})`
      : '';

    // NEW LOGO from InboundFunnel - deduplicated by Company + Date + Division
    // Uses CTE to deduplicate, then counts unique leads at each funnel stage
    const newLogoQuery = `
      WITH deduped_leads AS (
        SELECT
          Division,
          COALESCE(Company, 'Unknown') AS company_key,
          CAST(MQL_DT AS DATE) AS mql_date_key,
          MQL_DT,
          SQL_DT,
          SAL_DT,
          SQO_DT,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(Company, 'Unknown'), CAST(MQL_DT AS DATE), Division
            ORDER BY
              CASE WHEN LeadId IS NOT NULL OR ContactId IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN SQL_DT IS NOT NULL THEN 0 ELSE 1 END
          ) AS rn
        FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\`
        WHERE Division IN ('US', 'UK', 'AU')
          AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
          AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
          -- Removed SDRSource filter to include all MQL sources
          AND MQL_DT IS NOT NULL
          ${divisionClause}
      )
      SELECT
        'POR' AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        'NEW LOGO' AS category,
        COUNT(CASE
          WHEN mql_date_key >= '${filters.startDate}'
            AND mql_date_key <= '${filters.endDate}'
          THEN 1
        END) AS actual_mql,
        COUNT(CASE
          WHEN SQL_DT IS NOT NULL
            AND CAST(SQL_DT AS DATE) >= '${filters.startDate}'
            AND CAST(SQL_DT AS DATE) <= '${filters.endDate}'
          THEN 1
        END) AS actual_sql,
        COUNT(CASE
          WHEN SAL_DT IS NOT NULL
            AND CAST(SAL_DT AS DATE) >= '${filters.startDate}'
            AND CAST(SAL_DT AS DATE) <= '${filters.endDate}'
          THEN 1
        END) AS actual_sal,
        COUNT(CASE
          WHEN SQO_DT IS NOT NULL
            AND CAST(SQO_DT AS DATE) >= '${filters.startDate}'
            AND CAST(SQO_DT AS DATE) <= '${filters.endDate}'
          THEN 1
        END) AS actual_sqo
      FROM deduped_leads
      WHERE rn = 1
      GROUP BY 1, 2
      ORDER BY region
    `;

    // EXPANSION and MIGRATION from OpportunityViewTable (matches EQL Details exactly)
    // EQLs are qualified opportunities from existing customers (tracked by CreatedDate)
    const expansionMigrationQuery = `
      SELECT
        'POR' AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        CASE Type
          WHEN 'Existing Business' THEN 'EXPANSION'
          WHEN 'Migration' THEN 'MIGRATION'
        END AS category,
        COUNT(*) AS actual_mql,
        -- SQL: opportunities that progressed past initial stage
        COUNT(CASE WHEN StageName NOT IN ('Discovery', 'Qualification') OR Won THEN 1 END) AS actual_sql,
        -- SAL: opportunities accepted by sales
        COUNT(CASE WHEN StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR Won THEN 1 END) AS actual_sal,
        -- SQO: opportunities that are Won or in final stages
        COUNT(CASE WHEN Won OR StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 1 END) AS actual_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE por_record__c = true
        AND Division IN ('US', 'UK', 'AU')
        AND Type IN ('Existing Business', 'Migration')
        AND ACV > 0
        AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
        ${divisionClause}
      GROUP BY product, region, category
      HAVING category IS NOT NULL
      ORDER BY region, category
    `;

    // STRATEGIC from OpportunityViewTable - New Business with ACV > $100K
    // Tracks large new business deals separately from standard NEW LOGO
    const strategicQuery = `
      SELECT
        'POR' AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        'STRATEGIC' AS category,
        COUNT(*) AS actual_mql,
        -- SQL: opportunities that progressed past initial stage
        COUNT(CASE WHEN StageName NOT IN ('Discovery', 'Qualification') OR Won THEN 1 END) AS actual_sql,
        -- SAL: opportunities accepted by sales
        COUNT(CASE WHEN StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR Won THEN 1 END) AS actual_sal,
        -- SQO: opportunities that are Won or in final stages
        COUNT(CASE WHEN Won OR StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 1 END) AS actual_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE por_record__c = true
        AND Division IN ('US', 'UK', 'AU')
        AND Type = 'New Business'
        AND ACV > 100000
        AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
        ${divisionClause}
      GROUP BY product, region
      ORDER BY region
    `;

    const [[newLogoRows], [expMigRows], [strategicRows]] = await Promise.all([
      getBigQuery().query({ query: newLogoQuery }),
      getBigQuery().query({ query: expansionMigrationQuery }),
      getBigQuery().query({ query: strategicQuery }),
    ]);

    results.push(...(newLogoRows as any[]), ...(expMigRows as any[]), ...(strategicRows as any[]));
  } else {
    // R360
    const regionClause = filters.regions && filters.regions.length > 0
      ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
      : '';

    // NEW LOGO from R360InboundFunnel - deduplicated by Company + Date + Region
    // Uses CTE to deduplicate, then counts unique leads at each funnel stage
    const newLogoQuery = `
      WITH deduped_leads AS (
        SELECT
          Region,
          COALESCE(Company, 'Unknown') AS company_key,
          CAST(MQL_DT AS DATE) AS mql_date_key,
          MQL_DT,
          SQL_DT,
          SQO_DT,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(Company, 'Unknown'), CAST(MQL_DT AS DATE), Region
            ORDER BY
              CASE WHEN LeadId IS NOT NULL THEN 0 ELSE 1 END,
              CASE WHEN SQL_DT IS NOT NULL THEN 0 ELSE 1 END
          ) AS rn
        FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\`
        WHERE MQL_Reverted = false
          AND Region IS NOT NULL
          AND MQL_DT IS NOT NULL
          ${regionClause}
      )
      SELECT
        'R360' AS product,
        Region AS region,
        'NEW LOGO' AS category,
        COUNT(CASE
          WHEN mql_date_key >= '${filters.startDate}'
            AND mql_date_key <= '${filters.endDate}'
          THEN 1
        END) AS actual_mql,
        COUNT(CASE
          WHEN SQL_DT IS NOT NULL
            AND CAST(SQL_DT AS DATE) >= '${filters.startDate}'
            AND CAST(SQL_DT AS DATE) <= '${filters.endDate}'
          THEN 1
        END) AS actual_sql,
        0 AS actual_sal,
        COUNT(CASE
          WHEN SQO_DT IS NOT NULL
            AND CAST(SQO_DT AS DATE) >= '${filters.startDate}'
            AND CAST(SQO_DT AS DATE) <= '${filters.endDate}'
          THEN 1
        END) AS actual_sqo
      FROM deduped_leads
      WHERE rn = 1
      GROUP BY 1, 2
      ORDER BY region
    `;

    // EXPANSION and MIGRATION from OpportunityViewTable (matches EQL Details exactly)
    // EQLs are qualified opportunities from existing customers (tracked by CreatedDate)
    const expansionMigrationQuery = `
      SELECT
        'R360' AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        CASE Type
          WHEN 'Existing Business' THEN 'EXPANSION'
          WHEN 'Migration' THEN 'MIGRATION'
        END AS category,
        COUNT(*) AS actual_mql,
        -- SQL: opportunities that progressed past initial stage
        COUNT(CASE WHEN StageName NOT IN ('Discovery', 'Qualification') OR Won THEN 1 END) AS actual_sql,
        0 AS actual_sal,
        -- SQO: opportunities that are Won or in final stages
        COUNT(CASE WHEN Won OR StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 1 END) AS actual_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE r360_record__c = true
        AND Division IN ('US', 'UK', 'AU')
        AND Type IN ('Existing Business', 'Migration')
        AND ACV > 0
        AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
        ${regionClause.replace(/Region/g, 'Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
      GROUP BY product, region, category
      HAVING category IS NOT NULL
      ORDER BY region, category
    `;

    // STRATEGIC from OpportunityViewTable - New Business with ACV > $100K
    // Tracks large new business deals separately from standard NEW LOGO
    const strategicQuery = `
      SELECT
        'R360' AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        'STRATEGIC' AS category,
        COUNT(*) AS actual_mql,
        -- SQL: opportunities that progressed past initial stage
        COUNT(CASE WHEN StageName NOT IN ('Discovery', 'Qualification') OR Won THEN 1 END) AS actual_sql,
        0 AS actual_sal,
        -- SQO: opportunities that are Won or in final stages
        COUNT(CASE WHEN Won OR StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 1 END) AS actual_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE r360_record__c = true
        AND Division IN ('US', 'UK', 'AU')
        AND Type = 'New Business'
        AND ACV > 100000
        AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
        ${regionClause.replace(/Region/g, 'Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
      GROUP BY product, region
      ORDER BY region
    `;

    const [[newLogoRows], [expMigRows], [strategicRows]] = await Promise.all([
      getBigQuery().query({ query: newLogoQuery }),
      getBigQuery().query({ query: expansionMigrationQuery }),
      getBigQuery().query({ query: strategicQuery }),
    ]);

    results.push(...(newLogoRows as any[]), ...(expMigRows as any[]), ...(strategicRows as any[]));
  }

  return results;
}

// Query for POR funnel actuals (aggregated INBOUND)
async function getPORFunnelActuals(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  const query = `
    SELECT
      'POR' AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      'INBOUND' AS source,
      COUNT(DISTINCT CASE
        WHEN MQL_DT IS NOT NULL
          AND CAST(MQL_DT AS DATE) >= '${filters.startDate}'
          AND CAST(MQL_DT AS DATE) <= '${filters.endDate}'
        THEN COALESCE(LeadEmail, ContactEmail)
      END) AS actual_mql,
      COUNT(DISTINCT CASE
        WHEN SQL_DT IS NOT NULL
          AND CAST(SQL_DT AS DATE) >= '${filters.startDate}'
          AND CAST(SQL_DT AS DATE) <= '${filters.endDate}'
        THEN COALESCE(LeadEmail, ContactEmail)
      END) AS actual_sql,
      COUNT(DISTINCT CASE
        WHEN SAL_DT IS NOT NULL
          AND CAST(SAL_DT AS DATE) >= '${filters.startDate}'
          AND CAST(SAL_DT AS DATE) <= '${filters.endDate}'
        THEN COALESCE(LeadEmail, ContactEmail)
      END) AS actual_sal,
      COUNT(DISTINCT CASE
        WHEN SQO_DT IS NOT NULL
          AND CAST(SQO_DT AS DATE) >= '${filters.startDate}'
          AND CAST(SQO_DT AS DATE) <= '${filters.endDate}'
        THEN COALESCE(LeadEmail, ContactEmail)
      END) AS actual_sqo
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
      AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
      ${regionClause}
    GROUP BY 1, 2
    ORDER BY 2
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for R360 funnel actuals (aggregated INBOUND)
async function getR360FunnelActuals(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      'R360' AS product,
      Region AS region,
      'INBOUND' AS source,
      COUNT(DISTINCT CASE
        WHEN MQL_DT IS NOT NULL
          AND CAST(MQL_DT AS DATE) >= '${filters.startDate}'
          AND CAST(MQL_DT AS DATE) <= '${filters.endDate}'
        THEN Email
      END) AS actual_mql,
      COUNT(DISTINCT CASE
        WHEN SQL_DT IS NOT NULL
          AND CAST(SQL_DT AS DATE) >= '${filters.startDate}'
          AND CAST(SQL_DT AS DATE) <= '${filters.endDate}'
        THEN Email
      END) AS actual_sql,
      0 AS actual_sal,
      COUNT(DISTINCT CASE
        WHEN SQO_DT IS NOT NULL
          AND CAST(SQO_DT AS DATE) >= '${filters.startDate}'
          AND CAST(SQO_DT AS DATE) <= '${filters.endDate}'
        THEN Email
      END) AS actual_sqo
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\`
    WHERE MQL_Reverted = false
      AND Region IS NOT NULL
      ${regionClause}
    GROUP BY 1, 2
    ORDER BY 2
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for won deals
async function getWonDeals(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  const query = `
    SELECT
      Id AS opportunity_id,
      OpportunityName AS opportunity_name,
      AccountName AS account_name,
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN Type = 'New Business' AND ACV > 100000 THEN 'STRATEGIC'
        WHEN Type = 'Existing Business' THEN 'EXPANSION'
        WHEN Type = 'New Business' THEN 'NEW LOGO'
        WHEN Type = 'Migration' THEN 'MIGRATION'
        WHEN Type = 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(NULLIF(COALESCE(SDRSource, POR_SDRSource), ''), 'INBOUND') AS source,
      ROUND(ACV, 2) AS acv,
      CAST(CloseDate AS STRING) AS close_date,
      Owner AS owner_name,
      OwnerId AS owner_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    ORDER BY ACV DESC
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for lost deals
async function getLostDeals(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  const query = `
    SELECT
      Id AS opportunity_id,
      OpportunityName AS opportunity_name,
      AccountName AS account_name,
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN Type = 'New Business' AND ACV > 100000 THEN 'STRATEGIC'
        WHEN Type = 'Existing Business' THEN 'EXPANSION'
        WHEN Type = 'New Business' THEN 'NEW LOGO'
        WHEN Type = 'Migration' THEN 'MIGRATION'
        WHEN Type = 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(NULLIF(COALESCE(SDRSource, POR_SDRSource), ''), 'INBOUND') AS source,
      ROUND(ACV, 2) AS acv,
      COALESCE(ClosedLostReason, 'Not Specified') AS loss_reason,
      CAST(CloseDate AS STRING) AS close_date,
      Owner AS owner_name,
      OwnerId AS owner_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE LOWER(StageName) LIKE '%lost%'
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND Division IN ('US', 'UK', 'AU')
      AND ACV >= 0
      ${productClause}
      ${regionClause}
    ORDER BY ACV DESC
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for pipeline deals
async function getPipelineDeals(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  // Calculate quarter end date (Q1 ends March 31)
  const startYear = parseInt(filters.startDate.split('-')[0]);
  const startMonth = parseInt(filters.startDate.split('-')[1]);
  let quarterEndDate: string;
  if (startMonth >= 1 && startMonth <= 3) {
    quarterEndDate = `${startYear}-03-31`;
  } else if (startMonth >= 4 && startMonth <= 6) {
    quarterEndDate = `${startYear}-06-30`;
  } else if (startMonth >= 7 && startMonth <= 9) {
    quarterEndDate = `${startYear}-09-30`;
  } else {
    quarterEndDate = `${startYear}-12-31`;
  }

  const query = `
    SELECT
      Id AS opportunity_id,
      OpportunityName AS opportunity_name,
      AccountName AS account_name,
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN Type = 'New Business' AND ACV > 100000 THEN 'STRATEGIC'
        WHEN Type = 'Existing Business' THEN 'EXPANSION'
        WHEN Type = 'New Business' THEN 'NEW LOGO'
        WHEN Type = 'Migration' THEN 'MIGRATION'
        WHEN Type = 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(NULLIF(COALESCE(SDRSource, POR_SDRSource), ''), 'INBOUND') AS source,
      ROUND(ACV, 2) AS acv,
      StageName AS stage,
      CAST(CloseDate AS STRING) AS close_date,
      Owner AS owner_name,
      OwnerId AS owner_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE IsClosed = false
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${quarterEndDate}'
      ${productClause}
      ${regionClause}
    ORDER BY ACV DESC
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for source actuals from won deals
async function getSourceActuals(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  const query = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) IN ('INBOUND', 'INBOUND CALL', 'CHAT', 'WEBSITE', 'WEB FORM') THEN 'INBOUND'
        WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) IN ('OUTBOUND', 'OUTBOUND CALL', 'COLD CALL', 'EMAIL CAMPAIGN') THEN 'OUTBOUND'
        WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) IN ('AE SOURCED', 'AE', 'ACCOUNT EXECUTIVE') THEN 'AE SOURCED'
        WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) IN ('AM SOURCED', 'AM', 'ACCOUNT MANAGER', 'CSM') THEN 'AM SOURCED'
        WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) IN ('TRADESHOW', 'TRADE SHOW', 'EVENT', 'CONFERENCE') THEN 'TRADESHOW'
        WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) IN ('PARTNER', 'PARTNERSHIP', 'REFERRAL', 'CHANNEL') THEN 'PARTNERSHIPS'
        ELSE 'INBOUND'
      END AS source,
      COUNT(*) AS deal_count,
      ROUND(SUM(ACV), 2) AS total_acv
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    GROUP BY product, region, source
    ORDER BY product, region, source
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    return rows;
  } catch (error) {
    console.warn('Source actuals query failed:', error);
    return [];
  }
}

// Query for pipeline age
async function getPipelineAge(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  // Calculate quarter end date (Q1 ends March 31)
  const startYear = parseInt(filters.startDate.split('-')[0]);
  const startMonth = parseInt(filters.startDate.split('-')[1]);
  let quarterEndDate: string;
  if (startMonth >= 1 && startMonth <= 3) {
    quarterEndDate = `${startYear}-03-31`;
  } else if (startMonth >= 4 && startMonth <= 6) {
    quarterEndDate = `${startYear}-06-30`;
  } else if (startMonth >= 7 && startMonth <= 9) {
    quarterEndDate = `${startYear}-09-30`;
  } else {
    quarterEndDate = `${startYear}-12-31`;
  }

  const query = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN Type = 'New Business' AND ACV > 100000 THEN 'STRATEGIC'
        WHEN Type = 'Existing Business' THEN 'EXPANSION'
        WHEN Type = 'New Business' THEN 'NEW LOGO'
        WHEN Type = 'Migration' THEN 'MIGRATION'
        WHEN Type = 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      ROUND(AVG(DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY)), 0) AS avg_age_days
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE IsClosed = false
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${quarterEndDate}'
      ${productClause}
      ${regionClause}
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    return rows;
  } catch (error) {
    console.warn('Pipeline age query failed:', error);
    return [];
  }
}

// Query for loss reason RCA
async function getLossReasonRCA(filters: ReportFilters) {
  const { productClause, regionClause } = buildOpportunityFilterClause(filters);

  const query = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      COALESCE(ClosedLostReason, 'Not Specified') AS loss_reason,
      COUNT(*) AS deal_count,
      ROUND(SUM(ACV), 2) AS lost_acv
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE LOWER(StageName) LIKE '%lost%'
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    GROUP BY 1, 2, 3
    ORDER BY lost_acv DESC
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    return rows;
  } catch (error) {
    console.warn('Loss reason RCA query failed:', error);
    return [];
  }
}

// Query for MQL + EQL details
// MQL = Marketing Qualified Lead (NEW LOGO - from InboundFunnel)
// EQL = Existing Qualified Lead (EXPANSION/MIGRATION - from OpportunityViewTable)
async function getMQLDetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  // MQL Query - NEW LOGO from DailyRevenueFunnel (authoritative source, matches summary counts)
  // JOINs Lead/Contact/Account for detail fields, InboundFunnel for conversion status
  const porMqlQuery = `
    WITH funnel_status AS (
      SELECT
        LeadId, ContactId,
        MAX(CASE WHEN SQL_DT IS NOT NULL THEN 1 ELSE 0 END) AS has_sql,
        MAX(CASE WHEN SAL_DT IS NOT NULL THEN 1 ELSE 0 END) AS has_sal,
        MAX(CASE WHEN SQO_DT IS NOT NULL THEN 1 ELSE 0 END) AS has_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
      GROUP BY LeadId, ContactId
    ),
    raw_mqls AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        COALESCE(d.LeadID, d.ContactID) AS record_id,
        CONCAT('https://por.my.salesforce.com/', COALESCE(d.LeadID, d.ContactID)) AS salesforce_url,
        COALESCE(l.company, a.Name, 'Unknown') AS company_name,
        COALESCE(l.email, c.email, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), 'INBOUND')) AS source,
        CAST(d.CaptureDate AS STRING) AS mql_date,
        CASE WHEN COALESCE(fs.has_sql, 0) = 1 OR l.convertedopportunityid IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sql,
        CASE
          WHEN COALESCE(fs.has_sqo, 0) = 1 THEN 'CONVERTED_SQO'
          WHEN COALESCE(fs.has_sal, 0) = 1 THEN 'CONVERTED_SAL'
          WHEN COALESCE(fs.has_sql, 0) = 1 OR l.convertedopportunityid IS NOT NULL THEN 'CONVERTED'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS mql_status,
        false AS was_reverted,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'MQL' AS lead_type,
        'NEW LOGO' AS category,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(d.LeadID, d.ContactID)
          ORDER BY d.CaptureDate DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l ON d.LeadID = l.id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c ON d.ContactID = c.id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a ON c.accountid = a.Id
      LEFT JOIN funnel_status fs
        ON (d.LeadID IS NOT NULL AND d.LeadID = fs.LeadId)
        OR (d.ContactID IS NOT NULL AND d.ContactID = fs.ContactId)
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'INBOUND'
        AND d.MQL = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${filters.regions && filters.regions.length > 0 ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})` : ''}
    )
    SELECT * EXCEPT(rn) FROM raw_mqls WHERE rn = 1
    ORDER BY mql_date DESC
  `;

  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // R360 MQL Query - from DailyRevenueFunnel (authoritative source, matches summary counts)
  const r360MqlQuery = `
    WITH funnel_status AS (
      SELECT
        COALESCE(LeadId, Email) AS match_key,
        MAX(CASE WHEN SQL_DT IS NOT NULL THEN 1 ELSE 0 END) AS has_sql,
        MAX(CASE WHEN SQO_DT IS NOT NULL THEN 1 ELSE 0 END) AS has_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\`
      WHERE MQL_Reverted = false AND Region IS NOT NULL
      GROUP BY 1
    ),
    raw_mqls AS (
      SELECT
        'R360' AS product,
        d.Region AS region,
        COALESCE(d.LeadID, d.ContactID) AS record_id,
        CONCAT('https://por.my.salesforce.com/', COALESCE(d.LeadID, d.ContactID)) AS salesforce_url,
        COALESCE(l.company, a.Name, 'Unknown') AS company_name,
        COALESCE(l.email, c.email, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), 'INBOUND')) AS source,
        CAST(d.CaptureDate AS STRING) AS mql_date,
        CASE WHEN COALESCE(fs.has_sql, 0) = 1 OR l.convertedopportunityid IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sql,
        CASE
          WHEN COALESCE(fs.has_sqo, 0) = 1 THEN 'CONVERTED_SQO'
          WHEN COALESCE(fs.has_sql, 0) = 1 OR l.convertedopportunityid IS NOT NULL THEN 'CONVERTED'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS mql_status,
        false AS was_reverted,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'MQL' AS lead_type,
        'NEW LOGO' AS category,
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(d.LeadID, d.ContactID)
          ORDER BY d.CaptureDate DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l ON d.LeadID = l.id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c ON d.ContactID = c.id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a ON c.accountid = a.Id
      LEFT JOIN funnel_status fs ON COALESCE(d.LeadID, d.ContactID) = fs.match_key
      WHERE d.RecordType = 'R360'
        AND UPPER(d.FunnelType) IN ('INBOUND', 'R360 INBOUND')
        AND d.MQL = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${r360RegionClause ? r360RegionClause.replace('Region', 'd.Region') : ''}
    )
    SELECT * EXCEPT(rn) FROM raw_mqls WHERE rn = 1
    ORDER BY mql_date DESC
  `;

  // EQL Query - EXPANSION/MIGRATION from DailyRevenueFunnel (authoritative source, matches summary counts)
  // Deduplicates by OpportunityID, JOINs OpportunityViewTable for detail fields
  const eqlQuery = `
    WITH ranked_eqls AS (
      SELECT
        d.OpportunityID,
        CASE d.RecordType WHEN 'POR' THEN 'POR' ELSE 'R360' END AS product,
        d.Region AS region,
        UPPER(COALESCE(NULLIF(d.Source, ''), 'AM SOURCED')) AS source,
        FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE)) AS mql_date,
        CASE
          WHEN UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
          WHEN UPPER(d.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
        END AS category,
        -- Keep most progressed stage per opportunity (backtick-escape SQL reserved word)
        d.Won AS drf_won, d.SQO AS drf_sqo, d.SAL AS drf_sal, d.\`SQL\` AS drf_sql,
        ROW_NUMBER() OVER (
          PARTITION BY d.OpportunityID
          ORDER BY d.Won DESC, d.SQO DESC, d.SAL DESC, d.\`SQL\` DESC, d.CaptureDate DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      WHERE UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION', 'MIGRATION', 'R360 MIGRATION')
        AND d.MQL = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${filters.products && filters.products.length > 0 ? `AND d.RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})` : ''}
        ${filters.regions && filters.regions.length > 0 ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})` : ''}
    )
    SELECT
      e.product,
      e.region,
      e.OpportunityID AS record_id,
      CONCAT('https://por.my.salesforce.com/', e.OpportunityID) AS salesforce_url,
      COALESCE(o.AccountName, 'Unknown') AS company_name,
      'N/A' AS email,
      COALESCE(NULLIF(UPPER(COALESCE(o.SDRSource, o.POR_SDRSource)), ''), e.source) AS source,
      e.mql_date,
      CASE
        WHEN e.drf_won = 1 OR o.Won THEN 'Yes'
        WHEN e.drf_sqo = 1 THEN 'Yes'
        WHEN e.drf_sql = 1 THEN 'Yes'
        ELSE 'No'
      END AS converted_to_sql,
      CASE
        WHEN e.drf_won = 1 OR COALESCE(o.Won, false) THEN 'WON'
        WHEN COALESCE(o.IsClosed, false) AND NOT COALESCE(o.Won, false) THEN 'LOST'
        WHEN e.drf_sqo = 1 THEN 'CONVERTED_SQO'
        WHEN e.drf_sal = 1 THEN 'CONVERTED_SAL'
        WHEN e.drf_sql = 1 THEN 'CONVERTED'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(e.mql_date AS DATE), DAY) > 21 AND NOT COALESCE(o.IsClosed, false) THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS mql_status,
      CASE WHEN COALESCE(o.IsClosed, false) AND NOT COALESCE(o.Won, false) THEN true ELSE false END AS was_reverted,
      DATE_DIFF(CURRENT_DATE(), CAST(e.mql_date AS DATE), DAY) AS days_in_stage,
      'EQL' AS lead_type,
      e.category
    FROM ranked_eqls e
    LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o ON e.OpportunityID = o.Id
    WHERE e.rn = 1
    ORDER BY e.mql_date DESC
  `;

  // STRATEGIC MQL Query - New Business opps with ACV > $100K from OpportunityViewTable
  // Matches the summary-level strategic query pattern (line ~1228) but returns individual records
  const strategicMqlQuery = `
    SELECT
      CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      Id AS record_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
      COALESCE(AccountName, 'Unknown') AS company_name,
      'N/A' AS email,
      UPPER(COALESCE(NULLIF(SDRSource, ''), NULLIF(POR_SDRSource, ''), 'INBOUND')) AS source,
      FORMAT_DATE('%Y-%m-%d', CAST(CreatedDate AS DATE)) AS mql_date,
      CASE
        WHEN Won THEN 'Yes'
        WHEN StageName NOT IN ('Discovery', 'Qualification') THEN 'Yes'
        ELSE 'No'
      END AS converted_to_sql,
      CASE
        WHEN Won THEN 'WON'
        WHEN IsClosed AND NOT COALESCE(Won, false) THEN 'LOST'
        WHEN StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 'CONVERTED_SQO'
        WHEN StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') THEN 'CONVERTED_SAL'
        WHEN StageName NOT IN ('Discovery', 'Qualification') THEN 'CONVERTED'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS mql_status,
      CASE WHEN IsClosed AND NOT COALESCE(Won, false) THEN true ELSE false END AS was_reverted,
      DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) AS days_in_stage,
      'MQL' AS lead_type,
      'STRATEGIC' AS category
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND Type = 'New Business'
      AND ACV > 100000
      AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
      AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
      ${filters.products && filters.products.length > 0 ? `AND CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END IN (${filters.products.map(p => `'${p}'`).join(', ')})` : ''}
      ${filters.regions && filters.regions.length > 0 ? `AND CASE Division WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC' END IN (${filters.regions.map(r => `'${r}'`).join(', ')})` : ''}
    ORDER BY mql_date DESC
  `;

  const shouldFetchPOR = filters.products.length === 0 || filters.products.includes('POR');
  const shouldFetchR360 = filters.products.length === 0 || filters.products.includes('R360');

  let porMqlRows: any[] = [];
  let r360MqlRows: any[] = [];
  let eqlRows: any[] = [];
  let strategicMqlRows: any[] = [];

  try {
    porMqlRows = shouldFetchPOR
      ? (await getBigQuery().query({ query: porMqlQuery }))[0] as any[]
      : [];
  } catch (error) {
    console.warn('POR MQL details query failed:', error);
  }

  try {
    r360MqlRows = shouldFetchR360
      ? (await getBigQuery().query({ query: r360MqlQuery }))[0] as any[]
      : [];
  } catch (error) {
    console.warn('R360 MQL details query failed:', error);
  }

  try {
    eqlRows = (await getBigQuery().query({ query: eqlQuery }))[0] as any[];
  } catch (error: any) {
    console.warn('EQL details query failed:', error?.message || error);
    eqlRows = [];
  }

  try {
    strategicMqlRows = (await getBigQuery().query({ query: strategicMqlQuery }))[0] as any[];
  } catch (error: any) {
    console.warn('Strategic MQL details query failed:', error?.message || error);
    strategicMqlRows = [];
  }

  // Combine MQL, EQL, and Strategic data, split by product
  const porData = [
    ...porMqlRows,
    ...eqlRows.filter((r: any) => r.product === 'POR'),
    ...strategicMqlRows.filter((r: any) => r.product === 'POR'),
  ];
  const r360Data = [
    ...r360MqlRows,
    ...eqlRows.filter((r: any) => r.product === 'R360'),
    ...strategicMqlRows.filter((r: any) => r.product === 'R360'),
  ];

  return {
    POR: porData,
    R360: r360Data,
  };
}

// Query for SQL details
async function getSQLDetails(filters: ReportFilters) {
  // DRF region filter (uses Region directly as AMER/EMEA/APAC)
  const drfRegionClause = filters.regions && filters.regions.length > 0
    ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // POR SQL query - uses DailyRevenueFunnel as base (matches pacing counts)
  // DRF has OpportunityID for all records, so simple direct JOIN to OVT
  // LEFT JOIN to funnel tables for enrichment (email, dates, etc.)
  const porQuery = `
    WITH inbound_sqls AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, f.Company, 'Unknown') AS company_name,
        COALESCE(f.LeadEmail, f.ContactEmail, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        COALESCE(CAST(f.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(f.MQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN f.MQL_DT IS NOT NULL AND f.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(f.SQL_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        CASE WHEN f.SAL_DT IS NOT NULL OR d.SAL = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sal,
        CASE WHEN f.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN d.SAL = 1 OR f.SAL_DT IS NOT NULL THEN 'CONVERTED_SAL'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, f.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\` f
        ON d.OpportunityID = f.OpportunityID
        AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'INBOUND'
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${drfRegionClause}
    ),
    new_logo_sqls AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, nl.Company, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), nl.SDRSource, 'OUTBOUND')) AS source,
        COALESCE(CAST(nl.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(nl.MQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN nl.MQL_DT IS NOT NULL AND nl.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(nl.SQL_DT AS DATE), CAST(nl.MQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        CASE WHEN nl.SAL_DT IS NOT NULL OR d.SAL = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sal,
        CASE WHEN nl.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR nl.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN d.SAL = 1 OR nl.SAL_DT IS NOT NULL THEN 'CONVERTED_SAL'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, nl.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, nl.WonACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.NewLogoFunnel\` nl
        ON d.OpportunityID = nl.OpportunityID
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'NEW LOGO'
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${drfRegionClause}
    ),
    expansion_sqls AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, e.Company, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(e.SQOSource, ''), 'AM SOURCED')) AS source,
        COALESCE(CAST(e.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(e.EQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN e.EQL_DT IS NOT NULL AND e.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(e.SQL_DT AS DATE), CAST(e.EQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        'No' AS converted_to_sal,
        CASE WHEN e.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR e.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, e.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, 0) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'EXPANSION' AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.ExpansionFunnel\` e
        ON d.OpportunityID = e.OpportunityID AND e.RecordType = 'POR'
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'EXPANSION'
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${drfRegionClause}
    ),
    migration_sqls AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, m.Company, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(CAST(m.MigrationCase AS STRING), ''), 'AM SOURCED')) AS source,
        COALESCE(CAST(m.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(m.EQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN m.EQL_DT IS NOT NULL AND m.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(m.SQL_DT AS DATE), CAST(m.EQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        CASE WHEN m.SAL_DT IS NOT NULL OR d.SAL = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sal,
        CASE WHEN m.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR m.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN d.SAL = 1 OR m.SAL_DT IS NOT NULL THEN 'CONVERTED_SAL'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, m.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, 0) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'MIGRATION' AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.MigrationFunnel\` m
        ON d.OpportunityID = m.OpportunityID
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'MIGRATION'
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${drfRegionClause}
    )
    SELECT * EXCEPT(rn) FROM inbound_sqls WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM new_logo_sqls WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM expansion_sqls WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM migration_sqls WHERE rn = 1
    ORDER BY sql_date DESC
  `;

  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // R360 SQL query - uses DailyRevenueFunnel as base (matches pacing counts)
  const r360Query = `
    WITH inbound_sqls AS (
      SELECT
        'R360' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, f.Company, 'Unknown') AS company_name,
        COALESCE(f.Email, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        COALESCE(CAST(f.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(f.MQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN f.MQL_DT IS NOT NULL AND f.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(f.SQL_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        'N/A' AS converted_to_sal,
        CASE WHEN f.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, f.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\` f
        ON d.OpportunityID = f.OpportunityID
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
      WHERE d.RecordType = 'R360'
        AND UPPER(d.FunnelType) IN ('INBOUND', 'R360 INBOUND')
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${r360RegionClause}
    ),
    new_logo_sqls AS (
      SELECT
        'R360' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, nl.OpportunityName, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), nl.SDRSource, 'OUTBOUND')) AS source,
        COALESCE(CAST(nl.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(nl.MQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN nl.MQL_DT IS NOT NULL AND nl.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(nl.SQL_DT AS DATE), CAST(nl.MQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        'N/A' AS converted_to_sal,
        CASE WHEN nl.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR nl.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, nl.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, nl.WonACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360NewLogoFunnel\` nl
        ON d.OpportunityID = nl.OpportunityID
      WHERE d.RecordType = 'R360'
        AND UPPER(d.FunnelType) IN ('NEW LOGO', 'R360 NEW LOGO')
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${r360RegionClause}
    ),
    expansion_sqls AS (
      SELECT
        'R360' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, e.Company, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(e.SQOSource, ''), 'AM SOURCED')) AS source,
        COALESCE(CAST(e.SQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sql_date,
        COALESCE(CAST(e.EQL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS mql_date,
        CASE WHEN e.EQL_DT IS NOT NULL AND e.SQL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(e.SQL_DT AS DATE), CAST(e.EQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_mql_to_sql,
        'N/A' AS converted_to_sal,
        CASE WHEN e.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR e.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, e.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, 0) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'EXPANSION' AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.ExpansionFunnel\` e
        ON d.OpportunityID = e.OpportunityID AND e.RecordType = 'R360'
      WHERE d.RecordType = 'R360'
        AND UPPER(d.FunnelType) IN ('EXPANSION', 'R360 EXPANSION')
        AND d.\`SQL\` = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${r360RegionClause}
    )
    SELECT * EXCEPT(rn) FROM inbound_sqls WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM new_logo_sqls WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM expansion_sqls WHERE rn = 1
    ORDER BY sql_date DESC
  `;

  // STRATEGIC query from OpportunityViewTable (Type='New Business' AND ACV>100000)
  const strategicRegionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  const strategicSqlQuery = `
    SELECT
      CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
      CASE Division WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC' END AS region,
      Id AS record_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
      COALESCE(AccountName, 'Unknown') AS company_name,
      'N/A' AS email,
      UPPER(COALESCE(NULLIF(SDRSource, ''), NULLIF(POR_SDRSource, ''), 'INBOUND')) AS source,
      FORMAT_DATE('%Y-%m-%d', CAST(CreatedDate AS DATE)) AS sql_date,
      FORMAT_DATE('%Y-%m-%d', CAST(CreatedDate AS DATE)) AS mql_date,
      0 AS days_mql_to_sql,
      CASE WHEN StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR Won THEN 'Yes' ELSE 'No' END AS converted_to_sal,
      CASE WHEN StageName IN ('Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') OR Won OR IsClosed THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
      'Yes' AS has_opportunity,
      CASE
        WHEN Won THEN 'WON'
        WHEN IsClosed AND NOT COALESCE(Won, false) THEN 'LOST'
        WHEN StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 'CONVERTED_SQO'
        WHEN StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') THEN 'CONVERTED_SAL'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS sql_status,
      Id AS opportunity_id,
      OpportunityName AS opportunity_name,
      StageName AS opportunity_stage,
      ACV AS opportunity_acv,
      COALESCE(ClosedLostReason, 'N/A') AS loss_reason,
      DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) AS days_in_stage,
      'STRATEGIC' AS category
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND Type = 'New Business' AND ACV > 100000
      AND (StageName NOT IN ('Discovery', 'Qualification') OR Won)
      AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
      AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
      ${strategicRegionClause}
    ORDER BY sql_date DESC
  `;

  try {
    const shouldFetchPOR = filters.products.length === 0 || filters.products.includes('POR');
    const shouldFetchR360 = filters.products.length === 0 || filters.products.includes('R360');

    let strategicRows: any[] = [];
    try {
      [strategicRows] = await getBigQuery().query({ query: strategicSqlQuery }) as any[];
    } catch (error) {
      console.warn('Strategic SQL query failed:', error);
    }

    const [[porRows], [r360Rows]] = await Promise.all([
      shouldFetchPOR ? getBigQuery().query({ query: porQuery }) : Promise.resolve([[]]),
      shouldFetchR360 ? getBigQuery().query({ query: r360Query }) : Promise.resolve([[]]),
    ]);

    // Combine results with strategic data
    const porData = [...(porRows || []), ...(strategicRows || []).filter((r: any) => r.product === 'POR')];
    const r360Data = [...(r360Rows || []), ...(strategicRows || []).filter((r: any) => r.product === 'R360')];

    console.log(`SQL Details: POR=${porData.length}, R360=${r360Data.length}, Strategic=${strategicRows?.length || 0}`);
    return {
      POR: porData as any[],
      R360: r360Data as any[],
    };
  } catch (error) {
    console.warn('SQL details query failed:', error);
    return { POR: [], R360: [] };
  }
}

// SAL Details Query (POR only - InboundFunnel has SAL_DT)
// Enhanced: Uses OpportunityName lookup as fallback when OpportunityID and ConvertedOpportunityId are NULL
async function getSALDetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // POR SAL query - uses DailyRevenueFunnel as primary source to match pacing counts
  // Note: R360 doesn't have SAL stage, so only POR query needed
  // DRF→OpportunityViewTable JOIN via OpportunityID is 100% reliable for INBOUND
  const porQuery = `
    WITH ranked_sals AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, f.Company, 'Unknown') AS company_name,
        COALESCE(f.LeadEmail, f.ContactEmail, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        COALESCE(CAST(f.SAL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sal_date,
        CAST(f.SQL_DT AS STRING) AS sql_date,
        CAST(f.MQL_DT AS STRING) AS mql_date,
        CASE WHEN f.SQL_DT IS NOT NULL AND f.SAL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(f.SAL_DT AS DATE), CAST(f.SQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_sql_to_sal,
        CASE WHEN f.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sal_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, f.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(
          NULLIF(o.RejectedReason, ''),
          NULLIF(o.ClosedLostReason, ''),
          'N/A'
        ) AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\` f
        ON d.OpportunityID = f.OpportunityID
        AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'INBOUND'
        AND d.SAL = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${regionClause}
    ),
    -- EXPANSION and MIGRATION opportunities that have reached SAL stage
    -- SAL stage = past Needs Analysis (Stage 1-2 are Discovery/Qualification, Stage 3 is Needs Analysis)
    expansion_migration_sals AS (
      SELECT
        'POR' AS product,
        CASE o.Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        o.Id AS record_id,
        CONCAT('https://por.my.salesforce.com/', o.Id) AS salesforce_url,
        COALESCE(o.AccountName, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(COALESCE(o.SDRSource, o.POR_SDRSource), ''), 'EXPANSION')) AS source,
        CAST(o.CreatedDate AS STRING) AS sal_date,
        CAST(NULL AS STRING) AS sql_date,
        CAST(NULL AS STRING) AS mql_date,
        0 AS days_sql_to_sal,
        CASE WHEN o.Won OR o.StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won THEN 'WON'
          WHEN o.StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 'CONVERTED_SQO'
          WHEN o.IsClosed AND NOT o.Won THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sal_status,
        o.Id AS opportunity_id,
        o.OpportunityName AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(NULLIF(o.RejectedReason, ''), NULLIF(o.ClosedLostReason, ''), 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY o.Id ORDER BY o.CreatedDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.por_record__c = true
        AND o.Division IN ('US', 'UK', 'AU')
        AND o.Type IN ('Existing Business', 'Migration')
        AND o.ACV > 0
        AND (o.StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR o.Won)
        AND CAST(o.CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(o.CreatedDate AS DATE) <= '${filters.endDate}'
        ${regionClause.replace(/d\.Region/g, 'o.Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
    ),
    -- Non-inbound funnel records (OUTBOUND, AE SOURCED, TRADESHOW, etc.) from DailyRevenueFunnel
    non_inbound_sals AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, nl.Company, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(nl.SDRSource, ''), 'OUTBOUND')) AS source,
        COALESCE(CAST(nl.SAL_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sal_date,
        CAST(nl.SQL_DT AS STRING) AS sql_date,
        CAST(nl.MQL_DT AS STRING) AS mql_date,
        CASE WHEN nl.SQL_DT IS NOT NULL AND nl.SAL_DT IS NOT NULL
          THEN DATE_DIFF(CAST(nl.SAL_DT AS DATE), CAST(nl.SQL_DT AS DATE), DAY)
          ELSE 0
        END AS days_sql_to_sal,
        CASE WHEN nl.SQO_DT IS NOT NULL OR d.SQO = 1 THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        'Yes' AS has_opportunity,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN d.SQO = 1 OR nl.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sal_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, nl.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, nl.WonACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'NEW LOGO' AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.NewLogoFunnel\` nl
        ON d.OpportunityID = nl.OpportunityID
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'NEW LOGO'
        AND d.SAL = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${regionClause}
    )
    SELECT * EXCEPT(rn) FROM ranked_sals WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM expansion_migration_sals WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM non_inbound_sals WHERE rn = 1
    ORDER BY sal_date DESC
  `;

  // STRATEGIC SAL query - high-value NEW LOGO deals (ACV > $100k)
  const strategicQuery = `
    SELECT
      'POR' AS product,
      CASE o.Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      o.Id AS record_id,
      CONCAT('https://por.my.salesforce.com/', o.Id) AS salesforce_url,
      COALESCE(o.AccountName, 'Unknown') AS company_name,
      'N/A' AS email,
      UPPER(COALESCE(NULLIF(COALESCE(o.SDRSource, o.POR_SDRSource), ''), 'INBOUND')) AS source,
      FORMAT_DATE('%Y-%m-%d', CAST(o.CreatedDate AS DATE)) AS sal_date,
      CAST(NULL AS STRING) AS sql_date,
      CAST(NULL AS STRING) AS mql_date,
      0 AS days_sql_to_sal,
      CASE WHEN o.StageName IN ('Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') OR o.Won OR o.IsClosed THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
      'Yes' AS has_opportunity,
      CASE
        WHEN o.Won THEN 'WON'
        WHEN o.IsClosed AND NOT COALESCE(o.Won, false) THEN 'LOST'
        WHEN o.StageName IN ('Proposal', 'Negotiation', 'Closed Won') THEN 'CONVERTED_SQO'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS sal_status,
      o.Id AS opportunity_id,
      o.OpportunityName AS opportunity_name,
      o.StageName AS opportunity_stage,
      o.ACV AS opportunity_acv,
      COALESCE(NULLIF(o.RejectedReason, ''), NULLIF(o.ClosedLostReason, ''), 'N/A') AS loss_reason,
      DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) AS days_in_stage,
      'STRATEGIC' AS category
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
    WHERE o.por_record__c = true
      AND o.Division IN ('US', 'UK', 'AU')
      AND o.Type = 'New Business'
      AND o.ACV > 100000
      AND (o.StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR o.Won)
      AND CAST(o.CreatedDate AS DATE) >= '${filters.startDate}'
      AND CAST(o.CreatedDate AS DATE) <= '${filters.endDate}'
      ${regionClause.replace(/d\.Region/g, 'o.Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
    ORDER BY sal_date DESC
  `;

  try {
    // Execute main POR query and strategic query in parallel
    const [porRowsResult, strategicRowsResult] = await Promise.all([
      getBigQuery().query({ query: porQuery }),
      getBigQuery().query({ query: strategicQuery })
    ]);

    const porRows = porRowsResult[0] as any[];
    const strategicRows = strategicRowsResult[0] as any[];

    // Combine results
    const allPorRows = [...porRows, ...strategicRows];

    console.log(`SAL query returned ${porRows?.length || 0} standard rows + ${strategicRows?.length || 0} strategic rows = ${allPorRows.length} total`);
    return {
      POR: allPorRows,
      R360: [] as any[], // R360 doesn't have SAL stage
    };
  } catch (error) {
    console.error('SAL details query failed:', error);
    return { POR: [], R360: [] };
  }
}

// SQO Details Query - DailyRevenueFunnel-based for INBOUND/NEW LOGO
// Uses DRF WHERE SQO=1 as source of truth, matching pacing section
async function getSQODetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const shouldFetchPOR = filters.products.length === 0 || filters.products.includes('POR');
  const shouldFetchR360 = filters.products.length === 0 || filters.products.includes('R360');

  // POR SQO query - uses DailyRevenueFunnel for INBOUND and NEW LOGO
  const porQuery = `
    -- INBOUND SQO records from DailyRevenueFunnel (matches pacing counts)
    WITH inbound_sqos AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, f.Company, 'Unknown') AS company_name,
        COALESCE(f.LeadEmail, f.ContactEmail, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        COALESCE(CAST(f.SQO_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sqo_date,
        COALESCE(CAST(f.SAL_DT AS STRING), CAST(NULL AS STRING)) AS sal_date,
        COALESCE(CAST(f.SQL_DT AS STRING), CAST(NULL AS STRING)) AS sql_date,
        COALESCE(CAST(f.MQL_DT AS STRING), CAST(NULL AS STRING)) AS mql_date,
        CASE WHEN f.SAL_DT IS NOT NULL AND f.SQO_DT IS NOT NULL
          THEN DATE_DIFF(CAST(f.SQO_DT AS DATE), CAST(f.SAL_DT AS DATE), DAY)
          ELSE 0
        END AS days_sal_to_sqo,
        CASE WHEN f.MQL_DT IS NOT NULL AND f.SQO_DT IS NOT NULL
          THEN DATE_DIFF(CAST(f.SQO_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY)
          ELSE DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY)
        END AS days_total_cycle,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, f.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (
          PARTITION BY d.OpportunityID
          ORDER BY CASE WHEN o.Won = true THEN 0 ELSE 1 END, d.CaptureDate DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\` f
        ON d.OpportunityID = f.OpportunityID
        AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'INBOUND'
        AND d.SQO = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${regionClause}
    ),
    -- NEW LOGO (non-inbound) SQO records from DailyRevenueFunnel
    newlogo_sqos AS (
      SELECT
        'POR' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, nl.Company, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(nl.SDRSource, ''), 'OUTBOUND')) AS source,
        COALESCE(CAST(nl.SQO_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sqo_date,
        CAST(nl.SAL_DT AS STRING) AS sal_date,
        CAST(nl.SQL_DT AS STRING) AS sql_date,
        CAST(nl.MQL_DT AS STRING) AS mql_date,
        CASE WHEN nl.SAL_DT IS NOT NULL AND nl.SQO_DT IS NOT NULL
          THEN DATE_DIFF(CAST(nl.SQO_DT AS DATE), CAST(nl.SAL_DT AS DATE), DAY)
          ELSE 0
        END AS days_sal_to_sqo,
        CASE WHEN nl.MQL_DT IS NOT NULL AND nl.SQO_DT IS NOT NULL
          THEN DATE_DIFF(CAST(nl.SQO_DT AS DATE), CAST(nl.MQL_DT AS DATE), DAY)
          ELSE DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY)
        END AS days_total_cycle,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, nl.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, nl.WonACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'NEW LOGO' AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.NewLogoFunnel\` nl
        ON d.OpportunityID = nl.OpportunityID
      WHERE d.RecordType = 'POR'
        AND UPPER(d.FunnelType) = 'NEW LOGO'
        AND d.SQO = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${regionClause}
    ),
    -- EXPANSION and MIGRATION opportunities at SQO stage (Proposal+)
    expansion_migration_sqos AS (
      SELECT
        'POR' AS product,
        CASE o.Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        o.Id AS record_id,
        CONCAT('https://por.my.salesforce.com/', o.Id) AS salesforce_url,
        COALESCE(o.AccountName, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(COALESCE(o.SDRSource, o.POR_SDRSource), ''), 'EXPANSION')) AS source,
        CAST(o.CreatedDate AS STRING) AS sqo_date,
        CAST(NULL AS STRING) AS sal_date,
        CAST(NULL AS STRING) AS sql_date,
        CAST(NULL AS STRING) AS mql_date,
        0 AS days_sal_to_sqo,
        DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) AS days_total_cycle,
        CASE
          WHEN o.Won THEN 'WON'
          WHEN o.IsClosed AND NOT o.Won THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        o.Id AS opportunity_id,
        o.OpportunityName AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY o.Id ORDER BY o.CreatedDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.por_record__c = true
        AND o.Division IN ('US', 'UK', 'AU')
        AND o.Type IN ('Existing Business', 'Migration')
        AND o.ACV > 0
        AND (o.StageName IN ('Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') OR o.Won OR o.IsClosed)
        AND CAST(o.CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(o.CreatedDate AS DATE) <= '${filters.endDate}'
        ${regionClause.replace(/d\.Region/g, 'o.Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
    )
    SELECT * EXCEPT(rn) FROM inbound_sqos WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM newlogo_sqos WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM expansion_migration_sqos WHERE rn = 1
    ORDER BY sqo_date DESC
  `;

  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND d.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // R360 SQO query - uses DailyRevenueFunnel for INBOUND/NEW LOGO
  const r360Query = `
    -- INBOUND SQO records from DailyRevenueFunnel
    WITH inbound_sqos AS (
      SELECT
        'R360' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, f.Company, 'Unknown') AS company_name,
        COALESCE(f.Email, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        COALESCE(CAST(f.SQO_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sqo_date,
        'N/A' AS sal_date,
        COALESCE(CAST(f.SQL_DT AS STRING), CAST(NULL AS STRING)) AS sql_date,
        COALESCE(CAST(f.MQL_DT AS STRING), CAST(NULL AS STRING)) AS mql_date,
        0 AS days_sal_to_sqo,
        CASE WHEN f.MQL_DT IS NOT NULL AND f.SQO_DT IS NOT NULL
          THEN DATE_DIFF(CAST(f.SQO_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY)
          ELSE DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY)
        END AS days_total_cycle,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, f.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
          WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY CASE WHEN o.Won = true THEN 0 ELSE 1 END, d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\` f
        ON d.OpportunityID = f.OpportunityID AND f.MQL_Reverted = false
      WHERE d.RecordType = 'R360'
        AND UPPER(d.FunnelType) IN ('INBOUND', 'R360 INBOUND')
        AND d.SQO = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${r360RegionClause}
    ),
    -- NEW LOGO (non-inbound) SQO records from DailyRevenueFunnel
    newlogo_sqos AS (
      SELECT
        'R360' AS product,
        d.Region AS region,
        d.OpportunityID AS record_id,
        CONCAT('https://por.my.salesforce.com/', d.OpportunityID) AS salesforce_url,
        COALESCE(o.AccountName, nl.OpportunityName, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(d.Source, ''), NULLIF(nl.SDRSource, ''), 'OUTBOUND')) AS source,
        COALESCE(CAST(nl.SQO_DT AS STRING), FORMAT_DATE('%Y-%m-%d', CAST(d.CaptureDate AS DATE))) AS sqo_date,
        CAST(NULL AS STRING) AS sal_date,
        CAST(nl.SQL_DT AS STRING) AS sql_date,
        CAST(nl.MQL_DT AS STRING) AS mql_date,
        0 AS days_sal_to_sqo,
        CASE WHEN nl.MQL_DT IS NOT NULL AND nl.SQO_DT IS NOT NULL
          THEN DATE_DIFF(CAST(nl.SQO_DT AS DATE), CAST(nl.MQL_DT AS DATE), DAY)
          ELSE DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY)
        END AS days_total_cycle,
        CASE
          WHEN o.Won = true THEN 'WON'
          WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        d.OpportunityID AS opportunity_id,
        COALESCE(o.OpportunityName, nl.OpportunityName) AS opportunity_name,
        o.StageName AS opportunity_stage,
        COALESCE(o.ACV, nl.WonACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(d.CaptureDate AS DATE), DAY) AS days_in_stage,
        'NEW LOGO' AS category,
        ROW_NUMBER() OVER (PARTITION BY d.OpportunityID ORDER BY d.CaptureDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.DailyRevenueFunnel\` d
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON d.OpportunityID = o.Id
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360NewLogoFunnel\` nl
        ON d.OpportunityID = nl.OpportunityID
      WHERE d.RecordType = 'R360'
        AND UPPER(d.FunnelType) IN ('NEW LOGO', 'R360 NEW LOGO')
        AND d.SQO = 1
        AND d.CaptureDate >= '${filters.startDate}'
        AND d.CaptureDate <= '${filters.endDate}'
        ${r360RegionClause}
    ),
    -- EXPANSION and MIGRATION R360 opportunities at SQO stage (Proposal+)
    expansion_migration_sqos AS (
      SELECT
        'R360' AS product,
        CASE o.Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        o.Id AS record_id,
        CONCAT('https://por.my.salesforce.com/', o.Id) AS salesforce_url,
        COALESCE(o.AccountName, 'Unknown') AS company_name,
        'N/A' AS email,
        UPPER(COALESCE(NULLIF(COALESCE(o.SDRSource, o.POR_SDRSource), ''), 'EXPANSION')) AS source,
        CAST(o.CreatedDate AS STRING) AS sqo_date,
        CAST(NULL AS STRING) AS sal_date,
        CAST(NULL AS STRING) AS sql_date,
        CAST(NULL AS STRING) AS mql_date,
        0 AS days_sal_to_sqo,
        DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) AS days_total_cycle,
        CASE
          WHEN o.Won THEN 'WON'
          WHEN o.IsClosed AND NOT o.Won THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        o.Id AS opportunity_id,
        o.OpportunityName AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        COALESCE(o.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) AS days_in_stage,
        CASE
          WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
          WHEN o.Type = 'Migration' THEN 'MIGRATION'
        END AS category,
        ROW_NUMBER() OVER (PARTITION BY o.Id ORDER BY o.CreatedDate DESC) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.por_record__c = false
        AND o.Division IN ('US', 'UK', 'AU')
        AND o.Type IN ('Existing Business', 'Migration')
        AND o.ACV > 0
        AND (o.StageName IN ('Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') OR o.Won OR o.IsClosed)
        AND CAST(o.CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(o.CreatedDate AS DATE) <= '${filters.endDate}'
        ${r360RegionClause.replace(/d\.Region/g, 'o.Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
    )
    SELECT * EXCEPT(rn) FROM inbound_sqos WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM newlogo_sqos WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM expansion_migration_sqos WHERE rn = 1
    ORDER BY sqo_date DESC
  `;

  // STRATEGIC query - shared POR + R360
  const strategicSqoQuery = `
    SELECT
      CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
      CASE Division WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC' END AS region,
      Id AS record_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
      COALESCE(AccountName, 'Unknown') AS company_name,
      'N/A' AS email,
      UPPER(COALESCE(NULLIF(SDRSource, ''), NULLIF(POR_SDRSource, ''), 'INBOUND')) AS source,
      FORMAT_DATE('%Y-%m-%d', CAST(CreatedDate AS DATE)) AS sqo_date,
      CAST(NULL AS STRING) AS sal_date,
      CAST(NULL AS STRING) AS sql_date,
      CAST(NULL AS STRING) AS mql_date,
      0 AS days_sal_to_sqo,
      DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) AS days_total_cycle,
      CASE
        WHEN Won THEN 'WON'
        WHEN IsClosed AND NOT COALESCE(Won, false) THEN 'LOST'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) > 21 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS sqo_status,
      Id AS opportunity_id,
      OpportunityName AS opportunity_name,
      StageName AS opportunity_stage,
      ACV AS opportunity_acv,
      COALESCE(ClosedLostReason, 'N/A') AS loss_reason,
      DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) AS days_in_stage,
      'STRATEGIC' AS category
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND Type = 'New Business' AND ACV > 100000
      AND (StageName IN ('Proposal', 'Negotiation', 'Closed Won', 'Closed Lost') OR Won OR IsClosed)
      AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
      AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
      ${regionClause.replace(/d\.Region/g, 'Division').replace(/'AMER'/g, "'US'").replace(/'EMEA'/g, "'UK'").replace(/'APAC'/g, "'AU'")}
    ORDER BY sqo_date DESC
  `;

  try {
    const [[porRows], [r360Rows]] = await Promise.all([
      shouldFetchPOR ? getBigQuery().query({ query: porQuery }) : Promise.resolve([[]]),
      shouldFetchR360 ? getBigQuery().query({ query: r360Query }) : Promise.resolve([[]]),
    ]);

    // Fetch strategic separately (may error if table doesn't exist)
    let strategicRows: any[] = [];
    try {
      const [rows] = await getBigQuery().query({ query: strategicSqoQuery });
      strategicRows = rows as any[];
    } catch (strategicError) {
      console.warn('Strategic SQO query failed (table may not exist):', strategicError);
    }

    console.log(`SQO query returned ${porRows?.length || 0} POR rows, ${r360Rows?.length || 0} R360 rows, ${strategicRows?.length || 0} strategic rows`);

    return {
      POR: [...(porRows as any[]), ...strategicRows.filter(r => r.product === 'POR')],
      R360: [...(r360Rows as any[]), ...strategicRows.filter(r => r.product === 'R360')],
    };
  } catch (error) {
    console.error('SQO details query failed:', error);
    return { POR: [], R360: [] };
  }
}

// Query UTM source breakdown from InboundFunnel tables
async function getUtmBreakdown(filters: ReportFilters) {
  const { startDate, endDate } = filters;

  // Query all UTM dimensions separately for each product
  const query = `
    WITH por_raw AS (
      SELECT
        CASE Division
          WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC'
          ELSE 'AMER'
        END AS region,
        COALESCE(NULLIF(UtmSourceBucket, ''), NULLIF(UtmSource, ''), 'Direct/Unknown') AS utm_source,
        COALESCE(NULLIF(UtmMedium, ''), 'unknown') AS utm_medium,
        COALESCE(NULLIF(UtmCampaign, ''), 'none') AS utm_campaign,
        COALESCE(NULLIF(UtmTerm, ''), 'none') AS utm_keyword,
        CASE WHEN SQL_DT IS NOT NULL THEN 1 ELSE 0 END AS has_sql,
        CASE WHEN SAL_DT IS NOT NULL THEN 1 ELSE 0 END AS has_sal,
        CASE WHEN SQO_DT IS NOT NULL THEN 1 ELSE 0 END AS has_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.MarketingFunnel.InboundFunnel\`
      WHERE MQL_DT >= '${startDate}' AND MQL_DT <= '${endDate}'
    ),
    r360_raw AS (
      SELECT
        CASE Division
          WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC'
          ELSE 'AMER'
        END AS region,
        COALESCE(NULLIF(UtmSourceBucket, ''), NULLIF(UtmSource, ''), 'Direct/Unknown') AS utm_source,
        COALESCE(NULLIF(UtmMedium, ''), 'unknown') AS utm_medium,
        COALESCE(NULLIF(UtmCampaign, ''), 'none') AS utm_campaign,
        COALESCE(NULLIF(UtmTerm, ''), 'none') AS utm_keyword,
        CASE WHEN SQL_DT IS NOT NULL THEN 1 ELSE 0 END AS has_sql,
        0 AS has_sal,
        CASE WHEN SQO_DT IS NOT NULL THEN 1 ELSE 0 END AS has_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.MarketingFunnel.R360InboundFunnel\`
      WHERE MQL_DT >= '${startDate}' AND MQL_DT <= '${endDate}'
    ),
    -- POR by source
    por_by_source AS (
      SELECT 'POR' AS product, 'source' AS dimension, utm_source AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM por_raw GROUP BY utm_source
    ),
    -- POR by medium
    por_by_medium AS (
      SELECT 'POR' AS product, 'medium' AS dimension, utm_medium AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM por_raw GROUP BY utm_medium
    ),
    -- Campaign name + spend lookups from Google Ads
    por_campaign_names AS (
      SELECT campaign_id, campaign_name
      FROM (
        SELECT campaign_id, campaign_name,
               ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY _DATA_DATE DESC) AS rn
        FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_POR}.ads_Campaign_8275359090\`
      )
      WHERE rn = 1
    ),
    por_campaign_spend AS (
      SELECT s.campaign_id,
        ROUND(SUM(s.metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
        SUM(s.metrics_clicks) AS clicks,
        SUM(s.metrics_impressions) AS impressions,
        SUM(s.metrics_conversions) AS conversions
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_POR}.ads_CampaignBasicStats_8275359090\` s
      WHERE s.segments_date >= '${startDate}' AND s.segments_date <= '${endDate}'
        AND s.segments_ad_network_type = 'SEARCH'
      GROUP BY s.campaign_id
    ),
    r360_campaign_names AS (
      SELECT campaign_id, campaign_name
      FROM (
        SELECT campaign_id, campaign_name,
               ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY _DATA_DATE DESC) AS rn
        FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_R360}.ads_Campaign_3799591491\`
      )
      WHERE rn = 1
    ),
    r360_campaign_spend AS (
      SELECT s.campaign_id,
        ROUND(SUM(s.metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
        SUM(s.metrics_clicks) AS clicks,
        SUM(s.metrics_impressions) AS impressions,
        SUM(s.metrics_conversions) AS conversions
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_R360}.ads_CampaignBasicStats_3799591491\` s
      WHERE s.segments_date >= '${startDate}' AND s.segments_date <= '${endDate}'
        AND s.segments_ad_network_type = 'SEARCH'
      GROUP BY s.campaign_id
    ),
    -- POR by campaign (with name + spend lookup)
    por_by_campaign AS (
      SELECT 'POR' AS product, 'campaign' AS dimension,
        COALESCE(c.campaign_name, p.utm_campaign) AS value,
        SUM(p.mql_count) AS mql_count, SUM(p.sql_count) AS sql_count,
        SUM(p.sal_count) AS sal_count, SUM(p.sqo_count) AS sqo_count,
        MAX(sp.ad_spend_usd) AS ad_spend_usd,
        MAX(sp.clicks) AS clicks,
        MAX(sp.impressions) AS impressions,
        MAX(sp.conversions) AS conversions
      FROM (
        SELECT utm_campaign,
          COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
        FROM por_raw WHERE utm_campaign != 'none' GROUP BY utm_campaign
      ) p
      LEFT JOIN por_campaign_names c
        ON SAFE_CAST(p.utm_campaign AS INT64) = c.campaign_id
        OR LOWER(p.utm_campaign) = LOWER(c.campaign_name)
      LEFT JOIN por_campaign_spend sp ON c.campaign_id = sp.campaign_id
      GROUP BY value
    ),
    -- POR by keyword
    por_by_keyword AS (
      SELECT 'POR' AS product, 'keyword' AS dimension, utm_keyword AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM por_raw WHERE utm_keyword != 'none' GROUP BY utm_keyword
    ),
    -- R360 by source
    r360_by_source AS (
      SELECT 'R360' AS product, 'source' AS dimension, utm_source AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM r360_raw GROUP BY utm_source
    ),
    -- R360 by medium
    r360_by_medium AS (
      SELECT 'R360' AS product, 'medium' AS dimension, utm_medium AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM r360_raw GROUP BY utm_medium
    ),
    -- R360 by campaign (with name + spend lookup)
    r360_by_campaign AS (
      SELECT 'R360' AS product, 'campaign' AS dimension,
        COALESCE(c.campaign_name, r.utm_campaign) AS value,
        SUM(r.mql_count) AS mql_count, SUM(r.sql_count) AS sql_count,
        SUM(r.sal_count) AS sal_count, SUM(r.sqo_count) AS sqo_count,
        MAX(sp.ad_spend_usd) AS ad_spend_usd,
        MAX(sp.clicks) AS clicks,
        MAX(sp.impressions) AS impressions,
        MAX(sp.conversions) AS conversions
      FROM (
        SELECT utm_campaign,
          COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
        FROM r360_raw WHERE utm_campaign != 'none' GROUP BY utm_campaign
      ) r
      LEFT JOIN r360_campaign_names c
        ON SAFE_CAST(r.utm_campaign AS INT64) = c.campaign_id
        OR LOWER(r.utm_campaign) = LOWER(c.campaign_name)
      LEFT JOIN r360_campaign_spend sp ON c.campaign_id = sp.campaign_id
      GROUP BY value
    ),
    -- R360 by keyword
    r360_by_keyword AS (
      SELECT 'R360' AS product, 'keyword' AS dimension, utm_keyword AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM r360_raw WHERE utm_keyword != 'none' GROUP BY utm_keyword
    ),
    -- POR branded vs non-branded (keyword classification)
    por_by_branded AS (
      SELECT 'POR' AS product, 'branded' AS dimension,
        CASE
          WHEN LOWER(utm_keyword) IN ('none', 'organic') THEN 'Untracked/Organic'
          WHEN REGEXP_CONTAINS(LOWER(utm_keyword), r'point of rental|pointofrental|por |por$|point rental')
            THEN 'Branded'
          ELSE 'Non-Branded'
        END AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM por_raw
      GROUP BY value
    ),
    -- R360 branded vs non-branded
    r360_by_branded AS (
      SELECT 'R360' AS product, 'branded' AS dimension,
        CASE
          WHEN LOWER(utm_keyword) IN ('none', 'organic') THEN 'Untracked/Organic'
          WHEN REGEXP_CONTAINS(LOWER(utm_keyword), r'record360|record 360|r360|record360\.com')
            THEN 'Branded'
          ELSE 'Non-Branded'
        END AS value,
        COUNT(*) AS mql_count, SUM(has_sql) AS sql_count, SUM(has_sal) AS sal_count, SUM(has_sqo) AS sqo_count
      FROM r360_raw
      GROUP BY value
    )
    SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64) AS ad_spend_usd, CAST(NULL AS INT64) AS clicks,
      CAST(NULL AS INT64) AS impressions, CAST(NULL AS INT64) AS conversions
    FROM por_by_source
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM por_by_medium
    UNION ALL SELECT * FROM por_by_campaign
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM por_by_keyword
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM por_by_branded
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM r360_by_source
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM r360_by_medium
    UNION ALL SELECT * FROM r360_by_campaign
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM r360_by_keyword
    UNION ALL SELECT product, dimension, value, mql_count, sql_count, sal_count, sqo_count,
      CAST(NULL AS FLOAT64), CAST(NULL AS INT64), CAST(NULL AS INT64), CAST(NULL AS INT64)
    FROM r360_by_branded
    ORDER BY product, dimension, mql_count DESC
  `;

  try {
    const bigquery = getBigQuery();
    const [rows] = await bigquery.query({ query });

    const result: {
      POR: { by_source: any[]; by_medium: any[]; by_campaign: any[]; by_keyword: any[]; by_branded: any[] };
      R360: { by_source: any[]; by_medium: any[]; by_campaign: any[]; by_keyword: any[]; by_branded: any[] };
    } = {
      POR: { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] },
      R360: { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] },
    };

    for (const row of rows) {
      const mql = parseInt(row.mql_count) || 0;
      const sql = parseInt(row.sql_count) || 0;
      const sqo = parseInt(row.sqo_count) || 0;
      const spend = parseFloat(row.ad_spend_usd) || 0;
      const item: any = {
        name: row.value,
        mql_count: mql,
        sql_count: sql,
        sal_count: parseInt(row.sal_count) || 0,
        sqo_count: sqo,
        mql_to_sql_pct: mql > 0 ? Math.round((sql / mql) * 100) : 0,
        mql_to_sqo_pct: mql > 0 ? Math.round((sqo / mql) * 100) : 0,
      };
      // Add spend metrics for campaign dimension
      if (row.dimension === 'campaign' && spend > 0) {
        item.ad_spend_usd = spend;
        item.clicks = parseInt(row.clicks) || 0;
        item.impressions = parseInt(row.impressions) || 0;
        item.conversions = parseInt(row.conversions) || 0;
        item.cost_per_mql = mql > 0 ? Math.round((spend / mql) * 100) / 100 : 0;
        item.cost_per_sql = sql > 0 ? Math.round((spend / sql) * 100) / 100 : 0;
        item.cost_per_sqo = sqo > 0 ? Math.round((spend / sqo) * 100) / 100 : 0;
      }
      const product = row.product as 'POR' | 'R360';
      const dimKey = `by_${row.dimension}` as keyof typeof result.POR;
      if (result[product] && result[product][dimKey]) {
        result[product][dimKey].push(item);
      }
    }

    // Sort each array by mql_count desc and limit to top 15
    for (const product of ['POR', 'R360'] as const) {
      for (const dim of ['by_source', 'by_medium', 'by_campaign', 'by_keyword', 'by_branded'] as const) {
        result[product][dim] = result[product][dim]
          .sort((a, b) => b.mql_count - a.mql_count)
          .slice(0, 15);
      }
    }

    return result;
  } catch (error: any) {
    console.error('UTM breakdown query error:', error.message);
    return {
      POR: { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] },
      R360: { by_source: [], by_medium: [], by_campaign: [], by_keyword: [], by_branded: [] },
    };
  }
}

// Query for Google Ads data
async function getGoogleAds(filters: ReportFilters) {
  const query = `
    WITH por_campaigns AS (
      SELECT campaign_id, campaign_name
      FROM (
        SELECT campaign_id, campaign_name,
               ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY _DATA_DATE DESC) AS rn
        FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_POR}.ads_Campaign_8275359090\`
      )
      WHERE rn = 1
    ),
    por_ads AS (
      SELECT
        'POR' AS product,
        CASE
          WHEN UPPER(c.campaign_name) LIKE 'US %' OR UPPER(c.campaign_name) LIKE '%_NA' OR UPPER(c.campaign_name) LIKE '%_NA_%' THEN 'AMER'
          WHEN UPPER(c.campaign_name) LIKE 'UK %' OR UPPER(c.campaign_name) LIKE '%_UK' OR UPPER(c.campaign_name) LIKE '%_UK_%' THEN 'EMEA'
          WHEN UPPER(c.campaign_name) LIKE 'AU %' OR UPPER(c.campaign_name) LIKE '%_AUS' OR UPPER(c.campaign_name) LIKE '%_AUS_%' OR UPPER(c.campaign_name) LIKE '%_AU_%' THEN 'APAC'
          ELSE 'AMER'
        END AS region,
        SUM(s.metrics_impressions) AS impressions,
        SUM(s.metrics_clicks) AS clicks,
        ROUND(SUM(s.metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
        SUM(s.metrics_conversions) AS conversions
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_POR}.ads_CampaignBasicStats_8275359090\` s
      JOIN por_campaigns c ON s.campaign_id = c.campaign_id
      WHERE s.segments_date >= '${filters.startDate}'
        AND s.segments_date <= '${filters.endDate}'
        AND s.segments_ad_network_type = 'SEARCH'
      GROUP BY product, region
    ),
    r360_campaigns AS (
      SELECT campaign_id, campaign_name
      FROM (
        SELECT campaign_id, campaign_name,
               ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY _DATA_DATE DESC) AS rn
        FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_R360}.ads_Campaign_3799591491\`
      )
      WHERE rn = 1
    ),
    r360_ads AS (
      SELECT
        'R360' AS product,
        CASE
          WHEN UPPER(c.campaign_name) LIKE 'US %' OR UPPER(c.campaign_name) LIKE '%_NA' OR UPPER(c.campaign_name) LIKE '%_NA_%' THEN 'AMER'
          WHEN UPPER(c.campaign_name) LIKE 'UK %' OR UPPER(c.campaign_name) LIKE '%_UK' OR UPPER(c.campaign_name) LIKE '%_UK_%' THEN 'EMEA'
          WHEN UPPER(c.campaign_name) LIKE 'AU %' OR UPPER(c.campaign_name) LIKE '%_AUS' OR UPPER(c.campaign_name) LIKE '%_AUS_%' OR UPPER(c.campaign_name) LIKE '%_AU_%' THEN 'APAC'
          ELSE 'AMER'
        END AS region,
        SUM(s.metrics_impressions) AS impressions,
        SUM(s.metrics_clicks) AS clicks,
        ROUND(SUM(s.metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
        SUM(s.metrics_conversions) AS conversions
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.GOOGLE_ADS_R360}.ads_CampaignBasicStats_3799591491\` s
      JOIN r360_campaigns c ON s.campaign_id = c.campaign_id
      WHERE s.segments_date >= '${filters.startDate}'
        AND s.segments_date <= '${filters.endDate}'
        AND s.segments_ad_network_type = 'SEARCH'
      GROUP BY product, region
    ),
    combined AS (
      SELECT * FROM por_ads
      UNION ALL
      SELECT * FROM r360_ads
    )
    SELECT
      product,
      region,
      impressions,
      clicks,
      ROUND(SAFE_DIVIDE(clicks, NULLIF(impressions, 0)) * 100, 2) AS ctr_pct,
      ad_spend_usd,
      ROUND(SAFE_DIVIDE(ad_spend_usd, NULLIF(clicks, 0)), 2) AS cpc_usd,
      conversions,
      ROUND(SAFE_DIVIDE(ad_spend_usd, NULLIF(conversions, 0)), 2) AS cpa_usd
    FROM combined
    ORDER BY product, region
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    return rows;
  } catch (error) {
    console.warn('Google Ads query failed, returning empty:', error);
    return [];
  }
}

// Calculate period info
function calculatePeriodInfo(startDate: string, endDate: string) {
  const quarterStart = new Date('2026-01-01');
  const quarterEnd = new Date('2026-03-31');
  const end = new Date(endDate);

  const daysElapsed = Math.ceil((end.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const totalDays = 90;
  const daysRemaining = totalDays - daysElapsed;
  const quarterPctComplete = Math.round((daysElapsed / totalDays) * 1000) / 10;

  return {
    quarter_start: '2026-01-01',
    as_of_date: endDate,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    total_days: totalDays,
    quarter_pct_complete: quarterPctComplete,
  };
}

// Calculate RAG status
function calculateRAG(attainmentPct: number): RAGStatus {
  return getRAGStatus(attainmentPct);
}

// Main handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { startDate, endDate, products = [], regions = [], riskProfile = 'P90' } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const validProfiles = ['P50', 'P75', 'P90'];
    const safeRiskProfile = validProfiles.includes(riskProfile) ? riskProfile : 'P90';

    const filters: ReportFilters = { startDate, endDate, products, regions, riskProfile: safeRiskProfile };

    // Execute all BigQuery queries in parallel
    const [
      revOpsData,
      revenueActuals,
      _porFunnelDeprecated,
      _r360FunnelDeprecated,
      revOpsPerformance,
      wonDeals,
      lostDeals,
      pipelineDeals,
      googleAds,
      sourceActualsRaw,
      pipelineAgeData,
      lossReasonData,
      mqlDetailsData,
      sqlDetailsData,
      salDetailsData,
      sqoDetailsData,
      renewalUpliftMap,
      renewalTargetsMap,
      fyTargetsMap,
      utmBreakdownData,
      expMigUniqueCounts,
      expMigSourceCounts,
      inboundUniqueCounts,
      inboundSourceCounts,
    ] = await Promise.all([
      getRevOpsQTDData(filters),
      getRevenueActuals(filters),
      Promise.resolve([]), // porFunnel — deprecated: DailyRevenueFunnel values flow via RevOpsPerformance
      Promise.resolve([]), // r360Funnel — deprecated: DailyRevenueFunnel values flow via RevOpsPerformance
      getRevOpsPerformanceData(filters),
      getWonDeals(filters),
      getLostDeals(filters),
      getPipelineDeals(filters),
      getGoogleAds(filters),
      Promise.resolve([]), // sourceActuals now derived from perfPeriod
      getPipelineAge(filters),
      getLossReasonRCA(filters),
      getMQLDetails(filters),
      getSQLDetails(filters),
      getSALDetails(filters),
      getSQODetails(filters),
      getUpcomingRenewalUplift(),
      getRenewalTargetsFromRawPlan(filters.riskProfile),
      getFYTargetsFromPlan(),
      getUtmBreakdown(filters),
      getExpMigUniqueOppCounts(filters),
      getExpMigSourceCounts(filters),
      getInboundUniqueCounts(filters),
      getInboundSourceCounts(filters),
    ]);

    // Calculate period info
    const periodInfo = calculatePeriodInfo(startDate, endDate);

    // Build target map from RevOpsReport data (P90 targets)
    // IMPORTANT: Sum targets for duplicate product-region-category combinations
    // RevOpsReport may have multiple rows per segment (e.g., different Segments within same OpportunityType)
    const revOpsTargetMap = new Map<string, any>();
    for (const row of revOpsData) {
      const key = `${row.product}-${row.region}-${row.category}`;
      if (revOpsTargetMap.has(key)) {
        // Sum the targets for duplicate keys
        const existing = revOpsTargetMap.get(key);
        existing.q1_target = (parseFloat(existing.q1_target) || 0) + (parseFloat(row.q1_target) || 0);
        existing.qtd_actual = (parseFloat(existing.qtd_actual) || 0) + (parseFloat(row.qtd_actual) || 0);
        // Sum funnel metrics too
        existing.target_mql = (parseInt(existing.target_mql) || 0) + (parseInt(row.target_mql) || 0);
        existing.actual_mql = (parseInt(existing.actual_mql) || 0) + (parseInt(row.actual_mql) || 0);
        existing.target_sql = (parseInt(existing.target_sql) || 0) + (parseInt(row.target_sql) || 0);
        existing.actual_sql = (parseInt(existing.actual_sql) || 0) + (parseInt(row.actual_sql) || 0);
        existing.target_sal = (parseInt(existing.target_sal) || 0) + (parseInt(row.target_sal) || 0);
        existing.actual_sal = (parseInt(existing.actual_sal) || 0) + (parseInt(row.actual_sal) || 0);
        existing.target_sqo = (parseInt(existing.target_sqo) || 0) + (parseInt(row.target_sqo) || 0);
        existing.actual_sqo = (parseInt(existing.actual_sqo) || 0) + (parseInt(row.actual_sqo) || 0);
        existing.target_won = (parseInt(existing.target_won) || 0) + (parseInt(row.target_won) || 0);
        existing.actual_won = (parseInt(existing.actual_won) || 0) + (parseInt(row.actual_won) || 0);
      } else {
        revOpsTargetMap.set(key, { ...row });
      }
    }

    // CRITICAL: Ensure RENEWAL targets are present from RevOpsReport (P90)
    // This ensures renewal targets are included even if RevOpsReport main query missed them
    for (const [key, correctTarget] of Array.from(renewalTargetsMap.entries())) {
      if (revOpsTargetMap.has(key)) {
        const existingRow = revOpsTargetMap.get(key);
        const oldTarget = existingRow.q1_target;
        existingRow.q1_target = correctTarget;
        console.log(`RENEWAL target override: ${key} = $${correctTarget} (was $${oldTarget} from RevOpsReport)`);
      } else {
        // Create a new entry for renewals not in RevOpsReport
        const [product, region] = key.split('-');
        revOpsTargetMap.set(key, {
          product,
          region,
          category: 'RENEWAL',
          opportunity_type: 'Renewal',
          q1_target: correctTarget,
          qtd_actual: 0,
          attainment_pct: 0,
          target_mql: 0, actual_mql: 0,
          target_sql: 0, actual_sql: 0,
          target_sal: 0, actual_sal: 0,
          target_sqo: 0, actual_sqo: 0,
          target_won: 0, actual_won: 0,
          mql_to_sql_leakage: 0,
          sql_to_sal_leakage: 0,
          sal_to_sqo_leakage: 0,
          risk_profile: filters.riskProfile,
        });
        console.log(`RENEWAL target added: ${key} = $${correctTarget}`);
      }
    }

    // Group revenue by product/region/category from won deals
    const revenueMap = new Map<string, any>();
    for (const r of revenueActuals as any[]) {
      const key = `${r.product}-${r.region}-${r.category}`;
      if (revenueMap.has(key)) {
        const existing = revenueMap.get(key)!;
        existing.deal_count += parseInt(r.deal_count);
        existing.total_acv += parseFloat(r.total_acv);
      } else {
        revenueMap.set(key, {
          ...r,
          deal_count: parseInt(r.deal_count),
          total_acv: parseFloat(r.total_acv),
        });
      }
    }

    // Group pipeline deals by segment
    const pipelineMap = new Map<string, { acv: number; count: number }>();
    for (const deal of pipelineDeals as any[]) {
      const key = `${deal.product}-${deal.region}-${deal.category}`;
      const existing = pipelineMap.get(key) || { acv: 0, count: 0 };
      pipelineMap.set(key, {
        acv: existing.acv + (parseFloat(deal.acv) || 0),
        count: existing.count + 1,
      });
    }

    // Group lost deals by segment
    const lostMap = new Map<string, { acv: number; count: number }>();
    for (const deal of lostDeals as any[]) {
      const key = `${deal.product}-${deal.region}-${deal.category}`;
      const existing = lostMap.get(key) || { acv: 0, count: 0 };
      lostMap.set(key, {
        acv: existing.acv + (parseFloat(deal.acv) || 0),
        count: existing.count + 1,
      });
    }

    // Build attainment detail from RevOpsReport P90 targets
    const attainmentDetail: any[] = [];

    for (const [key, target] of Array.from(revOpsTargetMap.entries())) {
      const actual = revenueMap.get(key);
      const pipeline = pipelineMap.get(key) || { acv: 0, count: 0 };
      const lost = lostMap.get(key) || { acv: 0, count: 0 };

      const wonAcv = actual ? actual.total_acv : 0;
      const qtdDeals = actual ? actual.deal_count : 0;
      const q1Target = parseFloat(target.q1_target) || 0;

      // For RENEWAL category: calculate forecast including expected uplift (for RAG status)
      // CRITICAL: qtdAcv should only show ACTUAL closed deals, not expected uplift
      let qtdAcv = wonAcv;
      let q1Forecast = wonAcv; // Projected Q1 total (for RAG calculation)
      let renewalUplift = 0; // Track uplift separately for display
      if (target.category === 'RENEWAL') {
        const upliftKey = `${target.product}-${target.region}-RENEWAL`;
        renewalUplift = renewalUpliftMap.get(upliftKey) || 0;
        // DO NOT add uplift to qtdAcv - that's expected, not actual
        // Only forecast includes uplift for RAG calculation
        q1Forecast = wonAcv + renewalUplift;
        console.log(`RENEWAL ${target.product}-${target.region}: Won=${wonAcv}, Uplift=${renewalUplift}, Forecasted=${q1Forecast}, Q1Target=${q1Target}`);
      }

      // Calculate QTD target based on period progress
      const qtdTarget = q1Target * (periodInfo.quarter_pct_complete / 100);

      // Always calculate attainment from actual QTD ACV vs QTD target
      // (Don't use RevOpsReport's Revenue_Pacing_Score as it uses different actuals)
      // Logic: target=0 AND actual=0 → 100% (met the zero target), target=0 AND actual>0 → 100%
      // All percentages are rounded to whole numbers for display consistency
      const attainmentPct = qtdTarget > 0
        ? Math.round((qtdAcv / qtdTarget) * 100)
        : 100; // If no target, you've met or exceeded it

      // For RENEWAL: calculate projected Q1 attainment for RAG status
      // (Renewals include expected uplift, so RAG should be based on projected outcome vs Q1 target)
      const ragAttainmentPct = target.category === 'RENEWAL'
        ? (q1Target > 0 ? Math.round((q1Forecast / q1Target) * 100) : 100)
        : attainmentPct;

      // Gap is difference between actual and target
      // For RENEWAL: use Q1 forecast vs Q1 target (consistent with attainment %)
      // For others: use QTD actual vs QTD target
      // If target is $0, gap is $0 (no gap to measure against)
      let gap: number;
      if (target.category === 'RENEWAL') {
        gap = q1Target > 0 ? q1Forecast - q1Target : 0;
      } else {
        gap = qtdTarget > 0 ? qtdAcv - qtdTarget : 0;
      }
      const progressPct = q1Target > 0 ? Math.round((qtdAcv / q1Target) * 1000) / 10 : 0;
      // Get FY target from RAW_2026_Plan_by_Month (actual plan values)
      // Fall back to Q1 * 4 if not found (should not happen with proper data)
      const fyTargetKey = `${target.product}-${target.region}-${target.category}`;
      const fyTarget = fyTargetsMap.get(fyTargetKey) || (q1Target * 4);
      const fyProgressPct = fyTarget > 0 ? Math.round((qtdAcv / fyTarget) * 1000) / 10 : 0;

      // Calculate pipeline coverage (pipeline / remaining gap to Q1)
      // For RENEWAL: use wonAcv only (not including uplift) because uplift represents expected
      // pipeline close - including it would double-count and artificially inflate coverage
      const remainingGapBase = target.category === 'RENEWAL' ? wonAcv : qtdAcv;
      const remainingGap = Math.max(0, q1Target - remainingGapBase);
      // If no remaining gap (target hit or no target), coverage is 0 (not needed)
      const pipelineCoverage = remainingGap > 0 ? pipeline.acv / remainingGap : 0;

      // Calculate win rate (won deals / (won + lost))
      const totalClosed = qtdDeals + lost.count;
      const winRate = totalClosed > 0 ? Math.round((qtdDeals / totalClosed) * 1000) / 10 : 0;

      attainmentDetail.push({
        product: target.product,
        region: target.region,
        category: target.category,
        fy_target: fyTarget,
        q1_target: q1Target,
        // QTD target is always prorated (qtd_acv now shows only actual closed deals)
        qtd_target: Math.round(qtdTarget * 100) / 100,
        qtd_deals: qtdDeals,
        qtd_acv: qtdAcv, // ACTUAL closed deals only (not including expected uplift)
        // For RENEWAL: attainment is based on forecast vs Q1 target (since renewals come in lumps)
        // This provides meaningful attainment metric for planning purposes
        qtd_attainment_pct: target.category === 'RENEWAL' ? ragAttainmentPct : attainmentPct,
        // Include renewal-specific fields for transparency
        renewal_uplift: renewalUplift, // Expected uplift from expiring contracts
        q1_forecast: target.category === 'RENEWAL' ? Math.round(q1Forecast * 100) / 100 : undefined, // Won + expected uplift
        q1_progress_pct: progressPct,
        fy_progress_pct: fyProgressPct,
        qtd_gap: Math.round(gap * 100) / 100,
        pipeline_acv: pipeline.acv,
        pipeline_coverage_x: Math.round(pipelineCoverage * 10) / 10,
        win_rate_pct: winRate,
        qtd_lost_deals: lost.count,
        qtd_lost_acv: lost.acv,
        rag_status: calculateRAG(ragAttainmentPct),
        // Include funnel metrics from RevOpsReport
        target_mql: parseInt(target.target_mql) || 0,
        actual_mql: parseInt(target.actual_mql) || 0,
        target_sql: parseInt(target.target_sql) || 0,
        actual_sql: parseInt(target.actual_sql) || 0,
        target_sal: parseInt(target.target_sal) || 0,
        actual_sal: parseInt(target.actual_sal) || 0,
        target_sqo: parseInt(target.target_sqo) || 0,
        actual_sqo: parseInt(target.actual_sqo) || 0,
        target_won: parseInt(target.target_won) || 0,
        actual_won: parseInt(target.actual_won) || 0,
        // Leakage metrics
        mql_to_sql_leakage: parseFloat(target.mql_to_sql_leakage) || 0,
        sql_to_sal_leakage: parseFloat(target.sql_to_sal_leakage) || 0,
        sal_to_sqo_leakage: parseFloat(target.sal_to_sqo_leakage) || 0,
        risk_profile: target.risk_profile || filters.riskProfile,
      });
    }

    // Calculate grand total
    const totalPipelineAcv = attainmentDetail.reduce((sum, a) => sum + (a.pipeline_acv || 0), 0);
    const totalFyTarget = attainmentDetail.reduce((sum, a) => sum + a.fy_target, 0);
    const totalQ1Target = attainmentDetail.reduce((sum, a) => sum + a.q1_target, 0);
    const totalQtdTarget = attainmentDetail.reduce((sum, a) => sum + a.qtd_target, 0);
    const totalQtdAcv = attainmentDetail.reduce((sum, a) => sum + a.qtd_acv, 0);
    const totalWonDeals = attainmentDetail.reduce((sum, a) => sum + a.qtd_deals, 0);
    const totalLostDeals = attainmentDetail.reduce((sum, a) => sum + (a.qtd_lost_deals || 0), 0);
    const totalRemainingGap = Math.max(0, totalQ1Target - totalQtdAcv);

    const grandTotal = {
      product: 'ALL',
      total_fy_target: totalFyTarget,
      total_q1_target: totalQ1Target,
      total_qtd_target: totalQtdTarget,
      total_qtd_deals: totalWonDeals,
      total_qtd_acv: totalQtdAcv,
      // Logic: target=0 means 100% attainment. Rounded for display.
      total_qtd_attainment_pct: totalQtdTarget > 0
        ? Math.round((totalQtdAcv / totalQtdTarget) * 100)
        : 100,
      total_q1_progress_pct: totalQ1Target > 0
        ? Math.round((totalQtdAcv / totalQ1Target) * 100)
        : 100,
      total_fy_progress_pct: totalFyTarget > 0
        ? Math.round((totalQtdAcv / totalFyTarget) * 100)
        : 100,
      total_qtd_gap: totalQtdAcv - totalQtdTarget,
      total_pipeline_acv: totalPipelineAcv,
      total_pipeline_coverage_x: totalRemainingGap > 0 ? Math.round((totalPipelineAcv / totalRemainingGap) * 10) / 10 : 0,
      total_win_rate_pct: (totalWonDeals + totalLostDeals) > 0
        ? Math.round((totalWonDeals / (totalWonDeals + totalLostDeals)) * 1000) / 10
        : 0,
      total_won_deals: totalWonDeals,
      total_lost_deals: totalLostDeals,
      risk_profile: filters.riskProfile,
    };

    // Calculate product totals
    const productTotals: Record<string, any> = {};
    for (const product of ['POR', 'R360']) {
      const productDetails = attainmentDetail.filter(a => a.product === product);
      if (productDetails.length > 0) {
        const prodPipelineAcv = productDetails.reduce((sum, a) => sum + (a.pipeline_acv || 0), 0);
        const prodFyTarget = productDetails.reduce((sum, a) => sum + a.fy_target, 0);
        const prodQ1Target = productDetails.reduce((sum, a) => sum + a.q1_target, 0);
        const prodQtdTarget = productDetails.reduce((sum, a) => sum + a.qtd_target, 0);
        const prodQtdAcv = productDetails.reduce((sum, a) => sum + a.qtd_acv, 0);
        const prodWonDeals = productDetails.reduce((sum, a) => sum + a.qtd_deals, 0);
        const prodLostDeals = productDetails.reduce((sum, a) => sum + (a.qtd_lost_deals || 0), 0);
        const prodLostAcv = productDetails.reduce((sum, a) => sum + (a.qtd_lost_acv || 0), 0);
        const prodRemainingGap = Math.max(0, prodQ1Target - prodQtdAcv);

        productTotals[product] = {
          product,
          total_fy_target: prodFyTarget,
          total_q1_target: prodQ1Target,
          total_qtd_target: prodQtdTarget,
          total_qtd_deals: prodWonDeals,
          total_qtd_acv: prodQtdAcv,
          // Logic: target=0 means 100% attainment. Rounded for display.
          total_qtd_attainment_pct: prodQtdTarget > 0
            ? Math.round((prodQtdAcv / prodQtdTarget) * 100)
            : 100,
          total_fy_progress_pct: prodFyTarget > 0
            ? Math.round((prodQtdAcv / prodFyTarget) * 100)
            : 100,
          total_qtd_gap: prodQtdAcv - prodQtdTarget,
          total_pipeline_acv: prodPipelineAcv,
          total_pipeline_coverage_x: prodRemainingGap > 0 ? Math.round((prodPipelineAcv / prodRemainingGap) * 10) / 10 : 0,
          total_win_rate_pct: (prodWonDeals + prodLostDeals) > 0
            ? Math.round((prodWonDeals / (prodWonDeals + prodLostDeals)) * 1000) / 10
            : 0,
          total_won_deals: prodWonDeals,
          total_lost_deals: prodLostDeals,
          total_lost_acv: prodLostAcv,
          risk_profile: filters.riskProfile,
        };
      }
    }

    // Build funnel pacing from RevOpsReport data for ALL categories
    // NEW LOGO uses MQL, EXPANSION/MIGRATION use EQL (stored as MQL in RevOpsReport)
    const funnelPacing: any[] = [];

    // Build funnel targets and actuals from RevOpsPerformance
    // Key: product-region-category
    // Actuals and period targets come directly from RevOpsPerformance (no override logic needed)
    const perfPeriod = (revOpsPerformance as { period: any[]; q1: any[] }).period;
    const perfQ1 = (revOpsPerformance as { period: any[]; q1: any[] }).q1;

    const funnelDataMap = new Map<string, {
      q1_target_mql: number;
      q1_target_sql: number;
      q1_target_sal: number;
      q1_target_sqo: number;
      period_target_mql: number;
      period_target_sql: number;
      period_target_sal: number;
      period_target_sqo: number;
      actual_mql: number;
      actual_sql: number;
      actual_sal: number;
      actual_sqo: number;
    }>();

    const funnelCategories = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'];

    // Sum period actuals + targets by (product, region, category)
    // For NEW LOGO/STRATEGIC: only include INBOUND source actuals.
    // DailyRevenueFunnel tracks "Inbound" and "New Logo" (outbound) as separate funnels.
    // The category view shows the Inbound funnel flow (MQL→SQL→SAL→SQO).
    // Outbound records (OUTBOUND, AE SOURCED, TRADESHOW) appear in the source view only.
    // For EXPANSION/MIGRATION: include all sources (they represent a single funnel).
    for (const row of perfPeriod) {
      if (!row.category || !funnelCategories.includes(row.category)) continue;

      const isNewLogoCategory = row.category === 'NEW LOGO' || row.category === 'STRATEGIC';
      const isInboundSource = row.source === 'INBOUND';

      // For NEW LOGO/STRATEGIC actuals: only count INBOUND source.
      // DailyRevenueFunnel tracks "Inbound" (MQL→SQL→SAL→SQO) and "New Logo" (outbound SQL→SQO)
      // as separate funnels. The category view shows the Inbound funnel flow.
      // Outbound records appear in the source view only.
      // STRATEGIC has its own tab and actuals — no longer merged into NEW LOGO.
      const actualsKey = `${row.product}-${row.region}-${row.category}`;
      const targetsKey = `${row.product}-${row.region}-${row.category}`;

      // Ensure both keys exist
      for (const k of [actualsKey, targetsKey]) {
        if (!funnelDataMap.has(k)) {
          funnelDataMap.set(k, {
            q1_target_mql: 0, q1_target_sql: 0, q1_target_sal: 0, q1_target_sqo: 0,
            period_target_mql: 0, period_target_sql: 0, period_target_sal: 0, period_target_sqo: 0,
            actual_mql: 0, actual_sql: 0, actual_sal: 0, actual_sqo: 0,
          });
        }
      }

      // Actuals: SQL/SAL/SQO always from all sources. MQL: INBOUND-only for NEW LOGO/STRATEGIC.
      // Leads enter through INBOUND (MQL) but convert through OUTBOUND/AE SOURCED/TRADESHOW paths.
      // Targets include all sources, so actuals must too for SQL/SAL/SQO to avoid false 0% pacing.
      {
        const actualsEntry = funnelDataMap.get(actualsKey)!;
        // MQL: INBOUND-only for NEW LOGO (separate funnel paths); all sources for EXPANSION/MIGRATION
        if (!isNewLogoCategory || isInboundSource) {
          actualsEntry.actual_mql += parseInt(row.actual_mql) || 0;
        }
        // SQL/SAL/SQO: always include all sources (conversions span all source attributions)
        actualsEntry.actual_sql += parseInt(row.actual_sql) || 0;
        actualsEntry.actual_sal += parseInt(row.actual_sal) || 0;
        actualsEntry.actual_sqo += parseInt(row.actual_sqo) || 0;
      }

      const existing = funnelDataMap.get(targetsKey)!;

      // Targets: always sum all sources
      existing.period_target_mql += parseFloat(row.target_mql) || 0;
      existing.period_target_sql += parseFloat(row.target_sql) || 0;
      existing.period_target_sal += parseFloat(row.target_sal) || 0;
      existing.period_target_sqo += parseFloat(row.target_sqo) || 0;
    }

    // Add Q1 full targets by (product, region, category)
    for (const row of perfQ1) {
      if (!row.category || !funnelCategories.includes(row.category)) continue;
      const key = `${row.product}-${row.region}-${row.category}`;
      if (!funnelDataMap.has(key)) {
        funnelDataMap.set(key, {
          q1_target_mql: 0, q1_target_sql: 0, q1_target_sal: 0, q1_target_sqo: 0,
          period_target_mql: 0, period_target_sql: 0, period_target_sal: 0, period_target_sqo: 0,
          actual_mql: 0, actual_sql: 0, actual_sal: 0, actual_sqo: 0,
        });
      }
      const existing = funnelDataMap.get(key)!;
      existing.q1_target_mql += parseInt(row.q1_target_mql) || 0;
      existing.q1_target_sql += parseInt(row.q1_target_sql) || 0;
      existing.q1_target_sal += parseInt(row.q1_target_sal) || 0;
      existing.q1_target_sqo += parseInt(row.q1_target_sqo) || 0;
    }

    // Override EXPANSION/MIGRATION actuals with unique-opp counts from DailyRevenueFunnel.
    // RevOpsPerformance uses SUM(MQL/SQL/SAL/SQO) from DRF = person-days (inflated for daily snapshots).
    // getExpMigUniqueOppCounts uses COUNT(DISTINCT OpportunityID) = unique opportunities (correct).
    for (const [key, counts] of Array.from((expMigUniqueCounts as Map<string, { mql: number; sql: number; sal: number; sqo: number }>).entries())) {
      const existing = funnelDataMap.get(key);
      if (existing) {
        existing.actual_mql = counts.mql;
        existing.actual_sql = counts.sql;
        existing.actual_sal = counts.sal;
        existing.actual_sqo = counts.sqo;
      }
    }

    // Override NEW LOGO (INBOUND) MQL actuals with unique-lead counts from DailyRevenueFunnel.
    // RevOpsPerformance uses SUM(Actual_MQL) = person-days (can inflate from daily snapshots).
    // getInboundUniqueCounts uses COUNT(DISTINCT LeadID/ContactID) = unique leads (correct).
    // Only override MQL — SQL/SAL/SQO for NEW LOGO come from RevOpsPerformance (correct source).
    // DRF INBOUND FunnelType only tracks MQL stage; later stages use different data paths.
    for (const [key, counts] of Array.from((inboundUniqueCounts as Map<string, { mql: number; sql: number; sal: number; sqo: number }>).entries())) {
      const newLogoKey = `${key}-NEW LOGO`;
      const existing = funnelDataMap.get(newLogoKey);
      if (existing) {
        existing.actual_mql = counts.mql;
      }
    }

    // Subtract STRATEGIC actuals from NEW LOGO to avoid double-counting.
    // getInboundUniqueCounts counts ALL INBOUND leads (includes STRATEGIC).
    // STRATEGIC gets its own actuals from RevOpsPerformance above.
    for (const [key, counts] of Array.from((inboundUniqueCounts as Map<string, { mql: number; sql: number; sal: number; sqo: number }>).entries())) {
      const newLogoEntry = funnelDataMap.get(`${key}-NEW LOGO`);
      const strategicEntry = funnelDataMap.get(`${key}-STRATEGIC`);
      if (newLogoEntry && strategicEntry) {
        newLogoEntry.actual_mql = Math.max(0, newLogoEntry.actual_mql - strategicEntry.actual_mql);
      }
    }

    // Build funnel pacing array for all categories
    for (const [key, data] of Array.from(funnelDataMap.entries())) {
      const [product, region, category] = key.split('-');

      // Skip if no meaningful targets
      if (data.q1_target_mql === 0 && data.q1_target_sql === 0 && data.q1_target_sqo === 0) continue;

      // Period targets from date-range sum (seasonal distribution, no linear proration)
      const qtdTargetMql = Math.round(data.period_target_mql);
      const qtdTargetSql = Math.round(data.period_target_sql);
      const qtdTargetSal = Math.round(data.period_target_sal);
      const qtdTargetSqo = Math.round(data.period_target_sqo);

      // Calculate pacing against prorated QTD targets
      // Logic: target=0 means 100% pacing (met zero target). Rounded for display.
      const mqlPacing = qtdTargetMql > 0 ? Math.round((data.actual_mql / qtdTargetMql) * 100) : 100;
      const sqlPacing = qtdTargetSql > 0 ? Math.round((data.actual_sql / qtdTargetSql) * 100) : 100;
      const salPacing = qtdTargetSal > 0 ? Math.round((data.actual_sal / qtdTargetSal) * 100) : null; // SAL can be null if no target
      const sqoPacing = qtdTargetSqo > 0 ? Math.round((data.actual_sqo / qtdTargetSqo) * 100) : 100;

      // Calculate TOF Score: exclude stages with zero targets, redistribute weights
      const isR360Product = product === 'R360';
      const activeStages: { pct: number; weight: number }[] = [];
      const baseMqlWeight = isR360Product ? 0.143 : 0.10;
      const baseSqlWeight = isR360Product ? 0.286 : 0.20;
      const baseSalWeight = isR360Product ? 0 : 0.30;
      const baseSqoWeight = isR360Product ? 0.571 : 0.40;

      if (data.q1_target_mql > 0) activeStages.push({ pct: mqlPacing || 0, weight: baseMqlWeight });
      if (data.q1_target_sql > 0) activeStages.push({ pct: sqlPacing || 0, weight: baseSqlWeight });
      if (data.q1_target_sal > 0 && !isR360Product) activeStages.push({ pct: salPacing || 0, weight: baseSalWeight });
      if (data.q1_target_sqo > 0) activeStages.push({ pct: sqoPacing || 0, weight: baseSqoWeight });

      const totalActiveWeight = activeStages.reduce((sum, s) => sum + s.weight, 0);
      const tofScore = totalActiveWeight > 0
        ? Math.round(activeStages.reduce((sum, s) => sum + s.pct * (s.weight / totalActiveWeight), 0))
        : 0;

      // Label: EQL for EXPANSION/MIGRATION, MQL for NEW LOGO/STRATEGIC
      const leadStageLabel = (category === 'NEW LOGO' || category === 'STRATEGIC') ? 'MQL' : 'EQL';

      funnelPacing.push({
        product,
        region,
        category,
        lead_stage_label: leadStageLabel,
        tof_score: tofScore,
        tof_rag: calculateRAG(tofScore),
        actual_mql: data.actual_mql,
        q1_target_mql: data.q1_target_mql,
        target_mql: qtdTargetMql,
        mql_pacing_pct: mqlPacing,
        mql_rag: calculateRAG(mqlPacing),
        actual_sql: data.actual_sql,
        q1_target_sql: data.q1_target_sql,
        target_sql: qtdTargetSql,
        sql_pacing_pct: sqlPacing,
        sql_rag: calculateRAG(sqlPacing),
        actual_sal: data.actual_sal,
        q1_target_sal: data.q1_target_sal,
        target_sal: qtdTargetSal,
        sal_pacing_pct: salPacing,
        sal_rag: salPacing !== null ? calculateRAG(salPacing) : null,
        actual_sqo: data.actual_sqo,
        q1_target_sqo: data.q1_target_sqo,
        target_sqo: qtdTargetSqo,
        sqo_pacing_pct: sqoPacing,
        sqo_rag: calculateRAG(sqoPacing),
      });
    }

    // Sort by product, category, region
    funnelPacing.sort((a, b) => {
      if (a.product !== b.product) return a.product.localeCompare(b.product);
      const catOrder = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'];
      if (a.category !== b.category) return catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
      return a.region.localeCompare(b.region);
    });

    // Build Google Ads data grouped by product
    const googleAdsData: { POR: any[]; R360: any[] } = { POR: [], R360: [] };
    for (const ad of googleAds as any[]) {
      const adData = {
        region: ad.region,
        impressions: parseInt(ad.impressions) || 0,
        clicks: parseInt(ad.clicks) || 0,
        ctr_pct: parseFloat(ad.ctr_pct) || 0,
        ad_spend_usd: parseFloat(ad.ad_spend_usd) || 0,
        cpc_usd: parseFloat(ad.cpc_usd) || 0,
        conversions: parseFloat(ad.conversions) || 0,
        cpa_usd: parseFloat(ad.cpa_usd) || 0,
      };
      if (ad.product === 'POR') {
        googleAdsData.POR.push(adData);
      } else if (ad.product === 'R360') {
        googleAdsData.R360.push(adData);
      }
    }

    // Build pipeline age map
    const pipelineAgeMap = new Map<string, number>();
    for (const ageRow of pipelineAgeData as any[]) {
      const key = `${ageRow.product}-${ageRow.region}-${ageRow.category}`;
      pipelineAgeMap.set(key, parseInt(ageRow.avg_age_days) || 0);
    }

    // Build pipeline RCA data
    const pipelineRca: { POR: any[]; R360: any[] } = { POR: [], R360: [] };
    for (const detail of attainmentDetail) {
      if (detail.pipeline_acv > 0) {
        const health = detail.pipeline_coverage_x >= 3 ? 'HEALTHY' : detail.pipeline_coverage_x >= 2 ? 'ADEQUATE' : 'AT RISK';
        const ageKey = `${detail.product}-${detail.region}-${detail.category}`;
        const avgAge = pipelineAgeMap.get(ageKey) || 0;
        const rcaRow = {
          region: detail.region,
          category: detail.category,
          pipeline_acv: detail.pipeline_acv,
          pipeline_coverage_x: detail.pipeline_coverage_x,
          pipeline_avg_age_days: avgAge,
          pipeline_health: health,
        };
        if (detail.product === 'POR') {
          pipelineRca.POR.push(rcaRow);
        } else {
          pipelineRca.R360.push(rcaRow);
        }
      }
    }

    // Build loss reason RCA data
    const lossReasonRca: { POR: any[]; R360: any[] } = { POR: [], R360: [] };
    for (const lossRow of lossReasonData as any[]) {
      const lostAcv = parseFloat(lossRow.lost_acv) || 0;
      const dealCount = parseInt(lossRow.deal_count) || 0;

      let severity = 'LOW';
      if (lostAcv >= 50000) severity = 'CRITICAL';
      else if (lostAcv >= 20000) severity = 'HIGH';
      else if (lostAcv >= 5000) severity = 'MEDIUM';

      const rcaRow = {
        region: lossRow.region,
        loss_reason: lossRow.loss_reason,
        deal_count: dealCount,
        lost_acv: lostAcv,
        severity,
      };

      if (lossRow.product === 'POR') {
        lossReasonRca.POR.push(rcaRow);
      } else {
        lossReasonRca.R360.push(rcaRow);
      }
    }

    // Build source attainment from won deals with RevOpsReport targets
    const sourceAttainment: { POR: any[]; R360: any[] } = { POR: [], R360: [] };
    const sourceActualsMap = new Map<string, number>();
    for (const row of perfPeriod) {
      if (!row.source || row.source === 'N/A' || row.source === '' || row.category === 'RENEWAL') continue;
      const key = `${row.product}-${row.region}-${row.source}`;
      const actualAcv = parseFloat(row.actual_acv) || 0;
      sourceActualsMap.set(key, (sourceActualsMap.get(key) || 0) + actualAcv);
    }

    // Get source-level Q1 ACV targets from RevOpsPerformance Q1 data
    const sourceTargetsMap = new Map<string, number>();
    for (const row of perfQ1) {
      if (!row.source || row.source === 'N/A' || row.source === '' || row.category === 'RENEWAL') continue;
      const key = `${row.product}-${row.region}-${row.source}`;
      const targetAcv = parseFloat(row.q1_target_acv) || 0;
      if (targetAcv > 0) {
        sourceTargetsMap.set(key, (sourceTargetsMap.get(key) || 0) + Math.round(targetAcv));
      }
    }

    // Calculate QTD proration factor for source targets
    const sourceQtdProrationFactor = periodInfo.quarter_pct_complete / 100;

    // Build source attainment rows with computed targets
    // Get all unique product-region-source combinations from both actuals and targets
    const allSourceKeys = new Set([
      ...Array.from(sourceActualsMap.keys()),
      ...Array.from(sourceTargetsMap.keys()),
    ]);

    for (const key of Array.from(allSourceKeys)) {
      const [product, region, source] = key.split('-');
      const qtdAcv = sourceActualsMap.get(key) || 0;
      const q1Target = sourceTargetsMap.get(key) || 0;
      const qtdTarget = Math.round(q1Target * sourceQtdProrationFactor);
      // Logic: target=0 means 100% attainment (met or exceeded zero target)
      const attainmentPct = qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 100) : 100;
      const gap = qtdAcv - qtdTarget;

      const sourceRow = {
        region,
        source,
        q1_target: q1Target,
        qtd_target: qtdTarget,
        qtd_acv: qtdAcv,
        attainment_pct: attainmentPct,
        gap,
        rag_status: getRAGStatus(attainmentPct),
      };

      if (product === 'POR') {
        sourceAttainment.POR.push(sourceRow);
      } else {
        sourceAttainment.R360.push(sourceRow);
      }
    }

    // Sort source attainment by region and source
    sourceAttainment.POR.sort((a, b) => a.region.localeCompare(b.region) || a.source.localeCompare(b.source));
    sourceAttainment.R360.sort((a, b) => a.region.localeCompare(b.region) || a.source.localeCompare(b.source));

    // Build funnel by source data from RevOpsPerformance
    // Actuals and targets come directly — no proportional allocation needed
    // Now includes ALL categories (except RENEWAL) with category field for tab filtering
    const funnelBySource: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    // Group RevOpsPerformance period data by (product, region, source, category) for source view
    // and build Q1 target lookup by (product, region, source, category)
    const sourceMap = new Map<string, any>();
    const sourceQ1Map = new Map<string, any>();

    for (const row of perfPeriod) {
      if (!row.source || row.source === 'N/A' || row.source === '' || !row.category) continue;
      if (row.category === 'RENEWAL') continue;
      const key = `${row.product}-${row.region}-${row.source}-${row.category}`;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, {
          product: row.product, region: row.region, source: row.source, category: row.category,
          actual_mql: 0, actual_sql: 0, actual_sal: 0, actual_sqo: 0, actual_acv: 0,
          period_target_mql: 0, period_target_sql: 0, period_target_sal: 0, period_target_sqo: 0, period_target_acv: 0,
        });
      }
      const s = sourceMap.get(key)!;
      s.actual_mql += parseInt(row.actual_mql) || 0;
      s.actual_sql += parseInt(row.actual_sql) || 0;
      s.actual_sal += parseInt(row.actual_sal) || 0;
      s.actual_sqo += parseInt(row.actual_sqo) || 0;
      s.actual_acv += parseFloat(row.actual_acv) || 0;
      s.period_target_mql += parseFloat(row.target_mql) || 0;
      s.period_target_sql += parseFloat(row.target_sql) || 0;
      s.period_target_sal += parseFloat(row.target_sal) || 0;
      s.period_target_sqo += parseFloat(row.target_sqo) || 0;
      s.period_target_acv += parseFloat(row.target_acv) || 0;
    }

    for (const row of perfQ1) {
      if (!row.source || row.source === 'N/A' || row.source === '' || !row.category) continue;
      if (row.category === 'RENEWAL') continue;
      const key = `${row.product}-${row.region}-${row.source}-${row.category}`;
      if (!sourceQ1Map.has(key)) {
        sourceQ1Map.set(key, {
          q1_target_mql: 0, q1_target_sql: 0, q1_target_sal: 0, q1_target_sqo: 0, q1_target_acv: 0,
        });
      }
      const s = sourceQ1Map.get(key)!;
      s.q1_target_mql += parseInt(row.q1_target_mql) || 0;
      s.q1_target_sql += parseInt(row.q1_target_sql) || 0;
      s.q1_target_sal += parseInt(row.q1_target_sal) || 0;
      s.q1_target_sqo += parseInt(row.q1_target_sqo) || 0;
      s.q1_target_acv += parseFloat(row.q1_target_acv) || 0;
    }

    // Override EXPANSION/MIGRATION source actuals with unique-opp counts (not person-day inflated)
    const expMigSrcCounts = expMigSourceCounts as Map<string, { mql: number; sql: number; sal: number; sqo: number }>;
    for (const [emKey, counts] of Array.from(expMigSrcCounts.entries())) {
      const sourceEntry = sourceMap.get(emKey);
      if (sourceEntry) {
        sourceEntry.actual_mql = counts.mql;
        sourceEntry.actual_sql = counts.sql;
        sourceEntry.actual_sal = counts.sal;
        sourceEntry.actual_sqo = counts.sqo;
      }
    }

    // Override INBOUND NEW LOGO source MQL actuals with unique-lead counts (not person-day inflated)
    // Only override MQL — SQL/SAL/SQO use different data paths and are correct from RevOpsPerformance.
    const ibSrcCounts = inboundSourceCounts as Map<string, { mql: number; sql: number; sal: number; sqo: number }>;
    for (const [ibKey, counts] of Array.from(ibSrcCounts.entries())) {
      const sourceEntry = sourceMap.get(ibKey);
      if (sourceEntry) {
        sourceEntry.actual_mql = counts.mql;
      }
    }

    // Subtract STRATEGIC INBOUND actuals from NEW LOGO INBOUND to avoid double-count.
    // getInboundSourceCounts counts ALL INBOUND leads under the NEW LOGO key.
    // STRATEGIC INBOUND keeps its own actuals from RevOpsPerformance.
    for (const [key, s] of Array.from(sourceMap.entries())) {
      if (s.category === 'STRATEGIC' && s.source === 'INBOUND') {
        const newLogoKey = `${s.product}-${s.region}-INBOUND-NEW LOGO`;
        const newLogoEntry = sourceMap.get(newLogoKey);
        if (newLogoEntry) {
          newLogoEntry.actual_mql = Math.max(0, newLogoEntry.actual_mql - s.actual_mql);
        }
      }
    }

    for (const [key, s] of Array.from(sourceMap.entries())) {
      const q1 = sourceQ1Map.get(key) || { q1_target_mql: 0, q1_target_sql: 0, q1_target_sal: 0, q1_target_sqo: 0, q1_target_acv: 0 };
      const hasSal = s.product === 'POR';
      const qtdMql = Math.round(s.period_target_mql);
      const qtdSql = Math.round(s.period_target_sql);
      const qtdSal = hasSal ? Math.round(s.period_target_sal) : 0;
      const qtdSqo = Math.round(s.period_target_sqo);

      // Skip sources with no actuals and no targets
      if (s.actual_mql === 0 && s.actual_sql === 0 && s.actual_sqo === 0 &&
          q1.q1_target_mql === 0 && q1.q1_target_sql === 0 && q1.q1_target_sqo === 0) continue;

      const entry = {
        region: s.region,
        source: s.source,
        category: s.category,
        target_acv: Math.round(q1.q1_target_acv),
        actual_mql: s.actual_mql,
        actual_sql: s.actual_sql,
        actual_sal: hasSal ? s.actual_sal : 0,
        actual_sqo: s.actual_sqo,
        q1_target_mql: q1.q1_target_mql,
        q1_target_sql: q1.q1_target_sql,
        q1_target_sal: hasSal ? q1.q1_target_sal : 0,
        q1_target_sqo: q1.q1_target_sqo,
        qtd_target_mql: qtdMql,
        qtd_target_sql: qtdSql,
        qtd_target_sal: qtdSal,
        qtd_target_sqo: qtdSqo,
        mql_pacing_pct: qtdMql > 0 ? Math.round((s.actual_mql / qtdMql) * 100) : (s.actual_mql > 0 ? 100 : 0),
        sql_pacing_pct: qtdSql > 0 ? Math.round((s.actual_sql / qtdSql) * 100) : (s.actual_sql > 0 ? 100 : 0),
        sal_pacing_pct: hasSal ? (qtdSal > 0 ? Math.round((s.actual_sal / qtdSal) * 100) : (s.actual_sal > 0 ? 100 : 0)) : 100,
        sqo_pacing_pct: qtdSqo > 0 ? Math.round((s.actual_sqo / qtdSqo) * 100) : (s.actual_sqo > 0 ? 100 : 0),
        mql_gap: s.actual_mql - qtdMql,
        sql_gap: s.actual_sql - qtdSql,
        sal_gap: (hasSal ? s.actual_sal : 0) - qtdSal,
        sqo_gap: s.actual_sqo - qtdSqo,
        mql_to_sql_rate: s.actual_mql > 0 ? Math.round((s.actual_sql / s.actual_mql) * 1000) / 10 : 0,
        sql_to_sal_rate: hasSal ? (s.actual_sql > 0 ? Math.round((s.actual_sal / s.actual_sql) * 1000) / 10 : 0) : 0,
        sal_to_sqo_rate: s.actual_sal > 0 ? Math.round((s.actual_sqo / s.actual_sal) * 1000) / 10 : 0,
      };

      if (s.product === 'POR') {
        funnelBySource.POR.push(entry);
      } else if (s.product === 'R360') {
        funnelBySource.R360.push(entry);
      }
    }

    // Build funnel by category data from RevOpsPerformance (funnelDataMap already built above)
    const funnelByCategory: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    for (const [key, data] of Array.from(funnelDataMap.entries())) {
      const [product, region, category] = key.split('-');

      // Skip if no meaningful targets
      if (data.q1_target_mql === 0 && data.q1_target_sql === 0 && data.q1_target_sqo === 0) continue;

      const qtdTargetMql = Math.round(data.period_target_mql);
      const qtdTargetSql = Math.round(data.period_target_sql);
      const qtdTargetSal = Math.round(data.period_target_sal);
      const qtdTargetSqo = Math.round(data.period_target_sqo);

      const mqlPacing = qtdTargetMql > 0 ? Math.round((data.actual_mql / qtdTargetMql) * 100) : (data.actual_mql > 0 ? 100 : 0);
      const sqlPacing = qtdTargetSql > 0 ? Math.round((data.actual_sql / qtdTargetSql) * 100) : (data.actual_sql > 0 ? 100 : 0);
      const salPacing = qtdTargetSal > 0 ? Math.round((data.actual_sal / qtdTargetSal) * 100) : (data.actual_sal > 0 ? 100 : 0);
      const sqoPacing = qtdTargetSqo > 0 ? Math.round((data.actual_sqo / qtdTargetSqo) * 100) : (data.actual_sqo > 0 ? 100 : 0);

      const isR360 = product === 'R360';
      const catActiveStages: { pct: number; weight: number }[] = [];
      const catMqlW = isR360 ? 0.143 : 0.10;
      const catSqlW = isR360 ? 0.286 : 0.20;
      const catSalW = isR360 ? 0 : 0.30;
      const catSqoW = isR360 ? 0.571 : 0.40;

      if (data.q1_target_mql > 0) catActiveStages.push({ pct: mqlPacing, weight: catMqlW });
      if (data.q1_target_sql > 0) catActiveStages.push({ pct: sqlPacing, weight: catSqlW });
      if (data.q1_target_sal > 0 && !isR360) catActiveStages.push({ pct: salPacing, weight: catSalW });
      if (data.q1_target_sqo > 0) catActiveStages.push({ pct: sqoPacing, weight: catSqoW });

      const catTotalWeight = catActiveStages.reduce((sum, s) => sum + s.weight, 0);
      const tofScore = catTotalWeight > 0
        ? Math.round(catActiveStages.reduce((sum, s) => sum + s.pct * (s.weight / catTotalWeight), 0))
        : 0;

      const entry = {
        category,
        region,
        actual_mql: data.actual_mql,
        q1_target_mql: data.q1_target_mql,
        qtd_target_mql: qtdTargetMql,
        mql_pacing_pct: mqlPacing,
        mql_gap: data.actual_mql - qtdTargetMql,
        actual_sql: data.actual_sql,
        q1_target_sql: data.q1_target_sql,
        qtd_target_sql: qtdTargetSql,
        sql_pacing_pct: sqlPacing,
        sql_gap: data.actual_sql - qtdTargetSql,
        actual_sal: data.actual_sal,
        q1_target_sal: data.q1_target_sal,
        qtd_target_sal: qtdTargetSal,
        sal_pacing_pct: salPacing,
        sal_gap: data.actual_sal - qtdTargetSal,
        actual_sqo: data.actual_sqo,
        q1_target_sqo: data.q1_target_sqo,
        qtd_target_sqo: qtdTargetSqo,
        sqo_pacing_pct: sqoPacing,
        sqo_gap: data.actual_sqo - qtdTargetSqo,
        weighted_tof_score: tofScore,
      };

      if (product === 'POR') {
        funnelByCategory.POR.push(entry);
      } else if (product === 'R360') {
        funnelByCategory.R360.push(entry);
      }
    }

    // Calculate MQL disqualification summary - MUTUALLY EXCLUSIVE categories that sum to 100%
    const calculateDQSummary = (mqls: any[]) => {
      const total = mqls.length;
      // Converted to SQL (success - these leads progressed)
      const converted = mqls.filter((m: any) =>
        m.mql_status === 'CONVERTED' || m.converted_to_sql === 'Yes'
      ).length;
      // Reverted/disqualified (lost - these leads were removed from funnel)
      const reverted = mqls.filter((m: any) =>
        (m.mql_status === 'REVERTED' || m.was_reverted) &&
        m.mql_status !== 'CONVERTED' && m.converted_to_sql !== 'Yes'
      ).length;
      // Stalled but not converted or reverted (at risk - stuck in stage)
      const stalled = mqls.filter((m: any) =>
        m.mql_status === 'STALLED' &&
        m.converted_to_sql !== 'Yes' &&
        !m.was_reverted
      ).length;
      // In progress - not yet converted, reverted, or stalled (healthy pipeline)
      const inProgress = mqls.filter((m: any) =>
        m.converted_to_sql !== 'Yes' &&
        m.mql_status !== 'CONVERTED' &&
        m.mql_status !== 'REVERTED' &&
        !m.was_reverted &&
        m.mql_status !== 'STALLED'
      ).length;
      return {
        total_mqls: total,
        reverted_count: reverted,
        reverted_pct: total > 0 ? Math.round((reverted / total) * 100) : 0,
        converted_count: converted,
        converted_pct: total > 0 ? Math.round((converted / total) * 100) : 0,
        stalled_count: stalled,
        stalled_pct: total > 0 ? Math.round((stalled / total) * 100) : 0,
        in_progress_count: inProgress,
        in_progress_pct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
        // Keep active_count for backward compatibility but mark as deprecated
        active_count: inProgress,
        active_pct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      };
    };

    const mqlDisqualificationSummary = {
      POR: calculateDQSummary(mqlDetailsData.POR || []),
      R360: calculateDQSummary(mqlDetailsData.R360 || []),
    };

    // Calculate SQL disqualification summary
    const calculateSQLDQSummary = (sqls: any[]) => {
      const total = sqls.length;
      const convertedSQO = sqls.filter((s: any) => s.sql_status === 'CONVERTED_SQO' || s.converted_to_sqo === 'Yes').length;
      const convertedSAL = sqls.filter((s: any) => s.sql_status === 'CONVERTED_SAL' || s.converted_to_sal === 'Yes').length;
      const stalled = sqls.filter((s: any) => s.sql_status === 'STALLED').length;
      const active = sqls.filter((s: any) => s.sql_status === 'ACTIVE').length;
      const withOpp = sqls.filter((s: any) => s.has_opportunity === 'Yes').length;
      return {
        total_sqls: total,
        converted_to_sqo_count: convertedSQO,
        converted_to_sqo_pct: total > 0 ? Math.round((convertedSQO / total) * 100) : 0,
        converted_to_sal_count: convertedSAL,
        converted_to_sal_pct: total > 0 ? Math.round((convertedSAL / total) * 100) : 0,
        stalled_count: stalled,
        stalled_pct: total > 0 ? Math.round((stalled / total) * 100) : 0,
        active_count: active,
        active_pct: total > 0 ? Math.round((active / total) * 100) : 0,
        with_opportunity_count: withOpp,
        with_opportunity_pct: total > 0 ? Math.round((withOpp / total) * 100) : 0,
      };
    };

    const sqlDisqualificationSummary = {
      POR: calculateSQLDQSummary(sqlDetailsData.POR || []),
      R360: calculateSQLDQSummary(sqlDetailsData.R360 || []),
    };

    // ========================================================================
    // WINS & BRIGHT SPOTS
    // Definition: Areas exceeding targets (GREEN or exceptional performance)
    // Criteria: >= 100% attainment (exceptional: >= 120%)
    // ========================================================================
    const calculateWinsBrightSpots = (
      attainment: any[],
      product: 'POR' | 'R360'
    ) => {
      const wins: any[] = [];

      for (const row of attainment) {
        // Only GREEN status qualifies (>= 90% attainment)
        if (row.rag_status !== 'GREEN') continue;

        // Determine performance tier
        let performanceTier: 'EXCEPTIONAL' | 'ON_TRACK' | 'NEEDS_ATTENTION';
        if (row.qtd_attainment_pct >= 120) {
          performanceTier = 'EXCEPTIONAL';
        } else if (row.qtd_attainment_pct >= 100) {
          performanceTier = 'ON_TRACK';
        } else {
          performanceTier = 'NEEDS_ATTENTION';
        }

        // Generate commentary based on performance
        let commentary = '';
        if (performanceTier === 'EXCEPTIONAL') {
          commentary = `${row.region} ${row.category} at ${row.qtd_attainment_pct.toFixed(0)}% - exceptional performance, exceeding targets by ${(row.qtd_attainment_pct - 100).toFixed(0)}%. Strong execution driving results.`;
        } else if (performanceTier === 'ON_TRACK') {
          commentary = `${row.region} ${row.category} at ${row.qtd_attainment_pct.toFixed(0)}% - on track, meeting targets. Strong win rate supporting results.`;
        } else {
          commentary = `${row.region} ${row.category} at ${row.qtd_attainment_pct.toFixed(0)}% - approaching target with positive trajectory.`;
        }

        // Determine contributing factor
        let contributingFactor = 'Solid execution';
        if (row.win_rate_pct && row.win_rate_pct >= 50) {
          contributingFactor = 'High win rate';
        } else if (row.pipeline_coverage_x && row.pipeline_coverage_x >= 2) {
          contributingFactor = 'Strong pipeline';
        }

        wins.push({
          product,
          region: row.region,
          category: row.category,
          qtd_attainment_pct: row.qtd_attainment_pct,
          qtd_acv: row.qtd_acv,
          qtd_target: row.qtd_target,
          performance_tier: performanceTier,
          success_commentary: commentary,
          contributing_factor: contributingFactor,
          pipeline_coverage_x: row.pipeline_coverage_x || 0,
          win_rate_pct: row.win_rate_pct || 0,
        });
      }

      // Sort by attainment (highest first)
      return wins.sort((a, b) => b.qtd_attainment_pct - a.qtd_attainment_pct);
    };

    const winsBrightSpots = {
      POR: calculateWinsBrightSpots(
        attainmentDetail.filter((a: any) => a.product === 'POR'),
        'POR'
      ),
      R360: calculateWinsBrightSpots(
        attainmentDetail.filter((a: any) => a.product === 'R360'),
        'R360'
      ),
    };

    // ========================================================================
    // TOP RISK POCKETS
    // Definition: Areas significantly underperforming (RED status)
    // Criteria: < 70% attainment
    // ========================================================================
    const calculateTopRiskPockets = (attainment: any[]) => {
      const riskPockets: any[] = [];

      for (const row of attainment) {
        // Only RED status qualifies (< 70% attainment)
        if (row.rag_status !== 'RED') continue;

        riskPockets.push({
          product: row.product,
          region: row.region,
          category: row.category,
          qtd_target: row.qtd_target,
          qtd_acv: row.qtd_acv,
          qtd_gap: row.gap,
          qtd_attainment_pct: row.qtd_attainment_pct,
          rag_status: row.rag_status,
          win_rate_pct: row.win_rate_pct || 0,
          pipeline_acv: row.pipeline_acv || 0,
          pipeline_coverage_x: row.pipeline_coverage_x || 0,
          deals_won: row.qtd_deals || 0,
          avg_deal_size: row.qtd_deals > 0 ? row.qtd_acv / row.qtd_deals : 0,
        });
      }

      // Sort by gap (largest negative gap first)
      return riskPockets.sort((a, b) => a.qtd_gap - b.qtd_gap);
    };

    const topRiskPockets = calculateTopRiskPockets(attainmentDetail);

    // ========================================================================
    // ACTION ITEMS
    // Definition: Specific recommended actions based on risk analysis
    // Criteria: RED/YELLOW status areas with actionable recommendations
    // ========================================================================
    const calculateActionItems = (attainment: any[], funnel: any[]) => {
      const immediate: any[] = [];
      const shortTerm: any[] = [];
      const strategic: any[] = [];

      for (const row of attainment) {
        // Only RED and YELLOW status areas need action items
        if (row.rag_status === 'GREEN') continue;

        const funnelRow = funnel.find((f: any) =>
          f.product === row.product && f.region === row.region
        );

        // RED status = IMMEDIATE action needed
        if (row.rag_status === 'RED') {
          // Critical: Pipeline gap
          if (row.pipeline_coverage_x < 2) {
            immediate.push({
              urgency: 'IMMEDIATE',
              category: 'PIPELINE',
              product: row.product,
              region: row.region,
              issue: `${row.region} ${row.category} at ${row.qtd_attainment_pct.toFixed(0)}% with only ${row.pipeline_coverage_x?.toFixed(1)}x pipeline coverage`,
              reason: 'Insufficient pipeline to close the gap to target',
              action: 'Prioritize pipeline generation through outbound campaigns and partner sourcing',
              metric: `Pipeline Coverage: ${row.pipeline_coverage_x?.toFixed(1)}x (need 3x)`,
              severity: 'CRITICAL',
            });
          }

          // Critical: Low win rate
          if (row.win_rate_pct !== undefined && row.win_rate_pct < 25) {
            immediate.push({
              urgency: 'IMMEDIATE',
              category: 'WIN_RATE',
              product: row.product,
              region: row.region,
              issue: `${row.region} ${row.category} has ${row.win_rate_pct.toFixed(0)}% win rate`,
              reason: 'Low conversion from pipeline to closed-won deals',
              action: 'Review loss reasons and implement deal coaching for late-stage opportunities',
              metric: `Win Rate: ${row.win_rate_pct.toFixed(0)}% (target: 30%+)`,
              severity: 'CRITICAL',
            });
          }

          // High: Funnel leakage
          if (funnelRow && funnelRow.sqo_pacing_pct < 50) {
            shortTerm.push({
              urgency: 'SHORT_TERM',
              category: 'FUNNEL',
              product: row.product,
              region: row.region,
              issue: `${row.region} SQO pacing at ${funnelRow.sqo_pacing_pct?.toFixed(0)}% of target`,
              reason: 'Funnel conversion not keeping pace with demand generation',
              action: 'Audit MQL→SQL→SQO conversion and address stage-specific blockers',
              metric: `SQO Pacing: ${funnelRow.sqo_pacing_pct?.toFixed(0)}%`,
              severity: 'HIGH',
            });
          }
        }

        // YELLOW status = SHORT_TERM action needed
        if (row.rag_status === 'YELLOW') {
          // Medium: At-risk deals
          if (row.pipeline_coverage_x && row.pipeline_coverage_x >= 2 && row.pipeline_coverage_x < 3) {
            shortTerm.push({
              urgency: 'SHORT_TERM',
              category: 'EXECUTION',
              product: row.product,
              region: row.region,
              issue: `${row.region} ${row.category} at ${row.qtd_attainment_pct.toFixed(0)}% needs acceleration`,
              reason: 'Adequate pipeline exists but conversion velocity is slow',
              action: 'Focus on deal progression and reduce cycle time for late-stage opportunities',
              metric: `Attainment: ${row.qtd_attainment_pct.toFixed(0)}% (need 90%+)`,
              severity: 'MEDIUM',
            });
          }

          // Strategic: Capacity planning
          if (funnelRow && funnelRow.mql_pacing_pct < 80) {
            strategic.push({
              urgency: 'STRATEGIC',
              category: 'DEMAND_GEN',
              product: row.product,
              region: row.region,
              issue: `${row.region} MQL generation at ${funnelRow.mql_pacing_pct?.toFixed(0)}% of target`,
              reason: 'Top-of-funnel not generating enough leads to sustain targets',
              action: 'Increase marketing investment and expand channel partnerships',
              metric: `MQL Pacing: ${funnelRow.mql_pacing_pct?.toFixed(0)}%`,
              severity: 'MEDIUM',
            });
          }
        }
      }

      return { immediate, short_term: shortTerm, strategic };
    };

    const actionItems = calculateActionItems(attainmentDetail, funnelPacing);

    // ========================================================================
    // MOMENTUM INDICATORS
    // Definition: YELLOW status areas trending toward GREEN
    // Criteria: 70-89% attainment + strong pipeline coverage OR strong funnel pacing
    // ========================================================================
    const calculateMomentumIndicators = (
      attainment: any[],
      funnel: any[],
      product: 'POR' | 'R360'
    ) => {
      const momentumIndicators: any[] = [];

      for (const row of attainment) {
        // Only YELLOW status qualifies for momentum (70-89% attainment)
        if (row.rag_status !== 'YELLOW') continue;

        // Find matching funnel data for this region
        const funnelRow = funnel.find((f: any) => f.region === row.region);

        // Determine if trending toward green based on leading indicators:
        // 1. Strong pipeline coverage (>= 2x) means enough deals to close gap
        // 2. Strong funnel pacing (MQL or SQL >= 90%) means more leads coming
        const hasPipelineMomentum = row.pipeline_coverage_x >= 2.0;
        const hasFunnelMomentum = funnelRow && (
          (funnelRow.mql_pacing_pct >= 90) ||
          (funnelRow.sql_pacing_pct >= 90)
        );

        // Must have at least one positive momentum signal
        if (!hasPipelineMomentum && !hasFunnelMomentum) continue;

        // Calculate momentum tier based on strength of signals
        let momentumTier: string;
        let positiveMomentumCount = 0;

        if (hasPipelineMomentum) positiveMomentumCount++;
        if (hasFunnelMomentum) positiveMomentumCount++;

        // Both pipeline AND funnel strong = STRONG_MOMENTUM
        // Only one = MODERATE_MOMENTUM
        momentumTier = positiveMomentumCount >= 2 ? 'STRONG_MOMENTUM' : 'MODERATE_MOMENTUM';

        // Determine trend indicators
        const mqlPacing = funnelRow?.mql_pacing_pct || 0;
        const sqlPacing = funnelRow?.sql_pacing_pct || 0;
        const mqlTrend = mqlPacing >= 100 ? 'UP' : mqlPacing >= 80 ? 'FLAT' : 'DOWN';
        const sqlTrend = sqlPacing >= 100 ? 'UP' : sqlPacing >= 80 ? 'FLAT' : 'DOWN';

        // Generate commentary
        const reasons: string[] = [];
        if (hasPipelineMomentum) reasons.push(`${row.pipeline_coverage_x.toFixed(1)}x pipeline coverage`);
        if (hasFunnelMomentum && mqlPacing >= 90) reasons.push(`MQL at ${mqlPacing}% of target`);
        if (hasFunnelMomentum && sqlPacing >= 90) reasons.push(`SQL at ${sqlPacing}% of target`);

        momentumIndicators.push({
          product,
          region: row.region,
          category: row.category,
          momentum_tier: momentumTier,
          positive_momentum_count: positiveMomentumCount,
          momentum_commentary: `${row.region} ${row.category} at ${row.qtd_attainment_pct.toFixed(0)}% (YELLOW) showing positive momentum: ${reasons.join(', ')}.`,
          mql_trend: mqlTrend,
          mql_wow_pct: Math.round((mqlPacing - 100) * 10) / 10, // Approximate WoW as delta from target
          sql_trend: sqlTrend,
          sql_wow_pct: Math.round((sqlPacing - 100) * 10) / 10,
          // Additional context
          current_attainment_pct: row.qtd_attainment_pct,
          pipeline_coverage_x: row.pipeline_coverage_x,
          gap_to_green: Math.round(90 - row.qtd_attainment_pct), // How far from 90% (GREEN threshold)
        });
      }

      return momentumIndicators;
    };

    const momentumIndicators = {
      POR: calculateMomentumIndicators(
        attainmentDetail.filter((a: any) => a.product === 'POR'),
        funnelPacing.filter((f: any) => f.product === 'POR'),
        'POR'
      ),
      R360: calculateMomentumIndicators(
        attainmentDetail.filter((a: any) => a.product === 'R360'),
        funnelPacing.filter((f: any) => f.product === 'R360'),
        'R360'
      ),
    };

    // Build response
    const response = {
      generated_at_utc: new Date().toISOString(),
      report_date: endDate,
      filters_applied: filters,
      period: periodInfo,
      data_source: {
        targets: 'RevOpsReport (P90)',
        actuals: 'sfdc.OpportunityViewTable + RevOpsReport',
        funnel: 'MarketingFunnel + DailyRevenueFunnel',
      },
      grand_total: grandTotal,
      product_totals: productTotals,
      attainment_detail: attainmentDetail,
      source_attainment: sourceAttainment,
      funnel_pacing: funnelPacing,
      funnel_by_category: funnelByCategory,
      funnel_by_source: funnelBySource,
      google_ads: googleAdsData,
      pipeline_rca: pipelineRca,
      loss_reason_rca: lossReasonRca,
      mql_details: mqlDetailsData,
      sql_details: sqlDetailsData,
      sal_details: salDetailsData,
      sqo_details: sqoDetailsData,
      mql_disqualification_summary: mqlDisqualificationSummary,
      sql_disqualification_summary: sqlDisqualificationSummary,
      won_deals: wonDeals,
      lost_deals: lostDeals,
      pipeline_deals: pipelineDeals,
      momentum_indicators: momentumIndicators,
      wins_bright_spots: winsBrightSpots,
      top_risk_pockets: topRiskPockets,
      action_items: actionItems,
      utm_breakdown: utmBreakdownData,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: any) {
    console.error('BigQuery error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch data from BigQuery',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/report-data',
    method: 'POST',
    description: 'Fetch Q1 2026 Risk Report data using RevOps architecture with P90 targets',
    data_sources: {
      targets: 'Staging.RevOpsReport (RiskProfile=P90, Horizon=QTD)',
      actuals: 'sfdc.OpportunityViewTable + RevOpsReport.Actual_ACV',
      funnel: 'MarketingFunnel.InboundFunnel, R360InboundFunnel, DailyRevenueFunnel',
      google_ads: 'GoogleAds_POR_*, GoogleAds_Record360_*',
    },
    parameters: {
      startDate: 'YYYY-MM-DD (required)',
      endDate: 'YYYY-MM-DD (required)',
      products: 'Array of POR/R360 (optional)',
      regions: 'Array of AMER/EMEA/APAC (optional)',
    },
    example: {
      startDate: '2026-01-01',
      endDate: '2026-01-16',
      products: ['POR'],
      regions: ['AMER', 'EMEA'],
    },
    notes: [
      'Uses P90 risk profile for conservative/realistic targets',
      'RevOpsReport provides pre-calculated QTD attainment',
      'OpportunityType maps to Category (New Business -> NEW LOGO, etc.)',
      'Renewal forecasts include expected uplift from auto-renewing contracts',
    ],
  });
}
