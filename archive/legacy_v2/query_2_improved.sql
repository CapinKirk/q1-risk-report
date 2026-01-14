-- ============================================================================
-- Query 2: Enhanced Detail Payload with $ Sums and Trend Indicators
-- ============================================================================
-- Generates detailed breakdowns with:
-- - Top variance drivers (MTD worst 6)
-- - Top positive variance (MTD best 3)
-- - Top booked deals (MTD highest 6)
-- - Inbound MQL gaps (WTD top 6)
-- - Alert details with $ sums (not just counts)
-- - Anomaly detection
--
-- Key Improvements from V1:
-- - $ sums for all alert categories
-- - Trend indicators for gaps
-- - Better structured for actionable insights
-- ============================================================================

WITH
  -- Input parameters
  params AS (
    SELECT
      DATE('2026-01-10') AS as_of_date,
      'P50' AS percentile,
      'MONDAY' AS week_starts_on
  ),

  -- Date calculations
  dates AS (
    SELECT
      p.*,
      DATE_TRUNC(p.as_of_date, WEEK(MONDAY)) AS wtd_start,
      DATE_TRUNC(p.as_of_date, MONTH) AS mtd_start,
      p.as_of_date + 14 AS upcoming_risk_end
    FROM params p
  ),

  -- Determine correct date basis for actuals
  actuals_date_basis_calc AS (
    SELECT
      SUM(CASE WHEN Won_Date BETWEEN d.mtd_start AND d.as_of_date THEN Actual_ACV ELSE 0 END) AS sum_by_won_date,
      SUM(CASE WHEN TargetDate BETWEEN d.mtd_start AND d.as_of_date THEN Actual_ACV ELSE 0 END) AS sum_by_target_date,
      CASE
        WHEN SUM(CASE WHEN Won_Date BETWEEN d.mtd_start AND d.as_of_date THEN Actual_ACV ELSE 0 END) > 0 THEN 'Won_Date'
        ELSE 'TargetDate'
      END AS chosen_date_basis
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, dates d
  ),

  -- Base data with chosen date basis
  base_with_basis AS (
    SELECT
      sop.*,
      basis.chosen_date_basis,
      CASE
        WHEN basis.chosen_date_basis = 'Won_Date' THEN sop.Won_Date
        ELSE sop.TargetDate
      END AS date_basis
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
    CROSS JOIN actuals_date_basis_calc basis
  ),

  -- MTD variance drivers (top 6 worst by ACV gap)
  top_variance_mtd AS (
    SELECT
      RecordType AS rt,
      OpportunityType AS ot,
      FunnelType AS ft,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_Won) AS t_won,
      SUM(Actual_Won) AS a_won,
      SUM(Target_ACV) AS t_acv,
      SUM(Actual_ACV) AS a_acv,
      SUM(ACV_Variance) AS acv_var,
      SUM(COALESCE(Won_Count_Revenue_Slippage, 0)) AS won_slip
    FROM base_with_basis, dates
    WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source
    QUALIFY ROW_NUMBER() OVER (ORDER BY SUM(ACV_Variance) ASC) <= 6
  ),

  -- MTD positive variance (top 3 best wins)
  top_positive_mtd AS (
    SELECT
      RecordType AS rt,
      OpportunityType AS ot,
      FunnelType AS ft,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_Won) AS t_won,
      SUM(Actual_Won) AS a_won,
      SUM(Target_ACV) AS t_acv,
      SUM(Actual_ACV) AS a_acv,
      SUM(ACV_Variance) AS acv_var,
      SUM(COALESCE(Won_Count_Revenue_Slippage, 0)) AS won_slip
    FROM base_with_basis, dates
    WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source
    QUALIFY ROW_NUMBER() OVER (ORDER BY SUM(ACV_Variance) DESC) <= 3
  ),

  -- MTD top booked deals (top 6 by highest actual ACV)
  top_booked_mtd AS (
    SELECT
      RecordType AS rt,
      OpportunityType AS ot,
      FunnelType AS ft,
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Target_Won) AS t_won,
      SUM(Actual_Won) AS a_won,
      SUM(Target_ACV) AS t_acv,
      SUM(Actual_ACV) AS a_acv,
      SUM(ACV_Variance) AS acv_var,
      SUM(COALESCE(Won_Count_Revenue_Slippage, 0)) AS won_slip
    FROM base_with_basis, dates
    WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source
    QUALIFY ROW_NUMBER() OVER (ORDER BY SUM(Actual_ACV) DESC) <= 6
  ),

  -- Inbound MQL WTD gaps (top 6 by largest gap)
  inbound_mql_wtd AS (
    SELECT
      Region AS r,
      Segment AS seg,
      Source AS src,
      SUM(Actual_MQL) AS a_mql,
      SUM(Target_MQL) AS t_mql,
      (SUM(Target_MQL) - SUM(Actual_MQL)) AS mql_gap,
      SAFE_DIVIDE(SUM(Actual_MQL), SUM(Target_MQL)) AS mql_attainment
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, dates
    WHERE TargetDate BETWEEN dates.wtd_start AND dates.as_of_date
      AND Source = 'INBOUND'
    GROUP BY Region, Segment, Source
    QUALIFY ROW_NUMBER() OVER (ORDER BY (SUM(Target_MQL) - SUM(Actual_MQL)) DESC) <= 6
  ),

  -- Alert 1: Past due deals under pacing
  past_due_under_pacing AS (
    SELECT
      RecordType AS rt,
      OpportunityType AS ot,
      FunnelType AS ft,
      Region AS r,
      Segment AS seg,
      Source AS src,
      Won_Date AS won_date,
      SUM(Target_Won) AS t_won,
      SUM(Actual_Won) AS a_won,
      SUM(Target_ACV) AS t_acv,
      SUM(Actual_ACV) AS a_acv,
      SUM(ACV_Variance) AS acv_var,
      (SUM(Target_ACV) - SUM(Actual_ACV)) AS acv_gap
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, dates
    WHERE Won_Date < dates.as_of_date
      AND Target_Won > 0
    GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source, Won_Date
    HAVING SUM(Actual_Won) < SUM(Target_Won)
  ),

  past_due_items AS (
    SELECT * FROM past_due_under_pacing
    QUALIFY ROW_NUMBER() OVER (ORDER BY acv_gap DESC) <= 15
  ),

  past_due_summary AS (
    SELECT
      COUNT(*) AS count,
      SUM(acv_gap) AS total_acv_at_risk
    FROM past_due_under_pacing
  ),

  -- Alert 2: Missed lead window
  missed_lead_window AS (
    SELECT
      RecordType AS rt,
      OpportunityType AS ot,
      Region AS r,
      Segment AS seg,
      Source AS src,
      TargetDate AS mql_date,
      SUM(Target_MQL) AS t_mql,
      SUM(Actual_MQL) AS a_mql,
      SUM(COALESCE(MQL_Revenue_Slippage, 0)) AS mql_slip,
      (SUM(Target_MQL) - SUM(Actual_MQL)) AS mql_gap
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
    WHERE COALESCE(MQL_Pacing_Alert, '') = 'Missed Lead Window'
    GROUP BY RecordType, OpportunityType, Region, Segment, Source, TargetDate
  ),

  missed_lead_items AS (
    SELECT * FROM missed_lead_window
    QUALIFY ROW_NUMBER() OVER (ORDER BY mql_date DESC) <= 15
  ),

  missed_lead_summary AS (
    SELECT
      COUNT(*) AS count,
      SUM(ABS(mql_slip)) AS total_revenue_impact
    FROM missed_lead_window
  ),

  -- Alert 3: Upcoming won risk (next 14 days)
  upcoming_won_risk AS (
    SELECT
      RecordType AS rt,
      OpportunityType AS ot,
      FunnelType AS ft,
      Region AS r,
      Segment AS seg,
      Source AS src,
      Won_Date AS won_date,
      SUM(Target_Won) AS t_won,
      SUM(Actual_Won) AS a_won,
      SUM(Target_ACV) AS t_acv,
      SUM(Actual_ACV) AS a_acv,
      (SUM(Target_ACV) - SUM(Actual_ACV)) AS acv_gap
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, dates
    WHERE Won_Date BETWEEN dates.as_of_date AND dates.upcoming_risk_end
    GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source, Won_Date
    HAVING SUM(Target_Won) > SUM(Actual_Won)
  ),

  upcoming_risk_items AS (
    SELECT * FROM upcoming_won_risk
    QUALIFY ROW_NUMBER() OVER (ORDER BY acv_gap DESC) <= 15
  ),

  upcoming_risk_summary AS (
    SELECT
      COUNT(*) AS count,
      SUM(acv_gap) AS total_acv_at_risk
    FROM upcoming_won_risk
  ),

  -- Anomaly detection (MTD window)
  anomaly_counts AS (
    SELECT
      COUNTIF(Actual_SAL > Actual_SQL) AS rows_sal_gt_sql,
      COUNTIF(Actual_SQO > Actual_SAL) AS rows_sqo_gt_sal,
      COUNTIF(Actual_Won > Actual_SQO) AS rows_won_gt_sqo
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, dates
    WHERE TargetDate BETWEEN dates.mtd_start AND dates.as_of_date
  )

