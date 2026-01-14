-- ============================================================================
-- Query 1: Enhanced Report Payload with Trend Analysis
-- ============================================================================
-- Generates WTD/MTD/QTD/YTD scorecards with week-over-week and month-over-month
-- comparisons for executive-level insights.
--
-- Key Improvements from V1:
-- - Week-over-week pacing comparison
-- - Month-over-month trend indicators
-- - Smart date basis detection (Won_Date vs TargetDate)
-- - Better structured JSON for parsing
-- ============================================================================

WITH
  -- Input parameters
  params AS (
    SELECT
      DATE('2026-01-10') AS as_of_date,
      'P50' AS percentile,
      'MONDAY' AS week_starts_on
  ),

  -- Date calculations for current and prior periods
  dates AS (
    SELECT
      p.*,
      -- Current period dates
      DATE_TRUNC(p.as_of_date, WEEK(MONDAY)) AS wtd_start,
      DATE_TRUNC(p.as_of_date, MONTH) AS mtd_start,
      DATE_TRUNC(p.as_of_date, QUARTER) AS qtd_start,
      DATE_TRUNC(p.as_of_date, YEAR) AS ytd_start,

      -- Prior week dates (for WoW comparison)
      DATE_TRUNC(DATE_SUB(p.as_of_date, INTERVAL 7 DAY), WEEK(MONDAY)) AS prior_wtd_start,
      DATE_SUB(p.as_of_date, INTERVAL 7 DAY) AS prior_wtd_end,

      -- Prior month dates (for MoM comparison)
      DATE_TRUNC(DATE_SUB(p.as_of_date, INTERVAL 1 MONTH), MONTH) AS prior_mtd_start,
      DATE_SUB(p.as_of_date, INTERVAL 1 MONTH) AS prior_mtd_end
    FROM params p
  ),

  -- Determine correct date basis for actuals (Won_Date vs TargetDate)
  date_basis_detection AS (
    SELECT
      SUM(CASE WHEN Won_Date BETWEEN d.mtd_start AND d.as_of_date THEN Actual_ACV ELSE 0 END) AS sum_by_won_date,
      SUM(CASE WHEN TargetDate BETWEEN d.mtd_start AND d.as_of_date THEN Actual_ACV ELSE 0 END) AS sum_by_target_date,
      CASE
        WHEN SUM(CASE WHEN Won_Date BETWEEN d.mtd_start AND d.as_of_date THEN Actual_ACV ELSE 0 END) > 0
        THEN 'Won_Date'
        ELSE 'TargetDate'
      END AS date_basis
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, dates d
  ),

  -- Base data with chosen date basis
  base_data AS (
    SELECT
      sop.*,
      basis.date_basis,
      CASE
        WHEN basis.date_basis = 'Won_Date' THEN sop.Won_Date
        ELSE sop.TargetDate
      END AS effective_date
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
    CROSS JOIN date_basis_detection basis
  ),

  -- Current period aggregations (WTD/MTD/QTD/YTD)
  current_horizon_agg AS (
    -- WTD All Sources
    SELECT
      'WTD' AS horizon,
      'ALL' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      COALESCE(SUM(MQL_Revenue_Slippage), 0) AS MQL_Slippage,
      COALESCE(SUM(SQL_Revenue_Slippage), 0) AS SQL_Slippage,
      COALESCE(SUM(SQO_Revenue_Slippage), 0) AS SQO_Slippage,
      COALESCE(SUM(Won_Count_Revenue_Slippage), 0) AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.wtd_start AND dates.as_of_date

    UNION ALL

    -- MTD All Sources
    SELECT
      'MTD' AS horizon,
      'ALL' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      COALESCE(SUM(MQL_Revenue_Slippage), 0) AS MQL_Slippage,
      COALESCE(SUM(SQL_Revenue_Slippage), 0) AS SQL_Slippage,
      COALESCE(SUM(SQO_Revenue_Slippage), 0) AS SQO_Slippage,
      COALESCE(SUM(Won_Count_Revenue_Slippage), 0) AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.mtd_start AND dates.as_of_date

    UNION ALL

    -- QTD All Sources
    SELECT
      'QTD' AS horizon,
      'ALL' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      COALESCE(SUM(MQL_Revenue_Slippage), 0) AS MQL_Slippage,
      COALESCE(SUM(SQL_Revenue_Slippage), 0) AS SQL_Slippage,
      COALESCE(SUM(SQO_Revenue_Slippage), 0) AS SQO_Slippage,
      COALESCE(SUM(Won_Count_Revenue_Slippage), 0) AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.qtd_start AND dates.as_of_date

    UNION ALL

    -- YTD All Sources
    SELECT
      'YTD' AS horizon,
      'ALL' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      COALESCE(SUM(MQL_Revenue_Slippage), 0) AS MQL_Slippage,
      COALESCE(SUM(SQL_Revenue_Slippage), 0) AS SQL_Slippage,
      COALESCE(SUM(SQO_Revenue_Slippage), 0) AS SQO_Slippage,
      COALESCE(SUM(Won_Count_Revenue_Slippage), 0) AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.ytd_start AND dates.as_of_date

    UNION ALL

    -- WTD Inbound Only
    SELECT
      'WTD' AS horizon,
      'INBOUND' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      0 AS MQL_Slippage,
      0 AS SQL_Slippage,
      0 AS SQO_Slippage,
      0 AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.wtd_start AND dates.as_of_date
      AND Source = 'INBOUND'

    UNION ALL

    -- MTD Inbound Only
    SELECT
      'MTD' AS horizon,
      'INBOUND' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      0 AS MQL_Slippage,
      0 AS SQL_Slippage,
      0 AS SQO_Slippage,
      0 AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.mtd_start AND dates.as_of_date
      AND Source = 'INBOUND'

    UNION ALL

    -- QTD Inbound Only
    SELECT
      'QTD' AS horizon,
      'INBOUND' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      0 AS MQL_Slippage,
      0 AS SQL_Slippage,
      0 AS SQO_Slippage,
      0 AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.qtd_start AND dates.as_of_date
      AND Source = 'INBOUND'

    UNION ALL

    -- YTD Inbound Only
    SELECT
      'YTD' AS horizon,
      'INBOUND' AS source_filter,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SUM(Target_SQL) AS Target_SQL,
      SUM(Actual_SQL) AS Actual_SQL,
      SUM(Target_SAL) AS Target_SAL,
      SUM(Actual_SAL) AS Actual_SAL,
      SUM(Target_SQO) AS Target_SQO,
      SUM(Actual_SQO) AS Actual_SQO,
      0 AS MQL_Slippage,
      0 AS SQL_Slippage,
      0 AS SQO_Slippage,
      0 AS WON_Slippage
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.ytd_start AND dates.as_of_date
      AND Source = 'INBOUND'
  ),

  -- Prior period aggregations for trend comparison
  prior_period_agg AS (
    -- Prior WTD All Sources
    SELECT
      'WTD' AS horizon,
      'ALL' AS source_filter,
      SUM(Actual_ACV) AS Prior_Actual_ACV,
      SUM(Actual_Won) AS Prior_Actual_Won,
      SAFE_DIVIDE(SUM(Actual_ACV), SUM(Target_ACV)) AS Prior_Revenue_Pacing
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.prior_wtd_start AND dates.prior_wtd_end

    UNION ALL

    -- Prior MTD All Sources
    SELECT
      'MTD' AS horizon,
      'ALL' AS source_filter,
      SUM(Actual_ACV) AS Prior_Actual_ACV,
      SUM(Actual_Won) AS Prior_Actual_Won,
      SAFE_DIVIDE(SUM(Actual_ACV), SUM(Target_ACV)) AS Prior_Revenue_Pacing
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.prior_mtd_start AND dates.prior_mtd_end

    UNION ALL

    -- Prior WTD Inbound
    SELECT
      'WTD' AS horizon,
      'INBOUND' AS source_filter,
      SUM(Actual_ACV) AS Prior_Actual_ACV,
      SUM(Actual_Won) AS Prior_Actual_Won,
      SAFE_DIVIDE(SUM(Actual_ACV), SUM(Target_ACV)) AS Prior_Revenue_Pacing
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.prior_wtd_start AND dates.prior_wtd_end
      AND Source = 'INBOUND'

    UNION ALL

    -- Prior MTD Inbound
    SELECT
      'MTD' AS horizon,
      'INBOUND' AS source_filter,
      SUM(Actual_ACV) AS Prior_Actual_ACV,
      SUM(Actual_Won) AS Prior_Actual_Won,
      SAFE_DIVIDE(SUM(Actual_ACV), SUM(Target_ACV)) AS Prior_Revenue_Pacing
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.prior_mtd_start AND dates.prior_mtd_end
      AND Source = 'INBOUND'
  ),

  -- Calculate scores with trend indicators
  scorecard_with_trends AS (
    SELECT
      c.horizon,
      c.source_filter,
      c.Target_ACV,
      c.Actual_ACV,
      c.Target_Won,
      c.Actual_Won,
      SAFE_DIVIDE(c.Actual_ACV, c.Target_ACV) AS Revenue_Pacing_Score,
      SAFE_DIVIDE(c.Actual_Won, c.Target_Won) AS Volume_Pacing_Score,

      -- Conversion rate changes
      SAFE_DIVIDE(c.Actual_SAL, c.Actual_SQL) - SAFE_DIVIDE(c.Target_SAL, c.Target_SQL) AS SQL_to_SAL,
      SAFE_DIVIDE(c.Actual_SQO, c.Actual_SAL) - SAFE_DIVIDE(c.Target_SQO, c.Target_SAL) AS SAL_to_SQO,
      SAFE_DIVIDE(c.Actual_Won, c.Actual_SQO) - SAFE_DIVIDE(c.Target_Won, c.Target_SQO) AS SQO_to_Won,
      SAFE_DIVIDE(c.Actual_SQO, c.Actual_SQL) - SAFE_DIVIDE(c.Target_SQO, c.Target_SQL) AS SQL_to_SQO,

      -- Worst slippage
      CASE
        WHEN c.MQL_Slippage <= LEAST(c.SQL_Slippage, c.SQO_Slippage, c.WON_Slippage) THEN 'MQL'
        WHEN c.SQL_Slippage <= LEAST(c.SQO_Slippage, c.WON_Slippage) THEN 'SQL'
        WHEN c.SQO_Slippage <= c.WON_Slippage THEN 'SQO'
        ELSE 'WON'
      END AS Worst_Slippage_Stage,
      LEAST(c.MQL_Slippage, c.SQL_Slippage, c.SQO_Slippage, c.WON_Slippage) AS Worst_Slippage_Value,

      -- Prior period comparison
      p.Prior_Actual_ACV,
      p.Prior_Actual_Won,
      p.Prior_Revenue_Pacing,

      -- Trend indicators
      CASE
        WHEN SAFE_DIVIDE(c.Actual_ACV, c.Target_ACV) > COALESCE(p.Prior_Revenue_Pacing, 0) THEN 'improving'
        WHEN SAFE_DIVIDE(c.Actual_ACV, c.Target_ACV) < COALESCE(p.Prior_Revenue_Pacing, 0) THEN 'worsening'
        ELSE 'stable'
      END AS Revenue_Trend
    FROM current_horizon_agg c
    LEFT JOIN prior_period_agg p
      ON c.horizon = p.horizon
      AND c.source_filter = p.source_filter
  ),

  -- Worst pacing pockets by horizon
  pocket_pacing_raw AS (
    -- WTD
    SELECT
      'WTD' AS horizon,
      RecordType AS rt,
      OpportunityType AS ot,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_ACV) AS sum_target,
      SUM(Actual_ACV) AS sum_actual
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.wtd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, Region, Segment, Source

    UNION ALL

    -- MTD
    SELECT
      'MTD' AS horizon,
      RecordType AS rt,
      OpportunityType AS ot,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_ACV) AS sum_target,
      SUM(Actual_ACV) AS sum_actual
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, Region, Segment, Source

    UNION ALL

    -- QTD
    SELECT
      'QTD' AS horizon,
      RecordType AS rt,
      OpportunityType AS ot,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_ACV) AS sum_target,
      SUM(Actual_ACV) AS sum_actual
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.qtd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, Region, Segment, Source

    UNION ALL

    -- YTD
    SELECT
      'YTD' AS horizon,
      RecordType AS rt,
      OpportunityType AS ot,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_ACV) AS sum_target,
      SUM(Actual_ACV) AS sum_actual
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.ytd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, Region, Segment, Source
  ),

  pocket_pacing AS (
    SELECT
      horizon,
      rt,
      ot,
      r,
      seg,
      src,
      sum_target AS Target_ACV,
      sum_actual AS Actual_ACV,
      SAFE_DIVIDE(sum_actual, sum_target) AS Revenue_Pacing,
      (sum_target - sum_actual) AS ACV_Gap
    FROM pocket_pacing_raw
    WHERE sum_target > 0
    QUALIFY ROW_NUMBER() OVER (PARTITION BY horizon ORDER BY SAFE_DIVIDE(sum_actual, sum_target) ASC) <= 5
  ),

  -- Region Summary (MTD)
  region_summary_raw AS (
    SELECT
      Region AS region,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SAFE_DIVIDE(SUM(Actual_ACV), SUM(Target_ACV)) AS Revenue_Pacing,
      SAFE_DIVIDE(SUM(Actual_Won), SUM(Target_Won)) AS Volume_Pacing,
      (SUM(Target_ACV) - SUM(Actual_ACV)) AS ACV_Gap
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY Region
  ),

  -- OpportunityType Summary (MTD)
  opportunity_type_summary_raw AS (
    SELECT
      OpportunityType AS opp_type,
      SUM(Target_ACV) AS Target_ACV,
      SUM(Actual_ACV) AS Actual_ACV,
      SUM(Target_Won) AS Target_Won,
      SUM(Actual_Won) AS Actual_Won,
      SAFE_DIVIDE(SUM(Actual_ACV), SUM(Target_ACV)) AS Revenue_Pacing,
      SAFE_DIVIDE(SUM(Actual_Won), SUM(Target_Won)) AS Volume_Pacing,
      (SUM(Target_ACV) - SUM(Actual_ACV)) AS ACV_Gap
    FROM base_data, dates
    WHERE effective_date BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY OpportunityType
  )

