-- ============================================================================
-- QA CROSS-REFERENCE QUERY FOR TREND ANALYSIS
-- Version: 1.0.0
-- Created: 2026-01-14
-- Purpose: Validate actuals and targets between all data sources
-- ============================================================================
--
-- DATA SOURCES BEING VALIDATED:
-- 1. ACTUALS (Revenue): sfdc.OpportunityViewTable (Won deals with ACV)
-- 2. ACTUALS (Funnel): MarketingFunnel.InboundFunnel / R360InboundFunnel
-- 3. TARGETS: Staging.StrategicOperatingPlan (SOP)
-- 4. EXCEL: 2026 Bookings Plan Draft.xlsx (source of truth for targets)
--
-- KEY VALIDATION CHECKS:
-- A. Revenue Actuals match between sources
-- B. Funnel Actuals (MQL/SQL/SAL/SQO) match between sources
-- C. Targets match between SOP and Excel
-- D. Category/Region rollups are mathematically correct
-- E. QTD attainment calculations are correct
--
-- ============================================================================

-- Parameters (adjust these for your date range)
WITH params AS (
  SELECT
    DATE('2026-01-01') AS qtd_start,
    CURRENT_DATE() AS qtd_end,
    'P50' AS percentile
),

-- ============================================================================
-- SECTION 1: REVENUE ACTUALS FROM OpportunityViewTable
-- This is the SOURCE OF TRUTH for won ACV
-- ============================================================================
revenue_actuals AS (
  SELECT
    CASE por_record__c
      WHEN true THEN 'POR'
      ELSE 'R360'
    END AS product,
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
    COUNT(*) AS deal_count,
    ROUND(SUM(ACV), 2) AS total_acv
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`, params
  WHERE Won = true
    AND CloseDate >= params.qtd_start
    AND CloseDate <= params.qtd_end
    AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
  GROUP BY product, region, category, source
),

-- ============================================================================
-- SECTION 2: REVENUE ACTUALS SUMMARY BY PRODUCT
-- Compare with report-data.json product_totals
-- ============================================================================
revenue_by_product AS (
  SELECT
    product,
    SUM(deal_count) AS total_deals,
    ROUND(SUM(total_acv), 2) AS total_qtd_acv
  FROM revenue_actuals
  GROUP BY product
),

-- ============================================================================
-- SECTION 3: REVENUE ACTUALS SUMMARY BY PRODUCT + REGION + CATEGORY
-- Compare with report-data.json attainment_detail
-- ============================================================================
revenue_by_segment AS (
  SELECT
    product,
    region,
    category,
    SUM(deal_count) AS qtd_deals,
    ROUND(SUM(total_acv), 2) AS qtd_acv
  FROM revenue_actuals
  GROUP BY product, region, category
),

-- ============================================================================
-- SECTION 4: TARGETS FROM STRATEGIC OPERATING PLAN
-- QTD targets prorated from Q1 targets
-- ============================================================================
sop_targets AS (
  SELECT
    RecordType AS product,
    Region AS region,
    CASE
      WHEN FunnelType IN ('NEW LOGO', 'INBOUND', 'R360 NEW LOGO', 'R360 INBOUND') THEN 'NEW LOGO'
      WHEN FunnelType IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN FunnelType = 'MIGRATION' THEN 'MIGRATION'
      ELSE FunnelType
    END AS category,
    -- Q1 Target (full quarter)
    ROUND(SUM(CASE
      WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
      THEN Target_ACV ELSE 0
    END), 2) AS q1_target,
    -- QTD Target (prorated)
    ROUND(SUM(CASE
      WHEN TargetDate BETWEEN (SELECT qtd_start FROM params) AND (SELECT qtd_end FROM params)
      THEN Target_ACV ELSE 0
    END), 2) AS qtd_target,
    -- Funnel Targets
    ROUND(SUM(CASE
      WHEN TargetDate BETWEEN (SELECT qtd_start FROM params) AND (SELECT qtd_end FROM params)
      THEN Target_MQL ELSE 0
    END), 0) AS target_mql,
    ROUND(SUM(CASE
      WHEN TargetDate BETWEEN (SELECT qtd_start FROM params) AND (SELECT qtd_end FROM params)
      THEN Target_SQL ELSE 0
    END), 0) AS target_sql,
    ROUND(SUM(CASE
      WHEN TargetDate BETWEEN (SELECT qtd_start FROM params) AND (SELECT qtd_end FROM params)
      THEN Target_SAL ELSE 0
    END), 0) AS target_sal,
    ROUND(SUM(CASE
      WHEN TargetDate BETWEEN (SELECT qtd_start FROM params) AND (SELECT qtd_end FROM params)
      THEN Target_SQO ELSE 0
    END), 0) AS target_sqo
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile
    AND OpportunityType != 'RENEWAL'
    AND RecordType IN ('POR', 'R360')
  GROUP BY product, region, category
  HAVING q1_target > 0
),

-- ============================================================================
-- SECTION 5: FUNNEL ACTUALS FROM MARKETING TABLES (POR)
-- ============================================================================
por_funnel_actuals AS (
  SELECT
    'POR' AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    'INBOUND' AS source,
    -- MQL uses CaptureDate (when lead was captured)
    COUNT(DISTINCT CASE
      WHEN MQL_DT IS NOT NULL
        AND CAST(CaptureDate AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(CaptureDate AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS actual_mql,
    -- SQL/SAL/SQO use their respective date fields
    COUNT(DISTINCT CASE
      WHEN SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQL_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS actual_sql,
    COUNT(DISTINCT CASE
      WHEN SAL_DT IS NOT NULL
        AND CAST(SAL_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SAL_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS actual_sal,
    COUNT(DISTINCT CASE
      WHEN SQO_DT IS NOT NULL
        AND CAST(SQO_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQO_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS actual_sqo
  FROM `data-analytics-306119.MarketingFunnel.InboundFunnel`, params
  WHERE Division IN ('US', 'UK', 'AU')
    AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
    AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
  GROUP BY region
),

-- ============================================================================
-- SECTION 6: FUNNEL ACTUALS FROM MARKETING TABLES (R360)
-- ============================================================================
r360_funnel_actuals AS (
  SELECT
    'R360' AS product,
    Region AS region,
    'INBOUND' AS source,
    COUNT(DISTINCT CASE
      WHEN MQL_DT IS NOT NULL
        AND CAST(CaptureDate AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(CaptureDate AS DATE) <= (SELECT qtd_end FROM params)
      THEN Email
    END) AS actual_mql,
    COUNT(DISTINCT CASE
      WHEN SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQL_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN Email
    END) AS actual_sql,
    0 AS actual_sal, -- R360 doesn't track SAL in same way
    COUNT(DISTINCT CASE
      WHEN SQO_DT IS NOT NULL
        AND CAST(SQO_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQO_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN Email
    END) AS actual_sqo
  FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`, params
  WHERE MQL_Reverted = false
    AND Region IS NOT NULL
  GROUP BY Region
),