-- Build final JSON
SELECT
  TO_JSON_STRING(STRUCT(
    CAST(CURRENT_TIMESTAMP() AS STRING) AS generated_at_utc,
    d.as_of_date,
    d.percentile,
    d.week_starts_on,
    basis.chosen_date_basis AS actuals_date_basis,

    -- Top variance drivers
    ARRAY(
      SELECT AS STRUCT
        rt, ot, ft, r, seg, src,
        t_won, a_won, t_acv, a_acv, acv_var, won_slip
      FROM top_variance_mtd
      ORDER BY acv_var
    ) AS top_variance_mtd,

    -- Top positive variance
    ARRAY(
      SELECT AS STRUCT
        rt, ot, ft, r, seg, src,
        t_won, a_won, t_acv, a_acv, acv_var, won_slip
      FROM top_positive_mtd
      ORDER BY acv_var DESC
    ) AS top_positive_mtd,

    -- Top booked deals
    ARRAY(
      SELECT AS STRUCT
        rt, ot, ft, r, seg, src,
        t_won, a_won, t_acv, a_acv, acv_var, won_slip
      FROM top_booked_mtd
      ORDER BY a_acv DESC
    ) AS top_booked_mtd,

    -- Inbound MQL gaps
    ARRAY(
      SELECT AS STRUCT
        r, seg, src, a_mql, t_mql, mql_gap, mql_attainment
      FROM inbound_mql_wtd
      ORDER BY mql_gap DESC
    ) AS inbound_mql_wtd,

    -- Alert details with $ sums
    STRUCT(
      -- Past due
      (SELECT count FROM past_due_summary) AS past_due_under_pacing_count,
      (SELECT total_acv_at_risk FROM past_due_summary) AS past_due_under_pacing_sum,
      ARRAY(
        SELECT AS STRUCT
          rt, ot, ft, r, seg, src, won_date,
          t_won, a_won, t_acv, a_acv, acv_var, acv_gap
        FROM past_due_items
        ORDER BY acv_gap DESC
      ) AS past_due_under_pacing_items,

      -- Missed lead window
      (SELECT count FROM missed_lead_summary) AS missed_lead_window_count,
      (SELECT total_revenue_impact FROM missed_lead_summary) AS missed_lead_window_sum,
      ARRAY(
        SELECT AS STRUCT
          rt, ot, r, seg, src, mql_date,
          t_mql, a_mql, mql_slip, mql_gap
        FROM missed_lead_items
        ORDER BY mql_date DESC
      ) AS missed_lead_window_items,

      -- Upcoming risk
      (SELECT count FROM upcoming_risk_summary) AS upcoming_won_risk_next_14_days_count,
      (SELECT total_acv_at_risk FROM upcoming_risk_summary) AS upcoming_won_risk_next_14_days_sum,
      ARRAY(
        SELECT AS STRUCT
          rt, ot, ft, r, seg, src, won_date,
          t_won, a_won, t_acv, a_acv, acv_gap
        FROM upcoming_risk_items
        ORDER BY acv_gap DESC
      ) AS upcoming_won_risk_next_14_days_items
    ) AS alerts,

    -- Anomaly counts
    (SELECT AS STRUCT
      rows_sal_gt_sql,
      rows_sqo_gt_sal,
      rows_won_gt_sqo
    FROM anomaly_counts) AS anomaly_counts

  )) AS detail_payload_json
FROM dates d
CROSS JOIN actuals_date_basis_calc basis
