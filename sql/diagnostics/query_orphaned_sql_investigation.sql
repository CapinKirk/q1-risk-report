-- ============================================================================
-- ORPHANED SQL RECORDS INVESTIGATION
-- Version: 1.0.0
-- Created: 2026-01-14
-- Purpose: Investigate SQL records without OpportunityID to determine if
--          opportunities exist in Salesforce but aren't properly linked
-- ============================================================================
--
-- CONTEXT:
-- Previous analysis found 23 SQL records with no OpportunityID, all with Source = None.
-- 10 of these (7 SAL + 3 SQO) progressed past SQL stage, meaning an opportunity
-- SHOULD definitely exist for them.
--
-- INVESTIGATION GOALS:
-- 1. Identify all SQL records without OpportunityID
-- 2. Check if matching opportunities exist in OpportunityViewTable
-- 3. Determine root cause of missing linkage
--
-- ============================================================================

WITH params AS (
  SELECT
    DATE('2026-01-01') AS start_date,
    DATE('2026-01-15') AS end_date  -- Adjust as needed
),

-- ============================================================================
-- SECTION 1: SQL RECORDS WITHOUT OPPORTUNITY ID
-- Find all records that have SQL_DT but no OpportunityID
-- ============================================================================
sql_without_opportunity AS (
  SELECT
    f.LeadId,
    f.ContactId,
    f.LeadEmail,
    f.ContactEmail,
    COALESCE(f.LeadEmail, f.ContactEmail) AS email,
    f.Company,
    f.FirstName,
    f.LastName,
    f.Division,
    CASE f.Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    f.OpportunityID,
    f.OpportunityName,
    CAST(f.SQL_DT AS DATE) AS sql_date,
    CAST(f.SAL_DT AS DATE) AS sal_date,
    CAST(f.SQO_DT AS DATE) AS sqo_date,
    f.SDRSource AS funnel_sdr_source,
    f.Source AS funnel_source,
    -- Determine furthest funnel stage reached
    CASE
      WHEN f.SQO_DT IS NOT NULL THEN 'SQO'
      WHEN f.SAL_DT IS NOT NULL THEN 'SAL'
      WHEN f.SQL_DT IS NOT NULL THEN 'SQL'
      ELSE 'UNKNOWN'
    END AS furthest_stage
  FROM `data-analytics-306119.MarketingFunnel.InboundFunnel` f, params
  WHERE f.SQL_DT IS NOT NULL
    AND CAST(f.SQL_DT AS DATE) >= params.start_date
    AND CAST(f.SQL_DT AS DATE) <= params.end_date
    AND (f.OpportunityID IS NULL OR TRIM(f.OpportunityID) = '')
    AND f.Division IN ('US', 'UK', 'AU')
    AND (f.SpiralyzeTest IS NULL OR f.SpiralyzeTest = false)
    AND (f.MQL_Reverted IS NULL OR f.MQL_Reverted = false)
),

-- ============================================================================
-- SECTION 2: ALL OPPORTUNITIES IN DATE RANGE
-- Get all opportunities that closed or were created in the same period
-- ============================================================================
opportunities_in_range AS (
  SELECT
    o.Id AS opportunity_id,
    o.Name AS opportunity_name,
    o.AccountName,
    o.ContactEmail AS opp_contact_email,
    o.Division,
    CASE o.Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
    END AS region,
    o.Type,
    o.StageName,
    o.CloseDate,
    o.CreatedDate,
    o.ACV,
    o.SDRSource,
    o.POR_SDRSource,
    o.LeadSource,
    o.Won,
    o.por_record__c
  FROM `data-analytics-306119.sfdc.OpportunityViewTable` o, params
  WHERE o.por_record__c = true  -- POR only since InboundFunnel is POR
    AND o.Division IN ('US', 'UK', 'AU')
    AND (
      -- Created in date range
      (CAST(o.CreatedDate AS DATE) >= params.start_date AND CAST(o.CreatedDate AS DATE) <= params.end_date)
      -- OR Closed in date range
      OR (o.CloseDate >= params.start_date AND o.CloseDate <= params.end_date)
    )
),

