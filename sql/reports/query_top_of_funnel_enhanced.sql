-- ============================================================================
-- ENHANCED TOP OF FUNNEL PACING REPORT
-- Version: 2.0.0
-- Created: 2026-01-12
-- Purpose: Comprehensive top-of-funnel report with full Google Ads + Funnel
--          metrics, time horizon flexibility, trend analysis, and forecasting
--
-- DATA SOURCES:
--   ACTUALS:
--     - DailyRevenueFunnel (MQL, SQL, SAL, SQO, Won, WonACV)
--     - Google Ads Campaign Stats (Impressions, Clicks, Cost, Conversions)
--   TARGETS:
--     - StrategicOperatingPlan (P50 targets)
--
-- FEATURES:
--   - Time horizons: MTD, QTD, Rolling 7d, Rolling 30d
--   - Full funnel visualization with stage-to-stage conversions
--   - Google Ads to MQL attribution metrics
--   - Pacing & forecasting with RAG status
--   - Trend analysis (WoW, MoM)
--   - Conversion rate benchmarks
--   - Regional breakdowns
--   - Alerting thresholds
--   - Marketing ROI calculations
--
-- NOTES:
--   - Uses ads_CampaignBasicStats tables for search ads only
--   - Google Ads cost in micros (divide by 1,000,000 for USD)
--   - FunnelType normalized with UPPER() for consistent joins
--   - Uses SAFE_DIVIDE to handle division by zero
-- ============================================================================

-- ============================================================================
-- PARAMETERS & DATE CALCULATIONS
-- ============================================================================
WITH params AS (
  SELECT
    -- Current period dates
    CURRENT_DATE() AS today,
    DATE_TRUNC(CURRENT_DATE(), MONTH) AS mtd_start,
    DATE_TRUNC(CURRENT_DATE(), QUARTER) AS qtd_start,
    DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) AS rolling_7d_start,
    DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY) AS rolling_30d_start,
    CURRENT_DATE() AS period_end,

    -- Prior period dates (for trend analysis)
    DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 1 MONTH) AS prior_month_start,
    DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH) AS prior_month_end,
    DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AS prior_week_start,
    DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) AS prior_week_end,

    -- Period calculations for pacing
    DATE_DIFF(CURRENT_DATE(), DATE_TRUNC(CURRENT_DATE(), MONTH), DAY) + 1 AS mtd_days_elapsed,
    DATE_DIFF(LAST_DAY(CURRENT_DATE()), DATE_TRUNC(CURRENT_DATE(), MONTH), DAY) + 1 AS mtd_total_days,

    -- Target percentile
    'P50' AS percentile_filter,

    -- Conversion rate benchmarks (as decimals)
    0.50 AS benchmark_mql_to_sql,
    0.70 AS benchmark_sql_to_sal,
    0.60 AS benchmark_sal_to_sqo,
    0.30 AS benchmark_sqo_to_won,

    -- Alerting thresholds
    0.90 AS threshold_green,  -- >=90% = Green
    0.70 AS threshold_amber,  -- 70-89% = Amber, <70% = Red
    500.0 AS threshold_cpa_warning  -- CPA > $500 = Warning
),

