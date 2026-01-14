-- Trend Analysis Query
-- Compares metrics between current and previous periods
-- Parameters: @start_date, @end_date, @prev_start_date, @prev_end_date, @products, @regions

WITH params AS (
  SELECT
    DATE(@start_date) AS current_start,
    DATE(@end_date) AS current_end,
    DATE(@prev_start_date) AS prev_start,
    DATE(@prev_end_date) AS prev_end,
    SPLIT(@products, ',') AS product_filter,
    SPLIT(@regions, ',') AS region_filter
),

-- Map opportunity data to products and regions
opportunity_base AS (
  SELECT
    o.Id AS opportunity_id,
    a.Name AS account_name,
    o.Name AS opportunity_name,
    CASE
      WHEN o.Opportunity_Product__c = 'Record360' THEN 'R360'
      ELSE 'POR'
    END AS product,
    CASE
      WHEN o.Division__c IN ('US') THEN 'AMER'
      WHEN o.Division__c IN ('UK') THEN 'EMEA'
      WHEN o.Division__c IN ('AU') THEN 'APAC'
      ELSE 'AMER'
    END AS region,
    CASE
      WHEN o.Type = 'New Business' THEN 'NEW LOGO'
      WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
      WHEN o.Type = 'Migration' THEN 'MIGRATION'
      ELSE 'NEW LOGO'
    END AS category,
    COALESCE(o.Net_New_ACV__c, 0) AS acv,
    DATE(o.CloseDate) AS close_date,
    o.StageName AS stage,
    o.IsWon AS is_won,
    o.IsClosed AS is_closed
  FROM `data-analytics-306119.sfdc.OpportunityViewTable` o
  LEFT JOIN `data-analytics-306119.sfdc.Account` a ON o.AccountId = a.Id
  WHERE o.IsDeleted = FALSE
),

-- Current period won deals
current_won AS (
  SELECT
    o.product,
    o.region,
    o.category,
    COUNT(*) AS deal_count,
    COALESCE(SUM(o.acv), 0) AS total_acv,
    AVG(o.acv) AS avg_deal_size
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.is_won = TRUE
    AND o.close_date BETWEEN p.current_start AND p.current_end
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.product, o.region, o.category
),

-- Previous period won deals
previous_won AS (
  SELECT
    o.product,
    o.region,
    o.category,
    COUNT(*) AS deal_count,
    COALESCE(SUM(o.acv), 0) AS total_acv,
    AVG(o.acv) AS avg_deal_size
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.is_won = TRUE
    AND o.close_date BETWEEN p.prev_start AND p.prev_end
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.product, o.region, o.category
),

-- Current period pipeline
current_pipeline AS (
  SELECT
    o.product,
    o.region,
    o.category,
    COALESCE(SUM(o.acv), 0) AS pipeline_acv
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.is_closed = FALSE
    AND o.stage NOT IN ('Closed Won', 'Closed Lost')
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.product, o.region, o.category
),

-- Win rates by dimension (current period)
current_win_rates AS (
  SELECT
    o.product,
    o.region,
    o.category,
    SAFE_DIVIDE(
      SUM(CASE WHEN o.is_won THEN 1 ELSE 0 END),
      SUM(CASE WHEN o.is_closed THEN 1 ELSE 0 END)
    ) * 100 AS win_rate_pct
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.close_date BETWEEN p.current_start AND p.current_end
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.product, o.region, o.category
),

-- Win rates by dimension (previous period)
previous_win_rates AS (
  SELECT
    o.product,
    o.region,
    o.category,
    SAFE_DIVIDE(
      SUM(CASE WHEN o.is_won THEN 1 ELSE 0 END),
      SUM(CASE WHEN o.is_closed THEN 1 ELSE 0 END)
    ) * 100 AS win_rate_pct
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.close_date BETWEEN p.prev_start AND p.prev_end
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.product, o.region, o.category
),