-- ============================================================================
-- SECTION 3: ATTEMPT TO MATCH BY EMAIL
-- Check if orphaned SQL records have matching opportunities by email
-- ============================================================================
email_match_attempt AS (
  SELECT
    s.*,
    o.opportunity_id AS matched_opp_id,
    o.opportunity_name AS matched_opp_name,
    o.AccountName AS matched_account,
    o.Type AS matched_type,
    o.StageName AS matched_stage,
    o.ACV AS matched_acv,
    o.SDRSource AS matched_sdr_source,
    o.Won AS matched_won,
    o.CloseDate AS matched_close_date,
    CASE
      WHEN o.opportunity_id IS NOT NULL THEN 'EMAIL_MATCH_FOUND'
      ELSE 'NO_MATCH'
    END AS match_status
  FROM sql_without_opportunity s
  LEFT JOIN opportunities_in_range o
    ON LOWER(s.email) = LOWER(o.opp_contact_email)
),

-- ============================================================================
-- SECTION 4: ATTEMPT TO MATCH BY COMPANY NAME (fuzzy)
-- For records without email match, try company name
-- ============================================================================
company_match_attempt AS (
  SELECT
    e.*,
    CASE
      WHEN e.match_status = 'EMAIL_MATCH_FOUND' THEN 'EMAIL_MATCH_FOUND'
      WHEN o2.opportunity_id IS NOT NULL THEN 'COMPANY_MATCH_FOUND'
      ELSE 'NO_MATCH'
    END AS final_match_status,
    COALESCE(e.matched_opp_id, o2.opportunity_id) AS final_opp_id,
    COALESCE(e.matched_opp_name, o2.opportunity_name) AS final_opp_name,
    COALESCE(e.matched_account, o2.AccountName) AS final_account,
    COALESCE(e.matched_type, o2.Type) AS final_type,
    COALESCE(e.matched_stage, o2.StageName) AS final_stage,
    COALESCE(e.matched_acv, o2.ACV) AS final_acv
  FROM email_match_attempt e
  LEFT JOIN opportunities_in_range o2
    ON e.match_status = 'NO_MATCH'
    AND e.region = o2.region
    AND LOWER(e.Company) = LOWER(o2.AccountName)
),

-- ============================================================================
-- SECTION 5: SUMMARY OF ORPHANED RECORDS
-- ============================================================================
orphan_summary AS (
  SELECT
    furthest_stage,
    COUNT(*) AS record_count,
    SUM(CASE WHEN final_match_status = 'EMAIL_MATCH_FOUND' THEN 1 ELSE 0 END) AS email_matched,
    SUM(CASE WHEN final_match_status = 'COMPANY_MATCH_FOUND' THEN 1 ELSE 0 END) AS company_matched,
    SUM(CASE WHEN final_match_status = 'NO_MATCH' THEN 1 ELSE 0 END) AS no_match
  FROM company_match_attempt
  GROUP BY furthest_stage
)

-- ============================================================================
-- OUTPUT OPTIONS (uncomment the one you want to run)
-- ============================================================================

-- Option A: Summary by funnel stage
SELECT
  furthest_stage,
  record_count AS orphaned_sql_records,
  email_matched AS found_by_email,
  company_matched AS found_by_company,
  no_match AS truly_orphaned,
  ROUND(SAFE_DIVIDE(email_matched + company_matched, record_count) * 100, 1) AS match_rate_pct
FROM orphan_summary
ORDER BY
  CASE furthest_stage
    WHEN 'SQL' THEN 1
    WHEN 'SAL' THEN 2
    WHEN 'SQO' THEN 3
  END;

-- Option B: Full detail of orphaned records with match attempts
-- SELECT
--   LeadId,
--   ContactId,
--   email,
--   Company,
--   FirstName,
--   LastName,
--   region,
--   sql_date,
--   sal_date,
--   sqo_date,
--   furthest_stage,
--   funnel_sdr_source,
--   funnel_source,
--   final_match_status,
--   final_opp_id,
--   final_opp_name,
--   final_account,
--   final_type,
--   final_stage,
--   final_acv
-- FROM company_match_attempt
-- ORDER BY furthest_stage DESC, sql_date;

-- Option C: Records that SHOULD have opportunities (SAL/SQO stage) but don't match
-- SELECT *
-- FROM company_match_attempt
-- WHERE furthest_stage IN ('SAL', 'SQO')
--   AND final_match_status = 'NO_MATCH'
-- ORDER BY sql_date;
