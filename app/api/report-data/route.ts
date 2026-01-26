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
 * - Layer 5: RevOpsReport - WTD, MTD, QTD, YTD reporting with P75 targets
 * - Layer 4: RevOpsPerformance - Daily pacing with actuals (for trends)
 * - sfdc.OpportunityViewTable - Deal-level details (won, lost, pipeline)
 * - MarketingFunnel - Lead/funnel stage details
 *
 * Key Changes from StrategicOperatingPlan:
 * - Now uses RevOpsReport with RiskProfile='P75' for risk-adjusted targets
 * - Horizon='QTD' for quarter-to-date metrics
 * - Period_Start_Date='2026-01-01' for Q1 2026
 * - OpportunityType maps to Category (New Business->NEW LOGO, etc.)
 */

interface ReportFilters {
  startDate: string;
  endDate: string;
  products: string[];
  regions: string[];
}

// Helper to get BigQuery client
function getBigQuery() {
  return getBigQueryClient();
}

/**
 * Get renewal targets from RevOpsPlan (Layer 3 - AUTHORITATIVE SOURCE)
 * Q1 target = SUM(daily Target_ACV_Won) over ActivityQuarterYear='2026-Q1'
 * RevOpsPlan is the single source of truth for ALL planned targets
 */
async function getRenewalTargetsFromRawPlan(): Promise<Map<string, number>> {
  try {
    const query = `
      SELECT
        RecordType AS product,
        Region AS region,
        ROUND(SUM(COALESCE(Target_ACV_Won, 0)), 2) AS q1_target
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsPlan\`
      WHERE RiskProfile = 'P75'
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

    console.log('Renewal targets from RevOpsPlan (P75):', Object.fromEntries(renewalTargetMap));
    return renewalTargetMap;
  } catch (error: any) {
    console.error('Failed to fetch renewal targets from RevOpsPlan:', error.message);
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
 * Query RevOpsReport for QTD targets and actuals with P75 risk profile
 * This replaces the old StrategicOperatingPlan queries
 */
async function getRevOpsQTDData(filters: ReportFilters) {
  const filterClause = buildRevOpsFilterClause(filters);

  const query = `
    WITH plan_targets AS (
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
        ROUND(SUM(COALESCE(Target_ACV_Won, 0)), 2) AS q1_target,
        ROUND(SUM(COALESCE(Target_MQL, 0)), 0) AS target_mql,
        ROUND(SUM(COALESCE(Target_SQL, 0)), 0) AS target_sql,
        ROUND(SUM(COALESCE(Target_SAL, 0)), 0) AS target_sal,
        ROUND(SUM(COALESCE(Target_SQO, 0)), 0) AS target_sqo,
        ROUND(SUM(COALESCE(Target_Won, 0)), 0) AS target_won
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.STAGING}.RevOpsPlan\`
      WHERE RiskProfile = 'P75'
        AND ActivityQuarterYear = '2026-Q1'
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
        AND RiskProfile = 'P75'
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
      COALESCE(t.target_mql, 0) AS target_mql,
      COALESCE(a.actual_mql, 0) AS actual_mql,
      COALESCE(t.target_sql, 0) AS target_sql,
      COALESCE(a.actual_sql, 0) AS actual_sql,
      COALESCE(t.target_sal, 0) AS target_sal,
      COALESCE(a.actual_sal, 0) AS actual_sal,
      COALESCE(t.target_sqo, 0) AS target_sqo,
      COALESCE(a.actual_sqo, 0) AS actual_sqo,
      COALESCE(t.target_won, 0) AS target_won,
      COALESCE(a.actual_won, 0) AS actual_won,
      COALESCE(a.mql_to_sql_leakage, 0) AS mql_to_sql_leakage,
      COALESCE(a.sql_to_sal_leakage, 0) AS sql_to_sal_leakage,
      COALESCE(a.sal_to_sqo_leakage, 0) AS sal_to_sqo_leakage,
      'P75' AS risk_profile
    FROM plan_targets t
    FULL OUTER JOIN report_actuals a
      ON t.product = a.product AND t.region = a.region AND t.category = a.category
    ORDER BY product, region, category
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    console.log(`RevOpsPlan+Report QTD data: ${(rows as any[]).length} rows`);
    return rows as any[];
  } catch (error: any) {
    console.error('RevOpsPlan+Report query failed:', error.message);
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
    WHERE RiskProfile = 'P75'
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

// Query for funnel actuals by source using InboundFunnel (same source as MQL Details for consistency)
// Uses RevOpsPlan (Layer 3) for Q1 targets and RevOpsReport for actuals
// RevOpsPlan has daily target granularity - SUM over Q1 gives exact Q1 targets
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

  // Query RevOpsPlan (Layer 3) for Q1 targets by source
  // SUM daily target values over the full quarter for Q1 totals
  const query = `
    WITH plan_targets AS (
      SELECT
        Region AS region,
        ${sourceNormCase} AS source,
        ROUND(SUM(COALESCE(Target_ACV_Won, 0)), 2) AS target_acv,
        ROUND(SUM(COALESCE(Target_MQL, 0))) AS target_mql,
        ROUND(SUM(COALESCE(Target_SQL, 0))) AS target_sql,
        ROUND(SUM(COALESCE(Target_SAL, 0))) AS target_sal,
        ROUND(SUM(COALESCE(Target_SQO, 0))) AS target_sqo,
        ROUND(SUM(COALESCE(Target_Won, 0))) AS target_won
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsPlan\`
      WHERE RecordType = '${recordType}'
        AND RiskProfile = 'P75'
        AND ActivityQuarterYear = '2026-Q1'
        AND OpportunityType != 'Renewal'
        AND Source IS NOT NULL AND Source != ''
        ${regionFilter}
      GROUP BY 1, 2
    ),
    report_actuals AS (
      SELECT
        Region AS region,
        ${sourceNormCase} AS source,
        SUM(COALESCE(Actual_MQL, 0)) AS actual_mql,
        SUM(COALESCE(Actual_SQL, 0)) AS actual_sql,
        SUM(COALESCE(Actual_SAL, 0)) AS actual_sal,
        SUM(COALESCE(Actual_SQO, 0)) AS actual_sqo
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.Staging.RevOpsReport\`
      WHERE RecordType = '${recordType}'
        AND RiskProfile = 'P75'
        AND Horizon = 'QTD'
        AND Period_Start_Date = '2026-01-01'
        AND Source IS NOT NULL AND Source != ''
        AND OpportunityType != 'Renewal'
        ${regionFilter}
      GROUP BY 1, 2
    ),
    combined AS (
      SELECT
        '${product}' AS product,
        COALESCE(t.region, a.region) AS region,
        COALESCE(t.source, a.source) AS source,
        COALESCE(a.actual_mql, 0) AS actual_mql,
        COALESCE(a.actual_sql, 0) AS actual_sql,
        COALESCE(a.actual_sal, 0) AS actual_sal,
        COALESCE(a.actual_sqo, 0) AS actual_sqo,
        CAST(COALESCE(t.target_mql, 0) AS INT64) AS target_mql,
        CAST(COALESCE(t.target_sql, 0) AS INT64) AS target_sql,
        CAST(COALESCE(t.target_sal, 0) AS INT64) AS target_sal,
        CAST(COALESCE(t.target_sqo, 0) AS INT64) AS target_sqo,
        COALESCE(t.target_acv, 0) AS target_acv
      FROM plan_targets t
      FULL OUTER JOIN report_actuals a ON t.region = a.region AND t.source = a.source
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

  // MQL Query - NEW LOGO from InboundFunnel (deduplicated by Company + Date + Division)
  // Uses ROW_NUMBER() to pick one record per company per day, preferring records with LeadId/ContactId
  const porMqlQuery = `
    WITH ranked_mqls AS (
      SELECT
        'POR' AS product,
        CASE Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        COALESCE(LeadId, ContactId) AS record_id,
        CASE
          WHEN LeadId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', LeadId)
          WHEN ContactId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', ContactId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(Company, 'Unknown') AS company_name,
        COALESCE(LeadEmail, ContactEmail, 'N/A') AS email,
        COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
        CAST(MQL_DT AS STRING) AS mql_date,
        CASE WHEN SQL_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sql,
        CASE
          WHEN MQL_Reverted = true THEN 'REVERTED'
          WHEN SQL_DT IS NOT NULL THEN 'CONVERTED'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) > 30 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS mql_status,
        COALESCE(MQL_Reverted, false) AS was_reverted,
        DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) AS days_in_stage,
        'MQL' AS lead_type,
        'NEW LOGO' AS category,
        -- Prioritize records with LeadId/ContactId, then by most recent
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(Company, 'Unknown'), CAST(MQL_DT AS DATE), Division
          ORDER BY
            CASE WHEN LeadId IS NOT NULL OR ContactId IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN SQL_DT IS NOT NULL THEN 0 ELSE 1 END
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\`
      WHERE Division IN ('US', 'UK', 'AU')
        AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
        -- Include reverted MQLs for disqualification analysis
        AND MQL_DT IS NOT NULL
        AND CAST(MQL_DT AS DATE) >= '${filters.startDate}'
        AND CAST(MQL_DT AS DATE) <= '${filters.endDate}'
        ${regionClause}
    )
    SELECT product, region, record_id, salesforce_url, company_name, email, source,
           mql_date, converted_to_sql, mql_status, was_reverted, days_in_stage, lead_type, category
    FROM ranked_mqls
    WHERE rn = 1
    ORDER BY mql_date DESC
  `;

  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // R360 MQL Query - deduplicated by Company + Date + Region
  const r360MqlQuery = `
    WITH ranked_mqls AS (
      SELECT
        'R360' AS product,
        Region AS region,
        LeadId AS record_id,
        CASE
          WHEN LeadId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', LeadId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(Company, 'Unknown') AS company_name,
        Email AS email,
        COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
        CAST(MQL_DT AS STRING) AS mql_date,
        CASE WHEN SQL_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sql,
        CASE
          WHEN MQL_Reverted = true THEN 'REVERTED'
          WHEN SQL_DT IS NOT NULL THEN 'CONVERTED'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) > 30 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS mql_status,
        COALESCE(MQL_Reverted, false) AS was_reverted,
        DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) AS days_in_stage,
        'MQL' AS lead_type,
        'NEW LOGO' AS category,
        -- Prioritize records with LeadId, then by conversion status
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(Company, 'Unknown'), CAST(MQL_DT AS DATE), Region
          ORDER BY
            CASE WHEN LeadId IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN SQL_DT IS NOT NULL THEN 0 ELSE 1 END
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\`
      WHERE Region IS NOT NULL
        -- Include reverted MQLs for disqualification analysis
        AND MQL_DT IS NOT NULL
        AND CAST(MQL_DT AS DATE) >= '${filters.startDate}'
        AND CAST(MQL_DT AS DATE) <= '${filters.endDate}'
        ${r360RegionClause}
    )
    SELECT product, region, record_id, salesforce_url, company_name, email, source,
           mql_date, converted_to_sql, mql_status, was_reverted, days_in_stage, lead_type, category
    FROM ranked_mqls
    WHERE rn = 1
    ORDER BY mql_date DESC
  `;

  // EQL Query - EXPANSION/MIGRATION from OpportunityViewTable
  // EQLs are qualified opportunities from existing customers (tracked by CreatedDate)
  const { productClause, regionClause: oppRegionClause } = buildOpportunityFilterClause(filters);

  const eqlQuery = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      Id AS record_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url,
      COALESCE(AccountName, 'Unknown') AS company_name,
      'N/A' AS email,
      COALESCE(NULLIF(COALESCE(SDRSource, POR_SDRSource), ''), 'INBOUND') AS source,
      CAST(CreatedDate AS STRING) AS mql_date,
      CASE WHEN Won THEN 'Yes' WHEN StageName LIKE '%SQL%' OR StageName LIKE '%SAL%' OR StageName LIKE '%SQO%' THEN 'Yes' ELSE 'No' END AS converted_to_sql,
      CASE
        WHEN Won THEN 'CONVERTED'
        WHEN IsClosed AND NOT Won THEN 'REVERTED'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) > 30 AND NOT IsClosed THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS mql_status,
      CASE WHEN IsClosed AND NOT Won THEN true ELSE false END AS was_reverted,
      DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY) AS days_in_stage,
      'EQL' AS lead_type,
      CASE Type
        WHEN 'Existing Business' THEN 'EXPANSION'
        WHEN 'Migration' THEN 'MIGRATION'
      END AS category
    FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND Type IN ('Existing Business', 'Migration')
      AND ACV > 0
      AND CAST(CreatedDate AS DATE) >= '${filters.startDate}'
      AND CAST(CreatedDate AS DATE) <= '${filters.endDate}'
      ${productClause}
      ${oppRegionClause}
    ORDER BY CreatedDate DESC
  `;

  try {
    const shouldFetchPOR = filters.products.length === 0 || filters.products.includes('POR');
    const shouldFetchR360 = filters.products.length === 0 || filters.products.includes('R360');

    const [porMqlRows, r360MqlRows, eqlRows] = await Promise.all([
      shouldFetchPOR ? getBigQuery().query({ query: porMqlQuery }).then(r => r[0]) : Promise.resolve([]),
      shouldFetchR360 ? getBigQuery().query({ query: r360MqlQuery }).then(r => r[0]) : Promise.resolve([]),
      getBigQuery().query({ query: eqlQuery }).then(r => r[0]),
    ]);

    // Combine MQL and EQL data, split by product
    const porData = [
      ...(porMqlRows as any[]),
      ...(eqlRows as any[]).filter((r: any) => r.product === 'POR'),
    ];
    const r360Data = [
      ...(r360MqlRows as any[]),
      ...(eqlRows as any[]).filter((r: any) => r.product === 'R360'),
    ];

    return {
      POR: porData,
      R360: r360Data,
    };
  } catch (error) {
    console.warn('MQL/EQL details query failed:', error);
    return { POR: [], R360: [] };
  }
}

// Query for SQL details
async function getSQLDetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  // POR SQL query - deduplicates by email to match summary COUNT(DISTINCT email)
  // 6-tier enhanced linking: OpportunityID → ConvertedOpportunityId → Name match → ContactId-Account → Email-Account → Fuzzy name
  const porQuery = `
    WITH name_matched_opps AS (
      -- Tier 3: Pre-compute opportunity lookups by exact name
      SELECT DISTINCT
        OpportunityName,
        FIRST_VALUE(Id) OVER (PARTITION BY OpportunityName ORDER BY CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE OpportunityName IS NOT NULL AND OpportunityName != ''
        AND por_record__c = true AND Division IN ('US', 'UK', 'AU')
    ),
    contact_account_opps AS (
      -- Tier 4: Match via ContactId → Contact.AccountId → Opportunity
      SELECT DISTINCT
        c.Id AS contact_id,
        FIRST_VALUE(o.Id) OVER (PARTITION BY c.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.AccountId IS NOT NULL
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    email_matched_opps AS (
      -- Tier 5: Match via Email → Contact → Account → Opportunity
      SELECT DISTINCT
        LOWER(TRIM(c.Email)) AS email,
        FIRST_VALUE(o.Id) OVER (PARTITION BY LOWER(TRIM(c.Email)) ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.Email IS NOT NULL AND c.Email != '' AND c.AccountId IS NOT NULL
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    fuzzy_name_matched_opps AS (
      -- Tier 6: Fuzzy company name match (remove Inc, LLC, Ltd, etc.)
      SELECT DISTINCT
        REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') AS normalized_name,
        FIRST_VALUE(o.Id) OVER (
          PARTITION BY REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '')
          ORDER BY o.CreatedDate DESC
        ) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.AccountName IS NOT NULL AND o.AccountName != ''
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    account_matched_opps AS (
      -- Tier 7: Direct Account.Name match → find any Opportunity on that Account
      SELECT DISTINCT
        LOWER(TRIM(a.Name)) AS account_name,
        FIRST_VALUE(o.Id) OVER (PARTITION BY a.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON a.Id = o.AccountId
      WHERE a.Name IS NOT NULL AND a.Name != ''
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    ranked_sqls AS (
      SELECT
        'POR' AS product,
        CASE f.Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        COALESCE(f.LeadId, f.ContactId) AS record_id,
        -- 7-tier URL resolution
        CASE
          WHEN f.OpportunityID IS NOT NULL AND f.OpportunityID != '' THEN f.OpportunityLink
          WHEN l.ConvertedOpportunityId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', l.ConvertedOpportunityId)
          WHEN nmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', nmo.opp_id)
          WHEN cao.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', cao.opp_id)
          WHEN emo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', emo.opp_id)
          WHEN fnmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', fnmo.opp_id)
          WHEN amo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', amo.opp_id)
          WHEN NULLIF(f.LeadId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.LeadId)
          WHEN NULLIF(f.ContactId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.ContactId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(f.Company, 'Unknown') AS company_name,
        COALESCE(f.LeadEmail, f.ContactEmail, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        CAST(f.SQL_DT AS STRING) AS sql_date,
        CAST(f.MQL_DT AS STRING) AS mql_date,
        DATE_DIFF(CAST(f.SQL_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY) AS days_mql_to_sql,
        CASE WHEN f.SAL_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sal,
        CASE WHEN f.SQO_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        -- 7-tier has_opportunity check
        CASE WHEN (f.OpportunityID IS NOT NULL AND f.OpportunityID != '')
               OR l.ConvertedOpportunityId IS NOT NULL
               OR nmo.opp_id IS NOT NULL
               OR cao.opp_id IS NOT NULL
               OR emo.opp_id IS NOT NULL
               OR fnmo.opp_id IS NOT NULL
               OR amo.opp_id IS NOT NULL
        THEN 'Yes' ELSE 'No' END AS has_opportunity,
        CASE
          WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'WON'
          WHEN f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN f.SAL_DT IS NOT NULL THEN 'CONVERTED_SAL'
          WHEN COALESCE(o.IsClosed, o2.IsClosed, o3.IsClosed, o4.IsClosed, o5.IsClosed, o6.IsClosed, false) AND NOT COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SQL_DT AS DATE), DAY) > 45 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        -- 7-tier opportunity_id
        COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id) AS opportunity_id,
        COALESCE(f.OpportunityName, o.OpportunityName, o2.OpportunityName, o3.OpportunityName, o4.OpportunityName, o5.OpportunityName, o6.OpportunityName) AS opportunity_name,
        COALESCE(o.StageName, o2.StageName, o3.StageName, o4.StageName, o5.StageName, o6.StageName) AS opportunity_stage,
        COALESCE(o.ACV, o2.ACV, o3.ACV, o4.ACV, o5.ACV, o6.ACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, o2.ClosedLostReason, o3.ClosedLostReason, o4.ClosedLostReason, o5.ClosedLostReason, o6.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(f.SQL_DT AS DATE), DAY) AS days_in_stage,
        -- Deduplicate by email to match summary COUNT(DISTINCT email)
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(f.LeadEmail, f.ContactEmail)
          ORDER BY
            CASE WHEN f.SQO_DT IS NOT NULL THEN 0 ELSE 1 END,
            CASE WHEN f.SAL_DT IS NOT NULL THEN 0 ELSE 1 END,
            f.SQL_DT DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\` f
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l
        ON f.LeadId = l.Id
      -- Tier 1-2: Direct OpportunityID or ConvertedOpportunityId
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId) = o.Id
      -- Tier 3: Name match (only if tiers 1-2 failed)
      LEFT JOIN name_matched_opps nmo
        ON f.OpportunityName = nmo.OpportunityName
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o2
        ON nmo.opp_id = o2.Id
      -- Tier 4: ContactId → Account (only if tiers 1-3 failed)
      LEFT JOIN contact_account_opps cao
        ON f.ContactId = cao.contact_id
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o3
        ON cao.opp_id = o3.Id
      -- Tier 5: Email → Contact → Account (only if tiers 1-4 failed)
      LEFT JOIN email_matched_opps emo
        ON LOWER(TRIM(COALESCE(f.LeadEmail, f.ContactEmail))) = emo.email
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o4
        ON emo.opp_id = o4.Id
      -- Tier 6: Fuzzy name match (only if all other tiers failed)
      LEFT JOIN fuzzy_name_matched_opps fnmo
        ON REGEXP_REPLACE(LOWER(TRIM(f.Company)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') = fnmo.normalized_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o5
        ON fnmo.opp_id = o5.Id
      -- Tier 7: Account.Name direct match (only if all other tiers failed)
      LEFT JOIN account_matched_opps amo
        ON LOWER(TRIM(f.Company)) = amo.account_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL AND fnmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o6
        ON amo.opp_id = o6.Id
      WHERE f.Division IN ('US', 'UK', 'AU')
        AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
        AND f.SQL_DT IS NOT NULL
        AND CAST(f.SQL_DT AS DATE) >= '${filters.startDate}'
        AND CAST(f.SQL_DT AS DATE) <= '${filters.endDate}'
        ${regionClause.replace(/Division/g, 'f.Division')}
    )
    SELECT * EXCEPT(rn)
    FROM ranked_sqls
    WHERE rn = 1
    ORDER BY sql_date DESC
  `;

  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // R360 SQL query - deduplicates by email to match summary COUNT(DISTINCT email)
  // 6-tier enhanced linking: OpportunityID → ConvertedOpportunityId → Name match → ContactId-Account → Email-Account → Fuzzy name
  const r360Query = `
    WITH name_matched_opps AS (
      -- Tier 3: Pre-compute opportunity lookups by exact name
      SELECT DISTINCT
        OpportunityName,
        FIRST_VALUE(Id) OVER (PARTITION BY OpportunityName ORDER BY CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE OpportunityName IS NOT NULL AND OpportunityName != ''
        AND por_record__c = false
    ),
    contact_account_opps AS (
      -- Tier 4: Match via ContactId → Contact.AccountId → Opportunity
      SELECT DISTINCT
        c.Id AS contact_id,
        FIRST_VALUE(o.Id) OVER (PARTITION BY c.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.AccountId IS NOT NULL AND o.por_record__c = false
    ),
    email_matched_opps AS (
      -- Tier 5: Match via Email → Contact → Account → Opportunity
      SELECT DISTINCT
        LOWER(TRIM(c.Email)) AS email,
        FIRST_VALUE(o.Id) OVER (PARTITION BY LOWER(TRIM(c.Email)) ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.Email IS NOT NULL AND c.Email != '' AND c.AccountId IS NOT NULL
        AND o.por_record__c = false
    ),
    fuzzy_name_matched_opps AS (
      -- Tier 6: Fuzzy company name match (remove Inc, LLC, Ltd, etc.)
      SELECT DISTINCT
        REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') AS normalized_name,
        FIRST_VALUE(o.Id) OVER (
          PARTITION BY REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '')
          ORDER BY o.CreatedDate DESC
        ) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.AccountName IS NOT NULL AND o.AccountName != '' AND o.por_record__c = false
    ),
    account_matched_opps AS (
      -- Tier 7: Direct Account.Name match → find any Opportunity on that Account
      SELECT DISTINCT
        LOWER(TRIM(a.Name)) AS account_name,
        FIRST_VALUE(o.Id) OVER (PARTITION BY a.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON a.Id = o.AccountId
      WHERE a.Name IS NOT NULL AND a.Name != ''
        AND o.por_record__c = false
    ),
    ranked_sqls AS (
      SELECT
        'R360' AS product,
        f.Region AS region,
        f.LeadId AS record_id,
        -- 7-tier URL resolution
        CASE
          WHEN f.OpportunityID IS NOT NULL AND f.OpportunityID != '' THEN f.OpportunityLink
          WHEN l.ConvertedOpportunityId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', l.ConvertedOpportunityId)
          WHEN nmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', nmo.opp_id)
          WHEN cao.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', cao.opp_id)
          WHEN emo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', emo.opp_id)
          WHEN fnmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', fnmo.opp_id)
          WHEN amo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', amo.opp_id)
          WHEN NULLIF(f.LeadId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.LeadId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(f.Company, 'Unknown') AS company_name,
        f.Email AS email,
        UPPER(COALESCE(NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        CAST(f.SQL_DT AS STRING) AS sql_date,
        CAST(f.MQL_DT AS STRING) AS mql_date,
        DATE_DIFF(CAST(f.SQL_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY) AS days_mql_to_sql,
        'N/A' AS converted_to_sal,
        CASE WHEN f.SQO_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        -- 7-tier has_opportunity check
        CASE WHEN (f.OpportunityID IS NOT NULL AND f.OpportunityID != '')
               OR l.ConvertedOpportunityId IS NOT NULL
               OR nmo.opp_id IS NOT NULL
               OR cao.opp_id IS NOT NULL
               OR emo.opp_id IS NOT NULL
               OR fnmo.opp_id IS NOT NULL
               OR amo.opp_id IS NOT NULL
        THEN 'Yes' ELSE 'No' END AS has_opportunity,
        CASE
          WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'WON'
          WHEN f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN COALESCE(o.IsClosed, o2.IsClosed, o3.IsClosed, o4.IsClosed, o5.IsClosed, o6.IsClosed, false) AND NOT COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SQL_DT AS DATE), DAY) > 45 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sql_status,
        -- 7-tier opportunity_id
        COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id) AS opportunity_id,
        COALESCE(f.OpportunityName, o.OpportunityName, o2.OpportunityName, o3.OpportunityName, o4.OpportunityName, o5.OpportunityName, o6.OpportunityName) AS opportunity_name,
        COALESCE(o.StageName, o2.StageName, o3.StageName, o4.StageName, o5.StageName, o6.StageName) AS opportunity_stage,
        COALESCE(o.ACV, o2.ACV, o3.ACV, o4.ACV, o5.ACV, o6.ACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, o2.ClosedLostReason, o3.ClosedLostReason, o4.ClosedLostReason, o5.ClosedLostReason, o6.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(f.SQL_DT AS DATE), DAY) AS days_in_stage,
        -- Deduplicate by email to match summary COUNT(DISTINCT email)
        ROW_NUMBER() OVER (
          PARTITION BY f.Email
          ORDER BY
            CASE WHEN f.SQO_DT IS NOT NULL THEN 0 ELSE 1 END,
            f.SQL_DT DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\` f
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l
        ON f.LeadId = l.Id
      -- Tier 1-2: Direct OpportunityID or ConvertedOpportunityId
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId) = o.Id
      -- Tier 3: Name match (only if tiers 1-2 failed)
      LEFT JOIN name_matched_opps nmo
        ON f.OpportunityName = nmo.OpportunityName
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o2
        ON nmo.opp_id = o2.Id
      -- Tier 4: ContactId → Account (only if tiers 1-3 failed)
      LEFT JOIN contact_account_opps cao
        ON f.ContactId = cao.contact_id
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o3
        ON cao.opp_id = o3.Id
      -- Tier 5: Email → Contact → Account (only if tiers 1-4 failed)
      LEFT JOIN email_matched_opps emo
        ON LOWER(TRIM(f.Email)) = emo.email
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o4
        ON emo.opp_id = o4.Id
      -- Tier 6: Fuzzy name match (only if all other tiers failed)
      LEFT JOIN fuzzy_name_matched_opps fnmo
        ON REGEXP_REPLACE(LOWER(TRIM(f.Company)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') = fnmo.normalized_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o5
        ON fnmo.opp_id = o5.Id
      -- Tier 7: Account.Name direct match (only if all other tiers failed)
      LEFT JOIN account_matched_opps amo
        ON LOWER(TRIM(f.Company)) = amo.account_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL AND fnmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o6
        ON amo.opp_id = o6.Id
      WHERE f.MQL_Reverted = false
        AND f.Region IS NOT NULL
        AND f.SQL_DT IS NOT NULL
        AND CAST(f.SQL_DT AS DATE) >= '${filters.startDate}'
        AND CAST(f.SQL_DT AS DATE) <= '${filters.endDate}'
        ${r360RegionClause.replace(/Region/g, 'f.Region')}
    )
    SELECT * EXCEPT(rn)
    FROM ranked_sqls
    WHERE rn = 1
    ORDER BY sql_date DESC
  `;

  try {
    const shouldFetchPOR = filters.products.length === 0 || filters.products.includes('POR');
    const shouldFetchR360 = filters.products.length === 0 || filters.products.includes('R360');

    const [porRows, r360Rows] = await Promise.all([
      shouldFetchPOR ? getBigQuery().query({ query: porQuery }).then(r => r[0]) : Promise.resolve([]),
      shouldFetchR360 ? getBigQuery().query({ query: r360Query }).then(r => r[0]) : Promise.resolve([]),
    ]);

    return {
      POR: porRows as any[],
      R360: r360Rows as any[],
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
    ? `AND f.Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  // POR SAL query - deduplicates by email, JOINs to get opportunity details
  // Note: R360 doesn't have SAL stage, so only POR query needed
  // 6-tier enhanced linking: OpportunityID → ConvertedOpportunityId → Name match → ContactId-Account → Email-Account → Fuzzy name
  const porQuery = `
    WITH name_matched_opps AS (
      -- Tier 3: Pre-compute opportunity lookups by exact name
      SELECT DISTINCT
        OpportunityName,
        FIRST_VALUE(Id) OVER (PARTITION BY OpportunityName ORDER BY CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE OpportunityName IS NOT NULL AND OpportunityName != ''
        AND por_record__c = true AND Division IN ('US', 'UK', 'AU')
    ),
    contact_account_opps AS (
      -- Tier 4: Match via ContactId → Contact.AccountId → Opportunity
      SELECT DISTINCT
        c.Id AS contact_id,
        FIRST_VALUE(o.Id) OVER (PARTITION BY c.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.AccountId IS NOT NULL
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    email_matched_opps AS (
      -- Tier 5: Match via Email → Contact → Account → Opportunity
      SELECT DISTINCT
        LOWER(TRIM(c.Email)) AS email,
        FIRST_VALUE(o.Id) OVER (PARTITION BY LOWER(TRIM(c.Email)) ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.Email IS NOT NULL AND c.Email != '' AND c.AccountId IS NOT NULL
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    fuzzy_name_matched_opps AS (
      -- Tier 6: Fuzzy company name match (remove Inc, LLC, Ltd, etc.)
      SELECT DISTINCT
        REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') AS normalized_name,
        FIRST_VALUE(o.Id) OVER (
          PARTITION BY REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '')
          ORDER BY o.CreatedDate DESC
        ) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.AccountName IS NOT NULL AND o.AccountName != ''
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    account_matched_opps AS (
      -- Tier 7: Direct Account.Name match → find any Opportunity on that Account
      SELECT DISTINCT
        LOWER(TRIM(a.Name)) AS account_name,
        FIRST_VALUE(o.Id) OVER (PARTITION BY a.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON a.Id = o.AccountId
      WHERE a.Name IS NOT NULL AND a.Name != ''
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    ranked_sals AS (
      SELECT
        'POR' AS product,
        CASE f.Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        COALESCE(f.LeadId, f.ContactId) AS record_id,
        -- 7-tier URL resolution
        CASE
          WHEN f.OpportunityID IS NOT NULL AND f.OpportunityID != '' THEN f.OpportunityLink
          WHEN l.ConvertedOpportunityId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', l.ConvertedOpportunityId)
          WHEN nmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', nmo.opp_id)
          WHEN cao.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', cao.opp_id)
          WHEN emo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', emo.opp_id)
          WHEN fnmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', fnmo.opp_id)
          WHEN amo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', amo.opp_id)
          WHEN NULLIF(f.LeadId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.LeadId)
          WHEN NULLIF(f.ContactId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.ContactId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(f.Company, 'Unknown') AS company_name,
        COALESCE(f.LeadEmail, f.ContactEmail, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        CAST(f.SAL_DT AS STRING) AS sal_date,
        CAST(f.SQL_DT AS STRING) AS sql_date,
        CAST(f.MQL_DT AS STRING) AS mql_date,
        DATE_DIFF(CAST(f.SAL_DT AS DATE), CAST(f.SQL_DT AS DATE), DAY) AS days_sql_to_sal,
        CASE WHEN f.SQO_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
        -- 7-tier has_opportunity check
        CASE WHEN (f.OpportunityID IS NOT NULL AND f.OpportunityID != '')
               OR l.ConvertedOpportunityId IS NOT NULL
               OR nmo.opp_id IS NOT NULL
               OR cao.opp_id IS NOT NULL
               OR emo.opp_id IS NOT NULL
               OR fnmo.opp_id IS NOT NULL
               OR amo.opp_id IS NOT NULL
        THEN 'Yes' ELSE 'No' END AS has_opportunity,
        CASE
          WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'WON'
          WHEN f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
          WHEN COALESCE(o.IsClosed, o2.IsClosed, o3.IsClosed, o4.IsClosed, o5.IsClosed, o6.IsClosed, false) AND NOT COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SAL_DT AS DATE), DAY) > 45 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sal_status,
        -- 7-tier opportunity_id
        COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id) AS opportunity_id,
        COALESCE(f.OpportunityName, o.OpportunityName, o2.OpportunityName, o3.OpportunityName, o4.OpportunityName, o5.OpportunityName, o6.OpportunityName) AS opportunity_name,
        COALESCE(o.StageName, o2.StageName, o3.StageName, o4.StageName, o5.StageName, o6.StageName) AS opportunity_stage,
        COALESCE(o.ACV, o2.ACV, o3.ACV, o4.ACV, o5.ACV, o6.ACV) AS opportunity_acv,
        -- Prefer RejectedReason over ClosedLostReason for SAL rejection tracking
        COALESCE(
          NULLIF(COALESCE(o.RejectedReason, o2.RejectedReason, o3.RejectedReason, o4.RejectedReason, o5.RejectedReason, o6.RejectedReason), ''),
          NULLIF(COALESCE(o.ClosedLostReason, o2.ClosedLostReason, o3.ClosedLostReason, o4.ClosedLostReason, o5.ClosedLostReason, o6.ClosedLostReason), ''),
          'N/A'
        ) AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(f.SAL_DT AS DATE), DAY) AS days_in_stage,
        -- Derive category from opportunity Type field
        CASE
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Existing Business' THEN 'EXPANSION'
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Migration' THEN 'MIGRATION'
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        -- Deduplicate by email to match summary
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(f.LeadEmail, f.ContactEmail)
          ORDER BY
            CASE WHEN f.SQO_DT IS NOT NULL THEN 0 ELSE 1 END,
            f.SAL_DT DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\` f
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l
        ON f.LeadId = l.Id
      -- Tier 1-2: Direct OpportunityID or ConvertedOpportunityId
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId) = o.Id
      -- Tier 3: Name match (only if tiers 1-2 failed)
      LEFT JOIN name_matched_opps nmo
        ON f.OpportunityName = nmo.OpportunityName
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o2
        ON nmo.opp_id = o2.Id
      -- Tier 4: ContactId → Account (only if tiers 1-3 failed)
      LEFT JOIN contact_account_opps cao
        ON f.ContactId = cao.contact_id
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o3
        ON cao.opp_id = o3.Id
      -- Tier 5: Email → Contact → Account (only if tiers 1-4 failed)
      LEFT JOIN email_matched_opps emo
        ON LOWER(TRIM(COALESCE(f.LeadEmail, f.ContactEmail))) = emo.email
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o4
        ON emo.opp_id = o4.Id
      -- Tier 6: Fuzzy name match (only if all other tiers failed)
      LEFT JOIN fuzzy_name_matched_opps fnmo
        ON REGEXP_REPLACE(LOWER(TRIM(f.Company)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') = fnmo.normalized_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o5
        ON fnmo.opp_id = o5.Id
      -- Tier 7: Account.Name direct match (only if all other tiers failed)
      LEFT JOIN account_matched_opps amo
        ON LOWER(TRIM(f.Company)) = amo.account_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL AND fnmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o6
        ON amo.opp_id = o6.Id
      WHERE f.Division IN ('US', 'UK', 'AU')
        AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
        AND f.SAL_DT IS NOT NULL
        AND CAST(f.SAL_DT AS DATE) >= '${filters.startDate}'
        AND CAST(f.SAL_DT AS DATE) <= '${filters.endDate}'
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
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(o.CreatedDate AS DATE), DAY) > 45 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sal_status,
        o.Id AS opportunity_id,
        o.OpportunityName AS opportunity_name,
        o.StageName AS opportunity_stage,
        o.ACV AS opportunity_acv,
        -- Prefer RejectedReason over ClosedLostReason for SAL rejection tracking
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
        -- SAL stage = past Needs Analysis stage OR Won
        AND (o.StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR o.Won)
        AND CAST(o.CreatedDate AS DATE) >= '${filters.startDate}'
        AND CAST(o.CreatedDate AS DATE) <= '${filters.endDate}'
        ${regionClause.replace(/f\.Division/g, 'o.Division')}
    )
    SELECT * EXCEPT(rn) FROM ranked_sals WHERE rn = 1
    UNION ALL
    SELECT * EXCEPT(rn) FROM expansion_migration_sals WHERE rn = 1
    ORDER BY sal_date DESC
  `;

  try {
    const [porRows] = await getBigQuery().query({ query: porQuery });
    console.log(`SAL query returned ${porRows?.length || 0} rows`);
    return {
      POR: porRows as any[],
      R360: [] as any[], // R360 doesn't have SAL stage
    };
  } catch (error) {
    console.error('SAL details query failed:', error);
    return { POR: [], R360: [] };
  }
}

// SQO Details Query - Full implementation with JOINs and deduplication
// Enhanced: Uses OpportunityName lookup as fallback when OpportunityID and ConvertedOpportunityId are NULL
async function getSQODetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND f.Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  // POR SQO query - deduplicates by opportunity, JOINs for details
  // 6-tier enhanced linking: OpportunityID → ConvertedOpportunityId → Name match → ContactId-Account → Email-Account → Fuzzy name
  const porQuery = `
    WITH name_matched_opps AS (
      -- Tier 3: Pre-compute opportunity lookups by exact name
      SELECT DISTINCT
        OpportunityName,
        FIRST_VALUE(Id) OVER (PARTITION BY OpportunityName ORDER BY CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE OpportunityName IS NOT NULL AND OpportunityName != ''
        AND por_record__c = true AND Division IN ('US', 'UK', 'AU')
    ),
    contact_account_opps AS (
      -- Tier 4: Match via ContactId → Contact.AccountId → Opportunity
      SELECT DISTINCT
        c.Id AS contact_id,
        FIRST_VALUE(o.Id) OVER (PARTITION BY c.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.AccountId IS NOT NULL
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    email_matched_opps AS (
      -- Tier 5: Match via Email → Contact → Account → Opportunity
      SELECT DISTINCT
        LOWER(TRIM(c.Email)) AS email,
        FIRST_VALUE(o.Id) OVER (PARTITION BY LOWER(TRIM(c.Email)) ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.Email IS NOT NULL AND c.Email != '' AND c.AccountId IS NOT NULL
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    fuzzy_name_matched_opps AS (
      -- Tier 6: Fuzzy company name match (remove Inc, LLC, Ltd, etc.)
      SELECT DISTINCT
        REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') AS normalized_name,
        FIRST_VALUE(o.Id) OVER (
          PARTITION BY REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '')
          ORDER BY o.CreatedDate DESC
        ) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.AccountName IS NOT NULL AND o.AccountName != ''
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    account_matched_opps AS (
      -- Tier 7: Direct Account.Name match → find any Opportunity on that Account
      SELECT DISTINCT
        LOWER(TRIM(a.Name)) AS account_name,
        FIRST_VALUE(o.Id) OVER (PARTITION BY a.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON a.Id = o.AccountId
      WHERE a.Name IS NOT NULL AND a.Name != ''
        AND o.por_record__c = true AND o.Division IN ('US', 'UK', 'AU')
    ),
    ranked_sqos AS (
      SELECT
        'POR' AS product,
        CASE f.Division
          WHEN 'US' THEN 'AMER'
          WHEN 'UK' THEN 'EMEA'
          WHEN 'AU' THEN 'APAC'
        END AS region,
        COALESCE(f.OpportunityID, f.LeadId, f.ContactId) AS record_id,
        -- 7-tier URL resolution
        CASE
          WHEN f.OpportunityID IS NOT NULL AND f.OpportunityID != '' THEN f.OpportunityLink
          WHEN l.ConvertedOpportunityId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', l.ConvertedOpportunityId)
          WHEN nmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', nmo.opp_id)
          WHEN cao.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', cao.opp_id)
          WHEN emo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', emo.opp_id)
          WHEN fnmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', fnmo.opp_id)
          WHEN amo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', amo.opp_id)
          WHEN NULLIF(f.LeadId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.LeadId)
          WHEN NULLIF(f.ContactId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.ContactId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(f.Company, 'Unknown') AS company_name,
        COALESCE(f.LeadEmail, f.ContactEmail, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        CAST(f.SQO_DT AS STRING) AS sqo_date,
        CAST(f.SAL_DT AS STRING) AS sal_date,
        CAST(f.SQL_DT AS STRING) AS sql_date,
        CAST(f.MQL_DT AS STRING) AS mql_date,
        DATE_DIFF(CAST(f.SQO_DT AS DATE), CAST(f.SAL_DT AS DATE), DAY) AS days_sal_to_sqo,
        DATE_DIFF(CAST(f.SQO_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY) AS days_total_cycle,
        -- 7-tier sqo_status check
        CASE
          WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'WON'
          WHEN COALESCE(o.IsClosed, o2.IsClosed, o3.IsClosed, o4.IsClosed, o5.IsClosed, o6.IsClosed, false) AND NOT COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SQO_DT AS DATE), DAY) > 60 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        -- 7-tier opportunity_id
        COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id) AS opportunity_id,
        COALESCE(f.OpportunityName, o.OpportunityName, o2.OpportunityName, o3.OpportunityName, o4.OpportunityName, o5.OpportunityName, o6.OpportunityName) AS opportunity_name,
        COALESCE(o.StageName, o2.StageName, o3.StageName, o4.StageName, o5.StageName, o6.StageName) AS opportunity_stage,
        COALESCE(o.ACV, o2.ACV, o3.ACV, o4.ACV, o5.ACV, o6.ACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, o2.ClosedLostReason, o3.ClosedLostReason, o4.ClosedLostReason, o5.ClosedLostReason, o6.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(f.SQO_DT AS DATE), DAY) AS days_in_stage,
        -- Derive category from opportunity Type field
        CASE
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Existing Business' THEN 'EXPANSION'
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Migration' THEN 'MIGRATION'
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        -- Deduplicate by opportunity ID, preferring won deals
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id, COALESCE(f.LeadEmail, f.ContactEmail))
          ORDER BY
            CASE WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 0 ELSE 1 END,
            f.SQO_DT DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.InboundFunnel\` f
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l
        ON f.LeadId = l.Id
      -- Tier 1-2: Direct OpportunityID or ConvertedOpportunityId
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId) = o.Id
      -- Tier 3: Name match (only if tiers 1-2 failed)
      LEFT JOIN name_matched_opps nmo
        ON f.OpportunityName = nmo.OpportunityName
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o2
        ON nmo.opp_id = o2.Id
      -- Tier 4: ContactId → Account (only if tiers 1-3 failed)
      LEFT JOIN contact_account_opps cao
        ON f.ContactId = cao.contact_id
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o3
        ON cao.opp_id = o3.Id
      -- Tier 5: Email → Contact → Account (only if tiers 1-4 failed)
      LEFT JOIN email_matched_opps emo
        ON LOWER(TRIM(COALESCE(f.LeadEmail, f.ContactEmail))) = emo.email
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o4
        ON emo.opp_id = o4.Id
      -- Tier 6: Fuzzy name match (only if all other tiers failed)
      LEFT JOIN fuzzy_name_matched_opps fnmo
        ON REGEXP_REPLACE(LOWER(TRIM(f.Company)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') = fnmo.normalized_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o5
        ON fnmo.opp_id = o5.Id
      -- Tier 7: Account.Name direct match (only if all other tiers failed)
      LEFT JOIN account_matched_opps amo
        ON LOWER(TRIM(f.Company)) = amo.account_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL AND fnmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o6
        ON amo.opp_id = o6.Id
      WHERE f.Division IN ('US', 'UK', 'AU')
        AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
        AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
        AND f.SQO_DT IS NOT NULL
        AND CAST(f.SQO_DT AS DATE) >= '${filters.startDate}'
        AND CAST(f.SQO_DT AS DATE) <= '${filters.endDate}'
        ${regionClause}
    )
    SELECT * EXCEPT(rn)
    FROM ranked_sqos
    WHERE rn = 1
    ORDER BY sqo_date DESC
  `;

  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND f.Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // R360 SQO query - deduplicates, JOINs for details (no SAL stage in R360)
  // 6-tier enhanced linking: OpportunityID → ConvertedOpportunityId → Name match → ContactId-Account → Email-Account → Fuzzy name
  const r360Query = `
    WITH name_matched_opps AS (
      -- Tier 3: Pre-compute opportunity lookups by exact name
      SELECT DISTINCT
        OpportunityName,
        FIRST_VALUE(Id) OVER (PARTITION BY OpportunityName ORDER BY CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\`
      WHERE OpportunityName IS NOT NULL AND OpportunityName != ''
        AND por_record__c = false
    ),
    contact_account_opps AS (
      -- Tier 4: Match via ContactId → Contact.AccountId → Opportunity
      SELECT DISTINCT
        c.Id AS contact_id,
        FIRST_VALUE(o.Id) OVER (PARTITION BY c.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.AccountId IS NOT NULL AND o.por_record__c = false
    ),
    email_matched_opps AS (
      -- Tier 5: Match via Email → Contact → Account → Opportunity
      SELECT DISTINCT
        LOWER(TRIM(c.Email)) AS email,
        FIRST_VALUE(o.Id) OVER (PARTITION BY LOWER(TRIM(c.Email)) ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Contact\` c
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON c.AccountId = o.AccountId
      WHERE c.Email IS NOT NULL AND c.Email != '' AND c.AccountId IS NOT NULL
        AND o.por_record__c = false
    ),
    fuzzy_name_matched_opps AS (
      -- Tier 6: Fuzzy company name match (remove Inc, LLC, Ltd, etc.)
      SELECT DISTINCT
        REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') AS normalized_name,
        FIRST_VALUE(o.Id) OVER (
          PARTITION BY REGEXP_REPLACE(LOWER(TRIM(o.AccountName)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '')
          ORDER BY o.CreatedDate DESC
        ) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
      WHERE o.AccountName IS NOT NULL AND o.AccountName != '' AND o.por_record__c = false
    ),
    account_matched_opps AS (
      -- Tier 7: Direct Account.Name match → find any Opportunity on that Account
      SELECT DISTINCT
        LOWER(TRIM(a.Name)) AS account_name,
        FIRST_VALUE(o.Id) OVER (PARTITION BY a.Id ORDER BY o.CreatedDate DESC) AS opp_id
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Account\` a
      INNER JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON a.Id = o.AccountId
      WHERE a.Name IS NOT NULL AND a.Name != ''
        AND o.por_record__c = false
    ),
    ranked_sqos AS (
      SELECT
        'R360' AS product,
        f.Region AS region,
        COALESCE(f.OpportunityID, f.LeadId) AS record_id,
        -- 7-tier URL resolution
        CASE
          WHEN f.OpportunityID IS NOT NULL AND f.OpportunityID != '' THEN f.OpportunityLink
          WHEN l.ConvertedOpportunityId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', l.ConvertedOpportunityId)
          WHEN nmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', nmo.opp_id)
          WHEN cao.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', cao.opp_id)
          WHEN emo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', emo.opp_id)
          WHEN fnmo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', fnmo.opp_id)
          WHEN amo.opp_id IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', amo.opp_id)
          WHEN NULLIF(f.LeadId, '') IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', f.LeadId)
          ELSE 'https://por.my.salesforce.com/'
        END AS salesforce_url,
        COALESCE(f.Company, 'Unknown') AS company_name,
        COALESCE(f.Email, 'N/A') AS email,
        UPPER(COALESCE(NULLIF(f.SDRSource, ''), 'INBOUND')) AS source,
        CAST(f.SQO_DT AS STRING) AS sqo_date,
        'N/A' AS sal_date,
        CAST(f.SQL_DT AS STRING) AS sql_date,
        CAST(f.MQL_DT AS STRING) AS mql_date,
        0 AS days_sal_to_sqo,
        DATE_DIFF(CAST(f.SQO_DT AS DATE), CAST(f.MQL_DT AS DATE), DAY) AS days_total_cycle,
        -- 7-tier sqo_status check
        CASE
          WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'WON'
          WHEN COALESCE(o.IsClosed, o2.IsClosed, o3.IsClosed, o4.IsClosed, o5.IsClosed, o6.IsClosed, false) AND NOT COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 'LOST'
          WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SQO_DT AS DATE), DAY) > 60 THEN 'STALLED'
          ELSE 'ACTIVE'
        END AS sqo_status,
        -- 7-tier opportunity_id
        COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id) AS opportunity_id,
        COALESCE(f.OpportunityName, o.OpportunityName, o2.OpportunityName, o3.OpportunityName, o4.OpportunityName, o5.OpportunityName, o6.OpportunityName) AS opportunity_name,
        COALESCE(o.StageName, o2.StageName, o3.StageName, o4.StageName, o5.StageName, o6.StageName) AS opportunity_stage,
        COALESCE(o.ACV, o2.ACV, o3.ACV, o4.ACV, o5.ACV, o6.ACV) AS opportunity_acv,
        COALESCE(o.ClosedLostReason, o2.ClosedLostReason, o3.ClosedLostReason, o4.ClosedLostReason, o5.ClosedLostReason, o6.ClosedLostReason, 'N/A') AS loss_reason,
        DATE_DIFF(CURRENT_DATE(), CAST(f.SQO_DT AS DATE), DAY) AS days_in_stage,
        -- Derive category from opportunity Type field
        CASE
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Existing Business' THEN 'EXPANSION'
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Migration' THEN 'MIGRATION'
          WHEN COALESCE(o.Type, o2.Type, o3.Type, o4.Type, o5.Type, o6.Type) = 'Strategic' THEN 'STRATEGIC'
          ELSE 'NEW LOGO'
        END AS category,
        -- Deduplicate by opportunity ID
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId, nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id, f.Email)
          ORDER BY
            CASE WHEN COALESCE(o.Won, o2.Won, o3.Won, o4.Won, o5.Won, o6.Won, false) THEN 0 ELSE 1 END,
            f.SQO_DT DESC
        ) AS rn
      FROM \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.MARKETING_FUNNEL}.R360InboundFunnel\` f
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.Lead\` l
        ON f.LeadId = l.Id
      -- Tier 1-2: Direct OpportunityID or ConvertedOpportunityId
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o
        ON COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId) = o.Id
      -- Tier 3: Name match (only if tiers 1-2 failed)
      LEFT JOIN name_matched_opps nmo
        ON f.OpportunityName = nmo.OpportunityName
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o2
        ON nmo.opp_id = o2.Id
      -- Tier 4: ContactId → Account (only if tiers 1-3 failed)
      LEFT JOIN contact_account_opps cao
        ON f.ContactId = cao.contact_id
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o3
        ON cao.opp_id = o3.Id
      -- Tier 5: Email → Contact → Account (only if tiers 1-4 failed)
      LEFT JOIN email_matched_opps emo
        ON LOWER(TRIM(f.Email)) = emo.email
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o4
        ON emo.opp_id = o4.Id
      -- Tier 6: Fuzzy name match (only if all other tiers failed)
      LEFT JOIN fuzzy_name_matched_opps fnmo
        ON REGEXP_REPLACE(LOWER(TRIM(f.Company)), r'[,.]?\\s*(inc\\.?|llc\\.?|ltd\\.?|corp\\.?|co\\.?|company|corporation|limited|plc|l\\.?l\\.?c\\.?)\\s*$', '') = fnmo.normalized_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o5
        ON fnmo.opp_id = o5.Id
      -- Tier 7: Account.Name direct match (only if all other tiers failed)
      LEFT JOIN account_matched_opps amo
        ON LOWER(TRIM(f.Company)) = amo.account_name
        AND NULLIF(f.OpportunityID, '') IS NULL AND l.ConvertedOpportunityId IS NULL AND nmo.opp_id IS NULL AND cao.opp_id IS NULL AND emo.opp_id IS NULL AND fnmo.opp_id IS NULL
      LEFT JOIN \`${BIGQUERY_CONFIG.PROJECT_ID}.${BIGQUERY_CONFIG.DATASETS.SFDC}.OpportunityViewTable\` o6
        ON amo.opp_id = o6.Id
      WHERE f.Region IS NOT NULL
        AND f.MQL_Reverted = false
        AND f.SQO_DT IS NOT NULL
        AND CAST(f.SQO_DT AS DATE) >= '${filters.startDate}'
        AND CAST(f.SQO_DT AS DATE) <= '${filters.endDate}'
        ${r360RegionClause}
    )
    SELECT * EXCEPT(rn)
    FROM ranked_sqos
    WHERE rn = 1
    ORDER BY sqo_date DESC
  `;

  try {
    const [[porRows], [r360Rows]] = await Promise.all([
      getBigQuery().query({ query: porQuery }),
      getBigQuery().query({ query: r360Query }),
    ]);
    console.log(`SQO query returned ${porRows?.length || 0} POR rows, ${r360Rows?.length || 0} R360 rows`);

    return {
      POR: porRows as any[],
      R360: r360Rows as any[],
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
    const { startDate, endDate, products = [], regions = [] } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const filters: ReportFilters = { startDate, endDate, products, regions };

    // Execute all BigQuery queries in parallel
    const [
      revOpsData,
      revenueActuals,
      porFunnel,
      r360Funnel,
      porFunnelBySource,
      r360FunnelBySource,
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
      porFunnelByCategory,
      r360FunnelByCategory,
      renewalUpliftMap,
      renewalTargetsMap,
      ,  // sourceMixMap removed - source targets now from RevOpsReport directly
      fyTargetsMap,
      utmBreakdownData,
    ] = await Promise.all([
      getRevOpsQTDData(filters),
      getRevenueActuals(filters),
      filters.products.length === 0 || filters.products.includes('POR')
        ? getPORFunnelActuals(filters)
        : Promise.resolve([]),
      filters.products.length === 0 || filters.products.includes('R360')
        ? getR360FunnelActuals(filters)
        : Promise.resolve([]),
      filters.products.length === 0 || filters.products.includes('POR')
        ? getFunnelBySource(filters, 'POR')
        : Promise.resolve([]),
      filters.products.length === 0 || filters.products.includes('R360')
        ? getFunnelBySource(filters, 'R360')
        : Promise.resolve([]),
      getWonDeals(filters),
      getLostDeals(filters),
      getPipelineDeals(filters),
      getGoogleAds(filters),
      getSourceActuals(filters),
      getPipelineAge(filters),
      getLossReasonRCA(filters),
      getMQLDetails(filters),
      getSQLDetails(filters),
      getSALDetails(filters),
      getSQODetails(filters),
      filters.products.length === 0 || filters.products.includes('POR')
        ? getFunnelByCategory(filters, 'POR')
        : Promise.resolve([]),
      filters.products.length === 0 || filters.products.includes('R360')
        ? getFunnelByCategory(filters, 'R360')
        : Promise.resolve([]),
      getUpcomingRenewalUplift(),
      getRenewalTargetsFromRawPlan(),
      Promise.resolve(null),  // Source mix no longer needed - targets from RevOpsReport directly
      getFYTargetsFromPlan(),
      getUtmBreakdown(filters),
    ]);

    // Calculate period info
    const periodInfo = calculatePeriodInfo(startDate, endDate);

    // Build target map from RevOpsReport data (P75 targets)
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

    // CRITICAL: Ensure RENEWAL targets are present from RevOpsReport (P75)
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
          risk_profile: 'P75',
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

    // Build attainment detail from RevOpsReport P75 targets
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
        risk_profile: target.risk_profile || 'P75',
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
      risk_profile: 'P75',
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
          risk_profile: 'P75',
        };
      }
    }

    // Build funnel pacing from RevOpsReport data for ALL categories
    // NEW LOGO uses MQL, EXPANSION/MIGRATION use EQL (stored as MQL in RevOpsReport)
    const funnelPacing: any[] = [];

    // Calculate QTD proration factor for funnel pacing
    const funnelQtdProrationFactor = periodInfo.quarter_pct_complete / 100;

    // Build funnel targets and actuals from RevOpsReport for all categories
    // Key: product-region-category
    const funnelDataMap = new Map<string, {
      q1_target_mql: number;
      q1_target_sql: number;
      q1_target_sal: number;
      q1_target_sqo: number;
      actual_mql: number;
      actual_sql: number;
      actual_sal: number;
      actual_sqo: number;
    }>();

    for (const row of revOpsData) {
      // Only include categories with funnel data (exclude RENEWAL)
      if (!['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'].includes(row.category)) continue;

      const key = `${row.product}-${row.region}-${row.category}`;
      if (!funnelDataMap.has(key)) {
        funnelDataMap.set(key, {
          q1_target_mql: 0,
          q1_target_sql: 0,
          q1_target_sal: 0,
          q1_target_sqo: 0,
          actual_mql: 0,
          actual_sql: 0,
          actual_sal: 0,
          actual_sqo: 0,
        });
      }
      const existing = funnelDataMap.get(key)!;
      existing.q1_target_mql += parseInt(row.target_mql) || 0;
      existing.q1_target_sql += parseInt(row.target_sql) || 0;
      existing.q1_target_sal += parseInt(row.target_sal) || 0;
      existing.q1_target_sqo += parseInt(row.target_sqo) || 0;
      existing.actual_mql += parseInt(row.actual_mql) || 0;
      existing.actual_sql += parseInt(row.actual_sql) || 0;
      existing.actual_sal += parseInt(row.actual_sal) || 0;
      existing.actual_sqo += parseInt(row.actual_sqo) || 0;
    }

    // Override NEW LOGO actuals with live InboundFunnel data (more current than RevOpsReport)
    const allFunnel = [...(porFunnel as any[]), ...(r360Funnel as any[])];
    for (const f of allFunnel) {
      const key = `${f.product}-${f.region}-NEW LOGO`;
      const existing = funnelDataMap.get(key);
      if (existing) {
        existing.actual_mql = parseInt(f.actual_mql) || 0;
        existing.actual_sql = parseInt(f.actual_sql) || 0;
        existing.actual_sal = parseInt(f.actual_sal) || 0;
        existing.actual_sqo = parseInt(f.actual_sqo) || 0;
      }
    }

    // Build funnel pacing array for all categories
    for (const [key, data] of Array.from(funnelDataMap.entries())) {
      const [product, region, category] = key.split('-');

      // Skip if no meaningful targets
      if (data.q1_target_mql === 0 && data.q1_target_sql === 0 && data.q1_target_sqo === 0) continue;

      // Calculate prorated QTD targets
      const qtdTargetMql = Math.round(data.q1_target_mql * funnelQtdProrationFactor);
      const qtdTargetSql = Math.round(data.q1_target_sql * funnelQtdProrationFactor);
      const qtdTargetSal = Math.round(data.q1_target_sal * funnelQtdProrationFactor);
      const qtdTargetSqo = Math.round(data.q1_target_sqo * funnelQtdProrationFactor);

      // Calculate pacing against prorated QTD targets
      // Logic: target=0 means 100% pacing (met zero target). Rounded for display.
      const mqlPacing = qtdTargetMql > 0 ? Math.round((data.actual_mql / qtdTargetMql) * 100) : 100;
      const sqlPacing = qtdTargetSql > 0 ? Math.round((data.actual_sql / qtdTargetSql) * 100) : 100;
      const salPacing = qtdTargetSal > 0 ? Math.round((data.actual_sal / qtdTargetSal) * 100) : null; // SAL can be null if no target
      const sqoPacing = qtdTargetSqo > 0 ? Math.round((data.actual_sqo / qtdTargetSqo) * 100) : 100;

      // Calculate TOF Score: MQL/EQL=10%, SQL=20%, SAL=30%, SQO=40%
      const tofScore = Math.round(
        (mqlPacing || 0) * 0.10 +
        (sqlPacing || 0) * 0.20 +
        ((salPacing !== null ? salPacing : (sqlPacing || 0)) * 0.30) + // Use SQL pacing if no SAL
        (sqoPacing || 0) * 0.40
      );

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
    for (const a of sourceActualsRaw as any[]) {
      const key = `${a.product}-${a.region}-${a.source}`;
      sourceActualsMap.set(key, parseFloat(a.total_acv) || 0);
    }

    // Get source-level Q1 ACV targets directly from RevOpsReport (via funnel data)
    // This uses the same source of truth as category targets, eliminating variance
    const sourceTargetsMap = new Map<string, number>();
    for (const row of porFunnelBySource as any[]) {
      const key = `POR-${row.region}-${row.source}`;
      const targetAcv = parseFloat(row.target_acv) || 0;
      if (targetAcv > 0) {
        sourceTargetsMap.set(key, Math.round(targetAcv));
      }
    }
    for (const row of r360FunnelBySource as any[]) {
      const key = `R360-${row.region}-${row.source}`;
      const targetAcv = parseFloat(row.target_acv) || 0;
      if (targetAcv > 0) {
        sourceTargetsMap.set(key, Math.round(targetAcv));
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

    // Build funnel by source data
    const funnelBySource: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    // Note: sourceQtdProrationFactor already defined above for source attainment

    // Funnel by source: now includes source-level targets from plan with QTD proration
    for (const row of porFunnelBySource as any[]) {
      const q1TargetMql = parseInt(row.target_mql) || 0;
      const q1TargetSql = parseInt(row.target_sql) || 0;
      const q1TargetSal = parseInt(row.target_sal) || 0;
      const q1TargetSqo = parseInt(row.target_sqo) || 0;
      const q1TargetAcv = Math.round(parseFloat(row.target_acv) || 0);
      // Calculate QTD targets by applying proration factor
      const qtdTargetMql = Math.round(q1TargetMql * sourceQtdProrationFactor);
      const qtdTargetSql = Math.round(q1TargetSql * sourceQtdProrationFactor);
      const qtdTargetSal = Math.round(q1TargetSal * sourceQtdProrationFactor);
      const qtdTargetSqo = Math.round(q1TargetSqo * sourceQtdProrationFactor);
      const actualMql = parseInt(row.actual_mql) || 0;
      const actualSql = parseInt(row.actual_sql) || 0;
      const actualSal = parseInt(row.actual_sal) || 0;
      const actualSqo = parseInt(row.actual_sqo) || 0;

      funnelBySource.POR.push({
        region: row.region,
        source: row.source,
        target_acv: q1TargetAcv,
        actual_mql: actualMql,
        actual_sql: actualSql,
        actual_sal: actualSal,
        actual_sqo: actualSqo,
        q1_target_mql: q1TargetMql,
        q1_target_sql: q1TargetSql,
        q1_target_sal: q1TargetSal,
        q1_target_sqo: q1TargetSqo,
        qtd_target_mql: qtdTargetMql,
        qtd_target_sql: qtdTargetSql,
        qtd_target_sal: qtdTargetSal,
        qtd_target_sqo: qtdTargetSqo,
        // Pacing calculated against QTD targets (not Q1)
        mql_pacing_pct: qtdTargetMql > 0 ? Math.round((actualMql / qtdTargetMql) * 100) : 100,
        sql_pacing_pct: qtdTargetSql > 0 ? Math.round((actualSql / qtdTargetSql) * 100) : 100,
        sal_pacing_pct: qtdTargetSal > 0 ? Math.round((actualSal / qtdTargetSal) * 100) : 100,
        sqo_pacing_pct: qtdTargetSqo > 0 ? Math.round((actualSqo / qtdTargetSqo) * 100) : 100,
        // Gaps calculated against QTD targets
        mql_gap: actualMql - qtdTargetMql,
        sql_gap: actualSql - qtdTargetSql,
        sal_gap: actualSal - qtdTargetSal,
        sqo_gap: actualSqo - qtdTargetSqo,
        mql_to_sql_rate: parseFloat(row.mql_to_sql_rate) || 0,
        sql_to_sal_rate: parseFloat(row.sql_to_sal_rate) || 0,
        sal_to_sqo_rate: parseFloat(row.sal_to_sqo_rate) || 0,
      });
    }

    for (const row of r360FunnelBySource as any[]) {
      const q1TargetMql = parseInt(row.target_mql) || 0;
      const q1TargetSql = parseInt(row.target_sql) || 0;
      const q1TargetSqo = parseInt(row.target_sqo) || 0;
      const q1TargetAcv = Math.round(parseFloat(row.target_acv) || 0);
      // Calculate QTD targets by applying proration factor
      const qtdTargetMql = Math.round(q1TargetMql * sourceQtdProrationFactor);
      const qtdTargetSql = Math.round(q1TargetSql * sourceQtdProrationFactor);
      const qtdTargetSqo = Math.round(q1TargetSqo * sourceQtdProrationFactor);
      const actualMql = parseInt(row.actual_mql) || 0;
      const actualSql = parseInt(row.actual_sql) || 0;
      const actualSqo = parseInt(row.actual_sqo) || 0;

      funnelBySource.R360.push({
        region: row.region,
        source: row.source,
        target_acv: q1TargetAcv,
        actual_mql: actualMql,
        actual_sql: actualSql,
        actual_sal: 0,  // R360 has no SAL stage
        actual_sqo: actualSqo,
        q1_target_mql: q1TargetMql,
        q1_target_sql: q1TargetSql,
        q1_target_sal: 0,
        q1_target_sqo: q1TargetSqo,
        qtd_target_mql: qtdTargetMql,
        qtd_target_sql: qtdTargetSql,
        qtd_target_sal: 0,
        qtd_target_sqo: qtdTargetSqo,
        // Pacing calculated against QTD targets (not Q1)
        mql_pacing_pct: qtdTargetMql > 0 ? Math.round((actualMql / qtdTargetMql) * 100) : 100,
        sql_pacing_pct: qtdTargetSql > 0 ? Math.round((actualSql / qtdTargetSql) * 100) : 100,
        sal_pacing_pct: 100,
        sqo_pacing_pct: qtdTargetSqo > 0 ? Math.round((actualSqo / qtdTargetSqo) * 100) : 100,
        // Gaps calculated against QTD targets
        mql_gap: actualMql - qtdTargetMql,
        sql_gap: actualSql - qtdTargetSql,
        sal_gap: 0,
        sqo_gap: actualSqo - qtdTargetSqo,
        mql_to_sql_rate: parseFloat(row.mql_to_sql_rate) || 0,
        sql_to_sal_rate: 0,
        sal_to_sqo_rate: parseFloat(row.sal_to_sqo_rate) || 0,
      });
    }

    // Build funnel by category data
    const funnelByCategory: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    // Calculate QTD proration factor based on time elapsed in Q1
    const qtdProrationFactor = periodInfo.quarter_pct_complete / 100;

    // Get category-level targets from RevOpsReport
    const categoryTargetMap = new Map<string, any>();
    for (const row of revOpsData) {
      const key = `${row.product}-${row.region}-${row.category}`;
      if (!categoryTargetMap.has(key)) {
        categoryTargetMap.set(key, {
          q1_target_mql: 0,
          q1_target_sql: 0,
          q1_target_sal: 0,
          q1_target_sqo: 0,
        });
      }
      const existing = categoryTargetMap.get(key)!;
      existing.q1_target_mql += parseInt(row.target_mql) || 0;
      existing.q1_target_sql += parseInt(row.target_sql) || 0;
      existing.q1_target_sal += parseInt(row.target_sal) || 0;
      existing.q1_target_sqo += parseInt(row.target_sqo) || 0;
    }

    for (const row of porFunnelByCategory as any[]) {
      const key = `${row.product}-${row.region}-${row.category}`;
      const catTargets = categoryTargetMap.get(key) || {
        q1_target_mql: 0,
        q1_target_sql: 0,
        q1_target_sal: 0,
        q1_target_sqo: 0,
      };

      // Calculate prorated QTD targets based on time elapsed in Q1
      const qtdTargetMql = Math.round(catTargets.q1_target_mql * qtdProrationFactor);
      const qtdTargetSql = Math.round(catTargets.q1_target_sql * qtdProrationFactor);
      const qtdTargetSal = Math.round(catTargets.q1_target_sal * qtdProrationFactor);
      const qtdTargetSqo = Math.round(catTargets.q1_target_sqo * qtdProrationFactor);

      // Calculate pacing against prorated QTD targets
      // Logic: target=0 means 100% pacing (met zero target). Rounded for display.
      const mqlPacing = qtdTargetMql > 0 ? Math.round((parseInt(row.actual_mql) / qtdTargetMql) * 100) : 100;
      const sqlPacing = qtdTargetSql > 0 ? Math.round((parseInt(row.actual_sql) / qtdTargetSql) * 100) : 100;
      const salPacing = qtdTargetSal > 0 ? Math.round((parseInt(row.actual_sal) / qtdTargetSal) * 100) : 100;
      const sqoPacing = qtdTargetSqo > 0 ? Math.round((parseInt(row.actual_sqo) / qtdTargetSqo) * 100) : 100;

      funnelByCategory.POR.push({
        category: row.category,
        region: row.region,
        actual_mql: parseInt(row.actual_mql) || 0,
        q1_target_mql: Math.round(catTargets.q1_target_mql),
        qtd_target_mql: qtdTargetMql,
        mql_pacing_pct: mqlPacing,
        mql_gap: (parseInt(row.actual_mql) || 0) - qtdTargetMql,
        actual_sql: parseInt(row.actual_sql) || 0,
        q1_target_sql: Math.round(catTargets.q1_target_sql),
        qtd_target_sql: qtdTargetSql,
        sql_pacing_pct: sqlPacing,
        sql_gap: (parseInt(row.actual_sql) || 0) - qtdTargetSql,
        actual_sal: parseInt(row.actual_sal) || 0,
        q1_target_sal: Math.round(catTargets.q1_target_sal),
        qtd_target_sal: qtdTargetSal,
        sal_pacing_pct: salPacing,
        sal_gap: (parseInt(row.actual_sal) || 0) - qtdTargetSal,
        actual_sqo: parseInt(row.actual_sqo) || 0,
        q1_target_sqo: Math.round(catTargets.q1_target_sqo),
        qtd_target_sqo: qtdTargetSqo,
        sqo_pacing_pct: sqoPacing,
        sqo_gap: (parseInt(row.actual_sqo) || 0) - qtdTargetSqo,
        weighted_tof_score: Math.round((mqlPacing * 0.1 + sqlPacing * 0.2 + salPacing * 0.3 + sqoPacing * 0.4)),
      });
    }

    for (const row of r360FunnelByCategory as any[]) {
      const key = `${row.product}-${row.region}-${row.category}`;
      const catTargets = categoryTargetMap.get(key) || {
        q1_target_mql: 0,
        q1_target_sql: 0,
        q1_target_sal: 0,
        q1_target_sqo: 0,
      };

      // Calculate prorated QTD targets based on time elapsed in Q1
      const qtdTargetMql = Math.round(catTargets.q1_target_mql * qtdProrationFactor);
      const qtdTargetSql = Math.round(catTargets.q1_target_sql * qtdProrationFactor);
      const qtdTargetSal = Math.round(catTargets.q1_target_sal * qtdProrationFactor);
      const qtdTargetSqo = Math.round(catTargets.q1_target_sqo * qtdProrationFactor);

      // Calculate pacing against prorated QTD targets
      // Logic: target=0 means 100% pacing (met zero target). Rounded for display.
      const mqlPacing = qtdTargetMql > 0 ? Math.round((parseInt(row.actual_mql) / qtdTargetMql) * 100) : 100;
      const sqlPacing = qtdTargetSql > 0 ? Math.round((parseInt(row.actual_sql) / qtdTargetSql) * 100) : 100;
      const salPacing = qtdTargetSal > 0 ? Math.round((parseInt(row.actual_sal) / qtdTargetSal) * 100) : 100;
      const sqoPacing = qtdTargetSqo > 0 ? Math.round((parseInt(row.actual_sqo) / qtdTargetSqo) * 100) : 100;

      funnelByCategory.R360.push({
        category: row.category,
        region: row.region,
        actual_mql: parseInt(row.actual_mql) || 0,
        q1_target_mql: Math.round(catTargets.q1_target_mql),
        qtd_target_mql: qtdTargetMql,
        mql_pacing_pct: mqlPacing,
        mql_gap: (parseInt(row.actual_mql) || 0) - qtdTargetMql,
        actual_sql: parseInt(row.actual_sql) || 0,
        q1_target_sql: Math.round(catTargets.q1_target_sql),
        qtd_target_sql: qtdTargetSql,
        sql_pacing_pct: sqlPacing,
        sql_gap: (parseInt(row.actual_sql) || 0) - qtdTargetSql,
        actual_sal: parseInt(row.actual_sal) || 0,
        q1_target_sal: Math.round(catTargets.q1_target_sal),
        qtd_target_sal: qtdTargetSal,
        sal_pacing_pct: salPacing,
        sal_gap: (parseInt(row.actual_sal) || 0) - qtdTargetSal,
        actual_sqo: parseInt(row.actual_sqo) || 0,
        q1_target_sqo: Math.round(catTargets.q1_target_sqo),
        qtd_target_sqo: qtdTargetSqo,
        sqo_pacing_pct: sqoPacing,
        sqo_gap: (parseInt(row.actual_sqo) || 0) - qtdTargetSqo,
        // R360 has no SAL stage - redistribute weights (10:20:40 → 14.3:28.6:57.1)
        weighted_tof_score: Math.round((mqlPacing * 0.143 + sqlPacing * 0.286 + sqoPacing * 0.571)),
      });
    }

    // Add entries for categories that have targets but no actuals (e.g., STRATEGIC with 0 deals)
    const funnelCategories = ['NEW LOGO', 'STRATEGIC', 'EXPANSION', 'MIGRATION'];
    const existingPorKeys = new Set(funnelByCategory.POR.map((r: any) => `${r.region}-${r.category}`));
    const existingR360Keys = new Set(funnelByCategory.R360.map((r: any) => `${r.region}-${r.category}`));

    for (const [key, catTargets] of Array.from(categoryTargetMap.entries())) {
      const [product, region, category] = key.split('-');
      if (!funnelCategories.includes(category)) continue;
      // Skip if no meaningful targets
      if ((catTargets.q1_target_mql + catTargets.q1_target_sql + catTargets.q1_target_sqo) === 0) continue;

      const rowKey = `${region}-${category}`;
      const qtdTargetMql = Math.round(catTargets.q1_target_mql * qtdProrationFactor);
      const qtdTargetSql = Math.round(catTargets.q1_target_sql * qtdProrationFactor);
      const qtdTargetSal = Math.round(catTargets.q1_target_sal * qtdProrationFactor);
      const qtdTargetSqo = Math.round(catTargets.q1_target_sqo * qtdProrationFactor);

      if (product === 'POR' && !existingPorKeys.has(rowKey)) {
        funnelByCategory.POR.push({
          category,
          region,
          actual_mql: 0, q1_target_mql: Math.round(catTargets.q1_target_mql), qtd_target_mql: qtdTargetMql,
          mql_pacing_pct: qtdTargetMql > 0 ? 0 : 100, mql_gap: -qtdTargetMql,
          actual_sql: 0, q1_target_sql: Math.round(catTargets.q1_target_sql), qtd_target_sql: qtdTargetSql,
          sql_pacing_pct: qtdTargetSql > 0 ? 0 : 100, sql_gap: -qtdTargetSql,
          actual_sal: 0, q1_target_sal: Math.round(catTargets.q1_target_sal), qtd_target_sal: qtdTargetSal,
          sal_pacing_pct: qtdTargetSal > 0 ? 0 : 100, sal_gap: -qtdTargetSal,
          actual_sqo: 0, q1_target_sqo: Math.round(catTargets.q1_target_sqo), qtd_target_sqo: qtdTargetSqo,
          sqo_pacing_pct: qtdTargetSqo > 0 ? 0 : 100, sqo_gap: -qtdTargetSqo,
          weighted_tof_score: 0,
        });
      }
      if (product === 'R360' && !existingR360Keys.has(rowKey)) {
        funnelByCategory.R360.push({
          category,
          region,
          actual_mql: 0, q1_target_mql: Math.round(catTargets.q1_target_mql), qtd_target_mql: qtdTargetMql,
          mql_pacing_pct: qtdTargetMql > 0 ? 0 : 100, mql_gap: -qtdTargetMql,
          actual_sql: 0, q1_target_sql: Math.round(catTargets.q1_target_sql), qtd_target_sql: qtdTargetSql,
          sql_pacing_pct: qtdTargetSql > 0 ? 0 : 100, sql_gap: -qtdTargetSql,
          actual_sal: 0, q1_target_sal: Math.round(catTargets.q1_target_sal), qtd_target_sal: qtdTargetSal,
          sal_pacing_pct: qtdTargetSal > 0 ? 0 : 100, sal_gap: -qtdTargetSal,
          actual_sqo: 0, q1_target_sqo: Math.round(catTargets.q1_target_sqo), qtd_target_sqo: qtdTargetSqo,
          sqo_pacing_pct: qtdTargetSqo > 0 ? 0 : 100, sqo_gap: -qtdTargetSqo,
          weighted_tof_score: 0,
        });
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
        targets: 'RevOpsReport (P75)',
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
    description: 'Fetch Q1 2026 Risk Report data using RevOps architecture with P75 targets',
    data_sources: {
      targets: 'Staging.RevOpsReport (RiskProfile=P75, Horizon=QTD)',
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
      'Uses P75 risk profile for conservative/realistic targets',
      'RevOpsReport provides pre-calculated QTD attainment',
      'OpportunityType maps to Category (New Business -> NEW LOGO, etc.)',
      'Renewal forecasts include expected uplift from auto-renewing contracts',
    ],
  });
}
