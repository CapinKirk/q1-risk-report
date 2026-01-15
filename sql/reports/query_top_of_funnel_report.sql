-- ============================================================================
-- TOP OF FUNNEL PACING REPORT
-- Version: 1.0.0
-- Created: 2026-01-12
-- Purpose: Comprehensive top-of-funnel report with Google Ads + Funnel metrics
--
-- DATA SOURCES:
--   ACTUALS:
--     - DailyRevenueFunnel (MQL, SQL, SAL, SQO, Won)
--     - Google Ads (Impressions, Clicks, Cost, Conversions)
--   TARGETS:
--     - StrategicOperatingPlan (P50 targets)
--
-- FILTERS:
--   - Source = INBOUND (case-insensitive)
--   - RecordType IN (POR, R360)
--   - Date range: MTD (configurable via params)
--
-- NOTES:
--   - DailyRevenueFunnel uses CaptureDate for MQL timing
--   - FunnelType normalized to UPPER() for consistent joins
--   - Google Ads cost in micros (divide by 1,000,000 for USD)
-- ============================================================================

WITH params AS (
  SELECT
    DATE_TRUNC(CURRENT_DATE(), MONTH) AS period_start,
    CURRENT_DATE() AS period_end,
    'P50' AS percentile_filter
),

-- ============================================================================
-- GOOGLE ADS METRICS (POR)
-- Source: GoogleAds_POR_8275359090.ads_AccountStats_8275359090
-- ============================================================================
por_google_ads AS (
  SELECT
    'POR' AS product,
    'ALL' AS region,  -- Google Ads doesn't have region breakdown at account level
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), SUM(metrics_impressions)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000, SUM(metrics_clicks)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_AccountStats_8275359090`, params
  WHERE segments_date >= params.period_start
    AND segments_date <= params.period_end
    AND segments_click_type = 'URL_CLICKS'  -- Exclude call clicks for cleaner metrics
),

-- ============================================================================
-- GOOGLE ADS METRICS (R360)
-- Source: GoogleAds_Record360_3799591491.ads_AccountStats_3799591491
-- ============================================================================
r360_google_ads AS (
  SELECT
    'R360' AS product,
    'ALL' AS region,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), SUM(metrics_impressions)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000, SUM(metrics_clicks)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_AccountStats_3799591491`, params
  WHERE segments_date >= params.period_start
    AND segments_date <= params.period_end
    AND segments_click_type = 'URL_CLICKS'
),

-- ============================================================================
-- COMBINED GOOGLE ADS
-- ============================================================================
google_ads_combined AS (
  SELECT * FROM por_google_ads
  UNION ALL
  SELECT * FROM r360_google_ads
),

-- ============================================================================
-- FUNNEL ACTUALS FROM DAILYREVENUEFUNNEL
-- Source of truth for MQL/SQL/SAL/SQO/Won actuals
-- ============================================================================
funnel_actuals AS (
  SELECT
    RecordType AS product,
    Region AS region,
    UPPER(FunnelType) AS funnel_type,
    -- Funnel stage counts
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, params
  WHERE UPPER(Source) = 'INBOUND'
    AND CAST(CaptureDate AS DATE) >= params.period_start
    AND CAST(CaptureDate AS DATE) <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region, UPPER(FunnelType)
),

-- ============================================================================
-- TARGETS FROM STRATEGIC OPERATING PLAN
-- Source of truth for P50 targets
-- ============================================================================
funnel_targets AS (
  SELECT
    RecordType AS product,
    Region AS region,
    UPPER(FunnelType) AS funnel_type,
    -- Target metrics (summed across days in period)
    ROUND(SUM(Target_MQL), 1) AS target_mql,
    ROUND(SUM(Target_SQL), 1) AS target_sql,
    ROUND(SUM(Target_SAL), 1) AS target_sal,
    ROUND(SUM(Target_SQO), 1) AS target_sqo,
    ROUND(SUM(Target_Won), 1) AS target_won,
    ROUND(SUM(Target_ACV), 2) AS target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile_filter
    AND Source = 'INBOUND'
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.period_start
    AND TargetDate <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region, UPPER(FunnelType)
),