-- ============================================================================
-- GOOGLE ADS METRICS - POR (SEARCH ONLY)
-- Source: GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090
-- ============================================================================
por_google_ads_mtd AS (
  SELECT
    'POR' AS product,
    'MTD' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090`, params
  WHERE segments_date >= params.mtd_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

por_google_ads_qtd AS (
  SELECT
    'POR' AS product,
    'QTD' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090`, params
  WHERE segments_date >= params.qtd_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

por_google_ads_7d AS (
  SELECT
    'POR' AS product,
    'ROLLING_7D' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090`, params
  WHERE segments_date >= params.rolling_7d_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

por_google_ads_30d AS (
  SELECT
    'POR' AS product,
    'ROLLING_30D' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090`, params
  WHERE segments_date >= params.rolling_30d_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

-- Prior month Google Ads for trend comparison
por_google_ads_prior_month AS (
  SELECT
    'POR' AS product,
    'PRIOR_MONTH' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090`, params
  WHERE segments_date >= params.prior_month_start
    AND segments_date <= params.prior_month_end
    AND segments_ad_network_type = 'SEARCH'
),

-- ============================================================================
-- GOOGLE ADS METRICS - R360 (SEARCH ONLY)
-- Source: GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491
-- ============================================================================
r360_google_ads_mtd AS (
  SELECT
    'R360' AS product,
    'MTD' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491`, params
  WHERE segments_date >= params.mtd_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

r360_google_ads_qtd AS (
  SELECT
    'R360' AS product,
    'QTD' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491`, params
  WHERE segments_date >= params.qtd_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

r360_google_ads_7d AS (
  SELECT
    'R360' AS product,
    'ROLLING_7D' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491`, params
  WHERE segments_date >= params.rolling_7d_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

r360_google_ads_30d AS (
  SELECT
    'R360' AS product,
    'ROLLING_30D' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491`, params
  WHERE segments_date >= params.rolling_30d_start
    AND segments_date <= params.period_end
    AND segments_ad_network_type = 'SEARCH'
),

r360_google_ads_prior_month AS (
  SELECT
    'R360' AS product,
    'PRIOR_MONTH' AS horizon,
    SUM(metrics_impressions) AS impressions,
    SUM(metrics_clicks) AS clicks,
    ROUND(SUM(metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(metrics_clicks), NULLIF(SUM(metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(metrics_cost_micros) / 1000000.0, NULLIF(SUM(metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491`, params
  WHERE segments_date >= params.prior_month_start
    AND segments_date <= params.prior_month_end
    AND segments_ad_network_type = 'SEARCH'
),

-- Combine all Google Ads data
google_ads_all AS (
  SELECT * FROM por_google_ads_mtd
  UNION ALL SELECT * FROM por_google_ads_qtd
  UNION ALL SELECT * FROM por_google_ads_7d
  UNION ALL SELECT * FROM por_google_ads_30d
  UNION ALL SELECT * FROM por_google_ads_prior_month
  UNION ALL SELECT * FROM r360_google_ads_mtd
  UNION ALL SELECT * FROM r360_google_ads_qtd
  UNION ALL SELECT * FROM r360_google_ads_7d
  UNION ALL SELECT * FROM r360_google_ads_30d
  UNION ALL SELECT * FROM r360_google_ads_prior_month
),

-- ============================================================================
-- FUNNEL ACTUALS FROM DAILYREVENUEFUNNEL - MTD
-- ============================================================================
funnel_actuals_mtd AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'MTD' AS horizon,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, params
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) >= params.mtd_start
    AND CAST(CaptureDate AS DATE) <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_actuals_qtd AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'QTD' AS horizon,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, params
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) >= params.qtd_start
    AND CAST(CaptureDate AS DATE) <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_actuals_7d AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'ROLLING_7D' AS horizon,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, params
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) >= params.rolling_7d_start
    AND CAST(CaptureDate AS DATE) <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_actuals_30d AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'ROLLING_30D' AS horizon,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, params
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) >= params.rolling_30d_start
    AND CAST(CaptureDate AS DATE) <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

-- Prior month funnel actuals for trend comparison
funnel_actuals_prior_month AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'PRIOR_MONTH' AS horizon,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, params
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) >= params.prior_month_start
    AND CAST(CaptureDate AS DATE) <= params.prior_month_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

-- Combine all funnel actuals
funnel_actuals_all AS (
  SELECT * FROM funnel_actuals_mtd
  UNION ALL SELECT * FROM funnel_actuals_qtd
  UNION ALL SELECT * FROM funnel_actuals_7d
  UNION ALL SELECT * FROM funnel_actuals_30d
  UNION ALL SELECT * FROM funnel_actuals_prior_month
),

-- ============================================================================
-- FUNNEL TARGETS FROM STRATEGIC OPERATING PLAN
-- ============================================================================
funnel_targets_mtd AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'MTD' AS horizon,
    ROUND(SUM(Target_MQL), 1) AS target_mql,
    ROUND(SUM(Target_SQL), 1) AS target_sql,
    ROUND(SUM(Target_SAL), 1) AS target_sal,
    ROUND(SUM(Target_SQO), 1) AS target_sqo,
    ROUND(SUM(Target_Won), 1) AS target_won,
    ROUND(SUM(Target_ACV), 2) AS target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile_filter
    AND Source = 'INBOUND'
    AND UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.mtd_start
    AND TargetDate <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_targets_qtd AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'QTD' AS horizon,
    ROUND(SUM(Target_MQL), 1) AS target_mql,
    ROUND(SUM(Target_SQL), 1) AS target_sql,
    ROUND(SUM(Target_SAL), 1) AS target_sal,
    ROUND(SUM(Target_SQO), 1) AS target_sqo,
    ROUND(SUM(Target_Won), 1) AS target_won,
    ROUND(SUM(Target_ACV), 2) AS target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile_filter
    AND Source = 'INBOUND'
    AND UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.qtd_start
    AND TargetDate <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_targets_7d AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'ROLLING_7D' AS horizon,
    ROUND(SUM(Target_MQL), 1) AS target_mql,
    ROUND(SUM(Target_SQL), 1) AS target_sql,
    ROUND(SUM(Target_SAL), 1) AS target_sal,
    ROUND(SUM(Target_SQO), 1) AS target_sqo,
    ROUND(SUM(Target_Won), 1) AS target_won,
    ROUND(SUM(Target_ACV), 2) AS target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile_filter
    AND Source = 'INBOUND'
    AND UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.rolling_7d_start
    AND TargetDate <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_targets_30d AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'ROLLING_30D' AS horizon,
    ROUND(SUM(Target_MQL), 1) AS target_mql,
    ROUND(SUM(Target_SQL), 1) AS target_sql,
    ROUND(SUM(Target_SAL), 1) AS target_sal,
    ROUND(SUM(Target_SQO), 1) AS target_sqo,
    ROUND(SUM(Target_Won), 1) AS target_won,
    ROUND(SUM(Target_ACV), 2) AS target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile_filter
    AND Source = 'INBOUND'
    AND UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.rolling_30d_start
    AND TargetDate <= params.period_end
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

