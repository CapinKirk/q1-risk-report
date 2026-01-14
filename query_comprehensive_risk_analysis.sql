-- ============================================================================
-- COMPREHENSIVE BOOKINGS RISK ANALYSIS REPORT
-- Version: 2.7.0
-- Created: 2026-01-12
-- Updated: 2026-01-13
-- Purpose: CONSOLIDATED executive risk report for POR and R360
--
-- SCOPE: POR + R360 (EXCLUDES RENEWALS)
--        New Logo, Expansion, Migration
--
-- DATA SOURCES:
--   - OpportunityViewTable (Won/Lost deals, ACV)
--   - DailyRevenueFunnel (MQL, SQL, SAL, SQO)
--   - StrategicOperatingPlan (P50 targets)
--   - GoogleAds (POR + R360 campaign stats)
--
-- REPORT STRUCTURE (v2.6.0 - Consolidated):
--   1. Executive Summary - Key metrics at a glance
--   2. Attainment by Region & Product - ACV + Funnel combined
--   3. Source Attainment - Top of Funnel (MQL→SQL→SAL→SQO)
--   4. Hits & Misses Commentary - RCA on underperformers
--   5. Pipeline Risk Analysis - Coverage + Age + RCA by region
--   6. Google Ads Performance - Metrics + insights
--
-- CHANGE LOG:
--   v2.7.0 (2026-01-13): CATEGORY & SOURCE DIMENSION FIX
--     - Fixed Category dimension: Changed 'INBOUND' → 'NEW BUSINESS'
--     - Categories now: NEW BUSINESS, EXPANSION, MIGRATION
--     - Added SOURCE as separate dimension: Inbound, Outbound, AE Sourced, AM Sourced, Tradeshow, Partnerships
--     - Added funnel_actuals_by_source, funnel_targets_by_source CTEs
--     - Added funnel_by_source to JSON output
--     - Category = Deal type (what kind of deal), Source = Lead origin (where it came from)
--
--   v2.6.0 (2026-01-12): CONSOLIDATED EXECUTIVE REPORT
--     - Removed verbose WoW trend section (not actionable)
--     - Combined ACV + Funnel attainment into single view per region
--     - Unified hits/misses commentary with embedded RCA
--     - Streamlined pipeline risk with full RCA by region/product
--     - Simplified to 6 focused sections
--
--   v2.5.0 (2026-01-12): Added wins, momentum, action items
--   v2.4.2 (2026-01-12): CORRECT QTD TARGET CALCULATION (SUM DAILY TARGETS)
--     - CRITICAL FIX: QTD funnel targets now SUM daily targets from SOP for elapsed dates
--     - Previously: Prorated full quarter (q1_target * days/90) - INCORRECT
--     - Now: SUM(Target_MQL/SQL/SAL/SQO) WHERE TargetDate BETWEEN qtd_start AND as_of_date
--     - This matches the TOF Pacing Report approach (query_top_of_funnel_enhanced.sql)
--     - SOP table has daily granular targets - no proration needed
--     - Example: Day 12 of Q1 = sum of Jan 1-12 daily targets, NOT (Q1 target × 12/90)
--
--   v2.4.1 (2026-01-12): QTD FIX + HISTORICALS + LOSS RCA
--     - Added funnel_trend_analysis: WoW comparison (current 7d vs prior 7d)
--     - Added loss_reason_rca: Auto-generated commentary for top loss reasons
--     - New output sections: funnel_trends, loss_reason_rca
--
--   v2.4.0 (2026-01-12): TOP-OF-FUNNEL TARGETS & RCA COMMENTARY
--     - Added full quarter funnel targets from SOP (Target_MQL, Target_SQL, Target_SAL, Target_SQO)
--     - Added funnel_health_analysis CTE with stage-by-stage gap calculations
--     - Added target conversion rates (MQL->SQL, SQL->SAL, SAL->SQO) for comparison
--     - Added funnel_rca_insights CTE with auto-generated commentary
--     - New output sections: funnel_health, funnel_rca_insights
--     - Identifies primary bottleneck stage per region/product
--
--   v2.3.0 (2026-01-12): INTELLIGENT PIPELINE DATE FILTER
--     - Refined CreatedDate filter logic for open_pipeline
--     - Old logic: Exclude all opps created > 6 months ago
--     - New logic: Exclude opps created > 6 months ago UNLESS CloseDate is within next 6 months
--     - This keeps active pipeline with near-term close dates while filtering truly stale opps
--     - Recovered ~$890K additional pipeline across all categories
--
--   v2.2.0 (2026-01-12): MIGRATION PIPELINE FIX
--     - Added Migration Specialist to OwnerRole filter for open_pipeline
--     - Migration opportunities primarily owned by Migration Specialist role
--     - AMER Migration pipeline: $392K owned by Migration Specialist
--
--   v2.1.0 (2026-01-12): PIPELINE FILTERS
--     - Added 6-month CreatedDate filter to open_pipeline (excludes old stale opps)
--     - Added OwnerRole filter: AE/AM/R360 Sales User only
--     - Pipeline now shows only actionable, sales-managed opportunities
--
--   v2.0.0 (2026-01-12): DYNAMIC TARGETS
--     - Replaced hardcoded q1_targets CTE with dynamic SOP query
--     - ACV targets now pulled from StrategicOperatingPlan (all sources)
--     - MQL targets remain INBOUND-only (matches SOP structure)
--     - Added inbound_acv_target for funnel pacing comparison
--     - Fixed EMEA MQL target anomaly (was comparing INBOUND MQL to ALL-SOURCE ACV)
--
-- IMPORTANT NOTES ON MQL TARGETS:
--   - MQL targets are INBOUND channel only (Source = 'INBOUND')
--   - EMEA strategy is OUTBOUND-heavy: only 22% of NEW LOGO ACV from INBOUND
--   - APAC strategy is INBOUND-heavy: 63% of NEW LOGO ACV from INBOUND
--   - This explains why EMEA has lower MQL targets despite higher ACV targets
--   - See sop_data_quality_fix_q1_2026.sql for source breakdown details
-- ============================================================================

-- ============================================================================
-- PARAMETERS (Dynamic - update as_of_date for each run)
-- ============================================================================
WITH params AS (
  SELECT
    CURRENT_DATE() AS as_of_date,  -- Dynamic: runs with current date
    'P50' AS percentile,
    DATE_TRUNC(CURRENT_DATE(), QUARTER) AS quarter_start,
    DATE_ADD(DATE_TRUNC(CURRENT_DATE(), QUARTER), INTERVAL 3 MONTH) AS quarter_end,
    DATE_DIFF(CURRENT_DATE(), DATE_TRUNC(CURRENT_DATE(), QUARTER), DAY) + 1 AS qtd_days_elapsed,
    90 AS total_quarter_days  -- Q1 assumption
),

-- ============================================================================
-- Q1 TARGETS - DYNAMIC FROM STRATEGIC OPERATING PLAN
-- Pulls from StrategicOperatingPlan table for current quarter
-- Aggregates ALL SOURCES for total ACV targets per category
-- ============================================================================
q1_targets AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    -- Map FunnelType to category (handle "R360 INBOUND" -> NEW LOGO)
    CASE
      WHEN sop.FunnelType IN ('NEW LOGO', 'R360 NEW LOGO', 'INBOUND', 'R360 INBOUND') THEN 'NEW LOGO'
      WHEN sop.FunnelType IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN sop.FunnelType IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE sop.FunnelType
    END AS category,
    -- Aggregate across ALL sources for total category target
    ROUND(SUM(CASE
      WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0  -- Zero out PARTNERSHIPS per data quality fix
      ELSE sop.Target_ACV
    END), 2) AS q1_target
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate < p.quarter_end
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
  GROUP BY sop.RecordType, sop.Region,
    CASE
      WHEN sop.FunnelType IN ('NEW LOGO', 'R360 NEW LOGO', 'INBOUND', 'R360 INBOUND') THEN 'NEW LOGO'
      WHEN sop.FunnelType IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN sop.FunnelType IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE sop.FunnelType
    END
  HAVING SUM(CASE
    WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0
    ELSE sop.Target_ACV
  END) > 0
),

q1_totals AS (
  SELECT
    product,
    SUM(q1_target) AS total_q1_target
  FROM q1_targets
  GROUP BY product
),

-- ============================================================================
-- DATE WINDOWS
-- ============================================================================
dates AS (
  SELECT
    p.*,
    DATE_TRUNC(p.as_of_date, MONTH) AS mtd_start,
    DATE_TRUNC(p.as_of_date, QUARTER) AS qtd_start,
    DATE_SUB(p.as_of_date, INTERVAL 6 DAY) AS rolling_7d_start,
    DATE_SUB(p.as_of_date, INTERVAL 29 DAY) AS rolling_30d_start
  FROM params p
),

-- ============================================================================
-- WON DEAL ACTUALS FROM OPPORTUNITY VIEW TABLE
-- ============================================================================
won_actuals AS (
  SELECT
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    CloseDate,
    1 AS deal_count,
    ACV,
    CASE
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AE SOURCED' THEN 'AE SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AM SOURCED' THEN 'AM SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
      ELSE 'AE SOURCED'
    END AS source
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE Won = true
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
),

-- ============================================================================
-- QTD WON AGGREGATION
-- ============================================================================
qtd_won AS (
  SELECT
    w.product,
    w.region,
    w.category,
    SUM(w.deal_count) AS qtd_deals,
    ROUND(SUM(w.ACV), 2) AS qtd_acv
  FROM won_actuals w, dates d
  WHERE w.CloseDate BETWEEN d.qtd_start AND d.as_of_date
  GROUP BY w.product, w.region, w.category
),

-- ============================================================================
-- QTD WON BY SOURCE - ACV breakdown by lead source channel
-- ============================================================================
qtd_won_by_source AS (
  SELECT
    w.product,
    w.region,
    w.source,
    SUM(w.deal_count) AS qtd_deals,
    ROUND(SUM(w.ACV), 2) AS qtd_acv
  FROM won_actuals w, dates d
  WHERE w.CloseDate BETWEEN d.qtd_start AND d.as_of_date
  GROUP BY w.product, w.region, w.source
),

-- ============================================================================
-- SOURCE TARGETS FROM SOP - Q1 ACV targets by source
-- ============================================================================
source_targets AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    sop.Source AS source,
    ROUND(SUM(sop.Target_ACV), 2) AS q1_target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate < p.quarter_end
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
    AND sop.Source NOT IN ('ALL', 'PARTNERSHIPS')  -- Exclude aggregate and zeroed-out sources
  GROUP BY sop.RecordType, sop.Region, sop.Source
),

-- ============================================================================
-- SOURCE ATTAINMENT - ACV attainment by source channel
-- ============================================================================
source_attainment AS (
  SELECT
    COALESCE(t.product, a.product) AS product,
    COALESCE(t.region, a.region) AS region,
    COALESCE(t.source, a.source) AS source,
    COALESCE(t.q1_target_acv, 0) AS q1_target,
    ROUND(COALESCE(t.q1_target_acv, 0) * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params), 2) AS qtd_target,
    COALESCE(a.qtd_deals, 0) AS qtd_deals,
    COALESCE(a.qtd_acv, 0) AS qtd_acv,
    ROUND(SAFE_DIVIDE(COALESCE(a.qtd_acv, 0),
          COALESCE(t.q1_target_acv, 0) * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)) * 100, 1) AS attainment_pct,
    ROUND(COALESCE(a.qtd_acv, 0) - (COALESCE(t.q1_target_acv, 0) * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)), 2) AS gap,
    CASE
      WHEN SAFE_DIVIDE(COALESCE(a.qtd_acv, 0),
           COALESCE(t.q1_target_acv, 0) * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)) >= 0.90 THEN 'GREEN'
      WHEN SAFE_DIVIDE(COALESCE(a.qtd_acv, 0),
           COALESCE(t.q1_target_acv, 0) * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)) >= 0.70 THEN 'YELLOW'
      ELSE 'RED'
    END AS rag_status
  FROM source_targets t
  FULL OUTER JOIN qtd_won_by_source a ON t.product = a.product AND t.region = a.region AND t.source = a.source
  WHERE COALESCE(t.q1_target_acv, 0) > 0 OR COALESCE(a.qtd_acv, 0) > 0
),

-- ============================================================================
-- LOST DEAL ANALYSIS
-- ============================================================================
lost_deals AS (
  SELECT
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    CloseDate,
    1 AS deal_count,
    ACV,
    -- Loss reason fields (handle nulls)
    COALESCE(ClosedLostReason, 'Not Specified') AS loss_reason,
    CASE WHEN PrimaryCompetitorName IS NOT NULL THEN 'Yes' ELSE 'No' END AS lost_to_competitor,
    COALESCE(PrimaryCompetitorName, 'Not Captured') AS competitor
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE StageName = 'Closed Lost'
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
),

qtd_lost AS (
  SELECT
    l.product,
    l.region,
    l.category,
    SUM(l.deal_count) AS lost_deals,
    ROUND(SUM(l.ACV), 2) AS lost_acv
  FROM lost_deals l, dates d
  WHERE l.CloseDate BETWEEN d.qtd_start AND d.as_of_date
  GROUP BY l.product, l.region, l.category
),

-- ============================================================================
-- LOSS REASON BREAKDOWN
-- ============================================================================
loss_reasons AS (
  SELECT
    l.product,
    l.region,
    l.loss_reason,
    COUNT(*) AS deal_count,
    ROUND(SUM(l.ACV), 2) AS lost_acv
  FROM lost_deals l, dates d
  WHERE l.CloseDate BETWEEN d.qtd_start AND d.as_of_date
  GROUP BY l.product, l.region, l.loss_reason
),

loss_reasons_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY product, region ORDER BY lost_acv DESC) AS rank
  FROM loss_reasons
),