-- ============================================================================
-- SECTION 7: COMBINED ATTAINMENT VIEW
-- Join actuals with targets to calculate attainment
-- ============================================================================
attainment_comparison AS (
  SELECT
    t.product,
    t.region,
    t.category,
    -- Targets
    t.q1_target,
    t.qtd_target,
    -- Actuals
    COALESCE(a.qtd_deals, 0) AS qtd_deals,
    COALESCE(a.qtd_acv, 0) AS qtd_acv,
    -- Attainment
    ROUND(SAFE_DIVIDE(COALESCE(a.qtd_acv, 0), t.qtd_target) * 100, 1) AS attainment_pct,
    -- Gap
    ROUND(COALESCE(a.qtd_acv, 0) - t.qtd_target, 2) AS gap
  FROM sop_targets t
  LEFT JOIN revenue_by_segment a
    ON t.product = a.product
    AND t.region = a.region
    AND t.category = a.category
),

-- ============================================================================
-- SECTION 8: GRAND TOTAL COMPARISON
-- This should match report-data.json grand_total
-- ============================================================================
grand_total_check AS (
  SELECT
    'ALL' AS product,
    SUM(qtd_deals) AS total_qtd_deals,
    ROUND(SUM(qtd_acv), 2) AS total_qtd_acv,
    ROUND(SUM(q1_target), 2) AS total_q1_target,
    ROUND(SUM(qtd_target), 2) AS total_qtd_target,
    ROUND(SAFE_DIVIDE(SUM(qtd_acv), SUM(qtd_target)) * 100, 1) AS total_attainment_pct,
    ROUND(SUM(qtd_acv) - SUM(qtd_target), 2) AS total_gap
  FROM attainment_comparison
)