-- Full month targets for forecasting calculations
funnel_targets_full_month AS (
  SELECT
    RecordType AS product,
    Region AS region,
    'FULL_MONTH' AS horizon,
    ROUND(SUM(Target_MQL), 1) AS target_mql,
    ROUND(SUM(Target_SQL), 1) AS target_sql,
    ROUND(SUM(Target_SAL), 1) AS target_sal,
    ROUND(SUM(Target_SQO), 1) AS target_sqo,
    ROUND(SUM(Target_Won), 1) AS target_won,
    ROUND(SUM(Target_ACV), 2) AS target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, params
  WHERE Percentile = params.percentile_filter
    AND Source = 'INBOUND'
    AND UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND OpportunityType != 'RENEWAL'
    AND TargetDate >= params.mtd_start
    AND TargetDate <= LAST_DAY(params.mtd_start)
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

-- Combine all targets
funnel_targets_all AS (
  SELECT * FROM funnel_targets_mtd
  UNION ALL SELECT * FROM funnel_targets_qtd
  UNION ALL SELECT * FROM funnel_targets_7d
  UNION ALL SELECT * FROM funnel_targets_30d
  UNION ALL SELECT * FROM funnel_targets_full_month
),

-- ============================================================================
-- COMBINED FUNNEL REPORT WITH PACING & CONVERSION RATES
-- ============================================================================
funnel_combined AS (
  SELECT
    COALESCE(a.product, t.product) AS product,
    COALESCE(a.region, t.region) AS region,
    COALESCE(a.horizon, t.horizon) AS horizon,

    -- MQL metrics
    COALESCE(a.actual_mql, 0) AS actual_mql,
    COALESCE(t.target_mql, 0) AS target_mql,
    COALESCE(a.actual_mql, 0) - COALESCE(t.target_mql, 0) AS mql_variance,
    ROUND(SAFE_DIVIDE(a.actual_mql, t.target_mql) * 100, 0) AS mql_pacing_pct,

    -- SQL metrics
    COALESCE(a.actual_sql, 0) AS actual_sql,
    COALESCE(t.target_sql, 0) AS target_sql,
    COALESCE(a.actual_sql, 0) - COALESCE(t.target_sql, 0) AS sql_variance,
    ROUND(SAFE_DIVIDE(a.actual_sql, t.target_sql) * 100, 0) AS sql_pacing_pct,

    -- SAL metrics
    COALESCE(a.actual_sal, 0) AS actual_sal,
    COALESCE(t.target_sal, 0) AS target_sal,
    COALESCE(a.actual_sal, 0) - COALESCE(t.target_sal, 0) AS sal_variance,
    ROUND(SAFE_DIVIDE(a.actual_sal, t.target_sal) * 100, 0) AS sal_pacing_pct,

    -- SQO metrics
    COALESCE(a.actual_sqo, 0) AS actual_sqo,
    COALESCE(t.target_sqo, 0) AS target_sqo,
    COALESCE(a.actual_sqo, 0) - COALESCE(t.target_sqo, 0) AS sqo_variance,
    ROUND(SAFE_DIVIDE(a.actual_sqo, t.target_sqo) * 100, 0) AS sqo_pacing_pct,

    -- Won metrics
    COALESCE(a.actual_won, 0) AS actual_won,
    COALESCE(t.target_won, 0) AS target_won,
    COALESCE(a.actual_won, 0) - COALESCE(t.target_won, 0) AS won_variance,
    ROUND(SAFE_DIVIDE(a.actual_won, t.target_won) * 100, 0) AS won_pacing_pct,

    -- ACV metrics
    COALESCE(a.actual_acv, 0) AS actual_acv,
    COALESCE(t.target_acv, 0) AS target_acv,
    COALESCE(a.actual_acv, 0) - COALESCE(t.target_acv, 0) AS acv_variance,
    ROUND(SAFE_DIVIDE(a.actual_acv, t.target_acv) * 100, 0) AS acv_pacing_pct,

    -- Conversion rates (actuals)
    ROUND(SAFE_DIVIDE(a.actual_sql, a.actual_mql) * 100, 1) AS mql_to_sql_rate,
    ROUND(SAFE_DIVIDE(a.actual_sal, a.actual_sql) * 100, 1) AS sql_to_sal_rate,
    ROUND(SAFE_DIVIDE(a.actual_sqo, a.actual_sal) * 100, 1) AS sal_to_sqo_rate,
    ROUND(SAFE_DIVIDE(a.actual_won, a.actual_sqo) * 100, 1) AS sqo_to_won_rate,
    ROUND(SAFE_DIVIDE(a.actual_won, a.actual_mql) * 100, 1) AS mql_to_won_rate,

    -- Average deal size
    ROUND(SAFE_DIVIDE(a.actual_acv, a.actual_won), 2) AS avg_deal_size

  FROM funnel_actuals_all a
  FULL OUTER JOIN funnel_targets_all t
    ON a.product = t.product
    AND a.region = t.region
    AND a.horizon = t.horizon
),

-- ============================================================================
-- PRODUCT TOTALS (aggregated across regions) - MTD Only for clarity
-- ============================================================================
product_totals_mtd AS (
  SELECT
    product,
    'TOTAL' AS region,
    'MTD' AS horizon,
    SUM(actual_mql) AS actual_mql,
    SUM(target_mql) AS target_mql,
    ROUND(SAFE_DIVIDE(SUM(actual_mql), SUM(target_mql)) * 100, 0) AS mql_pacing_pct,
    SUM(actual_sql) AS actual_sql,
    SUM(target_sql) AS target_sql,
    ROUND(SAFE_DIVIDE(SUM(actual_sql), SUM(target_sql)) * 100, 0) AS sql_pacing_pct,
    SUM(actual_sal) AS actual_sal,
    SUM(target_sal) AS target_sal,
    ROUND(SAFE_DIVIDE(SUM(actual_sal), SUM(target_sal)) * 100, 0) AS sal_pacing_pct,
    SUM(actual_sqo) AS actual_sqo,
    SUM(target_sqo) AS target_sqo,
    ROUND(SAFE_DIVIDE(SUM(actual_sqo), SUM(target_sqo)) * 100, 0) AS sqo_pacing_pct,
    SUM(actual_won) AS actual_won,
    SUM(target_won) AS target_won,
    ROUND(SAFE_DIVIDE(SUM(actual_won), SUM(target_won)) * 100, 0) AS won_pacing_pct,
    SUM(actual_acv) AS actual_acv,
    SUM(target_acv) AS target_acv,
    ROUND(SAFE_DIVIDE(SUM(actual_acv), SUM(target_acv)) * 100, 0) AS acv_pacing_pct,
    ROUND(SAFE_DIVIDE(SUM(actual_sql), SUM(actual_mql)) * 100, 1) AS mql_to_sql_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_sal), SUM(actual_sql)) * 100, 1) AS sql_to_sal_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_sqo), SUM(actual_sal)) * 100, 1) AS sal_to_sqo_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_won), SUM(actual_sqo)) * 100, 1) AS sqo_to_won_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_won), SUM(actual_mql)) * 100, 1) AS mql_to_won_rate,
    ROUND(SAFE_DIVIDE(SUM(actual_acv), SUM(actual_won)), 2) AS avg_deal_size
  FROM funnel_combined
  WHERE horizon = 'MTD'
  GROUP BY product
),