-- ============================================================================
-- COMBINED FUNNEL REPORT (Actuals + Targets)
-- ============================================================================
funnel_combined AS (
  SELECT
    COALESCE(a.product, t.product) AS product,
    COALESCE(a.region, t.region) AS region,
    COALESCE(a.funnel_type, t.funnel_type) AS funnel_type,

    -- MQL
    COALESCE(a.actual_mql, 0) AS actual_mql,
    COALESCE(t.target_mql, 0) AS target_mql,
    COALESCE(a.actual_mql, 0) - COALESCE(t.target_mql, 0) AS mql_variance,
    ROUND(SAFE_DIVIDE(a.actual_mql, t.target_mql) * 100, 0) AS mql_pacing_pct,

    -- SQL
    COALESCE(a.actual_sql, 0) AS actual_sql,
    COALESCE(t.target_sql, 0) AS target_sql,
    COALESCE(a.actual_sql, 0) - COALESCE(t.target_sql, 0) AS sql_variance,
    ROUND(SAFE_DIVIDE(a.actual_sql, t.target_sql) * 100, 0) AS sql_pacing_pct,

    -- SAL
    COALESCE(a.actual_sal, 0) AS actual_sal,
    COALESCE(t.target_sal, 0) AS target_sal,
    COALESCE(a.actual_sal, 0) - COALESCE(t.target_sal, 0) AS sal_variance,
    ROUND(SAFE_DIVIDE(a.actual_sal, t.target_sal) * 100, 0) AS sal_pacing_pct,

    -- SQO
    COALESCE(a.actual_sqo, 0) AS actual_sqo,
    COALESCE(t.target_sqo, 0) AS target_sqo,
    COALESCE(a.actual_sqo, 0) - COALESCE(t.target_sqo, 0) AS sqo_variance,
    ROUND(SAFE_DIVIDE(a.actual_sqo, t.target_sqo) * 100, 0) AS sqo_pacing_pct,

    -- Won
    COALESCE(a.actual_won, 0) AS actual_won,
    COALESCE(t.target_won, 0) AS target_won,
    COALESCE(a.actual_won, 0) - COALESCE(t.target_won, 0) AS won_variance,
    ROUND(SAFE_DIVIDE(a.actual_won, t.target_won) * 100, 0) AS won_pacing_pct,

    -- ACV
    COALESCE(a.actual_acv, 0) AS actual_acv,
    COALESCE(t.target_acv, 0) AS target_acv,
    COALESCE(a.actual_acv, 0) - COALESCE(t.target_acv, 0) AS acv_variance,
    ROUND(SAFE_DIVIDE(a.actual_acv, t.target_acv) * 100, 0) AS acv_pacing_pct,

    -- Conversion rates (actuals)
    ROUND(SAFE_DIVIDE(a.actual_sql, a.actual_mql) * 100, 1) AS mql_to_sql_rate,
    ROUND(SAFE_DIVIDE(a.actual_sal, a.actual_sql) * 100, 1) AS sql_to_sal_rate,
    ROUND(SAFE_DIVIDE(a.actual_sqo, a.actual_sal) * 100, 1) AS sal_to_sqo_rate,
    ROUND(SAFE_DIVIDE(a.actual_won, a.actual_sqo) * 100, 1) AS sqo_to_won_rate,
    ROUND(SAFE_DIVIDE(a.actual_won, a.actual_mql) * 100, 1) AS mql_to_won_rate

  FROM funnel_actuals a
  FULL OUTER JOIN funnel_targets t
    ON a.product = t.product
    AND a.region = t.region
    AND a.funnel_type = t.funnel_type
),

