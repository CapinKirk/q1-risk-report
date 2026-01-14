-- Full Detail Report: All Segments with Status and Bottleneck Analysis
-- Outputs all R360 segments (not just top 3 risks)
-- Includes: QTD pacing, status classification, bottleneck stage, issue type
-- Created: 2026-01-11
--
-- STATUS THRESHOLDS:
--   ON_TRACK: >= 90% pacing
--   AT_RISK: 70-89% pacing
--   MISS: < 70% pacing
--
-- ISSUE TYPES:
--   VOLUME: Top-of-funnel issue (MQL/SQL < target but conversion OK)
--   CONVERSION: Mid-funnel issue (volume OK but conversion rates low)
--   HYBRID: Both volume and conversion issues
--
WITH
  params AS (
    SELECT DATE('2026-01-10') AS as_of_date, 'P50' AS percentile, 'R360' AS product_filter
  ),

  -- Date window calculations
  dates AS (
    SELECT
      p.*,
      DATE_TRUNC(p.as_of_date, QUARTER) AS qtd_start
    FROM params p
  ),

  -- ============================================================================
  -- ACTUALS FROM OPPORTUNITY VIEW TABLE
  -- ============================================================================
  actuals_from_opportunities AS (
    SELECT
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      CASE
        WHEN Type = 'Existing Business' THEN 'R360 EXPANSION'
        WHEN Type = 'New Business' AND (POR_SDRSource = 'Inbound' OR SDRSource = 'Inbound') THEN 'R360 INBOUND'
        WHEN Type = 'New Business' THEN 'R360 NEW LOGO'
        WHEN Type = 'Migration' THEN 'R360 MIGRATION'
        WHEN Type = 'Renewal' THEN 'R360 RENEWAL'
        ELSE 'R360 OTHER'
      END AS funnel_type,
      CASE
        WHEN Type = 'Renewal' THEN 'AM SOURCED'
        -- MIGRATION FIX 2026-01-11: SOP only has AM SOURCED and INBOUND for Migration
        WHEN Type = 'Migration' AND UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'INBOUND' THEN 'INBOUND'
        WHEN Type = 'Migration' THEN 'AM SOURCED'
        WHEN UPPER(SDRSource) = 'INBOUND' THEN 'INBOUND'
        WHEN UPPER(SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
        WHEN UPPER(SDRSource) = 'AE SOURCED' THEN 'AE SOURCED'
        WHEN UPPER(SDRSource) = 'AM SOURCED' THEN 'AM SOURCED'
        WHEN UPPER(SDRSource) = 'TRADESHOW' THEN 'TRADESHOW'
        WHEN SDRSource = 'N/A' OR SDRSource IS NULL THEN
          CASE
            WHEN UPPER(POR_SDRSource) = 'INBOUND' THEN 'INBOUND'
            WHEN UPPER(POR_SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
            WHEN UPPER(POR_SDRSource) = 'AE SOURCED' THEN 'AE SOURCED'
            WHEN UPPER(POR_SDRSource) = 'AM SOURCED' THEN 'AM SOURCED'
            WHEN UPPER(POR_SDRSource) = 'TRADESHOW' THEN 'TRADESHOW'
            WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
            ELSE 'AE SOURCED'
          END
        WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
        ELSE 'AE SOURCED'
      END AS source,
      -- STRATEGIC FIX 2026-01-11: ACV >= 100K USD threshold defines STRATEGIC segment
      -- NOTE: Segment__c field does NOT exist. Available: OpportunitySegment, account_segment__c
      CASE
        WHEN Type IN ('Existing Business', 'Migration') THEN 'N/A'
        WHEN ACV >= 100000 THEN 'STRATEGIC'
        ELSE 'SMB'
      END AS segment,
      Type AS opportunity_type,
      CloseDate,
      1 AS actual_won,
      ACV AS actual_acv
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE Won = true
      AND r360_record__c = true
      AND Type NOT IN ('Consulting', 'Credit Card')
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
  ),

  -- QTD Actuals (aggregated)
  actuals_qtd AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_from_opportunities, dates
    WHERE CloseDate BETWEEN dates.qtd_start AND dates.as_of_date
      AND opportunity_type != 'Renewal'
    GROUP BY region, funnel_type, source, segment
  ),

  -- ============================================================================
  -- TARGETS FROM STRATEGIC OPERATING PLAN
  -- ============================================================================
  targets_base AS (
    SELECT
      sop.Region AS region,
      sop.FunnelType AS funnel_type,
      sop.Source AS source,
      sop.Segment AS segment,
      sop.OpportunityType AS opportunity_type,
      sop.TargetDate,
      sop.Target_Won,
      sop.Target_ACV,
      sop.Target_MQL,
      sop.Target_SQL,
      sop.Target_SAL,
      sop.Target_SQO,
      sop.Actual_MQL,
      sop.Actual_SQL,
      sop.Actual_SAL,
      sop.Actual_SQO
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop, params
    WHERE sop.RecordType = params.product_filter
      AND sop.Percentile = params.percentile
  ),

  -- QTD Targets
  qtd_targets AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(Target_Won) AS target_won,
      SUM(Target_ACV) AS target_acv,
      SUM(Target_MQL) AS target_mql,
      SUM(Target_SQL) AS target_sql,
      SUM(Target_SAL) AS target_sal,
      SUM(Target_SQO) AS target_sqo,
      SUM(Actual_MQL) AS actual_mql,
      SUM(Actual_SQL) AS actual_sql,
      SUM(Actual_SAL) AS actual_sal,
      SUM(Actual_SQO) AS actual_sqo
    FROM targets_base, dates
    WHERE opportunity_type != 'RENEWAL'
      AND TargetDate BETWEEN dates.qtd_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment
  ),

  -- ============================================================================
  -- COMBINED QTD AGGREGATED (with funnel metric supplementation fix)
  -- ============================================================================
  qtd_aggregated AS (
    SELECT
      t.region,
      t.funnel_type,
      t.source,
      t.segment,
      -- Targets
      COALESCE(t.target_mql, 0) AS target_mql,
      COALESCE(t.target_sql, 0) AS target_sql,
      COALESCE(t.target_sal, 0) AS target_sal,
      COALESCE(t.target_sqo, 0) AS target_sqo,
      COALESCE(t.target_won, 0) AS target_won,
      COALESCE(t.target_acv, 0) AS target_acv,
      -- Actuals (with funnel supplementation for AE/AM SOURCED)
      COALESCE(t.actual_mql, 0) AS actual_mql,
      -- SQL: Supplement from SQO for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sql, 0) = 0
          AND (COALESCE(t.actual_sqo, 0) > 0 OR COALESCE(a.actual_won, 0) > 0)
        THEN GREATEST(COALESCE(t.actual_sqo, 0), COALESCE(a.actual_won, 0))
        ELSE COALESCE(t.actual_sql, 0)
      END AS actual_sql,
      COALESCE(t.actual_sal, 0) AS actual_sal,
      -- SQO: Supplement from Won for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sqo, 0) = 0
          AND COALESCE(a.actual_won, 0) > 0
        THEN COALESCE(a.actual_won, 0)
        ELSE COALESCE(t.actual_sqo, 0)
      END AS actual_sqo,
      COALESCE(a.actual_won, 0) AS actual_won,
      COALESCE(a.actual_acv, 0) AS actual_acv
    FROM qtd_targets t
    LEFT JOIN actuals_qtd a USING (region, funnel_type, source, segment)
    WHERE COALESCE(t.target_acv, 0) > 0  -- Only rows with targets
  ),

  -- ============================================================================
  -- CALCULATE PACING AND STATUS
  -- ============================================================================
  segment_analysis AS (
    SELECT
      region,
      funnel_type,
      source,
      segment,

      -- QTD Targets
      target_mql,
      target_sql,
      target_sal,
      target_sqo,
      target_won,
      target_acv,

      -- QTD Actuals
      actual_mql,
      actual_sql,
      actual_sal,
      actual_sqo,
      actual_won,
      actual_acv,

      -- Pacing percentages
      SAFE_DIVIDE(actual_mql, target_mql) AS mql_pacing,
      SAFE_DIVIDE(actual_sql, target_sql) AS sql_pacing,
      SAFE_DIVIDE(actual_sal, target_sal) AS sal_pacing,
      SAFE_DIVIDE(actual_sqo, target_sqo) AS sqo_pacing,
      SAFE_DIVIDE(actual_won, target_won) AS won_pacing,
      SAFE_DIVIDE(actual_acv, target_acv) AS acv_pacing,

      -- Conversion rates (actual)
      SAFE_DIVIDE(actual_sql, actual_mql) AS mql_to_sql_rate,
      SAFE_DIVIDE(actual_sal, actual_sql) AS sql_to_sal_rate,
      SAFE_DIVIDE(actual_sqo, actual_sal) AS sal_to_sqo_rate,
      SAFE_DIVIDE(actual_won, actual_sqo) AS sqo_to_won_rate,

      -- Target conversion rates (for comparison)
      SAFE_DIVIDE(target_sql, target_mql) AS target_mql_to_sql_rate,
      SAFE_DIVIDE(target_sal, target_sql) AS target_sql_to_sal_rate,
      SAFE_DIVIDE(target_sqo, target_sal) AS target_sal_to_sqo_rate,
      SAFE_DIVIDE(target_won, target_sqo) AS target_sqo_to_won_rate

    FROM qtd_aggregated
  ),

  -- ============================================================================
  -- STATUS AND BOTTLENECK CLASSIFICATION
  -- ============================================================================
  final_analysis AS (
    SELECT
      region,
      funnel_type,
      source,
      segment,

      -- Targets
      ROUND(target_mql, 0) AS qtd_target_mql,
      ROUND(target_sql, 0) AS qtd_target_sql,
      ROUND(target_sal, 0) AS qtd_target_sal,
      ROUND(target_sqo, 0) AS qtd_target_sqo,
      ROUND(target_won, 0) AS qtd_target_won,
      ROUND(target_acv, 2) AS qtd_target_acv,

      -- Actuals
      ROUND(actual_mql, 0) AS qtd_actual_mql,
      ROUND(actual_sql, 0) AS qtd_actual_sql,
      ROUND(actual_sal, 0) AS qtd_actual_sal,
      ROUND(actual_sqo, 0) AS qtd_actual_sqo,
      ROUND(actual_won, 0) AS qtd_actual_won,
      ROUND(actual_acv, 2) AS qtd_actual_acv,

      -- Pacing
      ROUND(acv_pacing * 100, 1) AS qtd_pacing_pct,

      -- Status classification
      CASE
        WHEN acv_pacing >= 0.90 THEN 'ON_TRACK'
        WHEN acv_pacing >= 0.70 THEN 'AT_RISK'
        ELSE 'MISS'
      END AS status,

      -- Bottleneck stage (first stage with significant underperformance)
      CASE
        WHEN COALESCE(mql_pacing, 1) < 0.70 THEN 'MQL'
        WHEN COALESCE(sql_pacing, 1) < 0.70 THEN 'SQL'
        WHEN COALESCE(sal_pacing, 1) < 0.70 THEN 'SAL'
        WHEN COALESCE(sqo_pacing, 1) < 0.70 THEN 'SQO'
        WHEN COALESCE(won_pacing, 1) < 0.70 THEN 'WON'
        WHEN COALESCE(acv_pacing, 1) < 0.70 THEN 'ACV'
        ELSE 'NONE'
      END AS bottleneck_stage,

      -- Issue type classification
      CASE
        -- VOLUME: Top-of-funnel is low but conversion is OK (>= 80% of target rate)
        WHEN (COALESCE(mql_pacing, 1) < 0.80 OR COALESCE(sql_pacing, 1) < 0.80)
          AND SAFE_DIVIDE(mql_to_sql_rate, target_mql_to_sql_rate) >= 0.80
          AND SAFE_DIVIDE(sqo_to_won_rate, target_sqo_to_won_rate) >= 0.80
        THEN 'VOLUME'
        -- CONVERSION: Volume is OK but conversion is low (< 80% of target rate)
        WHEN (COALESCE(mql_pacing, 1) >= 0.80 OR target_mql = 0)
          AND (
            SAFE_DIVIDE(mql_to_sql_rate, target_mql_to_sql_rate) < 0.80
            OR SAFE_DIVIDE(sqo_to_won_rate, target_sqo_to_won_rate) < 0.80
          )
        THEN 'CONVERSION'
        -- HYBRID: Both volume and conversion issues
        WHEN (COALESCE(mql_pacing, 1) < 0.80 OR COALESCE(sql_pacing, 1) < 0.80)
          AND (
            SAFE_DIVIDE(mql_to_sql_rate, target_mql_to_sql_rate) < 0.80
            OR SAFE_DIVIDE(sqo_to_won_rate, target_sqo_to_won_rate) < 0.80
          )
        THEN 'HYBRID'
        -- N/A: No significant issues or insufficient data
        ELSE 'N/A'
      END AS issue_type,

      -- ACV Gap
      ROUND(target_acv - actual_acv, 2) AS acv_gap,

      -- Conversion rates for reference
      ROUND(mql_to_sql_rate * 100, 1) AS mql_to_sql_pct,
      ROUND(sqo_to_won_rate * 100, 1) AS sqo_to_won_pct

    FROM segment_analysis
  )

-- ============================================================================
-- OUTPUT: All segments ordered by region and ACV gap
-- ============================================================================
SELECT
  region,
  funnel_type,
  source,
  segment,
  qtd_target_acv,
  qtd_actual_acv,
  qtd_pacing_pct,
  status,
  bottleneck_stage,
  issue_type,
  acv_gap,
  qtd_target_mql,
  qtd_actual_mql,
  qtd_target_sql,
  qtd_actual_sql,
  qtd_target_sal,
  qtd_actual_sal,
  qtd_target_sqo,
  qtd_actual_sqo,
  qtd_target_won,
  qtd_actual_won,
  mql_to_sql_pct,
  sqo_to_won_pct
FROM final_analysis
ORDER BY
  CASE region WHEN 'AMER' THEN 1 WHEN 'EMEA' THEN 2 WHEN 'APAC' THEN 3 ELSE 4 END,
  acv_gap DESC