-- ============================================================================
-- RAG STATUS CLASSIFICATION
-- ============================================================================
rag_status AS (
  SELECT
    fc.*,
    -- MQL RAG
    CASE
      WHEN fc.mql_pacing_pct IS NULL THEN 'N/A'
      WHEN fc.mql_pacing_pct >= 90 THEN 'GREEN'
      WHEN fc.mql_pacing_pct >= 70 THEN 'AMBER'
      ELSE 'RED'
    END AS mql_rag,
    -- SQL RAG
    CASE
      WHEN fc.sql_pacing_pct IS NULL THEN 'N/A'
      WHEN fc.sql_pacing_pct >= 90 THEN 'GREEN'
      WHEN fc.sql_pacing_pct >= 70 THEN 'AMBER'
      ELSE 'RED'
    END AS sql_rag,
    -- SAL RAG
    CASE
      WHEN fc.sal_pacing_pct IS NULL THEN 'N/A'
      WHEN fc.sal_pacing_pct >= 90 THEN 'GREEN'
      WHEN fc.sal_pacing_pct >= 70 THEN 'AMBER'
      ELSE 'RED'
    END AS sal_rag,
    -- SQO RAG
    CASE
      WHEN fc.sqo_pacing_pct IS NULL THEN 'N/A'
      WHEN fc.sqo_pacing_pct >= 90 THEN 'GREEN'
      WHEN fc.sqo_pacing_pct >= 70 THEN 'AMBER'
      ELSE 'RED'
    END AS sqo_rag,
    -- Won RAG
    CASE
      WHEN fc.won_pacing_pct IS NULL THEN 'N/A'
      WHEN fc.won_pacing_pct >= 90 THEN 'GREEN'
      WHEN fc.won_pacing_pct >= 70 THEN 'AMBER'
      ELSE 'RED'
    END AS won_rag,
    -- ACV RAG
    CASE
      WHEN fc.acv_pacing_pct IS NULL THEN 'N/A'
      WHEN fc.acv_pacing_pct >= 90 THEN 'GREEN'
      WHEN fc.acv_pacing_pct >= 70 THEN 'AMBER'
      ELSE 'RED'
    END AS acv_rag,

    -- Conversion rate vs benchmark flags (using params)
    CASE WHEN fc.mql_to_sql_rate < (p.benchmark_mql_to_sql * 100) THEN TRUE ELSE FALSE END AS mql_to_sql_below_benchmark,
    CASE WHEN fc.sql_to_sal_rate < (p.benchmark_sql_to_sal * 100) THEN TRUE ELSE FALSE END AS sql_to_sal_below_benchmark,
    CASE WHEN fc.sal_to_sqo_rate < (p.benchmark_sal_to_sqo * 100) THEN TRUE ELSE FALSE END AS sal_to_sqo_below_benchmark,
    CASE WHEN fc.sqo_to_won_rate < (p.benchmark_sqo_to_won * 100) THEN TRUE ELSE FALSE END AS sqo_to_won_below_benchmark

  FROM funnel_combined fc
  CROSS JOIN params p
),

