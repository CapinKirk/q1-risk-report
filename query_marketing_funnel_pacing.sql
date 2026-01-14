-- ============================================================================
-- MARKETING FUNNEL PACING REPORT - DYNAMIC QUERY
-- Version: 2.0.0
-- Created: 2026-01-12
-- Updated: 2026-01-12
-- Purpose: Pull MQL/SQL/SQO actuals vs targets for INBOUND channel
--
-- Data Sources:
--   - POR Actuals: MarketingFunnel.InboundFunnel
--   - R360 Actuals: MarketingFunnel.R360InboundFunnel
--   - Targets: Staging.StrategicOperatingPlan (Source = 'INBOUND')
--
-- IMPORTANT: MQL uses CaptureDate (when lead was captured), not MQL_DT
-- This matches the dashboard numbers more accurately.
--
-- Filters Applied:
--   - SpiralyzeTest = false (excludes test leads)
--   - MQL_Reverted = false (excludes reverted MQLs)
--   - OpportunityType != 'RENEWAL' for targets
--
-- Usage: Update qtd_start and qtd_end dates as needed
-- ============================================================================

WITH params AS (
  SELECT
    DATE('2026-01-01') AS qtd_start,
    CURRENT_DATE() AS qtd_end
),

-- ============================================================================
-- POR ACTUALS FROM INBOUNDFUNNEL
-- ============================================================================
por_actuals AS (
  SELECT
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    -- MQL uses CaptureDate (when lead was captured) for accurate counts
    COUNT(DISTINCT CASE
      WHEN MQL_DT IS NOT NULL
        AND CAST(CaptureDate AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(CaptureDate AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS mql,
    COUNT(DISTINCT CASE
      WHEN SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQL_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS sql,
    COUNT(DISTINCT CASE
      WHEN SAL_DT IS NOT NULL
        AND CAST(SAL_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SAL_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS sal,
    COUNT(DISTINCT CASE
      WHEN SQO_DT IS NOT NULL
        AND CAST(SQO_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQO_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN COALESCE(LeadEmail, ContactEmail)
    END) AS sqo
  FROM `data-analytics-306119.MarketingFunnel.InboundFunnel`
  WHERE Division IN ('US', 'UK', 'AU')
    AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
    AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
  GROUP BY region
),

-- ============================================================================
-- R360 ACTUALS FROM R360INBOUNDFUNNEL
-- ============================================================================
r360_actuals AS (
  SELECT
    Region AS region,
    -- MQL uses CaptureDate (when lead was captured) for accurate counts
    COUNT(DISTINCT CASE
      WHEN MQL_DT IS NOT NULL
        AND CAST(CaptureDate AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(CaptureDate AS DATE) <= (SELECT qtd_end FROM params)
      THEN Email
    END) AS mql,
    COUNT(DISTINCT CASE
      WHEN SQL_DT IS NOT NULL
        AND CAST(SQL_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQL_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN Email
    END) AS sql,
    COUNT(DISTINCT CASE
      WHEN SQO_DT IS NOT NULL
        AND CAST(SQO_DT AS DATE) >= (SELECT qtd_start FROM params)
        AND CAST(SQO_DT AS DATE) <= (SELECT qtd_end FROM params)
      THEN Email
    END) AS sqo
  FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
  WHERE MQL_Reverted = false
    AND Region IS NOT NULL
  GROUP BY Region
),

-- ============================================================================
-- QTD TARGETS FROM STRATEGIC OPERATING PLAN
-- ============================================================================
targets AS (
  SELECT
    RecordType AS product,
    Region AS region,
    ROUND(SUM(Target_MQL), 0) AS target_mql,
    ROUND(SUM(Target_SQL), 0) AS target_sql,
    ROUND(SUM(Target_SAL), 0) AS target_sal,
    ROUND(SUM(Target_SQO), 0) AS target_sqo
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = 'P50'
    AND Source = 'INBOUND'
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.qtd_start
    AND TargetDate <= params.qtd_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
)

-- ============================================================================
-- FINAL OUTPUT: COMBINED PACING REPORT
-- ============================================================================
SELECT
  'POR' AS product,
  a.region,
  -- MQL
  a.mql AS actual_mql,
  CAST(t.target_mql AS INT64) AS target_mql,
  ROUND(SAFE_DIVIDE(a.mql, t.target_mql) * 100, 0) AS mql_pacing_pct,
  a.mql - CAST(t.target_mql AS INT64) AS mql_gap,
  -- SQL
  a.sql AS actual_sql,
  CAST(t.target_sql AS INT64) AS target_sql,
  ROUND(SAFE_DIVIDE(a.sql, t.target_sql) * 100, 0) AS sql_pacing_pct,
  a.sql - CAST(t.target_sql AS INT64) AS sql_gap,
  -- SQO
  a.sqo AS actual_sqo,
  CAST(t.target_sqo AS INT64) AS target_sqo,
  ROUND(SAFE_DIVIDE(a.sqo, t.target_sqo) * 100, 0) AS sqo_pacing_pct,
  a.sqo - CAST(t.target_sqo AS INT64) AS sqo_gap
FROM por_actuals a
LEFT JOIN targets t ON t.product = 'POR' AND t.region = a.region

UNION ALL

SELECT
  'R360' AS product,
  a.region,
  -- MQL
  a.mql AS actual_mql,
  CAST(t.target_mql AS INT64) AS target_mql,
  ROUND(SAFE_DIVIDE(a.mql, t.target_mql) * 100, 0) AS mql_pacing_pct,
  a.mql - CAST(t.target_mql AS INT64) AS mql_gap,
  -- SQL
  a.sql AS actual_sql,
  CAST(t.target_sql AS INT64) AS target_sql,
  ROUND(SAFE_DIVIDE(a.sql, t.target_sql) * 100, 0) AS sql_pacing_pct,
  a.sql - CAST(t.target_sql AS INT64) AS sql_gap,
  -- SQO
  a.sqo AS actual_sqo,
  CAST(t.target_sqo AS INT64) AS target_sqo,
  ROUND(SAFE_DIVIDE(a.sqo, t.target_sqo) * 100, 0) AS sqo_pacing_pct,
  a.sqo - CAST(t.target_sqo AS INT64) AS sqo_gap
FROM r360_actuals a
LEFT JOIN targets t ON t.product = 'R360' AND t.region = a.region

ORDER BY product, region;
