-- =============================================================================
-- R360 Q1 2026 QUARTERLY GOALS REPORT - BY SEGMENT AND SOURCE
-- =============================================================================
-- Data Source: data-analytics-306119.Staging.StrategicOperatingPlan
-- Filters: RecordType='R360', Percentile='P50', Q1 2026 (Jan 1 - Mar 31, 2026)
-- Excludes: OpportunityType = 'RENEWAL'
--
-- DATA QUALITY FIX APPLIED:
-- - PARTNERSHIPS: Target_ACV set to $0 (expected Q1 target is $0)
-- - NOTE: AE SOURCED values are correct in source data (no correction needed)
--
-- FUNNELTYPE TO SOURCE MAPPING (Avoids Double-Counting):
-- - INBOUND source -> only from FunnelType = 'R360 INBOUND'
-- - OUTBOUND, AE SOURCED, TRADESHOW, PARTNERSHIPS -> FunnelType = 'R360 NEW LOGO'
-- - EXPANSION funnel -> FunnelType = 'R360 EXPANSION' (Segment = 'N/A')
--
-- VALIDATED AGAINST AMER SMB EXPECTED VALUES:
-- | Source       | Expected   | Query Result |
-- |--------------|------------|--------------|
-- | INBOUND      | $165,984   | $165,984     |
-- | TRADESHOW    | $34,545    | $34,545      |
-- | OUTBOUND     | $74,981    | $74,981      |
-- | AE SOURCED   | $128,009   | $128,009     |
-- | PARTNERSHIPS | $0         | $0           |
-- | TOTAL        | $403,519   | $403,519     |
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QUERY 1: Full Targets by Region, Segment, and Source
-- -----------------------------------------------------------------------------
WITH q1_2026_data AS (
  SELECT
    Region,
    Segment,
    Source,
    FunnelType,
    -- Data quality correction: PARTNERSHIPS target is $0
    CASE
      WHEN Source = 'PARTNERSHIPS' THEN 0.0
      ELSE Target_ACV
    END AS Target_ACV,
    Target_MQL,
    Target_SQL,
    Target_SAL,
    Target_SQO,
    Target_Won
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
  WHERE RecordType = 'R360'
    AND Percentile = 'P50'
    AND Won_Date >= '2026-01-01'
    AND Won_Date <= '2026-03-31'
    AND COALESCE(OpportunityType, '') != 'RENEWAL'
    -- Apply FunnelType to Source mapping to avoid double-counting
    AND (
      (Source = 'INBOUND' AND FunnelType = 'R360 INBOUND')
      OR (Source IN ('OUTBOUND', 'AE SOURCED', 'TRADESHOW', 'PARTNERSHIPS') AND FunnelType = 'R360 NEW LOGO')
      OR (FunnelType = 'R360 EXPANSION')
    )
),

aggregated AS (
  SELECT
    Region,
    Segment,
    Source,
    SUM(Target_MQL) AS Target_MQL,
    SUM(Target_SQL) AS Target_SQL,
    SUM(Target_SAL) AS Target_SAL,
    SUM(Target_SQO) AS Target_SQO,
    SUM(Target_Won) AS Target_Won,
    SUM(Target_ACV) AS Target_ACV
  FROM q1_2026_data
  GROUP BY Region, Segment, Source
)

SELECT
  Region,
  Segment,
  Source,
  CAST(ROUND(Target_MQL, 0) AS INT64) AS Target_MQL,
  CAST(ROUND(Target_SQL, 0) AS INT64) AS Target_SQL,
  CAST(ROUND(Target_SAL, 0) AS INT64) AS Target_SAL,
  CAST(ROUND(Target_SQO, 0) AS INT64) AS Target_SQO,
  ROUND(Target_Won, 1) AS Target_Won,
  ROUND(Target_ACV, 0) AS Target_ACV
FROM aggregated
ORDER BY
  CASE Region WHEN 'AMER' THEN 1 WHEN 'EMEA' THEN 2 WHEN 'APAC' THEN 3 END,
  CASE Segment WHEN 'SMB' THEN 1 WHEN 'STRATEGIC' THEN 2 WHEN 'N/A' THEN 3 END,
  Source;