-- ============================================================================
-- FORECASTING - Projected Month End
-- ============================================================================
forecasting AS (
  SELECT
    fc.product,
    fc.region,
    p.mtd_days_elapsed AS days_elapsed,
    p.mtd_total_days AS total_days,
    p.mtd_total_days - p.mtd_days_elapsed AS days_remaining,

    -- Daily run rates (current)
    ROUND(SAFE_DIVIDE(fc.actual_mql, p.mtd_days_elapsed), 2) AS daily_mql_rate,
    ROUND(SAFE_DIVIDE(fc.actual_sql, p.mtd_days_elapsed), 2) AS daily_sql_rate,
    ROUND(SAFE_DIVIDE(fc.actual_sqo, p.mtd_days_elapsed), 2) AS daily_sqo_rate,
    ROUND(SAFE_DIVIDE(fc.actual_won, p.mtd_days_elapsed), 2) AS daily_won_rate,
    ROUND(SAFE_DIVIDE(fc.actual_acv, p.mtd_days_elapsed), 2) AS daily_acv_rate,

    -- Projected month end based on current pace
    ROUND(SAFE_DIVIDE(fc.actual_mql, p.mtd_days_elapsed) * p.mtd_total_days, 0) AS projected_mql,
    ROUND(SAFE_DIVIDE(fc.actual_sql, p.mtd_days_elapsed) * p.mtd_total_days, 0) AS projected_sql,
    ROUND(SAFE_DIVIDE(fc.actual_sqo, p.mtd_days_elapsed) * p.mtd_total_days, 0) AS projected_sqo,
    ROUND(SAFE_DIVIDE(fc.actual_won, p.mtd_days_elapsed) * p.mtd_total_days, 0) AS projected_won,
    ROUND(SAFE_DIVIDE(fc.actual_acv, p.mtd_days_elapsed) * p.mtd_total_days, 2) AS projected_acv,

    -- Full month targets
    fm.target_mql AS full_month_target_mql,
    fm.target_sql AS full_month_target_sql,
    fm.target_sqo AS full_month_target_sqo,
    fm.target_won AS full_month_target_won,
    fm.target_acv AS full_month_target_acv,

    -- Required daily rate to hit target
    ROUND(SAFE_DIVIDE(fm.target_mql - fc.actual_mql, p.mtd_total_days - p.mtd_days_elapsed), 2) AS required_daily_mql,
    ROUND(SAFE_DIVIDE(fm.target_sql - fc.actual_sql, p.mtd_total_days - p.mtd_days_elapsed), 2) AS required_daily_sql,
    ROUND(SAFE_DIVIDE(fm.target_sqo - fc.actual_sqo, p.mtd_total_days - p.mtd_days_elapsed), 2) AS required_daily_sqo,
    ROUND(SAFE_DIVIDE(fm.target_won - fc.actual_won, p.mtd_total_days - p.mtd_days_elapsed), 2) AS required_daily_won,
    ROUND(SAFE_DIVIDE(fm.target_acv - fc.actual_acv, p.mtd_total_days - p.mtd_days_elapsed), 2) AS required_daily_acv

  FROM funnel_combined fc
  CROSS JOIN params p
  LEFT JOIN funnel_targets_all fm
    ON fc.product = fm.product
    AND fc.region = fm.region
    AND fm.horizon = 'FULL_MONTH'
  WHERE fc.horizon = 'MTD'
),