-- ============================================================================
-- COMPETITOR ANALYSIS
-- ============================================================================
competitor_losses AS (
  SELECT
    l.product,
    l.lost_to_competitor,
    l.competitor,
    COUNT(*) AS deal_count,
    ROUND(SUM(l.ACV), 2) AS lost_acv
  FROM lost_deals l, dates d
  WHERE l.CloseDate BETWEEN d.qtd_start AND d.as_of_date
    AND l.lost_to_competitor != 'Not Captured'
  GROUP BY l.product, l.lost_to_competitor, l.competitor
),

-- ============================================================================
-- OPEN PIPELINE ANALYSIS
-- Filtered to: AE/AM/Migration Specialist owned opportunities that are either:
--   1. Created in last 6 months, OR
--   2. Have CloseDate within next 6 months (keeps active deals regardless of age)
-- OwnerRole values: US/UK/AU Account Manager, US/UK/AU Account Executive,
--                   R360 Sales User, Migration Specialist
-- ============================================================================
open_pipeline AS (
  SELECT
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    COUNT(*) AS opp_count,
    ROUND(SUM(ACV), 2) AS pipeline_acv,
    ROUND(AVG(DATE_DIFF(CURRENT_DATE(), CreatedDate, DAY)), 0) AS avg_age_days
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE IsClosed = false
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
    -- Pipeline filter: Created in last 6 months OR closing in next 6 months
    AND (
      CreatedDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      OR CloseDate <= DATE_ADD(CURRENT_DATE(), INTERVAL 6 MONTH)
    )
    -- Owner filter: AE/AM/Migration Specialist owned opportunities
    AND (
      OwnerRole LIKE '%Account Executive%'
      OR OwnerRole LIKE '%Account Manager%'
      OR OwnerRole = 'R360 Sales User'
      OR OwnerRole = 'Migration Specialist'
    )
  GROUP BY product, region, category
),

-- ============================================================================
-- DEAL-LEVEL DETAIL VIEWS (for Opportunities table drill-down)
-- Returns individual opportunity records with Salesforce links
-- ============================================================================
won_deals_detail AS (
  SELECT
    Id AS opportunity_id,
    AccountName AS account_name,
    OpportunityName AS opportunity_name,
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    Type AS deal_type,
    ROUND(ACV, 2) AS acv,
    CAST(CloseDate AS STRING) AS close_date,
    StageName AS stage,
    true AS is_won,
    true AS is_closed,
    CAST(NULL AS STRING) AS loss_reason,
    CASE
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AE SOURCED' THEN 'AE SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AM SOURCED' THEN 'AM SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
      ELSE 'AE SOURCED'
    END AS source,
    Owner AS owner_name,
    OwnerId AS owner_id,
    CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`, dates d
  WHERE Won = true
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
    AND CloseDate >= d.qtd_start
    AND CloseDate <= d.as_of_date
),

lost_deals_detail AS (
  SELECT
    Id AS opportunity_id,
    AccountName AS account_name,
    OpportunityName AS opportunity_name,
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    Type AS deal_type,
    ROUND(ACV, 2) AS acv,
    CAST(CloseDate AS STRING) AS close_date,
    StageName AS stage,
    false AS is_won,
    true AS is_closed,
    COALESCE(ClosedLostReason, 'Not Specified') AS loss_reason,
    CASE
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AE SOURCED' THEN 'AE SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AM SOURCED' THEN 'AM SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
      ELSE 'AE SOURCED'
    END AS source,
    Owner AS owner_name,
    OwnerId AS owner_id,
    CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`, dates d
  WHERE StageName = 'Closed Lost'
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
    AND CloseDate >= d.qtd_start
    AND CloseDate <= d.as_of_date
),

pipeline_deals_detail AS (
  SELECT
    Id AS opportunity_id,
    AccountName AS account_name,
    OpportunityName AS opportunity_name,
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    Type AS deal_type,
    ROUND(ACV, 2) AS acv,
    CAST(CloseDate AS STRING) AS close_date,
    StageName AS stage,
    false AS is_won,
    false AS is_closed,
    CAST(NULL AS STRING) AS loss_reason,
    CASE
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AE SOURCED' THEN 'AE SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'AM SOURCED' THEN 'AM SOURCED'
      WHEN UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
      ELSE 'AE SOURCED'
    END AS source,
    Owner AS owner_name,
    OwnerId AS owner_id,
    CONCAT('https://por.my.salesforce.com/', Id) AS salesforce_url
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE IsClosed = false
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
    -- Pipeline filter: Created in last 6 months OR closing in next 6 months
    AND (
      CreatedDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      OR CloseDate <= DATE_ADD(CURRENT_DATE(), INTERVAL 6 MONTH)
    )
    -- Owner filter: AE/AM/Migration Specialist owned opportunities
    AND (
      OwnerRole LIKE '%Account Executive%'
      OR OwnerRole LIKE '%Account Manager%'
      OR OwnerRole = 'R360 Sales User'
      OR OwnerRole = 'Migration Specialist'
    )
),

-- ============================================================================
-- FUNNEL ACTUALS FROM DAILYREVENUEFUNNEL (ALL CATEGORIES)
-- Maps FunnelType to standardized category for matching with targets
-- ============================================================================
funnel_actuals_qtd AS (
  SELECT
    RecordType AS product,
    Region AS region,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, dates d
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) >= d.qtd_start
    AND CAST(CaptureDate AS DATE) <= d.as_of_date
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

-- Funnel actuals by category (NEW BUSINESS, EXPANSION, MIGRATION)
funnel_actuals_by_category AS (
  SELECT
    RecordType AS product,
    Region AS region,
    CASE
      WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, dates d
  WHERE CAST(CaptureDate AS DATE) >= d.qtd_start
    AND CAST(CaptureDate AS DATE) <= d.as_of_date
    AND RecordType IN ('POR', 'R360')
    AND UPPER(FunnelType) NOT IN ('RENEWAL', 'R360 RENEWAL')
    AND Region IN ('AMER', 'EMEA', 'APAC')  -- Exclude N/A regions
  GROUP BY RecordType, Region,
    CASE
      WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END
),

-- ============================================================================
-- FUNNEL TARGETS FROM SOP (INBOUND CHANNEL ONLY) - FULL QUARTER
-- IMPORTANT: These are INBOUND-sourced targets only!
-- - MQL targets come from INBOUND channel (marketing leads)
-- - EMEA is OUTBOUND-heavy: only ~22% of NEW LOGO ACV from INBOUND
-- - APAC is INBOUND-heavy: ~63% of NEW LOGO ACV from INBOUND
-- - This explains why EMEA MQL targets appear lower than APAC
-- NOTE: We get FULL QUARTER targets and prorate for QTD comparison
--       (same approach as attainment_summary for ACV)
-- ============================================================================
funnel_targets_full_q AS (
  SELECT
    RecordType AS product,
    Region AS region,
    -- Full quarter targets
    ROUND(SUM(Target_MQL), 0) AS q1_target_mql,
    ROUND(SUM(Target_SQL), 0) AS q1_target_sql,
    ROUND(SUM(Target_SAL), 0) AS q1_target_sal,
    ROUND(SUM(Target_SQO), 0) AS q1_target_sqo,
    ROUND(SUM(Target_Won), 0) AS q1_target_won,
    ROUND(SUM(Target_ACV), 2) AS q1_target_acv,
    -- Target conversion rates (derived from targets)
    ROUND(SAFE_DIVIDE(SUM(Target_SQL), SUM(Target_MQL)) * 100, 1) AS target_mql_to_sql_rate,
    ROUND(SAFE_DIVIDE(SUM(Target_SAL), SUM(Target_SQL)) * 100, 1) AS target_sql_to_sal_rate,
    ROUND(SAFE_DIVIDE(SUM(Target_SQO), SUM(Target_SAL)) * 100, 1) AS target_sal_to_sqo_rate,
    ROUND(SAFE_DIVIDE(SUM(Target_Won), SUM(Target_SQO)) * 100, 1) AS target_sqo_to_won_rate,
    'INBOUND' AS source_channel
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.Source = 'INBOUND'
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate < p.quarter_end
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
  GROUP BY sop.RecordType, sop.Region
),

-- ============================================================================
-- QTD FUNNEL TARGETS - SUMMED DAILY TARGETS FROM SOP
-- IMPORTANT: SOP has DAILY granular targets. QTD target = SUM of daily targets
-- for dates that have elapsed (NOT proration of full quarter).
-- This matches the approach in query_top_of_funnel_enhanced.sql
-- ============================================================================
funnel_targets_qtd AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    -- QTD targets: SUM daily targets for elapsed dates only
    ROUND(SUM(sop.Target_MQL), 0) AS target_mql,
    ROUND(SUM(sop.Target_SQL), 0) AS target_sql,
    ROUND(SUM(sop.Target_SAL), 0) AS target_sal,
    ROUND(SUM(sop.Target_SQO), 0) AS target_sqo,
    ROUND(SUM(sop.Target_Won), 0) AS target_won,
    ROUND(SUM(sop.Target_ACV), 2) AS target_acv,
    'INBOUND' AS source_channel
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.Source = 'INBOUND'
    AND UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start  -- From start of quarter
    AND sop.TargetDate <= p.as_of_date     -- To current date (QTD)
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
  GROUP BY sop.RecordType, sop.Region
),

-- ============================================================================
-- FUNNEL TARGETS BY CATEGORY (Q1 Full Quarter) - ALL Sources
-- Includes NEW BUSINESS, EXPANSION, MIGRATION targets from SOP
-- ============================================================================
funnel_targets_by_category_q1 AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    -- CRITICAL: Only INBOUND source has MQL targets (AE/AM/OUTBOUND skip MQL stage)
    ROUND(SUM(CASE WHEN UPPER(sop.Source) = 'INBOUND' THEN sop.Target_MQL ELSE 0 END), 0) AS q1_target_mql,
    ROUND(SUM(sop.Target_SQL), 0) AS q1_target_sql,
    ROUND(SUM(sop.Target_SAL), 0) AS q1_target_sal,
    ROUND(SUM(sop.Target_SQO), 0) AS q1_target_sqo,
    ROUND(SUM(sop.Target_Won), 0) AS q1_target_won,
    ROUND(SUM(sop.Target_ACV), 2) AS q1_target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate < p.quarter_end
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
    AND UPPER(sop.FunnelType) NOT IN ('RENEWAL', 'R360 RENEWAL')
  GROUP BY sop.RecordType, sop.Region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END
),

-- QTD Funnel Targets by Category
funnel_targets_by_category_qtd AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    -- CRITICAL: Only INBOUND source has MQL targets (AE/AM/OUTBOUND skip MQL stage)
    ROUND(SUM(CASE WHEN UPPER(sop.Source) = 'INBOUND' THEN sop.Target_MQL ELSE 0 END), 0) AS qtd_target_mql,
    ROUND(SUM(sop.Target_SQL), 0) AS qtd_target_sql,
    ROUND(SUM(sop.Target_SAL), 0) AS qtd_target_sal,
    ROUND(SUM(sop.Target_SQO), 0) AS qtd_target_sqo,
    ROUND(SUM(sop.Target_Won), 0) AS qtd_target_won,
    ROUND(SUM(sop.Target_ACV), 2) AS qtd_target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate <= p.as_of_date
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
    AND UPPER(sop.FunnelType) NOT IN ('RENEWAL', 'R360 RENEWAL')
  GROUP BY sop.RecordType, sop.Region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END
),

-- Combined Funnel Attainment by Category
funnel_attainment_by_category AS (
  SELECT
    COALESCE(a.product, tq.product, t1.product) AS product,
    COALESCE(a.region, tq.region, t1.region) AS region,
    COALESCE(a.category, tq.category, t1.category) AS category,
    -- Q1 Targets
    COALESCE(t1.q1_target_mql, 0) AS q1_target_mql,
    COALESCE(t1.q1_target_sql, 0) AS q1_target_sql,
    COALESCE(t1.q1_target_sal, 0) AS q1_target_sal,
    COALESCE(t1.q1_target_sqo, 0) AS q1_target_sqo,
    -- QTD Targets
    COALESCE(tq.qtd_target_mql, 0) AS qtd_target_mql,
    COALESCE(tq.qtd_target_sql, 0) AS qtd_target_sql,
    COALESCE(tq.qtd_target_sal, 0) AS qtd_target_sal,
    COALESCE(tq.qtd_target_sqo, 0) AS qtd_target_sqo,
    -- Actuals
    COALESCE(a.actual_mql, 0) AS actual_mql,
    COALESCE(a.actual_sql, 0) AS actual_sql,
    COALESCE(a.actual_sal, 0) AS actual_sal,
    COALESCE(a.actual_sqo, 0) AS actual_sqo,
    -- Pacing % (if QTD target = 0 but actual > 0, show 100% since target is met)
    CASE WHEN COALESCE(tq.qtd_target_mql, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_mql, 0), tq.qtd_target_mql) * 100, 0) END AS mql_pacing_pct,
    CASE WHEN COALESCE(tq.qtd_target_sql, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_sql, 0), tq.qtd_target_sql) * 100, 0) END AS sql_pacing_pct,
    CASE WHEN COALESCE(tq.qtd_target_sal, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_sal, 0), tq.qtd_target_sal) * 100, 0) END AS sal_pacing_pct,
    CASE WHEN COALESCE(tq.qtd_target_sqo, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_sqo, 0), tq.qtd_target_sqo) * 100, 0) END AS sqo_pacing_pct,
    -- Gaps
    COALESCE(a.actual_mql, 0) - COALESCE(tq.qtd_target_mql, 0) AS mql_gap,
    COALESCE(a.actual_sql, 0) - COALESCE(tq.qtd_target_sql, 0) AS sql_gap,
    COALESCE(a.actual_sal, 0) - COALESCE(tq.qtd_target_sal, 0) AS sal_gap,
    COALESCE(a.actual_sqo, 0) - COALESCE(tq.qtd_target_sqo, 0) AS sqo_gap,
    -- WEIGHTED TOF ATTAINMENT SCORE
    -- Weights: MQL=10%, SQL=20%, SAL=30%, SQO=40% (down-funnel weighted)
    -- Only includes stages with targets > 0, normalizes weights to sum to 1.0
    -- If no stages have QTD targets yet, default to 100%
    COALESCE(ROUND(
      SAFE_DIVIDE(
        (CASE WHEN COALESCE(tq.qtd_target_mql, 0) > 0 THEN 0.10 * SAFE_DIVIDE(COALESCE(a.actual_mql, 0), tq.qtd_target_mql) ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sql, 0) > 0 THEN 0.20 * SAFE_DIVIDE(COALESCE(a.actual_sql, 0), tq.qtd_target_sql) ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sal, 0) > 0 THEN 0.30 * SAFE_DIVIDE(COALESCE(a.actual_sal, 0), tq.qtd_target_sal) ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sqo, 0) > 0 THEN 0.40 * SAFE_DIVIDE(COALESCE(a.actual_sqo, 0), tq.qtd_target_sqo) ELSE 0 END),
        (CASE WHEN COALESCE(tq.qtd_target_mql, 0) > 0 THEN 0.10 ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sql, 0) > 0 THEN 0.20 ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sal, 0) > 0 THEN 0.30 ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sqo, 0) > 0 THEN 0.40 ELSE 0 END)
      ) * 100, 0
    ), 100) AS weighted_tof_score
  FROM funnel_actuals_by_category a
  FULL OUTER JOIN funnel_targets_by_category_qtd tq
    ON a.product = tq.product AND a.region = tq.region AND a.category = tq.category
  FULL OUTER JOIN funnel_targets_by_category_q1 t1
    ON COALESCE(a.product, tq.product) = t1.product
    AND COALESCE(a.region, tq.region) = t1.region
    AND COALESCE(a.category, tq.category) = t1.category
  WHERE COALESCE(a.category, tq.category, t1.category) != 'OTHER'
),