-- ============================================================================
-- PRODUCT TOTALS (aggregated across regions)
-- ============================================================================
product_totals AS (
  SELECT
    product,
    'TOTAL' AS region,
    'ALL INBOUND' AS funnel_type,
    SUM(actual_mql) AS actual_mql,
    SUM(target_mql) AS target_mql,
    SUM(actual_mql) - SUM(target_mql) AS mql_variance,
    ROUND(SAFE_DIVIDE(SUM(actual_mql), SUM(target_mql)) * 100, 0) AS mql_pacing_pct,
    SUM(actual_sql) AS actual_sql,
    SUM(target_sql) AS target_sql,
    SUM(actual_sql) - SUM(target_sql) AS sql_variance,
    ROUND(SAFE_DIVIDE(SUM(actual_sql), SUM(target_sql)) * 100, 0) AS sql_pacing_pct,
    SUM(actual_sal) AS actual_sal,
    SUM(target_sal) AS target_sal,
    SUM(actual_sal) - SUM(target_sal) AS sal_variance,
    ROUND(SAFE_DIVIDE(SUM(actual_sal), SUM(target_sal)) * 100, 0) AS sal_pacing_pct,
    SUM(actual_sqo) AS actual_sqo,
    SUM(target_sqo) AS target_sqo,
    SUM(actual_sqo) - SUM(target_sqo) AS sqo_variance,
    ROUND(SAFE_DIVIDE(SUM(actual_sqo), SUM(target_sqo)) * 100, 0) AS sqo_pacing_pct,
    SUM(actual_won) AS actual_won,
    SUM(target_won) AS target_won,
    SUM(actual_won) - SUM(target_won) AS won_variance,
    ROUND(SAFE_DIVIDE(SUM(actual_won), SUM(target_won)) * 100, 0) AS won_pacing_pct,
    SUM(actual_acv) AS actual_acv,
    SUM(target_acv) AS target_acv,
    SUM(actual_acv) - SUM(target_acv) AS acv_variance,
    ROUND(SAFE_DIVIDE(SUM(actual_acv), SUM(target_acv)) * 100, 0) AS acv_pacing_pct,
    ROUND(SAFE_DIVIDE(SUM(actual_sql), SUM(actual_mql)) * 100, 1) AS mql_to_sql_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_sal), SUM(actual_sql)) * 100, 1) AS sql_to_sal_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_sqo), SUM(actual_sal)) * 100, 1) AS sal_to_sqo_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_won), SUM(actual_sqo)) * 100, 1) AS sqo_to_won_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_won), SUM(actual_mql)) * 100, 1) AS mql_to_won_rate
  FROM funnel_combined
  GROUP BY product
)

-- ============================================================================
-- FINAL OUTPUT: JSON Structure for downstream consumption
-- ============================================================================
SELECT TO_JSON_STRING(STRUCT(
  CAST(CURRENT_TIMESTAMP() AS STRING) AS generated_at_utc,
  (SELECT period_start FROM params) AS period_start,
  (SELECT period_end FROM params) AS period_end,
  (SELECT percentile_filter FROM params) AS percentile,

  -- Google Ads Summary
  STRUCT(
    (SELECT AS STRUCT * FROM por_google_ads) AS POR,
    (SELECT AS STRUCT * FROM r360_google_ads) AS R360
  ) AS google_ads,

  -- Funnel Metrics by Product
  STRUCT(
    -- POR Details
    STRUCT(
      (SELECT AS STRUCT * FROM product_totals WHERE product = 'POR') AS summary,
      ARRAY(
        SELECT AS STRUCT *
        FROM funnel_combined
        WHERE product = 'POR'
        ORDER BY region, funnel_type
      ) AS by_region
    ) AS POR,

    -- R360 Details
    STRUCT(
      (SELECT AS STRUCT * FROM product_totals WHERE product = 'R360') AS summary,
      ARRAY(
        SELECT AS STRUCT *
        FROM funnel_combined
        WHERE product = 'R360'
        ORDER BY region, funnel_type
      ) AS by_region
    ) AS R360
  ) AS funnel_metrics

)) AS top_of_funnel_report;