-- ============================================================================
-- GOOGLE ADS ATTRIBUTION METRICS
-- Connects ad spend to funnel outcomes
-- ============================================================================
ads_attribution AS (
  SELECT
    ga.product,
    ga.horizon,
    ga.impressions,
    ga.clicks,
    ga.ad_spend_usd,
    ga.conversions,
    ga.ctr_pct,
    ga.cpc_usd,
    ga.cpa_usd,

    -- Get total MQL/SQL/SQO/Won for this product and horizon
    pt.actual_mql AS total_mql,
    pt.actual_sql AS total_sql,
    pt.actual_sqo AS total_sqo,
    pt.actual_won AS total_won,
    pt.actual_acv AS total_acv,

    -- Attribution metrics (assumes all inbound MQLs come from Google Ads as primary channel)
    ROUND(SAFE_DIVIDE(ga.clicks, pt.actual_mql) * 100, 1) AS clicks_to_mql_rate,
    ROUND(SAFE_DIVIDE(ga.conversions, pt.actual_mql) * 100, 1) AS conversions_to_mql_rate,
    ROUND(SAFE_DIVIDE(ga.ad_spend_usd, pt.actual_mql), 2) AS cost_per_mql,
    ROUND(SAFE_DIVIDE(ga.ad_spend_usd, pt.actual_sql), 2) AS cost_per_sql,
    ROUND(SAFE_DIVIDE(ga.ad_spend_usd, pt.actual_sqo), 2) AS cost_per_sqo,
    ROUND(SAFE_DIVIDE(ga.ad_spend_usd, pt.actual_won), 2) AS cost_per_won,

    -- Marketing ROI (ACV Won / Ad Spend)
    ROUND(SAFE_DIVIDE(pt.actual_acv, ga.ad_spend_usd), 2) AS marketing_roi,

    -- Blended CAC (Ad Spend / Won Deals)
    ROUND(SAFE_DIVIDE(ga.ad_spend_usd, pt.actual_won), 2) AS blended_cac,

    -- CPA Warning flag
    CASE WHEN ga.cpa_usd > (SELECT threshold_cpa_warning FROM params) THEN TRUE ELSE FALSE END AS cpa_warning

  FROM google_ads_all ga
  LEFT JOIN product_totals_mtd pt
    ON ga.product = pt.product
    AND ga.horizon = 'MTD'
  WHERE ga.horizon = 'MTD'
),

-- ============================================================================
-- TREND ANALYSIS - MoM Comparison
-- ============================================================================
trend_mom AS (
  SELECT
    curr.product,
    curr.region,
    'MoM' AS comparison_type,

    -- MQL trend
    curr.actual_mql AS current_mql,
    prior.actual_mql AS prior_mql,
    ROUND(SAFE_DIVIDE(curr.actual_mql - prior.actual_mql, NULLIF(prior.actual_mql, 0)) * 100, 1) AS mql_change_pct,
    CASE
      WHEN curr.actual_mql > prior.actual_mql THEN 'IMPROVING'
      WHEN curr.actual_mql < prior.actual_mql THEN 'DECLINING'
      ELSE 'STABLE'
    END AS mql_trend,

    -- SQL trend
    curr.actual_sql AS current_sql,
    prior.actual_sql AS prior_sql,
    ROUND(SAFE_DIVIDE(curr.actual_sql - prior.actual_sql, NULLIF(prior.actual_sql, 0)) * 100, 1) AS sql_change_pct,
    CASE
      WHEN curr.actual_sql > prior.actual_sql THEN 'IMPROVING'
      WHEN curr.actual_sql < prior.actual_sql THEN 'DECLINING'
      ELSE 'STABLE'
    END AS sql_trend,

    -- SQO trend
    curr.actual_sqo AS current_sqo,
    prior.actual_sqo AS prior_sqo,
    ROUND(SAFE_DIVIDE(curr.actual_sqo - prior.actual_sqo, NULLIF(prior.actual_sqo, 0)) * 100, 1) AS sqo_change_pct,
    CASE
      WHEN curr.actual_sqo > prior.actual_sqo THEN 'IMPROVING'
      WHEN curr.actual_sqo < prior.actual_sqo THEN 'DECLINING'
      ELSE 'STABLE'
    END AS sqo_trend,

    -- Won trend
    curr.actual_won AS current_won,
    prior.actual_won AS prior_won,
    ROUND(SAFE_DIVIDE(curr.actual_won - prior.actual_won, NULLIF(prior.actual_won, 0)) * 100, 1) AS won_change_pct,
    CASE
      WHEN curr.actual_won > prior.actual_won THEN 'IMPROVING'
      WHEN curr.actual_won < prior.actual_won THEN 'DECLINING'
      ELSE 'STABLE'
    END AS won_trend

  FROM funnel_combined curr
  LEFT JOIN funnel_combined prior
    ON curr.product = prior.product
    AND curr.region = prior.region
    AND prior.horizon = 'PRIOR_MONTH'
  WHERE curr.horizon = 'MTD'
),