-- Build final JSON
SELECT
  TO_JSON_STRING(STRUCT(
    d.as_of_date,
    d.percentile,
    d.week_starts_on,
    basis.date_basis AS actuals_date_basis,
    basis.sum_by_won_date,
    basis.sum_by_target_date,

    -- All sources scorecard with trends
    ARRAY(
      SELECT AS STRUCT
        horizon,
        Target_ACV,
        Actual_ACV,
        Target_Won,
        Actual_Won,
        Revenue_Pacing_Score,
        Volume_Pacing_Score,
        SQL_to_SAL,
        SAL_to_SQO,
        SQO_to_Won,
        SQL_to_SQO,
        STRUCT(Worst_Slippage_Stage AS stage, Worst_Slippage_Value AS value) AS Worst_Slippage,
        Prior_Actual_ACV,
        Prior_Revenue_Pacing,
        Revenue_Trend
      FROM scorecard_with_trends
      WHERE source_filter = 'ALL'
      ORDER BY CASE horizon WHEN 'WTD' THEN 1 WHEN 'MTD' THEN 2 WHEN 'QTD' THEN 3 WHEN 'YTD' THEN 4 END
    ) AS scorecard_all_sources,

    -- Inbound scorecard with trends
    ARRAY(
      SELECT AS STRUCT
        horizon,
        Target_ACV,
        Actual_ACV,
        Target_Won,
        Actual_Won,
        Revenue_Pacing_Score,
        Volume_Pacing_Score,
        Prior_Actual_ACV,
        Prior_Revenue_Pacing,
        Revenue_Trend
      FROM scorecard_with_trends
      WHERE source_filter = 'INBOUND'
      ORDER BY CASE horizon WHEN 'WTD' THEN 1 WHEN 'MTD' THEN 2 WHEN 'QTD' THEN 3 WHEN 'YTD' THEN 4 END
    ) AS scorecard_inbound,

    -- Worst pacing pockets by horizon
    STRUCT(
      ARRAY(SELECT AS STRUCT rt, ot, r, seg, src, Target_ACV, Actual_ACV, Revenue_Pacing, ACV_Gap FROM pocket_pacing WHERE horizon = 'WTD' ORDER BY Revenue_Pacing) AS WTD,
      ARRAY(SELECT AS STRUCT rt, ot, r, seg, src, Target_ACV, Actual_ACV, Revenue_Pacing, ACV_Gap FROM pocket_pacing WHERE horizon = 'MTD' ORDER BY Revenue_Pacing) AS MTD,
      ARRAY(SELECT AS STRUCT rt, ot, r, seg, src, Target_ACV, Actual_ACV, Revenue_Pacing, ACV_Gap FROM pocket_pacing WHERE horizon = 'QTD' ORDER BY Revenue_Pacing) AS QTD,
      ARRAY(SELECT AS STRUCT rt, ot, r, seg, src, Target_ACV, Actual_ACV, Revenue_Pacing, ACV_Gap FROM pocket_pacing WHERE horizon = 'YTD' ORDER BY Revenue_Pacing) AS YTD
    ) AS worst_revenue_pacing_by_horizon,

    -- Region Summary (MTD)
    ARRAY(
      SELECT AS STRUCT
        region,
        Target_ACV,
        Actual_ACV,
        Target_Won,
        Actual_Won,
        Revenue_Pacing,
        Volume_Pacing,
        ACV_Gap
      FROM region_summary_raw
      ORDER BY Target_ACV DESC
    ) AS region_summary_mtd,

    -- OpportunityType Summary (MTD)
    ARRAY(
      SELECT AS STRUCT
        opp_type,
        Target_ACV,
        Actual_ACV,
        Target_Won,
        Actual_Won,
        Revenue_Pacing,
        Volume_Pacing,
        ACV_Gap
      FROM opportunity_type_summary_raw
      ORDER BY Target_ACV DESC
    ) AS opportunity_type_summary_mtd
  )) AS report_payload_json
FROM dates d
CROSS JOIN date_basis_detection basis