-- Funnel metrics base from staging table
funnel_base AS (
  SELECT
    DATE(f.CaptureDate) AS capture_date,
    CASE
      WHEN f.Product IN ('Record360', 'R360') THEN 'R360'
      ELSE 'POR'
    END AS product,
    CASE
      WHEN f.Region IN ('US', 'AMER', 'Americas') THEN 'AMER'
      WHEN f.Region IN ('UK', 'EMEA', 'Europe') THEN 'EMEA'
      WHEN f.Region IN ('AU', 'APAC', 'Asia Pacific') THEN 'APAC'
      ELSE 'AMER'
    END AS region,
    COALESCE(f.MQL, 0) AS mql,
    COALESCE(f.SQL, 0) AS sql_count,
    COALESCE(f.SAL, 0) AS sal,
    COALESCE(f.SQO, 0) AS sqo
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel` f
),

-- Current period funnel
current_funnel AS (
  SELECT
    f.product,
    f.region,
    SUM(f.mql) AS total_mql,
    SUM(f.sql_count) AS total_sql,
    SUM(f.sal) AS total_sal,
    SUM(f.sqo) AS total_sqo
  FROM funnel_base f
  CROSS JOIN params p
  WHERE f.capture_date BETWEEN p.current_start AND p.current_end
    AND f.product IN UNNEST(p.product_filter)
    AND f.region IN UNNEST(p.region_filter)
  GROUP BY f.product, f.region
),

-- Previous period funnel
previous_funnel AS (
  SELECT
    f.product,
    f.region,
    SUM(f.mql) AS total_mql,
    SUM(f.sql_count) AS total_sql,
    SUM(f.sal) AS total_sal,
    SUM(f.sqo) AS total_sqo
  FROM funnel_base f
  CROSS JOIN params p
  WHERE f.capture_date BETWEEN p.prev_start AND p.prev_end
    AND f.product IN UNNEST(p.product_filter)
    AND f.region IN UNNEST(p.region_filter)
  GROUP BY f.product, f.region
),

-- Daily ACV timeseries for current period
current_daily_acv AS (
  SELECT
    o.close_date AS date,
    'current' AS period_type,
    COALESCE(SUM(o.acv), 0) AS daily_acv
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.is_won = TRUE
    AND o.close_date BETWEEN p.current_start AND p.current_end
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.close_date
  ORDER BY o.close_date
),

-- Daily ACV timeseries for previous period
previous_daily_acv AS (
  SELECT
    o.close_date AS date,
    'previous' AS period_type,
    COALESCE(SUM(o.acv), 0) AS daily_acv
  FROM opportunity_base o
  CROSS JOIN params p
  WHERE o.is_won = TRUE
    AND o.close_date BETWEEN p.prev_start AND p.prev_end
    AND o.product IN UNNEST(p.product_filter)
    AND o.region IN UNNEST(p.region_filter)
  GROUP BY o.close_date
  ORDER BY o.close_date
),

-- Daily funnel timeseries for current period
current_daily_funnel AS (
  SELECT
    f.capture_date AS date,
    'current' AS period_type,
    COALESCE(SUM(f.mql), 0) AS daily_mql,
    COALESCE(SUM(f.sql_count), 0) AS daily_sql
  FROM funnel_base f
  CROSS JOIN params p
  WHERE f.capture_date BETWEEN p.current_start AND p.current_end
    AND f.product IN UNNEST(p.product_filter)
    AND f.region IN UNNEST(p.region_filter)
  GROUP BY f.capture_date
  ORDER BY f.capture_date
),

-- Daily funnel timeseries for previous period
previous_daily_funnel AS (
  SELECT
    f.capture_date AS date,
    'previous' AS period_type,
    COALESCE(SUM(f.mql), 0) AS daily_mql,
    COALESCE(SUM(f.sql_count), 0) AS daily_sql
  FROM funnel_base f
  CROSS JOIN params p
  WHERE f.capture_date BETWEEN p.prev_start AND p.prev_end
    AND f.product IN UNNEST(p.product_filter)
    AND f.region IN UNNEST(p.region_filter)
  GROUP BY f.capture_date
  ORDER BY f.capture_date
),

-- Aggregate totals for summary
summary_current AS (
  SELECT
    COALESCE(SUM(total_acv), 0) AS total_acv,
    COALESCE(SUM(deal_count), 0) AS total_deals,
    SAFE_DIVIDE(SUM(total_acv), SUM(deal_count)) AS avg_deal_size
  FROM current_won
),

summary_previous AS (
  SELECT
    COALESCE(SUM(total_acv), 0) AS total_acv,
    COALESCE(SUM(deal_count), 0) AS total_deals,
    SAFE_DIVIDE(SUM(total_acv), SUM(deal_count)) AS avg_deal_size
  FROM previous_won
),

pipeline_total AS (
  SELECT COALESCE(SUM(pipeline_acv), 0) AS total_pipeline
  FROM current_pipeline
),

funnel_summary_current AS (
  SELECT
    COALESCE(SUM(total_mql), 0) AS total_mql,
    COALESCE(SUM(total_sql), 0) AS total_sql,
    COALESCE(SUM(total_sal), 0) AS total_sal,
    COALESCE(SUM(total_sqo), 0) AS total_sqo
  FROM current_funnel
),

funnel_summary_previous AS (
  SELECT
    COALESCE(SUM(total_mql), 0) AS total_mql,
    COALESCE(SUM(total_sql), 0) AS total_sql,
    COALESCE(SUM(total_sal), 0) AS total_sal,
    COALESCE(SUM(total_sqo), 0) AS total_sqo
  FROM previous_funnel
)

SELECT TO_JSON_STRING(STRUCT(
  -- Period info
  (SELECT STRUCT(
    STRUCT(
      FORMAT_DATE('%Y-%m-%d', current_start) AS startDate,
      FORMAT_DATE('%Y-%m-%d', current_end) AS endDate
    ) AS current,
    STRUCT(
      FORMAT_DATE('%Y-%m-%d', prev_start) AS startDate,
      FORMAT_DATE('%Y-%m-%d', prev_end) AS endDate
    ) AS previous,
    DATE_DIFF(current_end, current_start, DAY) + 1 AS daysInPeriod
  ) FROM params) AS periodInfo,

  -- Filters applied
  (SELECT STRUCT(
    ARRAY(SELECT p FROM UNNEST(product_filter) p) AS products,
    ARRAY(SELECT r FROM UNNEST(region_filter) r) AS regions
  ) FROM params) AS filters,

  -- Revenue summary
  STRUCT(
    STRUCT(
      sc.total_acv AS current,
      sp.total_acv AS previous,
      sc.total_acv - sp.total_acv AS delta,
      ROUND(SAFE_DIVIDE(sc.total_acv - sp.total_acv, NULLIF(sp.total_acv, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN sc.total_acv > sp.total_acv * 1.01 THEN 'UP'
        WHEN sc.total_acv < sp.total_acv * 0.99 THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS totalACV,
    STRUCT(
      sc.total_deals AS current,
      sp.total_deals AS previous,
      sc.total_deals - sp.total_deals AS delta,
      ROUND(SAFE_DIVIDE(sc.total_deals - sp.total_deals, NULLIF(sp.total_deals, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN sc.total_deals > sp.total_deals THEN 'UP'
        WHEN sc.total_deals < sp.total_deals THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS wonDeals,
    STRUCT(
      pt.total_pipeline AS current,
      0 AS previous,
      pt.total_pipeline AS delta,
      0 AS deltaPercent,
      'FLAT' AS trend
    ) AS pipelineACV,
    STRUCT(
      COALESCE(sc.avg_deal_size, 0) AS current,
      COALESCE(sp.avg_deal_size, 0) AS previous,
      COALESCE(sc.avg_deal_size, 0) - COALESCE(sp.avg_deal_size, 0) AS delta,
      ROUND(SAFE_DIVIDE(COALESCE(sc.avg_deal_size, 0) - COALESCE(sp.avg_deal_size, 0), NULLIF(sp.avg_deal_size, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN COALESCE(sc.avg_deal_size, 0) > COALESCE(sp.avg_deal_size, 0) * 1.01 THEN 'UP'
        WHEN COALESCE(sc.avg_deal_size, 0) < COALESCE(sp.avg_deal_size, 0) * 0.99 THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS avgDealSize
  ) AS revenueSummary,

  -- Funnel summary
  STRUCT(
    STRUCT(
      fsc.total_mql AS current,
      fsp.total_mql AS previous,
      fsc.total_mql - fsp.total_mql AS delta,
      ROUND(SAFE_DIVIDE(fsc.total_mql - fsp.total_mql, NULLIF(fsp.total_mql, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN fsc.total_mql > fsp.total_mql THEN 'UP'
        WHEN fsc.total_mql < fsp.total_mql THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS totalMQL,
    STRUCT(
      fsc.total_sql AS current,
      fsp.total_sql AS previous,
      fsc.total_sql - fsp.total_sql AS delta,
      ROUND(SAFE_DIVIDE(fsc.total_sql - fsp.total_sql, NULLIF(fsp.total_sql, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN fsc.total_sql > fsp.total_sql THEN 'UP'
        WHEN fsc.total_sql < fsp.total_sql THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS totalSQL,
    STRUCT(
      fsc.total_sal AS current,
      fsp.total_sal AS previous,
      fsc.total_sal - fsp.total_sal AS delta,
      ROUND(SAFE_DIVIDE(fsc.total_sal - fsp.total_sal, NULLIF(fsp.total_sal, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN fsc.total_sal > fsp.total_sal THEN 'UP'
        WHEN fsc.total_sal < fsp.total_sal THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS totalSAL,
    STRUCT(
      fsc.total_sqo AS current,
      fsp.total_sqo AS previous,
      fsc.total_sqo - fsp.total_sqo AS delta,
      ROUND(SAFE_DIVIDE(fsc.total_sqo - fsp.total_sqo, NULLIF(fsp.total_sqo, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN fsc.total_sqo > fsp.total_sqo THEN 'UP'
        WHEN fsc.total_sqo < fsp.total_sqo THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS totalSQO
  ) AS funnelSummary,

  -- Revenue by dimension
  (SELECT ARRAY_AGG(STRUCT(
    cw.product,
    cw.region,
    cw.category,
    STRUCT(
      cw.total_acv AS current,
      COALESCE(pw.total_acv, 0) AS previous,
      cw.total_acv - COALESCE(pw.total_acv, 0) AS delta,
      ROUND(SAFE_DIVIDE(cw.total_acv - COALESCE(pw.total_acv, 0), NULLIF(pw.total_acv, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN cw.total_acv > COALESCE(pw.total_acv, 0) * 1.01 THEN 'UP'
        WHEN cw.total_acv < COALESCE(pw.total_acv, 0) * 0.99 THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS acv,
    STRUCT(
      cw.deal_count AS current,
      COALESCE(pw.deal_count, 0) AS previous,
      cw.deal_count - COALESCE(pw.deal_count, 0) AS delta,
      ROUND(SAFE_DIVIDE(cw.deal_count - COALESCE(pw.deal_count, 0), NULLIF(pw.deal_count, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN cw.deal_count > COALESCE(pw.deal_count, 0) THEN 'UP'
        WHEN cw.deal_count < COALESCE(pw.deal_count, 0) THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS deals,
    STRUCT(
      COALESCE(cwr.win_rate_pct, 0) AS current,
      COALESCE(pwr.win_rate_pct, 0) AS previous,
      COALESCE(cwr.win_rate_pct, 0) - COALESCE(pwr.win_rate_pct, 0) AS delta,
      ROUND(SAFE_DIVIDE(COALESCE(cwr.win_rate_pct, 0) - COALESCE(pwr.win_rate_pct, 0), NULLIF(pwr.win_rate_pct, 0)) * 100, 1) AS deltaPercent,
      CASE
        WHEN COALESCE(cwr.win_rate_pct, 0) > COALESCE(pwr.win_rate_pct, 0) * 1.01 THEN 'UP'
        WHEN COALESCE(cwr.win_rate_pct, 0) < COALESCE(pwr.win_rate_pct, 0) * 0.99 THEN 'DOWN'
        ELSE 'FLAT'
      END AS trend
    ) AS winRate
  ))
  FROM current_won cw
  LEFT JOIN previous_won pw ON cw.product = pw.product AND cw.region = pw.region AND cw.category = pw.category
  LEFT JOIN current_win_rates cwr ON cw.product = cwr.product AND cw.region = cwr.region AND cw.category = cwr.category
  LEFT JOIN previous_win_rates pwr ON cw.product = pwr.product AND cw.region = pwr.region AND cw.category = pwr.category
  ) AS revenueByDimension,

  -- Funnel by dimension
  (SELECT ARRAY_AGG(STRUCT(
    cf.product,
    cf.region,
    STRUCT(
      cf.total_mql AS current,
      COALESCE(pf.total_mql, 0) AS previous,
      cf.total_mql - COALESCE(pf.total_mql, 0) AS delta,
      ROUND(SAFE_DIVIDE(cf.total_mql - COALESCE(pf.total_mql, 0), NULLIF(pf.total_mql, 0)) * 100, 1) AS deltaPercent,
      CASE WHEN cf.total_mql > COALESCE(pf.total_mql, 0) THEN 'UP' WHEN cf.total_mql < COALESCE(pf.total_mql, 0) THEN 'DOWN' ELSE 'FLAT' END AS trend
    ) AS mql,
    STRUCT(
      cf.total_sql AS current,
      COALESCE(pf.total_sql, 0) AS previous,
      cf.total_sql - COALESCE(pf.total_sql, 0) AS delta,
      ROUND(SAFE_DIVIDE(cf.total_sql - COALESCE(pf.total_sql, 0), NULLIF(pf.total_sql, 0)) * 100, 1) AS deltaPercent,
      CASE WHEN cf.total_sql > COALESCE(pf.total_sql, 0) THEN 'UP' WHEN cf.total_sql < COALESCE(pf.total_sql, 0) THEN 'DOWN' ELSE 'FLAT' END AS trend
    ) AS sql,
    STRUCT(
      cf.total_sal AS current,
      COALESCE(pf.total_sal, 0) AS previous,
      cf.total_sal - COALESCE(pf.total_sal, 0) AS delta,
      ROUND(SAFE_DIVIDE(cf.total_sal - COALESCE(pf.total_sal, 0), NULLIF(pf.total_sal, 0)) * 100, 1) AS deltaPercent,
      CASE WHEN cf.total_sal > COALESCE(pf.total_sal, 0) THEN 'UP' WHEN cf.total_sal < COALESCE(pf.total_sal, 0) THEN 'DOWN' ELSE 'FLAT' END AS trend
    ) AS sal,
    STRUCT(
      cf.total_sqo AS current,
      COALESCE(pf.total_sqo, 0) AS previous,
      cf.total_sqo - COALESCE(pf.total_sqo, 0) AS delta,
      ROUND(SAFE_DIVIDE(cf.total_sqo - COALESCE(pf.total_sqo, 0), NULLIF(pf.total_sqo, 0)) * 100, 1) AS deltaPercent,
      CASE WHEN cf.total_sqo > COALESCE(pf.total_sqo, 0) THEN 'UP' WHEN cf.total_sqo < COALESCE(pf.total_sqo, 0) THEN 'DOWN' ELSE 'FLAT' END AS trend
    ) AS sqo
  ))
  FROM current_funnel cf
  LEFT JOIN previous_funnel pf ON cf.product = pf.product AND cf.region = pf.region
  ) AS funnelByDimension,

  -- Chart data
  STRUCT(
    STRUCT(
      'ACV Won' AS metricName,
      (SELECT ARRAY_AGG(STRUCT(FORMAT_DATE('%Y-%m-%d', date) AS date, daily_acv AS value, period_type AS periodType) ORDER BY date) FROM current_daily_acv) AS currentPeriod,
      (SELECT ARRAY_AGG(STRUCT(FORMAT_DATE('%Y-%m-%d', date) AS date, daily_acv AS value, period_type AS periodType) ORDER BY date) FROM previous_daily_acv) AS previousPeriod
    ) AS acvTimeSeries,
    STRUCT(
      'MQL' AS metricName,
      (SELECT ARRAY_AGG(STRUCT(FORMAT_DATE('%Y-%m-%d', date) AS date, daily_mql AS value, period_type AS periodType) ORDER BY date) FROM current_daily_funnel) AS currentPeriod,
      (SELECT ARRAY_AGG(STRUCT(FORMAT_DATE('%Y-%m-%d', date) AS date, daily_mql AS value, period_type AS periodType) ORDER BY date) FROM previous_daily_funnel) AS previousPeriod
    ) AS mqlTimeSeries,
    STRUCT(
      'SQL' AS metricName,
      (SELECT ARRAY_AGG(STRUCT(FORMAT_DATE('%Y-%m-%d', date) AS date, daily_sql AS value, period_type AS periodType) ORDER BY date) FROM current_daily_funnel) AS currentPeriod,
      (SELECT ARRAY_AGG(STRUCT(FORMAT_DATE('%Y-%m-%d', date) AS date, daily_sql AS value, period_type AS periodType) ORDER BY date) FROM previous_daily_funnel) AS previousPeriod
    ) AS sqlTimeSeries
  ) AS charts,

  FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', CURRENT_TIMESTAMP()) AS generatedAt

)) AS trend_analysis_json
FROM summary_current sc
CROSS JOIN summary_previous sp
CROSS JOIN pipeline_total pt
CROSS JOIN funnel_summary_current fsc
CROSS JOIN funnel_summary_previous fsp