-- ============================================================================
-- ALERTS GENERATION
-- ============================================================================
alerts AS (
  SELECT
    -- Critical alerts (0% pacing)
    ARRAY(
      SELECT AS STRUCT
        product, region, 'MQL' AS stage, mql_pacing_pct AS pacing
      FROM rag_status
      WHERE horizon = 'MTD' AND mql_pacing_pct = 0 AND target_mql > 0
    ) AS critical_mql_zero,

    ARRAY(
      SELECT AS STRUCT
        product, region, 'Won' AS stage, won_pacing_pct AS pacing
      FROM rag_status
      WHERE horizon = 'MTD' AND won_pacing_pct = 0 AND target_won > 0
    ) AS critical_won_zero,

    -- Warning: MQL pacing <70%
    ARRAY(
      SELECT AS STRUCT
        product, region, mql_pacing_pct AS pacing, ROUND(target_mql - actual_mql, 0) AS gap
      FROM rag_status
      WHERE horizon = 'MTD' AND mql_pacing_pct < 70 AND mql_pacing_pct > 0
    ) AS warning_mql_low,

    -- Warning: Won pacing <50%
    ARRAY(
      SELECT AS STRUCT
        product, region, won_pacing_pct AS pacing, ROUND(target_won - actual_won, 0) AS gap
      FROM rag_status
      WHERE horizon = 'MTD' AND won_pacing_pct < 50 AND won_pacing_pct > 0
    ) AS warning_won_low,

    -- Warning: CPA > $500
    ARRAY(
      SELECT AS STRUCT
        product, cpa_usd
      FROM ads_attribution
      WHERE cpa_warning = TRUE
    ) AS warning_cpa_high,

    -- Positive: Stages exceeding targets
    ARRAY(
      SELECT AS STRUCT
        product, region, 'MQL' AS stage, mql_pacing_pct AS pacing
      FROM rag_status
      WHERE horizon = 'MTD' AND mql_pacing_pct >= 120
    ) AS wins_mql_exceeding,

    ARRAY(
      SELECT AS STRUCT
        product, region, 'SQL' AS stage, sql_pacing_pct AS pacing
      FROM rag_status
      WHERE horizon = 'MTD' AND sql_pacing_pct >= 120
    ) AS wins_sql_exceeding,

    -- Conversion rate below benchmark alerts
    ARRAY(
      SELECT AS STRUCT
        product, region, 'MQL_to_SQL' AS conversion, mql_to_sql_rate AS rate,
        (SELECT benchmark_mql_to_sql * 100 FROM params) AS benchmark
      FROM rag_status
      WHERE horizon = 'MTD' AND mql_to_sql_below_benchmark = TRUE AND actual_mql > 0
    ) AS below_benchmark_mql_sql,

    ARRAY(
      SELECT AS STRUCT
        product, region, 'SQL_to_SAL' AS conversion, sql_to_sal_rate AS rate,
        (SELECT benchmark_sql_to_sal * 100 FROM params) AS benchmark
      FROM rag_status
      WHERE horizon = 'MTD' AND sql_to_sal_below_benchmark = TRUE AND actual_sql > 0
    ) AS below_benchmark_sql_sal
),

-- ============================================================================
-- FULL FUNNEL VISUALIZATION (Stages with dropoff)
-- ============================================================================
full_funnel_por AS (
  SELECT
    'POR' AS product,
    ga.impressions,
    ga.clicks,
    ga.conversions,
    pt.actual_mql,
    pt.actual_sql,
    pt.actual_sal,
    pt.actual_sqo,
    pt.actual_won,
    pt.actual_acv,
    -- Stage-to-stage conversion rates
    ga.ctr_pct AS impressions_to_clicks_rate,
    ROUND(SAFE_DIVIDE(ga.conversions, ga.clicks) * 100, 2) AS clicks_to_conversions_rate,
    ROUND(SAFE_DIVIDE(pt.actual_mql, ga.conversions) * 100, 2) AS conversions_to_mql_rate,
    pt.mql_to_sql_rate,
    pt.sql_to_sal_rate,
    pt.sal_to_sqo_rate,
    pt.sqo_to_won_rate,
    -- Cumulative efficiency
    pt.mql_to_won_rate AS funnel_efficiency
  FROM google_ads_all ga
  CROSS JOIN product_totals_mtd pt
  WHERE ga.product = 'POR' AND ga.horizon = 'MTD' AND pt.product = 'POR'
),

full_funnel_r360 AS (
  SELECT
    'R360' AS product,
    ga.impressions,
    ga.clicks,
    ga.conversions,
    pt.actual_mql,
    pt.actual_sql,
    pt.actual_sal,
    pt.actual_sqo,
    pt.actual_won,
    pt.actual_acv,
    ga.ctr_pct AS impressions_to_clicks_rate,
    ROUND(SAFE_DIVIDE(ga.conversions, ga.clicks) * 100, 2) AS clicks_to_conversions_rate,
    ROUND(SAFE_DIVIDE(pt.actual_mql, ga.conversions) * 100, 2) AS conversions_to_mql_rate,
    pt.mql_to_sql_rate,
    pt.sql_to_sal_rate,
    pt.sal_to_sqo_rate,
    pt.sqo_to_won_rate,
    pt.mql_to_won_rate AS funnel_efficiency
  FROM google_ads_all ga
  CROSS JOIN product_totals_mtd pt
  WHERE ga.product = 'R360' AND ga.horizon = 'MTD' AND pt.product = 'R360'
)