-- ============================================================================
-- OUTPUT: Choose which section to run
-- ============================================================================

-- Option A: Full attainment detail (for attainment_detail comparison)
-- SELECT * FROM attainment_comparison ORDER BY product, region, category;

-- Option B: Grand total check (for grand_total comparison)
-- SELECT * FROM grand_total_check;

-- Option C: Product totals (for product_totals comparison)
-- SELECT * FROM revenue_by_product ORDER BY product;

-- Option D: Funnel actuals (for funnel_pacing comparison)
SELECT
  f.*,
  t.target_mql,
  t.target_sql,
  t.target_sal,
  t.target_sqo,
  ROUND(SAFE_DIVIDE(f.actual_mql, t.target_mql) * 100, 0) AS mql_pacing_pct,
  ROUND(SAFE_DIVIDE(f.actual_sql, t.target_sql) * 100, 0) AS sql_pacing_pct,
  ROUND(SAFE_DIVIDE(f.actual_sqo, t.target_sqo) * 100, 0) AS sqo_pacing_pct
FROM (
  SELECT * FROM por_funnel_actuals
  UNION ALL
  SELECT * FROM r360_funnel_actuals
) f
LEFT JOIN (
  SELECT product, region,
    SUM(target_mql) AS target_mql,
    SUM(target_sql) AS target_sql,
    SUM(target_sal) AS target_sal,
    SUM(target_sqo) AS target_sqo
  FROM sop_targets
  WHERE category = 'NEW LOGO' -- INBOUND targets are in NEW LOGO category
  GROUP BY product, region
) t ON f.product = t.product AND f.region = t.region
ORDER BY f.product, f.region;

-- ============================================================================
-- VALIDATION CHECKLIST
-- ============================================================================
--
-- Run each query and compare with report-data.json:
--
-- 1. GRAND TOTAL CHECK (Section 8)
--    - total_q1_target should = 3,527,879.34
--    - POR Q1 target should = 2,659,310
--    - R360 Q1 target should = 868,569.34
--
-- 2. PRODUCT TOTALS CHECK (Section 2)
--    - POR QTD ACV should match product_totals.POR.total_qtd_acv
--    - R360 QTD ACV should match product_totals.R360.total_qtd_acv
--
-- 3. ATTAINMENT DETAIL CHECK (Section 7)
--    - Each row should match corresponding row in attainment_detail
--    - Verify: qtd_deals, qtd_acv, qtd_attainment_pct, qtd_gap
--
-- 4. FUNNEL PACING CHECK (Section D)
--    - actual_mql, actual_sql, actual_sqo should match funnel_pacing
--    - target_mql, target_sql, target_sqo should match funnel_pacing
--
-- KNOWN DISCREPANCIES:
-- - SOP has $3,699 higher than Excel for AMER R360 SMB
-- - FunnelType "R360 INBOUND" must be combined with "R360 NEW LOGO"
-- - Source (INBOUND/OUTBOUND) is separate from FunnelType (NEW LOGO/EXPANSION)
--
-- ============================================================================