-- ============================================================================
-- FUNNEL BY CATEGORY + SOURCE DIMENSION
-- Shows funnel metrics broken down by BOTH Category AND Source
-- This ensures correct target alignment (e.g., AE SOURCED + NEW LOGO has no MQL target)
-- ============================================================================

-- Funnel actuals by Category + Source (from DailyRevenueFunnel)
funnel_actuals_by_source AS (
  SELECT
    RecordType AS product,
    Region AS region,
    CASE
      WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    CASE
      WHEN UPPER(COALESCE(Source, '')) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(COALESCE(Source, '')) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(COALESCE(Source, '')) IN ('AE SOURCED', 'AE_SOURCED') THEN 'AE SOURCED'
      WHEN UPPER(COALESCE(Source, '')) IN ('AM SOURCED', 'AM_SOURCED') THEN 'AM SOURCED'
      WHEN UPPER(COALESCE(Source, '')) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN UPPER(COALESCE(Source, '')) = 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      ELSE 'OTHER'
    END AS source,
    SUM(MQL) AS actual_mql,
    SUM(SQL) AS actual_sql,
    SUM(SAL) AS actual_sal,
    SUM(SQO) AS actual_sqo,
    SUM(Won) AS actual_won,
    ROUND(SUM(WonACV), 2) AS actual_acv
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, dates d
  WHERE CAST(CaptureDate AS DATE) >= d.qtd_start
    AND CAST(CaptureDate AS DATE) <= d.as_of_date
    AND RecordType IN ('POR', 'R360')
    AND UPPER(FunnelType) NOT IN ('RENEWAL', 'R360 RENEWAL')
    AND Region IN ('AMER', 'EMEA', 'APAC')
  GROUP BY RecordType, Region,
    CASE
      WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END,
    CASE
      WHEN UPPER(COALESCE(Source, '')) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(COALESCE(Source, '')) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(COALESCE(Source, '')) IN ('AE SOURCED', 'AE_SOURCED') THEN 'AE SOURCED'
      WHEN UPPER(COALESCE(Source, '')) IN ('AM SOURCED', 'AM_SOURCED') THEN 'AM SOURCED'
      WHEN UPPER(COALESCE(Source, '')) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN UPPER(COALESCE(Source, '')) = 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      ELSE 'OTHER'
    END
),

-- Funnel targets by Category + Source (Q1 Full Quarter) from SOP
funnel_targets_by_source_q1 AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    CASE
      WHEN UPPER(sop.Source) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(sop.Source) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(sop.Source) IN ('AE SOURCED', 'AE_SOURCED') THEN 'AE SOURCED'
      WHEN UPPER(sop.Source) IN ('AM SOURCED', 'AM_SOURCED') THEN 'AM SOURCED'
      WHEN UPPER(sop.Source) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN UPPER(sop.Source) = 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      ELSE 'OTHER'
    END AS source,
    -- CRITICAL: Only INBOUND source has MQL targets (AE/AM/OUTBOUND skip MQL stage)
    ROUND(SUM(CASE WHEN UPPER(sop.Source) = 'INBOUND' THEN sop.Target_MQL ELSE 0 END), 0) AS q1_target_mql,
    ROUND(SUM(sop.Target_SQL), 0) AS q1_target_sql,
    ROUND(SUM(sop.Target_SAL), 0) AS q1_target_sal,
    ROUND(SUM(sop.Target_SQO), 0) AS q1_target_sqo,
    ROUND(SUM(sop.Target_Won), 0) AS q1_target_won,
    ROUND(SUM(sop.Target_ACV), 2) AS q1_target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate < p.quarter_end
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
    AND sop.Source NOT IN ('ALL', 'TOTAL')
  GROUP BY sop.RecordType, sop.Region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END,
    CASE
      WHEN UPPER(sop.Source) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(sop.Source) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(sop.Source) IN ('AE SOURCED', 'AE_SOURCED') THEN 'AE SOURCED'
      WHEN UPPER(sop.Source) IN ('AM SOURCED', 'AM_SOURCED') THEN 'AM SOURCED'
      WHEN UPPER(sop.Source) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN UPPER(sop.Source) = 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      ELSE 'OTHER'
    END
),

-- QTD Funnel Targets by Category + Source
funnel_targets_by_source_qtd AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END AS category,
    CASE
      WHEN UPPER(sop.Source) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(sop.Source) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(sop.Source) IN ('AE SOURCED', 'AE_SOURCED') THEN 'AE SOURCED'
      WHEN UPPER(sop.Source) IN ('AM SOURCED', 'AM_SOURCED') THEN 'AM SOURCED'
      WHEN UPPER(sop.Source) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN UPPER(sop.Source) = 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      ELSE 'OTHER'
    END AS source,
    -- CRITICAL: Only INBOUND source has MQL targets (AE/AM/OUTBOUND skip MQL stage)
    ROUND(SUM(CASE WHEN UPPER(sop.Source) = 'INBOUND' THEN sop.Target_MQL ELSE 0 END), 0) AS qtd_target_mql,
    ROUND(SUM(sop.Target_SQL), 0) AS qtd_target_sql,
    ROUND(SUM(sop.Target_SAL), 0) AS qtd_target_sal,
    ROUND(SUM(sop.Target_SQO), 0) AS qtd_target_sqo,
    ROUND(SUM(sop.Target_Won), 0) AS qtd_target_won,
    ROUND(SUM(sop.Target_ACV), 2) AS qtd_target_acv
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  CROSS JOIN params p
  WHERE sop.Percentile = p.percentile
    AND sop.OpportunityType != 'RENEWAL'
    AND sop.TargetDate >= p.quarter_start
    AND sop.TargetDate <= p.as_of_date
    AND sop.RecordType IN ('POR', 'R360')
    AND sop.Region IN ('AMER', 'EMEA', 'APAC')
    AND sop.Source NOT IN ('ALL', 'TOTAL')
  GROUP BY sop.RecordType, sop.Region,
    CASE
      WHEN UPPER(sop.FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW BUSINESS'
      WHEN UPPER(sop.FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
      WHEN UPPER(sop.FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
      ELSE 'OTHER'
    END,
    CASE
      WHEN UPPER(sop.Source) = 'INBOUND' THEN 'INBOUND'
      WHEN UPPER(sop.Source) = 'OUTBOUND' THEN 'OUTBOUND'
      WHEN UPPER(sop.Source) IN ('AE SOURCED', 'AE_SOURCED') THEN 'AE SOURCED'
      WHEN UPPER(sop.Source) IN ('AM SOURCED', 'AM_SOURCED') THEN 'AM SOURCED'
      WHEN UPPER(sop.Source) = 'TRADESHOW' THEN 'TRADESHOW'
      WHEN UPPER(sop.Source) = 'PARTNERSHIPS' THEN 'PARTNERSHIPS'
      ELSE 'OTHER'
    END
),

-- Combined Funnel Attainment by Category + Source
funnel_attainment_by_source AS (
  SELECT
    COALESCE(a.product, tq.product, t1.product) AS product,
    COALESCE(a.region, tq.region, t1.region) AS region,
    COALESCE(a.category, tq.category, t1.category) AS category,
    COALESCE(a.source, tq.source, t1.source) AS source,
    -- Q1 Targets
    COALESCE(t1.q1_target_mql, 0) AS q1_target_mql,
    COALESCE(t1.q1_target_sql, 0) AS q1_target_sql,
    COALESCE(t1.q1_target_sal, 0) AS q1_target_sal,
    COALESCE(t1.q1_target_sqo, 0) AS q1_target_sqo,
    -- QTD Targets
    COALESCE(tq.qtd_target_mql, 0) AS qtd_target_mql,
    COALESCE(tq.qtd_target_sql, 0) AS qtd_target_sql,
    COALESCE(tq.qtd_target_sal, 0) AS qtd_target_sal,
    COALESCE(tq.qtd_target_sqo, 0) AS qtd_target_sqo,
    -- Actuals
    COALESCE(a.actual_mql, 0) AS actual_mql,
    COALESCE(a.actual_sql, 0) AS actual_sql,
    COALESCE(a.actual_sal, 0) AS actual_sal,
    COALESCE(a.actual_sqo, 0) AS actual_sqo,
    -- Pacing % (if QTD target = 0 but actual > 0, show 100% since target is met)
    CASE WHEN COALESCE(tq.qtd_target_mql, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_mql, 0), tq.qtd_target_mql) * 100, 0) END AS mql_pacing_pct,
    CASE WHEN COALESCE(tq.qtd_target_sql, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_sql, 0), tq.qtd_target_sql) * 100, 0) END AS sql_pacing_pct,
    CASE WHEN COALESCE(tq.qtd_target_sal, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_sal, 0), tq.qtd_target_sal) * 100, 0) END AS sal_pacing_pct,
    CASE WHEN COALESCE(tq.qtd_target_sqo, 0) = 0 THEN 100 ELSE ROUND(SAFE_DIVIDE(COALESCE(a.actual_sqo, 0), tq.qtd_target_sqo) * 100, 0) END AS sqo_pacing_pct,
    -- Gaps
    COALESCE(a.actual_mql, 0) - COALESCE(tq.qtd_target_mql, 0) AS mql_gap,
    COALESCE(a.actual_sql, 0) - COALESCE(tq.qtd_target_sql, 0) AS sql_gap,
    COALESCE(a.actual_sal, 0) - COALESCE(tq.qtd_target_sal, 0) AS sal_gap,
    COALESCE(a.actual_sqo, 0) - COALESCE(tq.qtd_target_sqo, 0) AS sqo_gap,
    -- WEIGHTED TOF ATTAINMENT SCORE
    -- Weights: MQL=10%, SQL=20%, SAL=30%, SQO=40% (down-funnel weighted)
    -- Only includes stages with targets > 0, normalizes weights to sum to 1.0
    -- If no stages have QTD targets yet, default to 100%
    COALESCE(ROUND(
      SAFE_DIVIDE(
        -- Weighted sum of attainment percentages (only for stages with targets)
        (CASE WHEN COALESCE(tq.qtd_target_mql, 0) > 0 THEN 0.10 * SAFE_DIVIDE(COALESCE(a.actual_mql, 0), tq.qtd_target_mql) ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sql, 0) > 0 THEN 0.20 * SAFE_DIVIDE(COALESCE(a.actual_sql, 0), tq.qtd_target_sql) ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sal, 0) > 0 THEN 0.30 * SAFE_DIVIDE(COALESCE(a.actual_sal, 0), tq.qtd_target_sal) ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sqo, 0) > 0 THEN 0.40 * SAFE_DIVIDE(COALESCE(a.actual_sqo, 0), tq.qtd_target_sqo) ELSE 0 END),
        -- Normalization factor (sum of applicable weights)
        (CASE WHEN COALESCE(tq.qtd_target_mql, 0) > 0 THEN 0.10 ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sql, 0) > 0 THEN 0.20 ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sal, 0) > 0 THEN 0.30 ELSE 0 END) +
        (CASE WHEN COALESCE(tq.qtd_target_sqo, 0) > 0 THEN 0.40 ELSE 0 END)
      ) * 100, 0
    ), 100) AS weighted_tof_score
  FROM funnel_actuals_by_source a
  FULL OUTER JOIN funnel_targets_by_source_qtd tq
    ON a.product = tq.product AND a.region = tq.region AND a.category = tq.category AND a.source = tq.source
  FULL OUTER JOIN funnel_targets_by_source_q1 t1
    ON COALESCE(a.product, tq.product) = t1.product
    AND COALESCE(a.region, tq.region) = t1.region
    AND COALESCE(a.category, tq.category) = t1.category
    AND COALESCE(a.source, tq.source) = t1.source
  WHERE COALESCE(a.source, tq.source, t1.source) != 'OTHER'
    AND COALESCE(a.category, tq.category, t1.category) != 'OTHER'
),