-- ============================================================================
-- FINAL OUTPUT: Comprehensive JSON Structure
-- ============================================================================
SELECT TO_JSON_STRING(STRUCT(
  -- Metadata
  CAST(CURRENT_TIMESTAMP() AS STRING) AS generated_at,
  (SELECT today FROM params) AS report_date,
  (SELECT percentile_filter FROM params) AS percentile,

  -- Period information
  STRUCT(
    (SELECT mtd_start FROM params) AS start,
    (SELECT today FROM params) AS end,
    (SELECT mtd_days_elapsed FROM params) AS days_elapsed,
    (SELECT mtd_total_days - mtd_days_elapsed FROM params) AS days_remaining,
    (SELECT mtd_total_days FROM params) AS total_days_in_month
  ) AS period,

  -- Google Ads Summary
  STRUCT(
    (SELECT AS STRUCT * EXCEPT(product, horizon) FROM por_google_ads_mtd) AS POR,
    (SELECT AS STRUCT * EXCEPT(product, horizon) FROM r360_google_ads_mtd) AS R360
  ) AS google_ads,

  -- Google Ads by Horizon
  STRUCT(
    STRUCT(
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM por_google_ads_mtd) AS MTD,
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM por_google_ads_qtd) AS QTD,
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM por_google_ads_7d) AS ROLLING_7D,
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM por_google_ads_30d) AS ROLLING_30D
    ) AS POR,
    STRUCT(
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM r360_google_ads_mtd) AS MTD,
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM r360_google_ads_qtd) AS QTD,
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM r360_google_ads_7d) AS ROLLING_7D,
      (SELECT AS STRUCT * EXCEPT(product, horizon) FROM r360_google_ads_30d) AS ROLLING_30D
    ) AS R360
  ) AS google_ads_by_horizon,

  -- Funnel Metrics
  STRUCT(
    STRUCT(
      (SELECT AS STRUCT * EXCEPT(product, region, horizon) FROM product_totals_mtd WHERE product = 'POR') AS summary,
      ARRAY(
        SELECT AS STRUCT * EXCEPT(horizon)
        FROM rag_status
        WHERE product = 'POR' AND horizon = 'MTD'
        ORDER BY region
      ) AS by_region
    ) AS POR,
    STRUCT(
      (SELECT AS STRUCT * EXCEPT(product, region, horizon) FROM product_totals_mtd WHERE product = 'R360') AS summary,
      ARRAY(
        SELECT AS STRUCT * EXCEPT(horizon)
        FROM rag_status
        WHERE product = 'R360' AND horizon = 'MTD'
        ORDER BY region
      ) AS by_region
    ) AS R360
  ) AS funnel_metrics,

  -- Full Funnel Visualization
  STRUCT(
    (SELECT AS STRUCT * EXCEPT(product) FROM full_funnel_por) AS POR,
    (SELECT AS STRUCT * EXCEPT(product) FROM full_funnel_r360) AS R360
  ) AS full_funnel,

  -- Attribution Metrics
  STRUCT(
    (SELECT AS STRUCT * EXCEPT(product, horizon) FROM ads_attribution WHERE product = 'POR') AS POR,
    (SELECT AS STRUCT * EXCEPT(product, horizon) FROM ads_attribution WHERE product = 'R360') AS R360
  ) AS attribution,

  -- Forecasting
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM forecasting WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM forecasting WHERE product = 'R360' ORDER BY region) AS R360
  ) AS forecasting,

  -- Trend Analysis
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM trend_mom WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM trend_mom WHERE product = 'R360' ORDER BY region) AS R360
  ) AS trends,

  -- Insights (Alerts, Warnings, Wins, Recommendations)
  STRUCT(
    (SELECT * FROM alerts) AS alerts,

    -- Generate recommendations based on data
    ARRAY<STRING>[
      CASE
        WHEN (SELECT COUNT(*) FROM rag_status WHERE horizon = 'MTD' AND mql_rag = 'RED') > 0
        THEN 'URGENT: Increase ad spend or optimize campaigns - multiple regions showing RED MQL pacing'
        ELSE NULL
      END,
      CASE
        WHEN (SELECT COUNT(*) FROM rag_status WHERE horizon = 'MTD' AND mql_to_sql_below_benchmark = TRUE) > 0
        THEN 'REVIEW: MQL-to-SQL conversion below 50% benchmark - assess lead quality'
        ELSE NULL
      END,
      CASE
        WHEN (SELECT MAX(cpa_usd) FROM ads_attribution) > 500
        THEN 'OPTIMIZE: CPA exceeds $500 threshold - review keyword targeting and ad relevance'
        ELSE NULL
      END
    ] AS recommendations
  ) AS insights,

  -- Conversion Benchmarks (for reference)
  STRUCT(
    (SELECT benchmark_mql_to_sql FROM params) AS mql_to_sql,
    (SELECT benchmark_sql_to_sal FROM params) AS sql_to_sal,
    (SELECT benchmark_sal_to_sqo FROM params) AS sal_to_sqo,
    (SELECT benchmark_sqo_to_won FROM params) AS sqo_to_won
  ) AS benchmarks

)) AS top_of_funnel_enhanced_report;
