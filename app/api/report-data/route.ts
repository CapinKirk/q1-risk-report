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
        ELSE 'OTHER'
      END AS category,
      COALESCE(SDRSource, 'N/A') AS source,
      Type AS deal_type,
      COUNT(*) AS deal_count,
      ROUND(SUM(ACV), 2) AS total_acv,
      ROUND(AVG(ACV), 2) AS avg_acv
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
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
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_MQL ELSE 0
      END), 0) AS target_mql,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_SQL ELSE 0
      END), 0) AS target_sql,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_SAL ELSE 0
      END), 0) AS target_sal,
      ROUND(SUM(CASE
        WHEN TargetDate BETWEEN '${filters.startDate}' AND '${filters.endDate}'
        THEN Target_SQO ELSE 0
      END), 0) AS target_sqo
    FROM \`data-analytics-306119.Staging.StrategicOperatingPlan\`
    WHERE Percentile = 'P50'
      AND OpportunityType != 'RENEWAL'
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

// Query for funnel actuals (POR)
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
          AND CAST(CaptureDate AS DATE) >= '${filters.startDate}'
          AND CAST(CaptureDate AS DATE) <= '${filters.endDate}'
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
    GROUP BY region
    ORDER BY region
  `;

  const [rows] = await getBigQuery().query({ query });
  return rows;
}

// Query for funnel actuals (R360)
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
          AND CAST(CaptureDate AS DATE) >= '${filters.startDate}'
          AND CAST(CaptureDate AS DATE) <= '${filters.endDate}'
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
    GROUP BY region
    ORDER BY region
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
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(SDRSource, POR_SDRSource, 'N/A') AS source,
      ROUND(ACV, 2) AS acv,
      CAST(CloseDate AS STRING) AS close_date,
      Owner AS owner_name,
      OwnerId AS owner_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE Won = true
      AND CloseDate >= '${filters.startDate}'
      AND CloseDate <= '${filters.endDate}'
      AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
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
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(SDRSource, POR_SDRSource, 'N/A') AS source,
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
      AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
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
        ELSE 'OTHER'
      END AS category,
      Type AS deal_type,
      COALESCE(SDRSource, POR_SDRSource, 'N/A') AS source,
      ROUND(ACV, 2) AS acv,
      StageName AS stage,
      CAST(CloseDate AS STRING) AS close_date,
      Owner AS owner_name,
      OwnerId AS owner_id,
      CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
    FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
    WHERE IsClosed = false
      AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
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
      wonDeals,
      lostDeals,
      pipelineDeals,
    ] = await Promise.all([
      getRevenueActuals(filters),
      getTargets(filters),
      filters.products.length === 0 || filters.products.includes('POR')
        ? getPORFunnelActuals(filters)
        : Promise.resolve([]),
      filters.products.length === 0 || filters.products.includes('R360')
        ? getR360FunnelActuals(filters)
        : Promise.resolve([]),
      getWonDeals(filters),
      getLostDeals(filters),
      getPipelineDeals(filters),
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

    // Build attainment for each target
    for (const target of targets as any[]) {
      const key = `${target.product}-${target.region}-${target.category}`;
      const actual = revenueMap.get(key);

      const qtdAcv = actual ? actual.total_acv : 0;
      const qtdDeals = actual ? actual.deal_count : 0;
      const qtdTarget = parseFloat(target.qtd_target) || 0;
      const q1Target = parseFloat(target.q1_target) || 0;
      const attainmentPct = qtdTarget > 0 ? Math.round((qtdAcv / qtdTarget) * 1000) / 10 : 0;
      const gap = qtdAcv - qtdTarget;
      const progressPct = q1Target > 0 ? Math.round((qtdAcv / q1Target) * 1000) / 10 : 0;

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
        rag_status: calculateRAG(attainmentPct),
      });
    }

    // Calculate grand total
    const grandTotal = {
      product: 'ALL',
      total_q1_target: attainmentDetail.reduce((sum, a) => sum + a.q1_target, 0),
      total_qtd_target: attainmentDetail.reduce((sum, a) => sum + a.qtd_target, 0),
      total_qtd_deals: attainmentDetail.reduce((sum, a) => sum + a.qtd_deals, 0),
      total_qtd_acv: attainmentDetail.reduce((sum, a) => sum + a.qtd_acv, 0),
      total_qtd_attainment_pct: 0,
      total_q1_progress_pct: 0,
      total_qtd_gap: 0,
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
        productTotals[product] = {
          product,
          total_q1_target: productDetails.reduce((sum, a) => sum + a.q1_target, 0),
          total_qtd_target: productDetails.reduce((sum, a) => sum + a.qtd_target, 0),
          total_qtd_deals: productDetails.reduce((sum, a) => sum + a.qtd_deals, 0),
          total_qtd_acv: productDetails.reduce((sum, a) => sum + a.qtd_acv, 0),
          total_qtd_attainment_pct: 0,
          total_qtd_gap: 0,
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
            target_mql: 0,
            target_sql: 0,
            target_sal: 0,
            target_sqo: 0,
          });
        }
        const existing = funnelTargetMap.get(key)!;
        existing.target_mql += parseFloat(t.target_mql) || 0;
        existing.target_sql += parseFloat(t.target_sql) || 0;
        existing.target_sal += parseFloat(t.target_sal) || 0;
        existing.target_sqo += parseFloat(t.target_sqo) || 0;
      }
    }

    for (const f of allFunnel) {
      const key = `${f.product}-${f.region}`;
      const targets = funnelTargetMap.get(key) || { target_mql: 0, target_sql: 0, target_sal: 0, target_sqo: 0 };

      const mqlPacing = targets.target_mql > 0 ? Math.round((parseInt(f.actual_mql) / targets.target_mql) * 100) : 0;
      const sqlPacing = targets.target_sql > 0 ? Math.round((parseInt(f.actual_sql) / targets.target_sql) * 100) : 0;
      const salPacing = targets.target_sal > 0 ? Math.round((parseInt(f.actual_sal) / targets.target_sal) * 100) : null;
      const sqoPacing = targets.target_sqo > 0 ? Math.round((parseInt(f.actual_sqo) / targets.target_sqo) * 100) : 0;

      funnelPacing.push({
        product: f.product,
        region: f.region,
        source_channel: 'INBOUND',
        actual_mql: parseInt(f.actual_mql),
        target_mql: targets.target_mql,
        mql_pacing_pct: mqlPacing,
        mql_rag: calculateRAG(mqlPacing),
        actual_sql: parseInt(f.actual_sql),
        target_sql: targets.target_sql,
        sql_pacing_pct: sqlPacing,
        sql_rag: calculateRAG(sqlPacing),
        actual_sal: parseInt(f.actual_sal),
        target_sal: targets.target_sal,
        sal_pacing_pct: salPacing,
        sal_rag: salPacing !== null ? calculateRAG(salPacing) : 'RED',
        actual_sqo: parseInt(f.actual_sqo),
        target_sqo: targets.target_sqo,
        sqo_pacing_pct: sqoPacing,
        sqo_rag: calculateRAG(sqoPacing),
      });
    }

    // Build response
    const response = {
      generated_at_utc: new Date().toISOString(),
      report_date: endDate,
      filters_applied: filters,
      period: periodInfo,
      grand_total: grandTotal,
      product_totals: productTotals,
      attainment_detail: attainmentDetail,
      funnel_pacing: funnelPacing,
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