-- ============================================================================
-- GOOGLE ADS QTD - WITH REGIONAL BREAKDOWN
-- Campaign naming convention:
--   US Campaign, mm_search_competitors_na → AMER
--   UK Campaign, mm_search_competitors_uk → EMEA
--   AU Campaign, mm_search_competitors_aus → APAC
-- ============================================================================
-- Deduplicated campaign names for POR (latest name per campaign)
por_campaigns AS (
  SELECT campaign_id, campaign_name
  FROM (
    SELECT campaign_id, campaign_name,
           ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY _DATA_DATE DESC) AS rn
    FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_Campaign_8275359090`
  )
  WHERE rn = 1
),

por_ads_qtd AS (
  SELECT
    'POR' AS product,
    CASE
      WHEN UPPER(c.campaign_name) LIKE 'US %' OR UPPER(c.campaign_name) LIKE '%_NA' OR UPPER(c.campaign_name) LIKE '%_NA_%' THEN 'AMER'
      WHEN UPPER(c.campaign_name) LIKE 'UK %' OR UPPER(c.campaign_name) LIKE '%_UK' OR UPPER(c.campaign_name) LIKE '%_UK_%' THEN 'EMEA'
      WHEN UPPER(c.campaign_name) LIKE 'AU %' OR UPPER(c.campaign_name) LIKE '%_AUS' OR UPPER(c.campaign_name) LIKE '%_AUS_%' OR UPPER(c.campaign_name) LIKE '%_AU_%' THEN 'APAC'
      ELSE 'AMER'  -- Default to AMER for unmatched campaigns
    END AS region,
    SUM(s.metrics_impressions) AS impressions,
    SUM(s.metrics_clicks) AS clicks,
    ROUND(SUM(s.metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(s.metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(s.metrics_clicks), NULLIF(SUM(s.metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(s.metrics_cost_micros) / 1000000.0, NULLIF(SUM(s.metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(s.metrics_cost_micros) / 1000000.0, NULLIF(SUM(s.metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090` s
  JOIN por_campaigns c ON s.campaign_id = c.campaign_id
  CROSS JOIN dates d
  WHERE s.segments_date >= d.qtd_start
    AND s.segments_date <= d.as_of_date
    AND s.segments_ad_network_type = 'SEARCH'
  GROUP BY product, region
),