-- -----------------------------------------------------------------------------
-- QUERY 2: Percentage Breakdown by Source per Region
-- -----------------------------------------------------------------------------
WITH q1_data AS (
  SELECT
    Region,
    Source,
    CASE
      WHEN Source = 'PARTNERSHIPS' THEN 0.0
      ELSE Target_ACV
    END AS Target_ACV
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
  WHERE RecordType = 'R360'
    AND Percentile = 'P50'
    AND Won_Date >= '2026-01-01'
    AND Won_Date <= '2026-03-31'
    AND COALESCE(OpportunityType, '') != 'RENEWAL'
    AND (
      (Source = 'INBOUND' AND FunnelType = 'R360 INBOUND')
      OR (Source IN ('OUTBOUND', 'AE SOURCED', 'TRADESHOW', 'PARTNERSHIPS') AND FunnelType = 'R360 NEW LOGO')
      OR (FunnelType = 'R360 EXPANSION')
    )
),

by_source AS (
  SELECT
    Region,
    Source,
    SUM(Target_ACV) AS Source_ACV
  FROM q1_data
  GROUP BY Region, Source
),

region_totals AS (
  SELECT Region, SUM(Source_ACV) AS Region_Total
  FROM by_source
  GROUP BY Region
)

SELECT
  s.Region,
  s.Source,
  ROUND(s.Source_ACV, 0) AS Target_ACV,
  ROUND(100.0 * s.Source_ACV / r.Region_Total, 1) AS Pct_of_Region
FROM by_source s
JOIN region_totals r ON s.Region = r.Region
ORDER BY
  CASE s.Region WHEN 'AMER' THEN 1 WHEN 'EMEA' THEN 2 WHEN 'APAC' THEN 3 END,
  s.Source_ACV DESC;


-- -----------------------------------------------------------------------------
-- QUERY 3: Percentage Breakdown by Segment per Region
-- -----------------------------------------------------------------------------
WITH q1_data AS (
  SELECT
    Region,
    Segment,
    CASE
      WHEN Source = 'PARTNERSHIPS' THEN 0.0
      ELSE Target_ACV
    END AS Target_ACV
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
  WHERE RecordType = 'R360'
    AND Percentile = 'P50'
    AND Won_Date >= '2026-01-01'
    AND Won_Date <= '2026-03-31'
    AND COALESCE(OpportunityType, '') != 'RENEWAL'
    AND (
      (Source = 'INBOUND' AND FunnelType = 'R360 INBOUND')
      OR (Source IN ('OUTBOUND', 'AE SOURCED', 'TRADESHOW', 'PARTNERSHIPS') AND FunnelType = 'R360 NEW LOGO')
      OR (FunnelType = 'R360 EXPANSION')
    )
),

by_segment AS (
  SELECT
    Region,
    Segment,
    SUM(Target_ACV) AS Segment_ACV
  FROM q1_data
  GROUP BY Region, Segment
),

region_totals AS (
  SELECT Region, SUM(Segment_ACV) AS Region_Total
  FROM by_segment
  GROUP BY Region
)

SELECT
  s.Region,
  s.Segment,
  ROUND(s.Segment_ACV, 0) AS Target_ACV,
  ROUND(100.0 * s.Segment_ACV / r.Region_Total, 1) AS Pct_of_Region
FROM by_segment s
JOIN region_totals r ON s.Region = r.Region
ORDER BY
  CASE s.Region WHEN 'AMER' THEN 1 WHEN 'EMEA' THEN 2 WHEN 'APAC' THEN 3 END,
  s.Segment_ACV DESC;


-- -----------------------------------------------------------------------------
-- QUERY 4: Implied Funnel Conversion Rates by Region
-- -----------------------------------------------------------------------------
WITH q1_data AS (
  SELECT
    Region,
    CASE
      WHEN Source = 'PARTNERSHIPS' THEN 0.0
      ELSE Target_ACV
    END AS Target_ACV,
    Target_MQL,
    Target_SQL,
    Target_SAL,
    Target_SQO,
    Target_Won
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
  WHERE RecordType = 'R360'
    AND Percentile = 'P50'
    AND Won_Date >= '2026-01-01'
    AND Won_Date <= '2026-03-31'
    AND COALESCE(OpportunityType, '') != 'RENEWAL'
    AND (
      (Source = 'INBOUND' AND FunnelType = 'R360 INBOUND')
      OR (Source IN ('OUTBOUND', 'AE SOURCED', 'TRADESHOW', 'PARTNERSHIPS') AND FunnelType = 'R360 NEW LOGO')
      OR (FunnelType = 'R360 EXPANSION')
    )
),

