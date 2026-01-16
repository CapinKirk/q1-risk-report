import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// Initialize BigQuery client with credentials from environment
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'data-analytics-306119';

function initBigQuery(): BigQuery {
  // Check for credentials JSON in environment (Vercel deployment)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    console.log('BigQuery: Using GOOGLE_CREDENTIALS_JSON env var');
    return new BigQuery({ projectId, credentials });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('BigQuery: Using GOOGLE_APPLICATION_CREDENTIALS_JSON env var');
    return new BigQuery({ projectId, credentials });
  }

  // Local development with gcloud auth
  console.log('BigQuery: Using default credentials (ADC)');
  return new BigQuery({ projectId });
}

const bigquery = initBigQuery();

interface ReportFilters {
  startDate: string;
  endDate: string;
  products: string[];
  regions: string[];
}

// Build WHERE clause for filters
function buildFilterClause(filters: ReportFilters): string {
  const conditions: string[] = [];

  if (filters.products && filters.products.length > 0) {
    const productList = filters.products.map(p => `'${p}'`).join(', ');
    conditions.push(`(
      (por_record__c = true AND '${filters.products.includes('POR') ? 'POR' : ''}' = 'POR') OR
      (r360_record__c = true AND '${filters.products.includes('R360') ? 'R360' : ''}' = 'R360')
    )`);
  }

  if (filters.regions && filters.regions.length > 0) {
    const regionMap: Record<string, string> = {
      'AMER': 'US',
      'EMEA': 'UK',
      'APAC': 'AU'
    };
    const divisions = filters.regions.map(r => `'${regionMap[r]}'`).join(', ');
    conditions.push(`Division IN (${divisions})`);
  }

  return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
}

// Helper to get BigQuery client
function getBigQuery(): BigQuery {
  return bigquery;
}