-- Deduplicated campaign names for R360 (latest name per campaign)
r360_campaigns AS (
  SELECT campaign_id, campaign_name
  FROM (
    SELECT campaign_id, campaign_name,
           ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY _DATA_DATE DESC) AS rn
    FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_Campaign_3799591491`
  )
  WHERE rn = 1
),

r360_ads_qtd AS (
  SELECT
    'R360' AS product,
    CASE
      WHEN UPPER(c.campaign_name) LIKE 'US %' OR UPPER(c.campaign_name) LIKE '%_NA' OR UPPER(c.campaign_name) LIKE '%_NA_%' THEN 'AMER'
      WHEN UPPER(c.campaign_name) LIKE 'UK %' OR UPPER(c.campaign_name) LIKE '%_UK' OR UPPER(c.campaign_name) LIKE '%_UK_%' THEN 'EMEA'
      WHEN UPPER(c.campaign_name) LIKE 'AU %' OR UPPER(c.campaign_name) LIKE '%_AUS' OR UPPER(c.campaign_name) LIKE '%_AUS_%' OR UPPER(c.campaign_name) LIKE '%_AU_%' THEN 'APAC'
      ELSE 'AMER'  -- Default to AMER for unmatched campaigns
    END AS region,
    SUM(s.metrics_impressions) AS impressions,
    SUM(s.metrics_clicks) AS clicks,
    ROUND(SUM(s.metrics_cost_micros) / 1000000.0, 2) AS ad_spend_usd,
    SUM(s.metrics_conversions) AS conversions,
    ROUND(SAFE_DIVIDE(SUM(s.metrics_clicks), NULLIF(SUM(s.metrics_impressions), 0)) * 100, 2) AS ctr_pct,
    ROUND(SAFE_DIVIDE(SUM(s.metrics_cost_micros) / 1000000.0, NULLIF(SUM(s.metrics_clicks), 0)), 2) AS cpc_usd,
    ROUND(SAFE_DIVIDE(SUM(s.metrics_cost_micros) / 1000000.0, NULLIF(SUM(s.metrics_conversions), 0)), 2) AS cpa_usd
  FROM `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491` s
  JOIN r360_campaigns c ON s.campaign_id = c.campaign_id
  CROSS JOIN dates d
  WHERE s.segments_date >= d.qtd_start
    AND s.segments_date <= d.as_of_date
    AND s.segments_ad_network_type = 'SEARCH'
  GROUP BY product, region
),

google_ads_combined AS (
  SELECT * FROM por_ads_qtd
  UNION ALL
  SELECT * FROM r360_ads_qtd
),

-- ============================================================================
-- COMBINED ATTAINMENT BY REGION/CATEGORY
-- ============================================================================
attainment_summary AS (
  SELECT
    t.product,
    t.region,
    t.category,
    t.q1_target,

    -- Calculate QTD target (prorated)
    ROUND(t.q1_target * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params), 2) AS qtd_target,

    -- Actuals
    COALESCE(w.qtd_deals, 0) AS qtd_deals,
    COALESCE(w.qtd_acv, 0) AS qtd_acv,

    -- Attainment %
    ROUND(SAFE_DIVIDE(COALESCE(w.qtd_acv, 0), t.q1_target * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)) * 100, 1) AS qtd_attainment_pct,

    -- Full quarter attainment (actual vs full Q target)
    ROUND(SAFE_DIVIDE(COALESCE(w.qtd_acv, 0), t.q1_target) * 100, 1) AS q1_progress_pct,

    -- Gap to QTD target
    ROUND(COALESCE(w.qtd_acv, 0) - (t.q1_target * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)), 2) AS qtd_gap,

    -- Lost deals info
    COALESCE(l.lost_deals, 0) AS qtd_lost_deals,
    COALESCE(l.lost_acv, 0) AS qtd_lost_acv,

    -- Win rate
    ROUND(SAFE_DIVIDE(COALESCE(w.qtd_deals, 0), COALESCE(w.qtd_deals, 0) + COALESCE(l.lost_deals, 0)) * 100, 1) AS win_rate_pct,

    -- Pipeline
    COALESCE(p.opp_count, 0) AS pipeline_opps,
    COALESCE(p.pipeline_acv, 0) AS pipeline_acv,
    COALESCE(p.avg_age_days, 0) AS pipeline_avg_age_days,

    -- Pipeline coverage
    ROUND(SAFE_DIVIDE(COALESCE(p.pipeline_acv, 0), t.q1_target - COALESCE(w.qtd_acv, 0)), 1) AS pipeline_coverage_x,

    -- RAG status
    CASE
      WHEN SAFE_DIVIDE(COALESCE(w.qtd_acv, 0), t.q1_target * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)) >= 0.90 THEN 'GREEN'
      WHEN SAFE_DIVIDE(COALESCE(w.qtd_acv, 0), t.q1_target * (SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params)) >= 0.70 THEN 'YELLOW'
      ELSE 'RED'
    END AS rag_status

  FROM q1_targets t
  LEFT JOIN qtd_won w ON t.product = w.product AND t.region = w.region AND t.category = w.category
  LEFT JOIN qtd_lost l ON t.product = l.product AND t.region = l.region AND t.category = l.category
  LEFT JOIN open_pipeline p ON t.product = p.product AND t.region = p.region AND t.category = p.category
  WHERE t.q1_target > 0
),

-- ============================================================================
-- FUNNEL PACING (INBOUND CHANNEL ONLY)
-- NOTE: These metrics are for INBOUND-sourced leads only.
-- EMEA is outbound-heavy so MQL targets appear lower relative to total ACV.
-- APAC is inbound-heavy so MQL targets appear higher relative to total ACV.
-- ============================================================================
funnel_pacing AS (
  SELECT
    COALESCE(a.product, t.product) AS product,
    COALESCE(a.region, t.region) AS region,
    'INBOUND' AS source_channel,  -- Clarify this is INBOUND channel only

    -- MQL
    COALESCE(a.actual_mql, 0) AS actual_mql,
    COALESCE(t.target_mql, 0) AS target_mql,
    ROUND(SAFE_DIVIDE(a.actual_mql, t.target_mql) * 100, 0) AS mql_pacing_pct,
    CASE WHEN SAFE_DIVIDE(a.actual_mql, t.target_mql) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(a.actual_mql, t.target_mql) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS mql_rag,

    -- SQL
    COALESCE(a.actual_sql, 0) AS actual_sql,
    COALESCE(t.target_sql, 0) AS target_sql,
    ROUND(SAFE_DIVIDE(a.actual_sql, t.target_sql) * 100, 0) AS sql_pacing_pct,
    CASE WHEN SAFE_DIVIDE(a.actual_sql, t.target_sql) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(a.actual_sql, t.target_sql) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS sql_rag,

    -- SAL
    COALESCE(a.actual_sal, 0) AS actual_sal,
    COALESCE(t.target_sal, 0) AS target_sal,
    ROUND(SAFE_DIVIDE(a.actual_sal, t.target_sal) * 100, 0) AS sal_pacing_pct,
    CASE WHEN SAFE_DIVIDE(a.actual_sal, t.target_sal) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(a.actual_sal, t.target_sal) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS sal_rag,

    -- SQO
    COALESCE(a.actual_sqo, 0) AS actual_sqo,
    COALESCE(t.target_sqo, 0) AS target_sqo,
    ROUND(SAFE_DIVIDE(a.actual_sqo, t.target_sqo) * 100, 0) AS sqo_pacing_pct,
    CASE WHEN SAFE_DIVIDE(a.actual_sqo, t.target_sqo) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(a.actual_sqo, t.target_sqo) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS sqo_rag,

    -- INBOUND ACV target (for context - not total category ACV)
    COALESCE(t.target_acv, 0) AS inbound_target_acv,

    -- Conversion rates
    ROUND(SAFE_DIVIDE(a.actual_sql, a.actual_mql) * 100, 1) AS mql_to_sql_rate,
    ROUND(SAFE_DIVIDE(a.actual_sal, a.actual_sql) * 100, 1) AS sql_to_sal_rate,
    ROUND(SAFE_DIVIDE(a.actual_sqo, a.actual_sal) * 100, 1) AS sal_to_sqo_rate

  FROM funnel_actuals_qtd a
  FULL OUTER JOIN funnel_targets_qtd t ON a.product = t.product AND a.region = t.region
),

-- ============================================================================
-- FUNNEL HEALTH ANALYSIS
-- Stage-by-stage gap analysis with bottleneck identification
-- Uses funnel_targets_qtd for QTD targets (summed daily targets from SOP)
-- Uses funnel_targets_full_q for full quarter reference
-- ============================================================================
funnel_health_analysis AS (
  SELECT
    COALESCE(fp.product, fq.product, ft.product) AS product,
    COALESCE(fp.region, fq.region, ft.region) AS region,

    -- QTD Actuals
    COALESCE(fp.actual_mql, 0) AS actual_mql,
    COALESCE(fp.actual_sql, 0) AS actual_sql,
    COALESCE(fp.actual_sal, 0) AS actual_sal,
    COALESCE(fp.actual_sqo, 0) AS actual_sqo,

    -- Full Quarter Targets (for reference)
    COALESCE(ft.q1_target_mql, 0) AS q1_target_mql,
    COALESCE(ft.q1_target_sql, 0) AS q1_target_sql,
    COALESCE(ft.q1_target_sal, 0) AS q1_target_sal,
    COALESCE(ft.q1_target_sqo, 0) AS q1_target_sqo,

    -- QTD Targets (summed daily targets - CORRECT approach)
    COALESCE(fq.target_mql, 0) AS qtd_target_mql,
    COALESCE(fq.target_sql, 0) AS qtd_target_sql,
    COALESCE(fq.target_sal, 0) AS qtd_target_sal,
    COALESCE(fq.target_sqo, 0) AS qtd_target_sqo,

    -- Gap at each stage (actual - QTD target)
    COALESCE(fp.actual_mql, 0) - COALESCE(fq.target_mql, 0) AS mql_gap,
    COALESCE(fp.actual_sql, 0) - COALESCE(fq.target_sql, 0) AS sql_gap,
    COALESCE(fp.actual_sal, 0) - COALESCE(fq.target_sal, 0) AS sal_gap,
    COALESCE(fp.actual_sqo, 0) - COALESCE(fq.target_sqo, 0) AS sqo_gap,

    -- Pacing % at each stage (actual / QTD target)
    ROUND(SAFE_DIVIDE(COALESCE(fp.actual_mql, 0), fq.target_mql) * 100, 0) AS mql_pacing_pct,
    ROUND(SAFE_DIVIDE(COALESCE(fp.actual_sql, 0), fq.target_sql) * 100, 0) AS sql_pacing_pct,
    ROUND(SAFE_DIVIDE(COALESCE(fp.actual_sal, 0), fq.target_sal) * 100, 0) AS sal_pacing_pct,
    ROUND(SAFE_DIVIDE(COALESCE(fp.actual_sqo, 0), fq.target_sqo) * 100, 0) AS sqo_pacing_pct,

    -- Actual conversion rates
    COALESCE(fp.mql_to_sql_rate, 0) AS actual_mql_to_sql_rate,
    COALESCE(fp.sql_to_sal_rate, 0) AS actual_sql_to_sal_rate,
    COALESCE(fp.sal_to_sqo_rate, 0) AS actual_sal_to_sqo_rate,

    -- Target conversion rates (from full quarter)
    COALESCE(ft.target_mql_to_sql_rate, 0) AS target_mql_to_sql_rate,
    COALESCE(ft.target_sql_to_sal_rate, 0) AS target_sql_to_sal_rate,
    COALESCE(ft.target_sal_to_sqo_rate, 0) AS target_sal_to_sqo_rate,

    -- Conversion rate gaps (actual - target)
    COALESCE(fp.mql_to_sql_rate, 0) - COALESCE(ft.target_mql_to_sql_rate, 0) AS mql_to_sql_rate_gap,
    COALESCE(fp.sql_to_sal_rate, 0) - COALESCE(ft.target_sql_to_sal_rate, 0) AS sql_to_sal_rate_gap,
    COALESCE(fp.sal_to_sqo_rate, 0) - COALESCE(ft.target_sal_to_sqo_rate, 0) AS sal_to_sqo_rate_gap,

    -- RAG status per stage (using QTD targets)
    CASE WHEN SAFE_DIVIDE(COALESCE(fp.actual_mql, 0), fq.target_mql) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(COALESCE(fp.actual_mql, 0), fq.target_mql) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS mql_rag,
    CASE WHEN SAFE_DIVIDE(COALESCE(fp.actual_sql, 0), fq.target_sql) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(COALESCE(fp.actual_sql, 0), fq.target_sql) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS sql_rag,
    CASE WHEN SAFE_DIVIDE(COALESCE(fp.actual_sal, 0), fq.target_sal) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(COALESCE(fp.actual_sal, 0), fq.target_sal) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS sal_rag,
    CASE WHEN SAFE_DIVIDE(COALESCE(fp.actual_sqo, 0), fq.target_sqo) >= 0.90 THEN 'GREEN'
         WHEN SAFE_DIVIDE(COALESCE(fp.actual_sqo, 0), fq.target_sqo) >= 0.70 THEN 'YELLOW'
         ELSE 'RED' END AS sqo_rag,

    -- Identify primary bottleneck (stage with lowest pacing %)
    CASE
      WHEN SAFE_DIVIDE(COALESCE(fp.actual_mql, 0), NULLIF(fq.target_mql, 0)) <=
           LEAST(
             COALESCE(SAFE_DIVIDE(COALESCE(fp.actual_sql, 0), NULLIF(fq.target_sql, 0)), 999),
             COALESCE(SAFE_DIVIDE(COALESCE(fp.actual_sal, 0), NULLIF(fq.target_sal, 0)), 999),
             COALESCE(SAFE_DIVIDE(COALESCE(fp.actual_sqo, 0), NULLIF(fq.target_sqo, 0)), 999)
           )
      THEN 'MQL'
      WHEN SAFE_DIVIDE(COALESCE(fp.actual_sql, 0), NULLIF(fq.target_sql, 0)) <=
           LEAST(
             COALESCE(SAFE_DIVIDE(COALESCE(fp.actual_sal, 0), NULLIF(fq.target_sal, 0)), 999),
             COALESCE(SAFE_DIVIDE(COALESCE(fp.actual_sqo, 0), NULLIF(fq.target_sqo, 0)), 999)
           )
      THEN 'SQL'
      WHEN SAFE_DIVIDE(COALESCE(fp.actual_sal, 0), NULLIF(fq.target_sal, 0)) <=
           COALESCE(SAFE_DIVIDE(COALESCE(fp.actual_sqo, 0), NULLIF(fq.target_sqo, 0)), 999)
      THEN 'SAL'
      ELSE 'SQO'
    END AS primary_bottleneck

  FROM funnel_pacing fp
  FULL OUTER JOIN funnel_targets_qtd fq ON fp.product = fq.product AND fp.region = fq.region
  FULL OUTER JOIN funnel_targets_full_q ft ON COALESCE(fp.product, fq.product) = ft.product
                                          AND COALESCE(fp.region, fq.region) = ft.region
),

-- ============================================================================
-- FUNNEL RCA INSIGHTS (AUTO-GENERATED COMMENTARY)
-- ============================================================================
funnel_rca_insights AS (
  SELECT
    product,
    region,
    primary_bottleneck,
    mql_pacing_pct,
    sql_pacing_pct,
    sal_pacing_pct,
    sqo_pacing_pct,
    actual_mql_to_sql_rate,
    target_mql_to_sql_rate,
    actual_sql_to_sal_rate,
    target_sql_to_sal_rate,
    actual_sal_to_sqo_rate,
    target_sal_to_sqo_rate,

    -- Generate RCA commentary
    CASE
      -- MQL deficit (top of funnel volume issue)
      WHEN primary_bottleneck = 'MQL' AND mql_pacing_pct < 70 THEN
        CONCAT(region, ' MQL pacing at ', CAST(COALESCE(mql_pacing_pct, 0) AS STRING), '% - top of funnel deficit will cascade to bookings. Increase marketing spend or lead gen activities.')
      WHEN primary_bottleneck = 'MQL' AND mql_pacing_pct BETWEEN 70 AND 89 THEN
        CONCAT(region, ' MQL slightly behind at ', CAST(COALESCE(mql_pacing_pct, 0) AS STRING), '% - monitor closely, consider supplementary campaigns.')

      -- SQL deficit (MQL->SQL conversion issue)
      WHEN primary_bottleneck = 'SQL' AND actual_mql_to_sql_rate < target_mql_to_sql_rate - 5 THEN
        CONCAT(region, ' MQL->SQL conversion ', CAST(ROUND(actual_mql_to_sql_rate, 0) AS STRING), '% vs ', CAST(ROUND(target_mql_to_sql_rate, 0) AS STRING), '% target - lead quality or SDR capacity issue.')
      WHEN primary_bottleneck = 'SQL' THEN
        CONCAT(region, ' SQL pacing at ', CAST(COALESCE(sql_pacing_pct, 0) AS STRING), '% - check SDR follow-up and lead qualification process.')

      -- SAL deficit (SQL->SAL conversion issue - qualification)
      WHEN primary_bottleneck = 'SAL' AND actual_sql_to_sal_rate < target_sql_to_sal_rate - 5 THEN
        CONCAT(region, ' SQL->SAL conversion ', CAST(ROUND(actual_sql_to_sal_rate, 0) AS STRING), '% vs ', CAST(ROUND(target_sql_to_sal_rate, 0) AS STRING), '% target - qualification or discovery issue.')
      WHEN primary_bottleneck = 'SAL' THEN
        CONCAT(region, ' SAL pacing at ', CAST(COALESCE(sal_pacing_pct, 0) AS STRING), '% - review discovery call effectiveness.')

      -- SQO deficit (SAL->SQO conversion issue - pipeline creation)
      WHEN primary_bottleneck = 'SQO' AND actual_sal_to_sqo_rate < target_sal_to_sqo_rate - 5 THEN
        CONCAT(region, ' SAL->SQO conversion ', CAST(ROUND(actual_sal_to_sqo_rate, 0) AS STRING), '% vs ', CAST(ROUND(target_sal_to_sqo_rate, 0) AS STRING), '% target - deal progression or pricing issue.')
      WHEN primary_bottleneck = 'SQO' THEN
        CONCAT(region, ' SQO pacing at ', CAST(COALESCE(sqo_pacing_pct, 0) AS STRING), '% - review proposal process and deal velocity.')

      -- Healthy funnel
      ELSE CONCAT(region, ' funnel healthy - all stages pacing at or above 90%.')
    END AS rca_commentary,

    -- Severity (for sorting)
    CASE
      WHEN LEAST(COALESCE(mql_pacing_pct, 0), COALESCE(sql_pacing_pct, 0), COALESCE(sal_pacing_pct, 0), COALESCE(sqo_pacing_pct, 0)) < 50 THEN 'CRITICAL'
      WHEN LEAST(COALESCE(mql_pacing_pct, 0), COALESCE(sql_pacing_pct, 0), COALESCE(sal_pacing_pct, 0), COALESCE(sqo_pacing_pct, 0)) < 70 THEN 'HIGH'
      WHEN LEAST(COALESCE(mql_pacing_pct, 0), COALESCE(sql_pacing_pct, 0), COALESCE(sal_pacing_pct, 0), COALESCE(sqo_pacing_pct, 0)) < 90 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS severity,

    -- Recommended action
    CASE primary_bottleneck
      WHEN 'MQL' THEN 'Increase marketing spend, launch supplementary campaigns, or expand outbound efforts.'
      WHEN 'SQL' THEN 'Review SDR capacity, improve lead response time, assess lead quality from sources.'
      WHEN 'SAL' THEN 'Coach AEs on discovery calls, review qualification criteria, assess demo effectiveness.'
      WHEN 'SQO' THEN 'Review proposal process, assess pricing competitiveness, coach on deal progression.'
      ELSE 'Maintain current performance.'
    END AS recommended_action

  FROM funnel_health_analysis
  WHERE COALESCE(q1_target_mql, 0) > 0  -- Only include regions with targets
),

-- ============================================================================
-- HISTORICAL TREND ANALYSIS - FUNNEL (Rolling 7d vs Prior 7d)
-- Compares current week's funnel performance against prior week
-- ============================================================================
funnel_trend_current_7d AS (
  SELECT
    RecordType AS product,
    Region AS region,
    SUM(MQL) AS mql_7d,
    SUM(SQL) AS sql_7d,
    SUM(SAL) AS sal_7d,
    SUM(SQO) AS sqo_7d
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, dates d
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) BETWEEN d.rolling_7d_start AND d.as_of_date
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_trend_prior_7d AS (
  SELECT
    RecordType AS product,
    Region AS region,
    SUM(MQL) AS mql_prior_7d,
    SUM(SQL) AS sql_prior_7d,
    SUM(SAL) AS sal_prior_7d,
    SUM(SQO) AS sqo_prior_7d
  FROM `data-analytics-306119.Staging.DailyRevenueFunnel`, dates d
  WHERE UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')
    AND CAST(CaptureDate AS DATE) BETWEEN DATE_SUB(d.rolling_7d_start, INTERVAL 7 DAY) AND DATE_SUB(d.rolling_7d_start, INTERVAL 1 DAY)
    AND RecordType IN ('POR', 'R360')
  GROUP BY RecordType, Region
),

funnel_trend_analysis AS (
  SELECT
    COALESCE(c.product, p.product) AS product,
    COALESCE(c.region, p.region) AS region,
    -- Current 7d
    COALESCE(c.mql_7d, 0) AS mql_current_7d,
    COALESCE(c.sql_7d, 0) AS sql_current_7d,
    COALESCE(c.sal_7d, 0) AS sal_current_7d,
    COALESCE(c.sqo_7d, 0) AS sqo_current_7d,
    -- Prior 7d
    COALESCE(p.mql_prior_7d, 0) AS mql_prior_7d,
    COALESCE(p.sql_prior_7d, 0) AS sql_prior_7d,
    COALESCE(p.sal_prior_7d, 0) AS sal_prior_7d,
    COALESCE(p.sqo_prior_7d, 0) AS sqo_prior_7d,
    -- WoW Change
    COALESCE(c.mql_7d, 0) - COALESCE(p.mql_prior_7d, 0) AS mql_wow_change,
    COALESCE(c.sql_7d, 0) - COALESCE(p.sql_prior_7d, 0) AS sql_wow_change,
    COALESCE(c.sal_7d, 0) - COALESCE(p.sal_prior_7d, 0) AS sal_wow_change,
    COALESCE(c.sqo_7d, 0) - COALESCE(p.sqo_prior_7d, 0) AS sqo_wow_change,
    -- WoW % Change
    ROUND(SAFE_DIVIDE(COALESCE(c.mql_7d, 0) - COALESCE(p.mql_prior_7d, 0), NULLIF(p.mql_prior_7d, 0)) * 100, 0) AS mql_wow_pct,
    ROUND(SAFE_DIVIDE(COALESCE(c.sql_7d, 0) - COALESCE(p.sql_prior_7d, 0), NULLIF(p.sql_prior_7d, 0)) * 100, 0) AS sql_wow_pct,
    ROUND(SAFE_DIVIDE(COALESCE(c.sal_7d, 0) - COALESCE(p.sal_prior_7d, 0), NULLIF(p.sal_prior_7d, 0)) * 100, 0) AS sal_wow_pct,
    ROUND(SAFE_DIVIDE(COALESCE(c.sqo_7d, 0) - COALESCE(p.sqo_prior_7d, 0), NULLIF(p.sqo_prior_7d, 0)) * 100, 0) AS sqo_wow_pct,
    -- Trend direction
    CASE WHEN COALESCE(c.mql_7d, 0) > COALESCE(p.mql_prior_7d, 0) THEN 'UP'
         WHEN COALESCE(c.mql_7d, 0) < COALESCE(p.mql_prior_7d, 0) THEN 'DOWN'
         ELSE 'FLAT' END AS mql_trend,
    CASE WHEN COALESCE(c.sql_7d, 0) > COALESCE(p.sql_prior_7d, 0) THEN 'UP'
         WHEN COALESCE(c.sql_7d, 0) < COALESCE(p.sql_prior_7d, 0) THEN 'DOWN'
         ELSE 'FLAT' END AS sql_trend,
    CASE WHEN COALESCE(c.sal_7d, 0) > COALESCE(p.sal_prior_7d, 0) THEN 'UP'
         WHEN COALESCE(c.sal_7d, 0) < COALESCE(p.sal_prior_7d, 0) THEN 'DOWN'
         ELSE 'FLAT' END AS sal_trend,
    CASE WHEN COALESCE(c.sqo_7d, 0) > COALESCE(p.sqo_prior_7d, 0) THEN 'UP'
         WHEN COALESCE(c.sqo_7d, 0) < COALESCE(p.sqo_prior_7d, 0) THEN 'DOWN'
         ELSE 'FLAT' END AS sqo_trend
  FROM funnel_trend_current_7d c
  FULL OUTER JOIN funnel_trend_prior_7d p ON c.product = p.product AND c.region = p.region
),

-- ============================================================================
-- LOSS REASON RCA ANALYSIS
-- Auto-generated commentary based on top loss reasons per region
-- ============================================================================
loss_reason_rca AS (
  SELECT
    product,
    region,
    loss_reason,
    deal_count,
    lost_acv,
    rank,
    -- Calculate % of total regional losses
    ROUND(SAFE_DIVIDE(lost_acv, SUM(lost_acv) OVER (PARTITION BY product, region)) * 100, 1) AS pct_of_regional_loss,
    -- Generate RCA commentary
    CASE
      -- Pricing issues
      WHEN LOWER(loss_reason) LIKE '%price%' OR LOWER(loss_reason) LIKE '%cost%' OR LOWER(loss_reason) LIKE '%budget%' THEN
        CONCAT('Pricing sensitivity: ', loss_reason, ' accounts for $', CAST(ROUND(lost_acv, 0) AS STRING), ' (', deal_count, ' deals). Review competitive pricing and value proposition.')
      -- Competitor losses
      WHEN LOWER(loss_reason) LIKE '%competitor%' OR LOWER(loss_reason) LIKE '%alternative%' THEN
        CONCAT('Competitive loss: ', loss_reason, ' - $', CAST(ROUND(lost_acv, 0) AS STRING), '. Analyze competitor strengths and adjust positioning.')
      -- Timing/No decision
      WHEN LOWER(loss_reason) LIKE '%timing%' OR LOWER(loss_reason) LIKE '%no decision%' OR LOWER(loss_reason) LIKE '%stalled%' THEN
        CONCAT('Deal stall: ', loss_reason, ' - $', CAST(ROUND(lost_acv, 0) AS STRING), '. Improve urgency creation and follow-up cadence.')
      -- Feature gaps
      WHEN LOWER(loss_reason) LIKE '%feature%' OR LOWER(loss_reason) LIKE '%functionality%' OR LOWER(loss_reason) LIKE '%capability%' THEN
        CONCAT('Feature gap: ', loss_reason, ' - $', CAST(ROUND(lost_acv, 0) AS STRING), '. Escalate to Product for roadmap consideration.')
      -- Implementation/complexity
      WHEN LOWER(loss_reason) LIKE '%implementation%' OR LOWER(loss_reason) LIKE '%complex%' OR LOWER(loss_reason) LIKE '%resource%' THEN
        CONCAT('Implementation concern: ', loss_reason, ' - $', CAST(ROUND(lost_acv, 0) AS STRING), '. Review onboarding messaging and support offerings.')
      -- Generic/unspecified
      ELSE
        CONCAT(loss_reason, ': $', CAST(ROUND(lost_acv, 0) AS STRING), ' (', deal_count, ' deals). Review and categorize for actionable insights.')
    END AS rca_commentary,
    -- Severity based on ACV
    CASE
      WHEN lost_acv >= 50000 THEN 'CRITICAL'
      WHEN lost_acv >= 20000 THEN 'HIGH'
      WHEN lost_acv >= 10000 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS severity,
    -- Recommended action category
    CASE
      WHEN LOWER(loss_reason) LIKE '%price%' OR LOWER(loss_reason) LIKE '%cost%' OR LOWER(loss_reason) LIKE '%budget%' THEN 'PRICING_REVIEW'
      WHEN LOWER(loss_reason) LIKE '%competitor%' THEN 'COMPETITIVE_INTEL'
      WHEN LOWER(loss_reason) LIKE '%timing%' OR LOWER(loss_reason) LIKE '%no decision%' THEN 'SALES_PROCESS'
      WHEN LOWER(loss_reason) LIKE '%feature%' OR LOWER(loss_reason) LIKE '%functionality%' THEN 'PRODUCT_FEEDBACK'
      ELSE 'PROCESS_REVIEW'
    END AS action_category
  FROM loss_reasons_ranked
  WHERE rank <= 3  -- Top 3 reasons per region
),

-- ============================================================================
-- WINS ANALYSIS - Areas exceeding targets (pacing >100%)
-- Highlights strong performance for balanced reporting
-- ============================================================================
wins_analysis AS (
  SELECT
    product,
    region,
    category,
    qtd_acv,
    qtd_target,
    qtd_attainment_pct,
    pipeline_coverage_x,
    win_rate_pct,
    -- Win classification
    CASE
      WHEN qtd_attainment_pct >= 120 THEN 'EXCEPTIONAL'
      WHEN qtd_attainment_pct >= 100 THEN 'ON_TRACK'
      ELSE 'BELOW_TARGET'
    END AS performance_tier,
    -- Auto-generated success commentary
    CASE
      WHEN qtd_attainment_pct >= 120 THEN
        CONCAT(region, ' ', category, ' at ', CAST(ROUND(qtd_attainment_pct, 0) AS STRING), '% - exceptional performance, exceeding targets by ',
               CAST(ROUND(qtd_attainment_pct - 100, 0) AS STRING), '%. Strong execution driving results.')
      WHEN qtd_attainment_pct >= 100 THEN
        CONCAT(region, ' ', category, ' at ', CAST(ROUND(qtd_attainment_pct, 0) AS STRING), '% - on track, meeting targets. ',
               CASE WHEN win_rate_pct >= 50 THEN 'Strong win rate supporting results.' ELSE 'Continue pipeline development.' END)
      ELSE NULL
    END AS success_commentary,
    -- Contributing factors
    CASE
      WHEN win_rate_pct >= 60 THEN 'High win rate'
      WHEN pipeline_coverage_x >= 3.0 THEN 'Strong pipeline coverage'
      WHEN qtd_attainment_pct >= 100 THEN 'Consistent execution'
      ELSE NULL
    END AS contributing_factor
  FROM attainment_summary
  WHERE qtd_attainment_pct >= 100
),

-- ============================================================================
-- MOMENTUM INDICATORS - Positive WoW trends
-- Identifies improving areas even if not yet at target
-- ============================================================================
momentum_indicators AS (
  SELECT
    ft.product,
    ft.region,
    -- MQL momentum
    ft.mql_current_7d,
    ft.mql_prior_7d,
    ft.mql_wow_pct,
    ft.mql_trend,
    -- SQL momentum
    ft.sql_current_7d,
    ft.sql_prior_7d,
    ft.sql_wow_pct,
    ft.sql_trend,
    -- Overall momentum score (count of improving stages)
    (CASE WHEN ft.mql_trend = 'UP' THEN 1 ELSE 0 END +
     CASE WHEN ft.sql_trend = 'UP' THEN 1 ELSE 0 END +
     CASE WHEN ft.sal_trend = 'UP' THEN 1 ELSE 0 END +
     CASE WHEN ft.sqo_trend = 'UP' THEN 1 ELSE 0 END) AS positive_momentum_count,
    -- Momentum classification
    CASE
      WHEN (CASE WHEN ft.mql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sal_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sqo_trend = 'UP' THEN 1 ELSE 0 END) >= 3 THEN 'STRONG_MOMENTUM'
      WHEN (CASE WHEN ft.mql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sal_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sqo_trend = 'UP' THEN 1 ELSE 0 END) >= 2 THEN 'MODERATE_MOMENTUM'
      WHEN (CASE WHEN ft.mql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sal_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sqo_trend = 'UP' THEN 1 ELSE 0 END) >= 1 THEN 'SOME_MOMENTUM'
      ELSE 'NO_MOMENTUM'
    END AS momentum_tier,
    -- Momentum commentary
    CASE
      WHEN ft.mql_trend = 'UP' AND ft.mql_wow_pct >= 20 THEN
        CONCAT(ft.region, ' showing strong MQL momentum (+', CAST(COALESCE(ft.mql_wow_pct, 0) AS STRING), '% WoW). ',
               'Lead generation accelerating.')
      WHEN ft.sql_trend = 'UP' AND ft.sql_wow_pct >= 20 THEN
        CONCAT(ft.region, ' showing strong SQL momentum (+', CAST(COALESCE(ft.sql_wow_pct, 0) AS STRING), '% WoW). ',
               'SDR conversion improving.')
      WHEN (CASE WHEN ft.mql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sql_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sal_trend = 'UP' THEN 1 ELSE 0 END +
            CASE WHEN ft.sqo_trend = 'UP' THEN 1 ELSE 0 END) >= 2 THEN
        CONCAT(ft.region, ' showing positive momentum across multiple funnel stages.')
      ELSE NULL
    END AS momentum_commentary
  FROM funnel_trend_analysis ft
  WHERE ft.mql_trend = 'UP' OR ft.sql_trend = 'UP' OR ft.sal_trend = 'UP' OR ft.sqo_trend = 'UP'
),

-- ============================================================================
-- PIPELINE RCA - Coverage analysis with commentary
-- ============================================================================
pipeline_rca AS (
  SELECT
    product,
    region,
    category,
    q1_target,
    qtd_acv,
    pipeline_acv,
    pipeline_opps,
    pipeline_avg_age_days,
    pipeline_coverage_x,
    -- Remaining target
    ROUND(q1_target - qtd_acv, 2) AS remaining_target,
    -- Pipeline health assessment
    CASE
      WHEN pipeline_coverage_x >= 3.0 THEN 'HEALTHY'
      WHEN pipeline_coverage_x >= 2.0 THEN 'ADEQUATE'
      WHEN pipeline_coverage_x >= 1.0 THEN 'AT_RISK'
      ELSE 'CRITICAL'
    END AS pipeline_health,
    -- Pipeline age concern
    CASE
      WHEN pipeline_avg_age_days > 90 THEN 'AGING'
      WHEN pipeline_avg_age_days > 60 THEN 'MATURING'
      ELSE 'FRESH'
    END AS pipeline_age_status,
    -- RCA commentary
    CASE
      WHEN pipeline_coverage_x >= 3.0 AND pipeline_avg_age_days <= 60 THEN
        CONCAT(region, ' ', category, ' pipeline healthy at ', CAST(ROUND(pipeline_coverage_x, 1) AS STRING), 'x coverage. ',
               'Fresh pipeline (', CAST(ROUND(pipeline_avg_age_days, 0) AS STRING), ' days avg) supports Q1 target.')
      WHEN pipeline_coverage_x >= 3.0 AND pipeline_avg_age_days > 60 THEN
        CONCAT(region, ' ', category, ' has ', CAST(ROUND(pipeline_coverage_x, 1) AS STRING), 'x coverage but aging (',
               CAST(ROUND(pipeline_avg_age_days, 0) AS STRING), ' days avg). Focus on deal velocity.')
      WHEN pipeline_coverage_x >= 2.0 THEN
        CONCAT(region, ' ', category, ' pipeline adequate at ', CAST(ROUND(pipeline_coverage_x, 1) AS STRING), 'x. ',
               'Monitor closely - need ', FORMAT("$%'.0f", (q1_target - qtd_acv) / 2), ' more pipeline for safety.')
      WHEN pipeline_coverage_x >= 1.0 THEN
        CONCAT(region, ' ', category, ' pipeline AT RISK at only ', CAST(ROUND(pipeline_coverage_x, 1) AS STRING), 'x. ',
               'Urgent: Generate $', CAST(ROUND((q1_target - qtd_acv) * 2, 0) AS STRING), ' additional pipeline.')
      ELSE
        CONCAT(region, ' ', category, ' CRITICAL pipeline gap - only ', CAST(ROUND(pipeline_coverage_x, 1) AS STRING), 'x coverage. ',
               'Immediate action required to build pipeline.')
    END AS rca_commentary,
    -- Severity for sorting
    CASE
      WHEN pipeline_coverage_x < 1.0 THEN 'CRITICAL'
      WHEN pipeline_coverage_x < 2.0 THEN 'HIGH'
      WHEN pipeline_coverage_x < 3.0 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS severity,
    -- Recommended action
    CASE
      WHEN pipeline_coverage_x < 1.0 THEN 'Immediate pipeline generation needed. Deploy outbound, accelerate inbound campaigns.'
      WHEN pipeline_coverage_x < 2.0 THEN 'Increase prospecting activity. Review stalled deals for reactivation.'
      WHEN pipeline_avg_age_days > 90 THEN 'Focus on deal velocity. Review aging opportunities for close or disqualification.'
      ELSE 'Maintain pipeline hygiene. Continue current prospecting cadence.'
    END AS recommended_action
  FROM attainment_summary
  WHERE q1_target > 0
),

-- ============================================================================
-- TREND RCA - Declining trend analysis with root cause insights
-- ============================================================================
trend_rca AS (
  SELECT
    ft.product,
    ft.region,
    -- Identify declining stages
    CASE WHEN ft.mql_trend = 'DOWN' THEN TRUE ELSE FALSE END AS mql_declining,
    CASE WHEN ft.sql_trend = 'DOWN' THEN TRUE ELSE FALSE END AS sql_declining,
    CASE WHEN ft.sal_trend = 'DOWN' THEN TRUE ELSE FALSE END AS sal_declining,
    CASE WHEN ft.sqo_trend = 'DOWN' THEN TRUE ELSE FALSE END AS sqo_declining,
    -- Decline metrics
    ft.mql_wow_change,
    ft.sql_wow_change,
    ft.sal_wow_change,
    ft.sqo_wow_change,
    ft.mql_wow_pct,
    ft.sql_wow_pct,
    ft.sal_wow_pct,
    ft.sqo_wow_pct,
    -- Count declining stages
    (CASE WHEN ft.mql_trend = 'DOWN' THEN 1 ELSE 0 END +
     CASE WHEN ft.sql_trend = 'DOWN' THEN 1 ELSE 0 END +
     CASE WHEN ft.sal_trend = 'DOWN' THEN 1 ELSE 0 END +
     CASE WHEN ft.sqo_trend = 'DOWN' THEN 1 ELSE 0 END) AS declining_stage_count,
    -- Severity
    CASE
      WHEN (CASE WHEN ft.mql_trend = 'DOWN' THEN 1 ELSE 0 END +
            CASE WHEN ft.sql_trend = 'DOWN' THEN 1 ELSE 0 END +
            CASE WHEN ft.sal_trend = 'DOWN' THEN 1 ELSE 0 END +
            CASE WHEN ft.sqo_trend = 'DOWN' THEN 1 ELSE 0 END) >= 3 THEN 'CRITICAL'
      WHEN ft.mql_trend = 'DOWN' AND COALESCE(ft.mql_wow_pct, 0) < -30 THEN 'CRITICAL'
      WHEN (CASE WHEN ft.mql_trend = 'DOWN' THEN 1 ELSE 0 END +
            CASE WHEN ft.sql_trend = 'DOWN' THEN 1 ELSE 0 END) >= 2 THEN 'HIGH'
      WHEN ft.mql_trend = 'DOWN' OR ft.sql_trend = 'DOWN' THEN 'MEDIUM'
      ELSE 'LOW'
    END AS severity,
    -- RCA commentary
    CASE
      WHEN ft.mql_trend = 'DOWN' AND COALESCE(ft.mql_wow_pct, 0) < -30 THEN
        CONCAT(ft.region, ' MQL dropped ', CAST(ABS(COALESCE(ft.mql_wow_pct, 0)) AS STRING), '% WoW - significant lead gen decline. ',
               'Investigate: campaign spend changes, landing page issues, or seasonal factors.')
      WHEN ft.mql_trend = 'DOWN' AND ft.sql_trend = 'DOWN' THEN
        CONCAT(ft.region, ' showing top-of-funnel contraction (MQL ', CAST(COALESCE(ft.mql_wow_pct, 0) AS STRING), '%, SQL ',
               CAST(COALESCE(ft.sql_wow_pct, 0) AS STRING), '%). Review marketing campaigns and SDR capacity.')
      WHEN ft.mql_trend = 'DOWN' THEN
        CONCAT(ft.region, ' MQL declining (', CAST(COALESCE(ft.mql_wow_pct, 0) AS STRING), '% WoW). ',
               'Monitor campaign performance and lead sources.')
      WHEN ft.sql_trend = 'DOWN' THEN
        CONCAT(ft.region, ' SQL conversion declining (', CAST(COALESCE(ft.sql_wow_pct, 0) AS STRING), '% WoW). ',
               'Check SDR follow-up rates and lead quality.')
      WHEN ft.sal_trend = 'DOWN' AND ft.sqo_trend = 'DOWN' THEN
        CONCAT(ft.region, ' mid-funnel contraction (SAL ', CAST(COALESCE(ft.sal_wow_pct, 0) AS STRING), '%, SQO ',
               CAST(COALESCE(ft.sqo_wow_pct, 0) AS STRING), '%). Review discovery and qualification process.')
      ELSE NULL
    END AS rca_commentary,
    -- Recommended action
    CASE
      WHEN ft.mql_trend = 'DOWN' AND COALESCE(ft.mql_wow_pct, 0) < -30 THEN
        'Urgent: Audit ad campaigns, check website traffic, review lead source performance.'
      WHEN ft.mql_trend = 'DOWN' THEN
        'Investigate lead gen decline. Consider supplementary campaigns or outbound boost.'
      WHEN ft.sql_trend = 'DOWN' THEN
        'Review SDR performance. Check lead response time and qualification criteria.'
      WHEN ft.sal_trend = 'DOWN' OR ft.sqo_trend = 'DOWN' THEN
        'Coach AEs on discovery and proposal process. Review deal stage progression.'
      ELSE 'Continue monitoring trends.'
    END AS recommended_action
  FROM funnel_trend_analysis ft
  WHERE ft.mql_trend = 'DOWN' OR ft.sql_trend = 'DOWN' OR ft.sal_trend = 'DOWN' OR ft.sqo_trend = 'DOWN'
),

-- ============================================================================
-- GOOGLE ADS RCA - Campaign performance insights
-- ============================================================================
google_ads_rca AS (
  SELECT
    ga.product,
    ga.region,
    ga.impressions,
    ga.clicks,
    ga.ad_spend_usd,
    ga.conversions,
    ga.ctr_pct,
    ga.cpc_usd,
    ga.cpa_usd,
    -- Performance assessment
    CASE
      WHEN ga.ctr_pct >= 3.0 THEN 'STRONG'
      WHEN ga.ctr_pct >= 2.0 THEN 'AVERAGE'
      ELSE 'BELOW_AVERAGE'
    END AS ctr_performance,
    CASE
      WHEN ga.cpa_usd <= 200 THEN 'EFFICIENT'
      WHEN ga.cpa_usd <= 400 THEN 'AVERAGE'
      ELSE 'EXPENSIVE'
    END AS cpa_performance,
    -- Severity
    CASE
      WHEN ga.cpa_usd > 500 THEN 'CRITICAL'
      WHEN ga.cpa_usd > 400 OR ga.ctr_pct < 1.5 THEN 'HIGH'
      WHEN ga.cpa_usd > 300 OR ga.ctr_pct < 2.0 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS severity,
    -- RCA commentary
    CASE
      WHEN ga.cpa_usd > 500 THEN
        CONCAT(ga.product, ' CPA at $', CAST(ROUND(ga.cpa_usd, 0) AS STRING), ' - significantly above $500 threshold. ',
               'Review keyword targeting, ad relevance, and landing page conversion.')
      WHEN ga.ctr_pct < 1.5 AND ga.cpa_usd > 300 THEN
        CONCAT(ga.product, ' CTR low at ', CAST(ROUND(ga.ctr_pct, 2) AS STRING), '% with high CPA ($',
               CAST(ROUND(ga.cpa_usd, 0) AS STRING), '). Ad creative and targeting need optimization.')
      WHEN ga.ctr_pct < 2.0 THEN
        CONCAT(ga.product, ' CTR at ', CAST(ROUND(ga.ctr_pct, 2) AS STRING), '% - below 2% benchmark. ',
               'Test new ad copy and review keyword match types.')
      WHEN ga.cpa_usd > 300 THEN
        CONCAT(ga.product, ' CPA at $', CAST(ROUND(ga.cpa_usd, 0) AS STRING), ' - above target. ',
               'Optimize bidding strategy and negative keywords.')
      WHEN ga.ctr_pct >= 3.0 AND ga.cpa_usd <= 200 THEN
        CONCAT(ga.product, ' campaigns performing well - ', CAST(ROUND(ga.ctr_pct, 2) AS STRING), '% CTR, $',
               CAST(ROUND(ga.cpa_usd, 0) AS STRING), ' CPA. Consider scaling spend.')
      ELSE
        CONCAT(ga.product, ' ads at acceptable efficiency ($', CAST(ROUND(ga.cpa_usd, 0) AS STRING), ' CPA). ',
               'Continue optimizing for incremental gains.')
    END AS rca_commentary,
    -- Recommended action
    CASE
      WHEN ga.cpa_usd > 500 THEN 'Urgent: Pause underperforming keywords, review ad relevance, optimize landing pages.'
      WHEN ga.ctr_pct < 1.5 THEN 'Test new ad creative, refine audience targeting, review keyword quality.'
      WHEN ga.cpa_usd > 300 THEN 'Optimize bidding, add negative keywords, improve landing page conversion.'
      WHEN ga.ctr_pct >= 3.0 AND ga.cpa_usd <= 200 THEN 'Scale budget for high-performing campaigns.'
      ELSE 'Continue A/B testing and incremental optimization.'
    END AS recommended_action
  FROM google_ads_combined ga
),

-- ============================================================================
-- CONSOLIDATED ACTION ITEMS
-- Groups all recommendations by urgency: Immediate, Short-term, Strategic
-- ============================================================================
action_items AS (
  -- IMMEDIATE (This Week) - Critical issues
  SELECT
    'IMMEDIATE' AS urgency,
    'FUNNEL' AS category,
    fri.product,
    fri.region,
    fri.rca_commentary AS issue,
    fri.recommended_action AS action,
    fri.severity
  FROM funnel_rca_insights fri
  WHERE fri.severity IN ('CRITICAL', 'HIGH')

  UNION ALL

  SELECT
    'IMMEDIATE' AS urgency,
    'PIPELINE' AS category,
    pr.product,
    pr.region,
    pr.rca_commentary AS issue,
    pr.recommended_action AS action,
    pr.severity
  FROM pipeline_rca pr
  WHERE pr.severity = 'CRITICAL'

  UNION ALL

  SELECT
    'IMMEDIATE' AS urgency,
    'TREND' AS category,
    tr.product,
    tr.region,
    tr.rca_commentary AS issue,
    tr.recommended_action AS action,
    tr.severity
  FROM trend_rca tr
  WHERE tr.severity = 'CRITICAL' AND tr.rca_commentary IS NOT NULL

  UNION ALL

  SELECT
    'IMMEDIATE' AS urgency,
    'GOOGLE_ADS' AS category,
    gar.product,
    NULL AS region,
    gar.rca_commentary AS issue,
    gar.recommended_action AS action,
    gar.severity
  FROM google_ads_rca gar
  WHERE gar.severity = 'CRITICAL'

  UNION ALL

  -- SHORT-TERM (This Month) - High priority issues
  SELECT
    'SHORT_TERM' AS urgency,
    'PIPELINE' AS category,
    pr.product,
    pr.region,
    pr.rca_commentary AS issue,
    pr.recommended_action AS action,
    pr.severity
  FROM pipeline_rca pr
  WHERE pr.severity = 'HIGH'

  UNION ALL

  SELECT
    'SHORT_TERM' AS urgency,
    'TREND' AS category,
    tr.product,
    tr.region,
    tr.rca_commentary AS issue,
    tr.recommended_action AS action,
    tr.severity
  FROM trend_rca tr
  WHERE tr.severity = 'HIGH' AND tr.rca_commentary IS NOT NULL

  UNION ALL

  SELECT
    'SHORT_TERM' AS urgency,
    'GOOGLE_ADS' AS category,
    gar.product,
    NULL AS region,
    gar.rca_commentary AS issue,
    gar.recommended_action AS action,
    gar.severity
  FROM google_ads_rca gar
  WHERE gar.severity = 'HIGH'

  UNION ALL

  SELECT
    'SHORT_TERM' AS urgency,
    'LOSS_REASON' AS category,
    lrr.product,
    lrr.region,
    lrr.rca_commentary AS issue,
    CASE lrr.action_category
      WHEN 'PRICING_REVIEW' THEN 'Review pricing competitiveness and value proposition messaging.'
      WHEN 'COMPETITIVE_INTEL' THEN 'Analyze competitor positioning and update battlecards.'
      WHEN 'SALES_PROCESS' THEN 'Improve urgency creation and follow-up cadence.'
      WHEN 'PRODUCT_FEEDBACK' THEN 'Escalate feature gaps to Product team for roadmap consideration.'
      ELSE 'Review and categorize for process improvement.'
    END AS action,
    lrr.severity
  FROM loss_reason_rca lrr
  WHERE lrr.severity IN ('CRITICAL', 'HIGH')

  UNION ALL

  -- STRATEGIC (This Quarter) - Medium priority and process improvements
  SELECT
    'STRATEGIC' AS urgency,
    'FUNNEL' AS category,
    fri.product,
    fri.region,
    fri.rca_commentary AS issue,
    fri.recommended_action AS action,
    fri.severity
  FROM funnel_rca_insights fri
  WHERE fri.severity = 'MEDIUM'

  UNION ALL

  SELECT
    'STRATEGIC' AS urgency,
    'PIPELINE' AS category,
    pr.product,
    pr.region,
    pr.rca_commentary AS issue,
    pr.recommended_action AS action,
    pr.severity
  FROM pipeline_rca pr
  WHERE pr.severity = 'MEDIUM'

  UNION ALL

  SELECT
    'STRATEGIC' AS urgency,
    'LOSS_REASON' AS category,
    lrr.product,
    lrr.region,
    lrr.rca_commentary AS issue,
    CASE lrr.action_category
      WHEN 'PRICING_REVIEW' THEN 'Conduct pricing analysis and competitive benchmarking.'
      WHEN 'COMPETITIVE_INTEL' THEN 'Build competitor knowledge base and training materials.'
      WHEN 'SALES_PROCESS' THEN 'Develop sales enablement for objection handling.'
      WHEN 'PRODUCT_FEEDBACK' THEN 'Create product feedback loop for customer-driven roadmap.'
      ELSE 'Implement process improvements based on loss patterns.'
    END AS action,
    lrr.severity
  FROM loss_reason_rca lrr
  WHERE lrr.severity = 'MEDIUM'
),

-- ============================================================================
-- PRODUCT TOTALS
-- ============================================================================
product_summary AS (
  SELECT
    product,
    SUM(q1_target) AS total_q1_target,
    SUM(qtd_target) AS total_qtd_target,
    SUM(qtd_deals) AS total_qtd_deals,
    SUM(qtd_acv) AS total_qtd_acv,
    ROUND(SAFE_DIVIDE(SUM(qtd_acv), SUM(qtd_target)) * 100, 1) AS total_qtd_attainment_pct,
    ROUND(SAFE_DIVIDE(SUM(qtd_acv), SUM(q1_target)) * 100, 1) AS total_q1_progress_pct,
    SUM(qtd_gap) AS total_qtd_gap,
    SUM(qtd_lost_deals) AS total_lost_deals,
    SUM(qtd_lost_acv) AS total_lost_acv,
    ROUND(SAFE_DIVIDE(SUM(qtd_deals), SUM(qtd_deals) + SUM(qtd_lost_deals)) * 100, 1) AS total_win_rate_pct,
    SUM(pipeline_acv) AS total_pipeline_acv,
    ROUND(SAFE_DIVIDE(SUM(pipeline_acv), SUM(q1_target) - SUM(qtd_acv)), 1) AS total_pipeline_coverage_x
  FROM attainment_summary
  GROUP BY product
),

-- ============================================================================
-- GRAND TOTALS
-- ============================================================================
grand_total AS (
  SELECT
    'ALL' AS product,
    SUM(total_q1_target) AS total_q1_target,
    SUM(total_qtd_target) AS total_qtd_target,
    SUM(total_qtd_deals) AS total_qtd_deals,
    SUM(total_qtd_acv) AS total_qtd_acv,
    ROUND(SAFE_DIVIDE(SUM(total_qtd_acv), SUM(total_qtd_target)) * 100, 1) AS total_qtd_attainment_pct,
    ROUND(SAFE_DIVIDE(SUM(total_qtd_acv), SUM(total_q1_target)) * 100, 1) AS total_q1_progress_pct,
    SUM(total_qtd_gap) AS total_qtd_gap,
    SUM(total_lost_deals) AS total_lost_deals,
    SUM(total_lost_acv) AS total_lost_acv,
    ROUND(SAFE_DIVIDE(SUM(total_qtd_deals), SUM(total_qtd_deals) + SUM(total_lost_deals)) * 100, 1) AS total_win_rate_pct,
    SUM(total_pipeline_acv) AS total_pipeline_acv,
    ROUND(SAFE_DIVIDE(SUM(total_pipeline_acv), SUM(total_q1_target) - SUM(total_qtd_acv)), 1) AS total_pipeline_coverage_x
  FROM product_summary
)

-- ============================================================================
-- FINAL OUTPUT: Comprehensive JSON Structure (v2.5.0)
-- Reorganized: Wins first, then Risks, then detailed analysis
-- ============================================================================
SELECT TO_JSON_STRING(STRUCT(
  -- Metadata
  CAST(CURRENT_TIMESTAMP() AS STRING) AS generated_at_utc,
  (SELECT as_of_date FROM params) AS report_date,
  (SELECT percentile FROM params) AS percentile,
  '2.6.1' AS query_version,

  -- Period Info
  STRUCT(
    (SELECT quarter_start FROM params) AS quarter_start,
    (SELECT as_of_date FROM params) AS as_of_date,
    (SELECT qtd_days_elapsed FROM params) AS days_elapsed,
    (SELECT total_quarter_days FROM params) - (SELECT qtd_days_elapsed FROM params) AS days_remaining,
    (SELECT total_quarter_days FROM params) AS total_days,
    ROUND((SELECT qtd_days_elapsed FROM params) / (SELECT total_quarter_days FROM params) * 100, 1) AS quarter_pct_complete
  ) AS period,

  -- Executive Summary Counts (NEW in v2.5.0)
  STRUCT(
    (SELECT COUNT(*) FROM wins_analysis WHERE performance_tier IN ('EXCEPTIONAL', 'ON_TRACK')) AS areas_exceeding_target,
    (SELECT COUNT(*) FROM attainment_summary WHERE rag_status = 'RED') AS areas_at_risk,
    (SELECT COUNT(*) FROM attainment_summary WHERE rag_status = 'YELLOW') AS areas_needing_attention,
    (SELECT COUNT(*) FROM momentum_indicators WHERE momentum_tier IN ('STRONG_MOMENTUM', 'MODERATE_MOMENTUM')) AS areas_with_momentum
  ) AS executive_counts,

  -- Grand Total
  (SELECT AS STRUCT * FROM grand_total) AS grand_total,

  -- Product Summaries
  STRUCT(
    (SELECT AS STRUCT * FROM product_summary WHERE product = 'POR') AS POR,
    (SELECT AS STRUCT * FROM product_summary WHERE product = 'R360') AS R360
  ) AS product_totals,

  -- ============================================================================
  -- WINS & BRIGHT SPOTS (NEW in v2.5.0 - Placed BEFORE risks)
  -- ============================================================================
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, category, qtd_attainment_pct, qtd_acv, qtd_target,
                       performance_tier, success_commentary, contributing_factor, pipeline_coverage_x, win_rate_pct
      FROM wins_analysis
      WHERE product = 'POR'
      ORDER BY qtd_attainment_pct DESC
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, category, qtd_attainment_pct, qtd_acv, qtd_target,
                       performance_tier, success_commentary, contributing_factor, pipeline_coverage_x, win_rate_pct
      FROM wins_analysis
      WHERE product = 'R360'
      ORDER BY qtd_attainment_pct DESC
    ) AS R360
  ) AS wins_bright_spots,

  -- Momentum Indicators (NEW in v2.5.0)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, momentum_tier, positive_momentum_count, momentum_commentary,
                       mql_trend, mql_wow_pct, sql_trend, sql_wow_pct
      FROM momentum_indicators
      WHERE product = 'POR'
      ORDER BY positive_momentum_count DESC
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, momentum_tier, positive_momentum_count, momentum_commentary,
                       mql_trend, mql_wow_pct, sql_trend, sql_wow_pct
      FROM momentum_indicators
      WHERE product = 'R360'
      ORDER BY positive_momentum_count DESC
    ) AS R360
  ) AS momentum_indicators,

  -- ============================================================================
  -- RISK POCKETS (Existing - enhanced)
  -- ============================================================================
  -- Detailed Attainment by Region/Category
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM attainment_summary WHERE product = 'POR' ORDER BY region, category) AS POR,
    ARRAY(SELECT AS STRUCT * FROM attainment_summary WHERE product = 'R360' ORDER BY region, category) AS R360
  ) AS attainment_detail,

  -- Top Risk Pockets (sorted by gap)
  ARRAY(
    SELECT AS STRUCT
      product, region, category, qtd_target, qtd_acv, qtd_gap, qtd_attainment_pct, rag_status,
      win_rate_pct, pipeline_acv, pipeline_coverage_x
    FROM attainment_summary
    WHERE qtd_gap < 0
    ORDER BY qtd_gap ASC
    LIMIT 10
  ) AS top_risk_pockets,

  -- Funnel Pacing (Inbound)
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM funnel_pacing WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM funnel_pacing WHERE product = 'R360' ORDER BY region) AS R360
  ) AS funnel_pacing,

  -- Source Attainment (ACV by source channel) - NEW in v2.6.1
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM source_attainment WHERE product = 'POR' ORDER BY region, source) AS POR,
    ARRAY(SELECT AS STRUCT * FROM source_attainment WHERE product = 'R360' ORDER BY region, source) AS R360
  ) AS source_attainment,

  -- Funnel Health Analysis (NEW in v2.4.0)
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM funnel_health_analysis WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM funnel_health_analysis WHERE product = 'R360' ORDER BY region) AS R360
  ) AS funnel_health,

  -- Funnel Attainment by Category (NEW BUSINESS, EXPANSION, MIGRATION) - Updated v2.7.0
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM funnel_attainment_by_category WHERE product = 'POR' ORDER BY category, region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM funnel_attainment_by_category WHERE product = 'R360' ORDER BY category, region) AS R360
  ) AS funnel_by_category,

  -- Funnel Attainment by Category + Source - REFACTORED v2.7.0 to include Category dimension
  -- Now shows Source attainment WITHIN each Category (e.g., NEW BUSINESS × INBOUND, EXPANSION × AM SOURCED)
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM funnel_attainment_by_source WHERE product = 'POR' ORDER BY category, source, region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM funnel_attainment_by_source WHERE product = 'R360' ORDER BY category, source, region) AS R360
  ) AS funnel_by_source,

  -- Funnel RCA Insights (NEW in v2.4.0)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, primary_bottleneck, severity, rca_commentary, recommended_action,
                       mql_pacing_pct, sql_pacing_pct, sal_pacing_pct, sqo_pacing_pct
      FROM funnel_rca_insights
      WHERE product = 'POR'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        region
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, primary_bottleneck, severity, rca_commentary, recommended_action,
                       mql_pacing_pct, sql_pacing_pct, sal_pacing_pct, sqo_pacing_pct
      FROM funnel_rca_insights
      WHERE product = 'R360'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        region
    ) AS R360
  ) AS funnel_rca_insights,

  -- Funnel Trend Analysis (WoW Comparison) - NEW in v2.4.1
  STRUCT(
    ARRAY(SELECT AS STRUCT * FROM funnel_trend_analysis WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT * FROM funnel_trend_analysis WHERE product = 'R360' ORDER BY region) AS R360
  ) AS funnel_trends,

  -- Loss Reason RCA Analysis - NEW in v2.4.1
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, loss_reason, deal_count, lost_acv, pct_of_regional_loss,
                       rca_commentary, severity, action_category
      FROM loss_reason_rca
      WHERE product = 'POR'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        region, rank
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, loss_reason, deal_count, lost_acv, pct_of_regional_loss,
                       rca_commentary, severity, action_category
      FROM loss_reason_rca
      WHERE product = 'R360'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        region, rank
    ) AS R360
  ) AS loss_reason_rca,

  -- Loss Reasons Analysis
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, loss_reason, deal_count, lost_acv
      FROM loss_reasons_ranked
      WHERE product = 'POR' AND rank <= 5
      ORDER BY product, region, rank
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, loss_reason, deal_count, lost_acv
      FROM loss_reasons_ranked
      WHERE product = 'R360' AND rank <= 5
      ORDER BY product, region, rank
    ) AS R360
  ) AS loss_reasons,

  -- Competitor Analysis
  ARRAY(
    SELECT AS STRUCT *
    FROM competitor_losses
    ORDER BY lost_acv DESC
    LIMIT 10
  ) AS competitor_losses,

  -- Google Ads Summary (by region)
  STRUCT(
    ARRAY(SELECT AS STRUCT * EXCEPT(product) FROM google_ads_combined WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT * EXCEPT(product) FROM google_ads_combined WHERE product = 'R360' ORDER BY region) AS R360
  ) AS google_ads,

  -- ============================================================================
  -- NEW SECTIONS IN v2.5.0
  -- ============================================================================

  -- Pipeline RCA (NEW in v2.5.0)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, category, pipeline_acv, pipeline_coverage_x, pipeline_opps,
                       pipeline_avg_age_days, pipeline_health, pipeline_age_status, remaining_target,
                       rca_commentary, severity, recommended_action
      FROM pipeline_rca
      WHERE product = 'POR'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        region
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, category, pipeline_acv, pipeline_coverage_x, pipeline_opps,
                       pipeline_avg_age_days, pipeline_health, pipeline_age_status, remaining_target,
                       rca_commentary, severity, recommended_action
      FROM pipeline_rca
      WHERE product = 'R360'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        region
    ) AS R360
  ) AS pipeline_rca,

  -- Trend RCA (NEW in v2.5.0)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT product, region, mql_declining, sql_declining, sal_declining, sqo_declining,
                       mql_wow_pct, sql_wow_pct, sal_wow_pct, sqo_wow_pct, declining_stage_count,
                       severity, rca_commentary, recommended_action
      FROM trend_rca
      WHERE product = 'POR' AND rca_commentary IS NOT NULL
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT product, region, mql_declining, sql_declining, sal_declining, sqo_declining,
                       mql_wow_pct, sql_wow_pct, sal_wow_pct, sqo_wow_pct, declining_stage_count,
                       severity, rca_commentary, recommended_action
      FROM trend_rca
      WHERE product = 'R360' AND rca_commentary IS NOT NULL
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END
    ) AS R360
  ) AS trend_rca,

  -- Google Ads RCA (NEW in v2.5.0) - by region
  STRUCT(
    ARRAY(SELECT AS STRUCT product, region, ctr_pct, cpc_usd, cpa_usd, ctr_performance, cpa_performance,
                      severity, rca_commentary, recommended_action
     FROM google_ads_rca WHERE product = 'POR' ORDER BY region) AS POR,
    ARRAY(SELECT AS STRUCT product, region, ctr_pct, cpc_usd, cpa_usd, ctr_performance, cpa_performance,
                      severity, rca_commentary, recommended_action
     FROM google_ads_rca WHERE product = 'R360' ORDER BY region) AS R360
  ) AS google_ads_rca,

  -- Consolidated Action Items (NEW in v2.5.0)
  STRUCT(
    -- Immediate (This Week)
    ARRAY(
      SELECT AS STRUCT urgency, category, product, region, issue, action, severity
      FROM action_items
      WHERE urgency = 'IMMEDIATE'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END,
        product, region
    ) AS immediate,
    -- Short-term (This Month)
    ARRAY(
      SELECT AS STRUCT urgency, category, product, region, issue, action, severity
      FROM action_items
      WHERE urgency = 'SHORT_TERM'
      ORDER BY
        CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 ELSE 3 END,
        product, region
    ) AS short_term,
    -- Strategic (This Quarter)
    ARRAY(
      SELECT AS STRUCT urgency, category, product, region, issue, action, severity
      FROM action_items
      WHERE urgency = 'STRATEGIC'
      ORDER BY product, region
    ) AS strategic
  ) AS action_items,

  -- Quarterly Targets Reference
  STRUCT(
    (SELECT SUM(q1_target) FROM q1_targets WHERE product = 'POR') AS POR_Q1_target,
    (SELECT SUM(q1_target) FROM q1_targets WHERE product = 'R360') AS R360_Q1_target,
    (SELECT SUM(q1_target) FROM q1_targets) AS combined_Q1_target
  ) AS quarterly_targets,

  -- ============================================================================
  -- DEAL-LEVEL DATA (for Opportunities table)
  -- ============================================================================

  -- Won Deals (QTD)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT opportunity_id, account_name, opportunity_name, product, region, category,
                       deal_type, acv, close_date, stage, is_won, is_closed, loss_reason,
                       source, owner_name, owner_id, salesforce_url
      FROM won_deals_detail
      WHERE product = 'POR'
      ORDER BY acv DESC
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT opportunity_id, account_name, opportunity_name, product, region, category,
                       deal_type, acv, close_date, stage, is_won, is_closed, loss_reason,
                       source, owner_name, owner_id, salesforce_url
      FROM won_deals_detail
      WHERE product = 'R360'
      ORDER BY acv DESC
    ) AS R360
  ) AS won_deals,

  -- Lost Deals (QTD)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT opportunity_id, account_name, opportunity_name, product, region, category,
                       deal_type, acv, close_date, stage, is_won, is_closed, loss_reason,
                       source, owner_name, owner_id, salesforce_url
      FROM lost_deals_detail
      WHERE product = 'POR'
      ORDER BY acv DESC
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT opportunity_id, account_name, opportunity_name, product, region, category,
                       deal_type, acv, close_date, stage, is_won, is_closed, loss_reason,
                       source, owner_name, owner_id, salesforce_url
      FROM lost_deals_detail
      WHERE product = 'R360'
      ORDER BY acv DESC
    ) AS R360
  ) AS lost_deals,

  -- Pipeline Deals (Open)
  STRUCT(
    ARRAY(
      SELECT AS STRUCT opportunity_id, account_name, opportunity_name, product, region, category,
                       deal_type, acv, close_date, stage, is_won, is_closed, loss_reason,
                       source, owner_name, owner_id, salesforce_url
      FROM pipeline_deals_detail
      WHERE product = 'POR'
      ORDER BY acv DESC
    ) AS POR,
    ARRAY(
      SELECT AS STRUCT opportunity_id, account_name, opportunity_name, product, region, category,
                       deal_type, acv, close_date, stage, is_won, is_closed, loss_reason,
                       source, owner_name, owner_id, salesforce_url
      FROM pipeline_deals_detail
      WHERE product = 'R360'
      ORDER BY acv DESC
    ) AS R360
  ) AS pipeline_deals

)) AS comprehensive_risk_analysis_json;