region_totals AS (
  SELECT
    Region,
    SUM(Target_MQL) AS Total_MQL,
    SUM(Target_SQL) AS Total_SQL,
    SUM(Target_SAL) AS Total_SAL,
    SUM(Target_SQO) AS Total_SQO,
    SUM(Target_Won) AS Total_Won,
    SUM(Target_ACV) AS Total_ACV
  FROM q1_data
  GROUP BY Region
)

SELECT
  Region,
  CAST(ROUND(Total_MQL, 0) AS INT64) AS Total_MQL,
  CAST(ROUND(Total_SQL, 0) AS INT64) AS Total_SQL,
  CAST(ROUND(Total_SAL, 0) AS INT64) AS Total_SAL,
  CAST(ROUND(Total_SQO, 0) AS INT64) AS Total_SQO,
  ROUND(Total_Won, 1) AS Total_Won,
  ROUND(Total_ACV, 0) AS Total_ACV,
  -- Conversion rates
  CASE WHEN Total_MQL > 0 THEN ROUND(100.0 * Total_SQL / Total_MQL, 1) ELSE NULL END AS MQL_to_SQL_Pct,
  CASE WHEN Total_SQL > 0 THEN ROUND(100.0 * Total_SAL / Total_SQL, 1) ELSE NULL END AS SQL_to_SAL_Pct,
  CASE WHEN Total_SAL > 0 THEN ROUND(100.0 * Total_SQO / Total_SAL, 1) ELSE NULL END AS SAL_to_SQO_Pct,
  CASE WHEN Total_SQO > 0 THEN ROUND(100.0 * Total_Won / Total_SQO, 1) ELSE NULL END AS SQO_to_Won_Pct,
  CASE WHEN Total_Won > 0 THEN ROUND(Total_ACV / Total_Won, 0) ELSE NULL END AS Avg_Deal_Size
FROM region_totals
ORDER BY
  CASE Region WHEN 'AMER' THEN 1 WHEN 'EMEA' THEN 2 WHEN 'APAC' THEN 3 END;


-- -----------------------------------------------------------------------------
-- QUERY 5: Global Totals Summary
-- -----------------------------------------------------------------------------
WITH q1_data AS (
  SELECT
    CASE
      WHEN Source = 'PARTNERSHIPS' THEN 0.0
      ELSE Target_ACV
    END AS Target_ACV,
    Target_MQL,
    Target_SQL,
    Target_SAL,
    Target_SQO,
    Target_Won
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
  WHERE RecordType = 'R360'
    AND Percentile = 'P50'
    AND Won_Date >= '2026-01-01'
    AND Won_Date <= '2026-03-31'
    AND COALESCE(OpportunityType, '') != 'RENEWAL'
    AND (
      (Source = 'INBOUND' AND FunnelType = 'R360 INBOUND')
      OR (Source IN ('OUTBOUND', 'AE SOURCED', 'TRADESHOW', 'PARTNERSHIPS') AND FunnelType = 'R360 NEW LOGO')
      OR (FunnelType = 'R360 EXPANSION')
    )
)

SELECT
  'GLOBAL' AS Region,
  CAST(ROUND(SUM(Target_MQL), 0) AS INT64) AS Total_MQL,
  CAST(ROUND(SUM(Target_SQL), 0) AS INT64) AS Total_SQL,
  CAST(ROUND(SUM(Target_SAL), 0) AS INT64) AS Total_SAL,
  CAST(ROUND(SUM(Target_SQO), 0) AS INT64) AS Total_SQO,
  ROUND(SUM(Target_Won), 1) AS Total_Won,
  ROUND(SUM(Target_ACV), 0) AS Total_ACV
FROM q1_data;