// Query for revenue actuals
async function getRevenueActuals(filters: ReportFilters) {
  const filterClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  const query = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE Type
        WHEN 'Existing Business' THEN 'EXPANSION'
        WHEN 'New Business' THEN 'NEW LOGO'
        WHEN 'Migration' THEN 'MIGRATION'
        WHEN 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
      Type AS deal_type,
      COUNT(*) AS deal_count,
      ROUND(SUM(ACV), 2) AS total_acv,
      ROUND(AVG(ACV), 2) AS avg_acv
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      ${filterClause}
      ${regionClause}
    GROUP BY product, region, category, source, deal_type
    ORDER BY product, region, category
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for targets
async function getTargets(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      RecordType AS product,
      Region AS region,
      CASE
        WHEN FunnelType IN ('NEW LOGO', 'INBOUND', 'R360 NEW LOGO', 'R360 INBOUND') THEN 'NEW LOGO'
        WHEN FunnelType IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
        WHEN FunnelType = 'MIGRATION' THEN 'MIGRATION'
        WHEN FunnelType IN ('RENEWAL', 'R360 RENEWAL') THEN 'RENEWAL'
        ELSE FunnelType
      END AS category,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
        THEN Target_ACV ELSE 0
      END), 2) AS q1_target,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_ACV ELSE 0
      END), 2) AS qtd_target,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
        THEN Target_MQL ELSE 0
      END), 0) AS q1_target_mql,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_MQL ELSE 0
      END), 0) AS target_mql,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
        THEN Target_SQL ELSE 0
      END), 0) AS q1_target_sql,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_SQL ELSE 0
      END), 0) AS target_sql,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
        THEN Target_SAL ELSE 0
      END), 0) AS q1_target_sal,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_SAL ELSE 0
      END), 0) AS target_sal,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
        THEN Target_SQO ELSE 0
      END), 0) AS q1_target_sqo,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_SQO ELSE 0
      END), 0) AS target_sqo
    FROM \`data-analytics-306119.Staging.StrategicOperatingPlan\`
    WHERE Percentile = 'P50'
      AND RecordType IN ('POR', 'R360')
      ${productClause}
      ${regionClause}
    GROUP BY product, region, category
    HAVING q1_target > 0
    ORDER BY product, region, category
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for funnel actuals (POR) - aggregated
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
    FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
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

// Query for funnel actuals by source (POR) - broken down by SDRSource
// Query for funnel actuals by source using DailyRevenueFunnel table
// This table has all sources (INBOUND, OUTBOUND, AE SOURCED, etc.)
async function getFunnelBySource(filters: ReportFilters, product: 'POR' | 'R360') {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  // Query actuals from DailyRevenueFunnel
  const actualsQuery = `
    SELECT
      RecordType AS product,
      Region AS region,
      UPPER(Source) AS source,
      COALESCE(SUM(MQL), 0) AS actual_mql,
      COALESCE(SUM(SQL), 0) AS actual_sql,
      COALESCE(SUM(SAL), 0) AS actual_sal,
      COALESCE(SUM(SQO), 0) AS actual_sqo
    FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
    WHERE RecordType = '${product}'
      AND CAST(CaptureDate AS DATE) >= '${filters.startDate}'
      AND CAST(CaptureDate AS DATE) <= '${filters.endDate}'
      AND Source IS NOT NULL
      ${regionClause}
    GROUP BY RecordType, Region, UPPER(Source)
  `;

  // Query targets from StrategicOperatingPlan
  const targetsQuery = `
    SELECT
      RecordType AS product,
      Region AS region,
      UPPER(Source) AS source,
      ROUND(SUM(Target_MQL), 0) AS target_mql,
      ROUND(SUM(Target_SQL), 0) AS target_sql,
      ROUND(SUM(Target_SAL), 0) AS target_sal,
      ROUND(SUM(Target_SQO), 0) AS target_sqo
    FROM \`data-analytics-306119.Staging.StrategicOperatingPlan\`
    WHERE Percentile = 'P50'
      AND RecordType = '${product}'
      AND TargetDate >= '${filters.startDate}'
      AND TargetDate <= '${filters.endDate}'
      AND Source IS NOT NULL
      ${regionClause}
    GROUP BY RecordType, Region, UPPER(Source)
  `;

  // Combined query joining actuals and targets
  const query = `
    WITH actuals AS (${actualsQuery}),
    targets AS (${targetsQuery})
    SELECT
      COALESCE(a.product, t.product) AS product,
      COALESCE(a.region, t.region) AS region,
      COALESCE(a.source, t.source) AS source,
      COALESCE(a.actual_mql, 0) AS actual_mql,
      COALESCE(t.target_mql, 0) AS target_mql,
      COALESCE(a.actual_sql, 0) AS actual_sql,
      COALESCE(t.target_sql, 0) AS target_sql,
      COALESCE(a.actual_sal, 0) AS actual_sal,
      COALESCE(t.target_sal, 0) AS target_sal,
      COALESCE(a.actual_sqo, 0) AS actual_sqo,
      COALESCE(t.target_sqo, 0) AS target_sqo,
      -- Pacing percentages
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_mql, 0), NULLIF(t.target_mql, 0)) * 100, 0) AS mql_pacing_pct,
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_sql, 0), NULLIF(t.target_sql, 0)) * 100, 0) AS sql_pacing_pct,
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_sal, 0), NULLIF(t.target_sal, 0)) * 100, 0) AS sal_pacing_pct,
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_sqo, 0), NULLIF(t.target_sqo, 0)) * 100, 0) AS sqo_pacing_pct,
      -- Conversion rates
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_sql, 0), NULLIF(a.actual_mql, 0)) * 100, 1) AS mql_to_sql_rate,
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_sal, 0), NULLIF(a.actual_sql, 0)) * 100, 1) AS sql_to_sal_rate,
      ROUND(SAFE_DIVIDE(COALESCE(a.actual_sqo, 0), NULLIF(a.actual_sal, 0)) * 100, 1) AS sal_to_sqo_rate
    FROM actuals a
    FULL OUTER JOIN targets t
      ON a.product = t.product
      AND a.region = t.region
      AND a.source = t.source
    ORDER BY region, source
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for funnel actuals (R360) - aggregated
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
    FROM \`data-analytics-306119.MarketingFunnel.R360InboundFunnel\`
    WHERE MQL_Reverted = false
      AND Region IS NOT NULL
      ${regionClause}
    GROUP BY 1, 2
    ORDER BY 2
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for funnel actuals BY CATEGORY (NEW LOGO, EXPANSION) from DailyRevenueFunnel
async function getFunnelByCategory(filters: ReportFilters, product: 'POR' | 'R360') {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      RecordType AS product,
      Region AS region,
      CASE
        WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW LOGO'
        WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
        WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
        ELSE 'OTHER'
      END AS category,
      COALESCE(SUM(MQL), 0) AS actual_mql,
      COALESCE(SUM(SQL), 0) AS actual_sql,
      COALESCE(SUM(SAL), 0) AS actual_sal,
      COALESCE(SUM(SQO), 0) AS actual_sqo
    FROM \`data-analytics-306119.Staging.DailyRevenueFunnel\`
    WHERE RecordType = '${product}'
      AND CAST(CaptureDate AS DATE) >= '${filters.startDate}'
      AND CAST(CaptureDate AS DATE) <= '${filters.endDate}'
      AND Region IN ('AMER', 'EMEA', 'APAC')
      ${regionClause}
    GROUP BY RecordType, Region,
      CASE
        WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW LOGO'
        WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
        WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
        WHEN UPPER(FunnelType) IN ('RENEWAL', 'R360 RENEWAL') THEN 'RENEWAL'
        ELSE 'OTHER'
      END
    ORDER BY region, category
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for deal details (won)
async function getWonDeals(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

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
      CASE Type
        WHEN 'Existing Business' THEN 'EXPANSION'
        WHEN 'New Business' THEN 'NEW LOGO'
        WHEN 'Migration' THEN 'MIGRATION'
        WHEN 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(NULLIF(COALESCE(SDRSource, POR_SDRSource), ''), 'INBOUND') AS source,
      ROUND(ACV, 2) AS acv,
      CAST(CloseDate AS STRING) AS close_date,
      Owner AS owner_name,
      OwnerId AS owner_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    ORDER BY ACV DESC
    LIMIT 100
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for lost deals
async function getLostDeals(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

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
      CASE Type
        WHEN 'Existing Business' THEN 'EXPANSION'
        WHEN 'New Business' THEN 'NEW LOGO'
        WHEN 'Migration' THEN 'MIGRATION'
        WHEN 'Renewal' THEN 'RENEWAL'
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
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE StageName = 'Closed Lost'
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    ORDER BY ACV DESC
    LIMIT 100
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for pipeline deals
async function getPipelineDeals(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

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
      CASE Type
        WHEN 'Existing Business' THEN 'EXPANSION'
        WHEN 'New Business' THEN 'NEW LOGO'
        WHEN 'Migration' THEN 'MIGRATION'
        WHEN 'Renewal' THEN 'RENEWAL'
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
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE IsClosed = false
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      ${productClause}
      ${regionClause}
    ORDER BY ACV DESC
    LIMIT 200
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for source attainment data - actuals from won deals
async function getSourceActuals(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

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
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
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

// Query for source targets from StrategicOperatingPlan
async function getSourceTargets(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND RecordType IN (${filters.products.map(p => `'${p}'`).join(', ')})`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const query = `
    SELECT
      RecordType AS product,
      Region AS region,
      CASE
        WHEN UPPER(Source) IN ('INBOUND', 'INBOUND CALL', 'CHAT', 'WEBSITE') THEN 'INBOUND'
        WHEN UPPER(Source) IN ('OUTBOUND', 'OUTBOUND CALL', 'SDR OUTBOUND') THEN 'OUTBOUND'
        WHEN UPPER(Source) IN ('AE SOURCED', 'AE', 'ACCOUNT EXECUTIVE') THEN 'AE SOURCED'
        WHEN UPPER(Source) IN ('AM SOURCED', 'AM', 'ACCOUNT MANAGER', 'CSM SOURCED') THEN 'AM SOURCED'
        WHEN UPPER(Source) IN ('TRADESHOW', 'TRADE SHOW', 'EVENT') THEN 'TRADESHOW'
        WHEN UPPER(Source) IN ('PARTNERSHIPS', 'PARTNER', 'REFERRAL', 'CHANNEL') THEN 'PARTNERSHIPS'
        ELSE UPPER(Source)
      END AS source,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
        THEN Target_ACV ELSE 0
      END), 2) AS q1_target,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_ACV ELSE 0
      END), 2) AS qtd_target
    FROM \`data-analytics-306119.Staging.StrategicOperatingPlan\`
    WHERE Percentile = 'P50'
      AND RecordType IN ('POR', 'R360')
      AND Region IN ('AMER', 'EMEA', 'APAC')
      ${productClause}
      ${regionClause}
    GROUP BY product, region, source
    HAVING q1_target > 0
    ORDER BY product, region, source
  `;

  try {
    const [rows] = await getBigQuery().query({ query });
    return rows;
  } catch (error) {
    console.warn('Source targets query failed:', error);
    return [];
  }
}

// Query for pipeline age by product/region/category
async function getPipelineAge(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  const query = `
    SELECT
      CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE Type
        WHEN 'Existing Business' THEN 'EXPANSION'
        WHEN 'New Business' THEN 'NEW LOGO'
        WHEN 'Migration' THEN 'MIGRATION'
        WHEN 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS category,
      ROUND(AVG(DATE_DIFF(CURRENT_DATE(), CAST(CreatedDate AS DATE), DAY)), 0) AS avg_age_days
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE IsClosed = false
      AND Type NOT IN ('Credit Card', 'Consulting')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
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

// Query for loss reason RCA - aggregate lost deals by reason
async function getLossReasonRCA(filters: ReportFilters) {
  const productClause = filters.products && filters.products.length > 0
    ? `AND (
        (por_record__c = true AND 'POR' IN (${filters.products.map(p => `'${p}'`).join(', ')})) OR
        (r360_record__c = true AND 'R360' IN (${filters.products.map(p => `'${p}'`).join(', ')}))
      )`
    : '';

  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

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
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE StageName = 'Closed Lost'
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

// Query for MQL details with Salesforce links, company name, source, and disqualification status
async function getMQLDetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  // POR MQL details query - includes ALL MQLs (including reverted)
  const porQuery = `
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
        ELSE CONCAT('https://por.my.salesforce.com/', ContactId)
      END AS salesforce_url,
      COALESCE(Company, 'Unknown') AS company_name,
      COALESCE(LeadEmail, ContactEmail, 'N/A') AS email,
      COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
      CAST(MQL_DT AS STRING) AS mql_date,
      CASE WHEN SQL_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sql,
      -- Disqualification status
      CASE
        WHEN MQL_Reverted = true THEN 'REVERTED'
        WHEN SQL_DT IS NOT NULL THEN 'CONVERTED'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) > 30 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS mql_status,
      COALESCE(MQL_Reverted, false) AS was_reverted,
      DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) AS days_in_stage
    FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
      AND MQL_DT IS NOT NULL
      AND CAST(MQL_DT AS DATE) >= '${filters.startDate}'
      AND CAST(MQL_DT AS DATE) <= '${filters.endDate}'
      ${regionClause}
    ORDER BY MQL_DT DESC
    LIMIT 200
  `;

  // R360 MQL details query - includes ALL MQLs (including reverted)
  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const r360Query = `
    SELECT
      'R360' AS product,
      Region AS region,
      LeadId AS record_id,
      CONCAT('https://por.my.salesforce.com/', LeadId) AS salesforce_url,
      COALESCE(Company, 'Unknown') AS company_name,
      Email AS email,
      COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
      CAST(MQL_DT AS STRING) AS mql_date,
      CASE WHEN SQL_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sql,
      -- Disqualification status
      CASE
        WHEN MQL_Reverted = true THEN 'REVERTED'
        WHEN SQL_DT IS NOT NULL THEN 'CONVERTED'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) > 30 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS mql_status,
      COALESCE(MQL_Reverted, false) AS was_reverted,
      DATE_DIFF(CURRENT_DATE(), CAST(MQL_DT AS DATE), DAY) AS days_in_stage
    FROM \`data-analytics-306119.MarketingFunnel.R360InboundFunnel\`
    WHERE Region IS NOT NULL
      AND MQL_DT IS NOT NULL
      AND CAST(MQL_DT AS DATE) >= '${filters.startDate}'
      AND CAST(MQL_DT AS DATE) <= '${filters.endDate}'
      ${r360RegionClause}
    ORDER BY MQL_DT DESC
    LIMIT 200
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
    console.warn('MQL details query failed:', error);
    return { POR: [], R360: [] };
  }
}

// Query for SQL details with opportunity info and disqualification/loss reasons
async function getSQLDetails(filters: ReportFilters) {
  const regionClause = filters.regions && filters.regions.length > 0
    ? `AND Division IN (${filters.regions.map(r => {
        const map: Record<string, string> = { 'AMER': 'US', 'EMEA': 'UK', 'APAC': 'AU' };
        return `'${map[r]}'`;
      }).join(', ')})`
    : '';

  // POR SQL details query - includes opportunity info from InboundFunnel
  const porQuery = `
    SELECT
      'POR' AS product,
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      COALESCE(LeadId, ContactId) AS record_id,
      -- Link to opportunity if available, otherwise lead/contact
      CASE
        WHEN OpportunityID IS NOT NULL AND OpportunityID != '' THEN OpportunityLink
        WHEN LeadId IS NOT NULL THEN CONCAT('https://por.my.salesforce.com/', LeadId)
        ELSE CONCAT('https://por.my.salesforce.com/', ContactId)
      END AS salesforce_url,
      COALESCE(Company, 'Unknown') AS company_name,
      COALESCE(LeadEmail, ContactEmail, 'N/A') AS email,
      COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
      CAST(SQL_DT AS STRING) AS sql_date,
      CAST(MQL_DT AS STRING) AS mql_date,
      DATE_DIFF(CAST(SQL_DT AS DATE), CAST(MQL_DT AS DATE), DAY) AS days_mql_to_sql,
      CASE WHEN SAL_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sal,
      CASE WHEN SQO_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
      CASE WHEN OpportunityID IS NOT NULL AND OpportunityID != '' THEN 'Yes' ELSE 'No' END AS has_opportunity,
      CASE
        WHEN SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
        WHEN SAL_DT IS NOT NULL THEN 'CONVERTED_SAL'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) > 45 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS sql_status,
      OpportunityID AS opportunity_id,
      OpportunityName AS opportunity_name,
      CAST(NULL AS STRING) AS opportunity_stage,
      CAST(NULL AS FLOAT64) AS opportunity_acv,
      'N/A' AS loss_reason,
      DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) AS days_in_stage
    FROM \`data-analytics-306119.MarketingFunnel.InboundFunnel\`
    WHERE Division IN ('US', 'UK', 'AU')
      AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
      AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
      AND SQL_DT IS NOT NULL
      AND CAST(SQL_DT AS DATE) >= '${filters.startDate}'
      AND CAST(SQL_DT AS DATE) <= '${filters.endDate}'
      ${regionClause}
    ORDER BY SQL_DT DESC
  `;

  // R360 SQL details query - includes opportunity info from R360InboundFunnel
  const r360RegionClause = filters.regions && filters.regions.length > 0
    ? `AND Region IN (${filters.regions.map(r => `'${r}'`).join(', ')})`
    : '';

  const r360Query = `
    SELECT
      'R360' AS product,
      Region AS region,
      LeadId AS record_id,
      -- Link to opportunity if available, otherwise lead
      CASE
        WHEN OpportunityID IS NOT NULL AND OpportunityID != '' THEN OpportunityLink
        ELSE COALESCE(LeadLink, CONCAT('https://por.my.salesforce.com/', LeadId))
      END AS salesforce_url,
      COALESCE(Company, 'Unknown') AS company_name,
      Email AS email,
      COALESCE(NULLIF(SDRSource, ''), 'INBOUND') AS source,
      CAST(SQL_DT AS STRING) AS sql_date,
      CAST(MQL_DT AS STRING) AS mql_date,
      DATE_DIFF(CAST(SQL_DT AS DATE), CAST(MQL_DT AS DATE), DAY) AS days_mql_to_sql,
      'N/A' AS converted_to_sal,
      CASE WHEN SQO_DT IS NOT NULL THEN 'Yes' ELSE 'No' END AS converted_to_sqo,
      CASE WHEN OpportunityID IS NOT NULL AND OpportunityID != '' THEN 'Yes' ELSE 'No' END AS has_opportunity,
      CASE
        WHEN SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
        WHEN DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) > 45 THEN 'STALLED'
        ELSE 'ACTIVE'
      END AS sql_status,
      OpportunityID AS opportunity_id,
      OpportunityName AS opportunity_name,
      CAST(NULL AS STRING) AS opportunity_stage,
      CAST(NULL AS FLOAT64) AS opportunity_acv,
      'N/A' AS loss_reason,
      DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) AS days_in_stage
    FROM \`data-analytics-306119.MarketingFunnel.R360InboundFunnel\`
    WHERE MQL_Reverted = false
      AND Region IS NOT NULL
      AND SQL_DT IS NOT NULL
      AND CAST(SQL_DT AS DATE) >= '${filters.startDate}'
      AND CAST(SQL_DT AS DATE) <= '${filters.endDate}'
      ${r360RegionClause}
    ORDER BY SQL_DT DESC
  `;

  try {
    const shouldFetchPOR = filters.products.length === 0 || filters.products.includes('POR');
    const shouldFetchR360 = filters.products.length === 0 || filters.products.includes('R360');

    const [porRows, r360Rows] = await Promise.all([
      shouldFetchPOR ? getBigQuery().query({ query: porQuery }).then(r => r[0]) : Promise.resolve([]),
      shouldFetchR360 ? getBigQuery().query({ query: r360Query }).then(r => r[0]) : Promise.resolve([]),
    ]);

    console.log('SQL details - POR count:', (porRows as any[]).length);
    console.log('SQL details - R360 count:', (r360Rows as any[]).length);

    return {
      POR: porRows as any[],
      R360: r360Rows as any[],
    };
  } catch (error) {
    console.warn('SQL details query failed:', error);
    return { POR: [], R360: [] };
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
        FROM \`data-analytics-306119.GoogleAds_POR_8275359090.ads_Campaign_8275359090\`
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
      FROM \`data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090\` s
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
        FROM \`data-analytics-306119.GoogleAds_Record360_3799591491.ads_Campaign_3799591491\`
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
      FROM \`data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491\` s
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
  const start = new Date(startDate);
  const end = new Date(endDate);
  const quarterStart = new Date('2026-01-01');
  const quarterEnd = new Date('2026-03-31');

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
function calculateRAG(attainmentPct: number): string {
  if (attainmentPct >= 90) return 'GREEN';
  if (attainmentPct >= 70) return 'YELLOW';
  return 'RED';
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
      revenueActuals,
      targets,
      porFunnel,
      r360Funnel,
      porFunnelBySource,
      r360FunnelBySource,
      wonDeals,
      lostDeals,
      pipelineDeals,
      googleAds,
      sourceActualsRaw,
      sourceTargetsRaw,
      pipelineAgeData,
      lossReasonData,
      mqlDetailsData,
      sqlDetailsData,
      porFunnelByCategory,
      r360FunnelByCategory,
    ] = await Promise.all([
      getRevenueActuals(filters),
      getTargets(filters),
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
      getSourceTargets(filters),
      getPipelineAge(filters),
      getLossReasonRCA(filters),
      getMQLDetails(filters),
      getSQLDetails(filters),
      filters.products.length === 0 || filters.products.includes('POR')
        ? getFunnelByCategory(filters, 'POR')
        : Promise.resolve([]),
      filters.products.length === 0 || filters.products.includes('R360')
        ? getFunnelByCategory(filters, 'R360')
        : Promise.resolve([]),
    ]);

    // Calculate period info
    const periodInfo = calculatePeriodInfo(startDate, endDate);

    // Build attainment detail by joining actuals with targets
    const attainmentDetail: any[] = [];
    const targetMap = new Map(targets.map((t: any) =>
      [`${t.product}-${t.region}-${t.category}`, t]
    ));

    // Group revenue by product/region/category
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

    // Build attainment for each target
    for (const target of targets as any[]) {
      const key = `${target.product}-${target.region}-${target.category}`;
      const actual = revenueMap.get(key);
      const pipeline = pipelineMap.get(key) || { acv: 0, count: 0 };
      const lost = lostMap.get(key) || { acv: 0, count: 0 };

      const qtdAcv = actual ? actual.total_acv : 0;
      const qtdDeals = actual ? actual.deal_count : 0;
      const qtdTarget = parseFloat(target.qtd_target) || 0;
      const q1Target = parseFloat(target.q1_target) || 0;
      const attainmentPct = qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 1000) / 10 : 0;
      const gap = qtdAcv - qtdTarget;
      const progressPct = q1Target > 0 ? Math.round((qtdAcv / q1Target) * 1000) / 10 : 0;

      // Calculate pipeline coverage (pipeline / remaining gap to Q1)
      const remainingGap = Math.max(0, q1Target - qtdAcv);
      const pipelineCoverage = remainingGap > 0 ? pipeline.acv / remainingGap : (pipeline.acv > 0 ? 99 : 0);

      // Calculate win rate (won deals / (won + lost))
      const totalClosed = qtdDeals + lost.count;
      const winRate = totalClosed > 0 ? Math.round((qtdDeals / totalClosed) * 1000) / 10 : 0;

      attainmentDetail.push({
        product: target.product,
        region: target.region,
        category: target.category,
        q1_target: q1Target,
        qtd_target: qtdTarget,
        qtd_deals: qtdDeals,
        qtd_acv: qtdAcv,
        qtd_attainment_pct: attainmentPct,
        q1_progress_pct: progressPct,
        qtd_gap: gap,
        pipeline_acv: pipeline.acv,
        pipeline_coverage_x: Math.round(pipelineCoverage * 10) / 10,
        win_rate_pct: winRate,
        qtd_lost_deals: lost.count,
        qtd_lost_acv: lost.acv,
        rag_status: calculateRAG(attainmentPct),
      });
    }

    // Calculate grand total
    const totalPipelineAcv = attainmentDetail.reduce((sum, a) => sum + (a.pipeline_acv || 0), 0);
    const totalQ1Target = attainmentDetail.reduce((sum, a) => sum + a.q1_target, 0);
    const totalQtdAcv = attainmentDetail.reduce((sum, a) => sum + a.qtd_acv, 0);
    const totalWonDeals = attainmentDetail.reduce((sum, a) => sum + a.qtd_deals, 0);
    const totalLostDeals = attainmentDetail.reduce((sum, a) => sum + (a.qtd_lost_deals || 0), 0);
    const totalRemainingGap = Math.max(0, totalQ1Target - totalQtdAcv);

    const grandTotal = {
      product: 'ALL',
      total_q1_target: totalQ1Target,
      total_qtd_target: attainmentDetail.reduce((sum, a) => sum + a.qtd_target, 0),
      total_qtd_deals: totalWonDeals,
      total_qtd_acv: totalQtdAcv,
      total_qtd_attainment_pct: 0,
      total_q1_progress_pct: 0,
      total_qtd_gap: 0,
      total_pipeline_acv: totalPipelineAcv,
      total_pipeline_coverage_x: totalRemainingGap > 0 ? Math.round((totalPipelineAcv / totalRemainingGap) * 10) / 10 : 0,
      total_win_rate_pct: (totalWonDeals + totalLostDeals) > 0
        ? Math.round((totalWonDeals / (totalWonDeals + totalLostDeals)) * 1000) / 10
        : 0,
    };
    grandTotal.total_qtd_attainment_pct = grandTotal.total_qtd_target > 0
      ? Math.round((grandTotal.total_qtd_acv / grandTotal.total_qtd_target) * 1000) / 10
      : 0;
    grandTotal.total_q1_progress_pct = grandTotal.total_q1_target > 0
      ? Math.round((grandTotal.total_qtd_acv / grandTotal.total_q1_target) * 1000) / 10
      : 0;
    grandTotal.total_qtd_gap = grandTotal.total_qtd_acv - grandTotal.total_qtd_target;

    // Calculate product totals
    const productTotals: Record<string, any> = {};
    for (const product of ['POR', 'R360']) {
      const productDetails = attainmentDetail.filter(a => a.product === product);
      if (productDetails.length > 0) {
        const prodPipelineAcv = productDetails.reduce((sum, a) => sum + (a.pipeline_acv || 0), 0);
        const prodQ1Target = productDetails.reduce((sum, a) => sum + a.q1_target, 0);
        const prodQtdAcv = productDetails.reduce((sum, a) => sum + a.qtd_acv, 0);
        const prodWonDeals = productDetails.reduce((sum, a) => sum + a.qtd_deals, 0);
        const prodLostDeals = productDetails.reduce((sum, a) => sum + (a.qtd_lost_deals || 0), 0);
        const prodLostAcv = productDetails.reduce((sum, a) => sum + (a.qtd_lost_acv || 0), 0);
        const prodRemainingGap = Math.max(0, prodQ1Target - prodQtdAcv);

        productTotals[product] = {
          product,
          total_q1_target: prodQ1Target,
          total_qtd_target: productDetails.reduce((sum, a) => sum + a.qtd_target, 0),
          total_qtd_deals: prodWonDeals,
          total_qtd_acv: prodQtdAcv,
          total_qtd_attainment_pct: 0,
          total_qtd_gap: 0,
          total_pipeline_acv: prodPipelineAcv,
          total_pipeline_coverage_x: prodRemainingGap > 0 ? Math.round((prodPipelineAcv / prodRemainingGap) * 10) / 10 : 0,
          total_win_rate_pct: (prodWonDeals + prodLostDeals) > 0
            ? Math.round((prodWonDeals / (prodWonDeals + prodLostDeals)) * 1000) / 10
            : 0,
          total_lost_deals: prodLostDeals,
          total_lost_acv: prodLostAcv,
        };
        const pt = productTotals[product];
        pt.total_qtd_attainment_pct = pt.total_qtd_target > 0
          ? Math.round((pt.total_qtd_acv / pt.total_qtd_target) * 1000) / 10
          : 0;
        pt.total_qtd_gap = pt.total_qtd_acv - pt.total_qtd_target;
      }
    }

    // Build funnel pacing
    const funnelPacing: any[] = [];
    const allFunnel = [...(porFunnel as any[]), ...(r360Funnel as any[])];
    const funnelTargetMap = new Map<string, any>();

    for (const t of targets as any[]) {
      if (t.category === 'NEW LOGO') { // INBOUND targets are in NEW LOGO
        const key = `${t.product}-${t.region}`;
        if (!funnelTargetMap.has(key)) {
          funnelTargetMap.set(key, {
            q1_target_mql: 0,
            target_mql: 0,
            q1_target_sql: 0,
            target_sql: 0,
            q1_target_sal: 0,
            target_sal: 0,
            q1_target_sqo: 0,
            target_sqo: 0,
          });
        }
        const existing = funnelTargetMap.get(key)!;
        existing.q1_target_mql += parseFloat(t.q1_target_mql) || 0;
        existing.target_mql += parseFloat(t.target_mql) || 0;
        existing.q1_target_sql += parseFloat(t.q1_target_sql) || 0;
        existing.target_sql += parseFloat(t.target_sql) || 0;
        existing.q1_target_sal += parseFloat(t.q1_target_sal) || 0;
        existing.target_sal += parseFloat(t.target_sal) || 0;
        existing.q1_target_sqo += parseFloat(t.q1_target_sqo) || 0;
        existing.target_sqo += parseFloat(t.target_sqo) || 0;
      }
    }

    for (const f of allFunnel) {
      const key = `${f.product}-${f.region}`;
      const targets = funnelTargetMap.get(key) || {
        q1_target_mql: 0, target_mql: 0,
        q1_target_sql: 0, target_sql: 0,
        q1_target_sal: 0, target_sal: 0,
        q1_target_sqo: 0, target_sqo: 0,
      };

      const mqlPacing = targets.target_mql > 0 ? Math.round((parseInt(f.actual_mql) / targets.target_mql) * 100) : 0;
      const sqlPacing = targets.target_sql > 0 ? Math.round((parseInt(f.actual_sql) / targets.target_sql) * 100) : 0;
      const salPacing = targets.target_sal > 0 ? Math.round((parseInt(f.actual_sal) / targets.target_sal) * 100) : null;
      const sqoPacing = targets.target_sqo > 0 ? Math.round((parseInt(f.actual_sqo) / targets.target_sqo) * 100) : 0;

      funnelPacing.push({
        product: f.product,
        region: f.region,
        source_channel: 'INBOUND',
        actual_mql: parseInt(f.actual_mql),
        q1_target_mql: targets.q1_target_mql,
        target_mql: targets.target_mql,
        mql_pacing_pct: mqlPacing,
        mql_rag: calculateRAG(mqlPacing),
        actual_sql: parseInt(f.actual_sql),
        q1_target_sql: targets.q1_target_sql,
        target_sql: targets.target_sql,
        sql_pacing_pct: sqlPacing,
        sql_rag: calculateRAG(sqlPacing),
        actual_sal: parseInt(f.actual_sal),
        q1_target_sal: targets.q1_target_sal,
        target_sal: targets.target_sal,
        sal_pacing_pct: salPacing,
        sal_rag: salPacing !== null ? calculateRAG(salPacing) : 'RED',
        actual_sqo: parseInt(f.actual_sqo),
        q1_target_sqo: targets.q1_target_sqo,
        target_sqo: targets.target_sqo,
        sqo_pacing_pct: sqoPacing,
        sqo_rag: calculateRAG(sqoPacing),
      });
    }

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

    // Build pipeline age map from query results
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

      // Determine severity based on ACV impact
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

    // Build source attainment data by joining actuals with targets from StrategicOperatingPlan
    // Create a map of source targets
    const sourceTargetMap = new Map<string, { q1_target: number; qtd_target: number }>();
    for (const t of sourceTargetsRaw as any[]) {
      const key = `${t.product}-${t.region}-${t.source}`;
      sourceTargetMap.set(key, {
        q1_target: parseFloat(t.q1_target) || 0,
        qtd_target: parseFloat(t.qtd_target) || 0,
      });
    }

    // Also track all sources that have targets (even if no actuals)
    const allSourceKeys = new Set<string>();
    for (const t of sourceTargetsRaw as any[]) {
      allSourceKeys.add(`${t.product}-${t.region}-${t.source}`);
    }
    for (const a of sourceActualsRaw as any[]) {
      allSourceKeys.add(`${a.product}-${a.region}-${a.source}`);
    }

    // Create map of actuals
    const sourceActualsMap = new Map<string, number>();
    for (const a of sourceActualsRaw as any[]) {
      const key = `${a.product}-${a.region}-${a.source}`;
      sourceActualsMap.set(key, parseFloat(a.total_acv) || 0);
    }

    const sourceAttainment: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    // Process all source/region combinations
    for (const key of Array.from(allSourceKeys)) {
      const [product, region, source] = key.split('-');
      const targets = sourceTargetMap.get(key) || { q1_target: 0, qtd_target: 0 };
      const qtdAcv = sourceActualsMap.get(key) || 0;

      const q1Target = targets.q1_target;
      const qtdTarget = targets.qtd_target;

      // Calculate attainment
      const attainmentPct = qtdTarget > 0 ? (qtdAcv / qtdTarget) * 100 : (qtdAcv > 0 ? 100 : 0);
      const gap = qtdAcv - qtdTarget;

      const sourceRow = {
        region,
        source,
        q1_target: Math.round(q1Target),
        qtd_target: Math.round(qtdTarget),
        qtd_acv: qtdAcv,
        attainment_pct: Math.round(attainmentPct * 10) / 10,
        gap: Math.round(gap),
        rag_status: calculateRAG(attainmentPct),
      };

      if (product === 'POR') {
        sourceAttainment.POR.push(sourceRow);
      } else {
        sourceAttainment.R360.push(sourceRow);
      }
    }

    // Sort by attainment (worst first)
    sourceAttainment.POR.sort((a, b) => a.attainment_pct - b.attainment_pct);
    sourceAttainment.R360.sort((a, b) => a.attainment_pct - b.attainment_pct);

    // Build funnel by source data with targets and pacing
    const funnelBySource: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    // Process POR funnel by source (now includes targets from StrategicOperatingPlan)
    for (const row of porFunnelBySource as any[]) {
      const funnelSourceRow = {
        region: row.region,
        source: row.source,
        // Actuals
        actual_mql: parseInt(row.actual_mql) || 0,
        actual_sql: parseInt(row.actual_sql) || 0,
        actual_sal: parseInt(row.actual_sal) || 0,
        actual_sqo: parseInt(row.actual_sqo) || 0,
        // Targets
        target_mql: parseInt(row.target_mql) || 0,
        target_sql: parseInt(row.target_sql) || 0,
        target_sal: parseInt(row.target_sal) || 0,
        target_sqo: parseInt(row.target_sqo) || 0,
        // Pacing percentages
        mql_pacing_pct: parseInt(row.mql_pacing_pct) || 0,
        sql_pacing_pct: parseInt(row.sql_pacing_pct) || 0,
        sal_pacing_pct: parseInt(row.sal_pacing_pct) || 0,
        sqo_pacing_pct: parseInt(row.sqo_pacing_pct) || 0,
        // Conversion rates
        mql_to_sql_rate: parseFloat(row.mql_to_sql_rate) || 0,
        sql_to_sal_rate: parseFloat(row.sql_to_sal_rate) || 0,
        sal_to_sqo_rate: parseFloat(row.sal_to_sqo_rate) || 0,
      };
      funnelBySource.POR.push(funnelSourceRow);
    }

    // Process R360 funnel by source (now includes targets from StrategicOperatingPlan)
    for (const row of r360FunnelBySource as any[]) {
      const funnelSourceRow = {
        region: row.region,
        source: row.source,
        // Actuals
        actual_mql: parseInt(row.actual_mql) || 0,
        actual_sql: parseInt(row.actual_sql) || 0,
        actual_sal: parseInt(row.actual_sal) || 0,
        actual_sqo: parseInt(row.actual_sqo) || 0,
        // Targets
        target_mql: parseInt(row.target_mql) || 0,
        target_sql: parseInt(row.target_sql) || 0,
        target_sal: parseInt(row.target_sal) || 0,
        target_sqo: parseInt(row.target_sqo) || 0,
        // Pacing percentages
        mql_pacing_pct: parseInt(row.mql_pacing_pct) || 0,
        sql_pacing_pct: parseInt(row.sql_pacing_pct) || 0,
        sal_pacing_pct: parseInt(row.sal_pacing_pct) || 0,
        sqo_pacing_pct: parseInt(row.sqo_pacing_pct) || 0,
        // Conversion rates
        mql_to_sql_rate: parseFloat(row.mql_to_sql_rate) || 0,
        sql_to_sal_rate: parseFloat(row.sql_to_sal_rate) || 0,
        sal_to_sqo_rate: parseFloat(row.sal_to_sqo_rate) || 0,
      };
      funnelBySource.R360.push(funnelSourceRow);
    }

    // Build funnel by category data
    const funnelByCategory: { POR: any[]; R360: any[] } = { POR: [], R360: [] };

    // Get category-level targets from the targets data
    const categoryTargetMap = new Map<string, any>();
    for (const t of targets as any[]) {
      const key = `${t.product}-${t.region}-${t.category}`;
      if (!categoryTargetMap.has(key)) {
        categoryTargetMap.set(key, {
          q1_target_mql: 0, target_mql: 0,
          q1_target_sql: 0, target_sql: 0,
          q1_target_sal: 0, target_sal: 0,
          q1_target_sqo: 0, target_sqo: 0,
        });
      }
      const existing = categoryTargetMap.get(key)!;
      existing.q1_target_mql += parseFloat(t.q1_target_mql) || 0;
      existing.target_mql += parseFloat(t.target_mql) || 0;
      existing.q1_target_sql += parseFloat(t.q1_target_sql) || 0;
      existing.target_sql += parseFloat(t.target_sql) || 0;
      existing.q1_target_sal += parseFloat(t.q1_target_sal) || 0;
      existing.target_sal += parseFloat(t.target_sal) || 0;
      existing.q1_target_sqo += parseFloat(t.q1_target_sqo) || 0;
      existing.target_sqo += parseFloat(t.target_sqo) || 0;
    }

    // Process POR funnel by category
    for (const row of porFunnelByCategory as any[]) {
      const key = `${row.product}-${row.region}-${row.category}`;
      const catTargets = categoryTargetMap.get(key) || {
        q1_target_mql: 0, target_mql: 0,
        q1_target_sql: 0, target_sql: 0,
        q1_target_sal: 0, target_sal: 0,
        q1_target_sqo: 0, target_sqo: 0,
      };

      const mqlPacing = catTargets.target_mql > 0 ? Math.round((parseInt(row.actual_mql) / catTargets.target_mql) * 100) : 0;
      const sqlPacing = catTargets.target_sql > 0 ? Math.round((parseInt(row.actual_sql) / catTargets.target_sql) * 100) : 0;
      const salPacing = catTargets.target_sal > 0 ? Math.round((parseInt(row.actual_sal) / catTargets.target_sal) * 100) : 0;
      const sqoPacing = catTargets.target_sqo > 0 ? Math.round((parseInt(row.actual_sqo) / catTargets.target_sqo) * 100) : 0;

      funnelByCategory.POR.push({
        category: row.category,
        region: row.region,
        actual_mql: parseInt(row.actual_mql) || 0,
        q1_target_mql: Math.round(catTargets.q1_target_mql),
        qtd_target_mql: Math.round(catTargets.target_mql),
        mql_pacing_pct: mqlPacing,
        mql_gap: (parseInt(row.actual_mql) || 0) - Math.round(catTargets.target_mql),
        actual_sql: parseInt(row.actual_sql) || 0,
        q1_target_sql: Math.round(catTargets.q1_target_sql),
        qtd_target_sql: Math.round(catTargets.target_sql),
        sql_pacing_pct: sqlPacing,
        sql_gap: (parseInt(row.actual_sql) || 0) - Math.round(catTargets.target_sql),
        actual_sal: parseInt(row.actual_sal) || 0,
        q1_target_sal: Math.round(catTargets.q1_target_sal),
        qtd_target_sal: Math.round(catTargets.target_sal),
        sal_pacing_pct: salPacing,
        sal_gap: (parseInt(row.actual_sal) || 0) - Math.round(catTargets.target_sal),
        actual_sqo: parseInt(row.actual_sqo) || 0,
        q1_target_sqo: Math.round(catTargets.q1_target_sqo),
        qtd_target_sqo: Math.round(catTargets.target_sqo),
        sqo_pacing_pct: sqoPacing,
        sqo_gap: (parseInt(row.actual_sqo) || 0) - Math.round(catTargets.target_sqo),
        weighted_tof_score: Math.round((mqlPacing * 0.1 + sqlPacing * 0.2 + salPacing * 0.3 + sqoPacing * 0.4)),
      });
    }

    // Process R360 funnel by category
    for (const row of r360FunnelByCategory as any[]) {
      const key = `${row.product}-${row.region}-${row.category}`;
      const catTargets = categoryTargetMap.get(key) || {
        q1_target_mql: 0, target_mql: 0,
        q1_target_sql: 0, target_sql: 0,
        q1_target_sal: 0, target_sal: 0,
        q1_target_sqo: 0, target_sqo: 0,
      };

      const mqlPacing = catTargets.target_mql > 0 ? Math.round((parseInt(row.actual_mql) / catTargets.target_mql) * 100) : 0;
      const sqlPacing = catTargets.target_sql > 0 ? Math.round((parseInt(row.actual_sql) / catTargets.target_sql) * 100) : 0;
      const salPacing = catTargets.target_sal > 0 ? Math.round((parseInt(row.actual_sal) / catTargets.target_sal) * 100) : 0;
      const sqoPacing = catTargets.target_sqo > 0 ? Math.round((parseInt(row.actual_sqo) / catTargets.target_sqo) * 100) : 0;

      funnelByCategory.R360.push({
        category: row.category,
        region: row.region,
        actual_mql: parseInt(row.actual_mql) || 0,
        q1_target_mql: Math.round(catTargets.q1_target_mql),
        qtd_target_mql: Math.round(catTargets.target_mql),
        mql_pacing_pct: mqlPacing,
        mql_gap: (parseInt(row.actual_mql) || 0) - Math.round(catTargets.target_mql),
        actual_sql: parseInt(row.actual_sql) || 0,
        q1_target_sql: Math.round(catTargets.q1_target_sql),
        qtd_target_sql: Math.round(catTargets.target_sql),
        sql_pacing_pct: sqlPacing,
        sql_gap: (parseInt(row.actual_sql) || 0) - Math.round(catTargets.target_sql),
        actual_sal: parseInt(row.actual_sal) || 0,
        q1_target_sal: Math.round(catTargets.q1_target_sal),
        qtd_target_sal: Math.round(catTargets.target_sal),
        sal_pacing_pct: salPacing,
        sal_gap: (parseInt(row.actual_sal) || 0) - Math.round(catTargets.target_sal),
        actual_sqo: parseInt(row.actual_sqo) || 0,
        q1_target_sqo: Math.round(catTargets.q1_target_sqo),
        qtd_target_sqo: Math.round(catTargets.target_sqo),
        sqo_pacing_pct: sqoPacing,
        sqo_gap: (parseInt(row.actual_sqo) || 0) - Math.round(catTargets.target_sqo),
        weighted_tof_score: Math.round((mqlPacing * 0.1 + sqlPacing * 0.2 + salPacing * 0.3 + sqoPacing * 0.4)),
      });
    }

    // Calculate MQL disqualification summary from MQL details
    const calculateDQSummary = (mqls: any[]) => {
      const total = mqls.length;
      const reverted = mqls.filter((m: any) => m.mql_status === 'REVERTED' || m.was_reverted).length;
      const converted = mqls.filter((m: any) => m.mql_status === 'CONVERTED' || m.converted_to_sql === 'Yes').length;
      const stalled = mqls.filter((m: any) => m.mql_status === 'STALLED').length;
      const active = mqls.filter((m: any) => m.mql_status === 'ACTIVE').length;
      return {
        total_mqls: total,
        reverted_count: reverted,
        reverted_pct: total > 0 ? Math.round((reverted / total) * 100) : 0,
        converted_count: converted,
        converted_pct: total > 0 ? Math.round((converted / total) * 100) : 0,
        stalled_count: stalled,
        stalled_pct: total > 0 ? Math.round((stalled / total) * 100) : 0,
        active_count: active,
        active_pct: total > 0 ? Math.round((active / total) * 100) : 0,
      };
    };

    const mqlDisqualificationSummary = {
      POR: calculateDQSummary(mqlDetailsData.POR || []),
      R360: calculateDQSummary(mqlDetailsData.R360 || []),
    };

    // Calculate SQL disqualification summary from SQL details
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

    // Build response
    const response = {
      generated_at_utc: new Date().toISOString(),
      report_date: endDate,
      filters_applied: filters,
      period: periodInfo,
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
      mql_disqualification_summary: mqlDisqualificationSummary,
      sql_disqualification_summary: sqlDisqualificationSummary,
      won_deals: wonDeals,
      lost_deals: lostDeals,
      pipeline_deals: pipelineDeals,
    };

    return NextResponse.json(response);

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
    description: 'Fetch report data from BigQuery with filters',
    parameters: {
      startDate: 'YYYY-MM-DD (required)',
      endDate: 'YYYY-MM-DD (required)',
      products: 'Array of POR/R360 (optional)',
      regions: 'Array of AMER/EMEA/APAC (optional)',
    },
    example: {
      startDate: '2026-01-01',
      endDate: '2026-01-14',
      products: ['POR'],
      regions: ['AMER', 'EMEA'],
    },
  });
}
