-- ============================================================================
-- DATA RECONCILIATION QUERY
-- Version: 2.0.0
-- Created: 2026-01-12
-- Updated: 2026-01-12
-- Purpose: Verify Q1 2026 won deals and targets between sources
-- ============================================================================
--
-- This query verifies data consistency between:
-- 1. BigQuery sfdc.Opportunity table
-- 2. BigQuery sfdc.OpportunityViewTable
-- 3. Salesforce direct query (run in SF for comparison)
-- 4. Excel "2026 Bookings Plan Draft.xlsx" targets
-- 5. BigQuery StrategicOperatingPlan targets
--
-- KEY LEARNINGS (2026-01-12):
-- - FunnelType and Source are SEPARATE dimensions
-- - FunnelTypes: NEW LOGO, EXPANSION, MIGRATION, RENEWAL (only!)
-- - Source: INBOUND, OUTBOUND, AE SOURCED, AM SOURCED, TRADESHOW, PARTNERSHIPS
-- - "INBOUND" is NOT a FunnelType! (SOP incorrectly has "R360 INBOUND" as FunnelType)
-- - Excel "Plan by Month" is source of truth for targets (not BigQuery SOP)
-- - SOP has $3,699 discrepancy for AMER R360 SMB ($407K vs Excel $403K)
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: R360 WON DEALS VERIFICATION (BigQuery sfdc.Opportunity)
-- ============================================================================
-- Run this in BigQuery to get R360 won deals

SELECT
  'R360' AS product,
  type,
  sales_rep_division__c AS division,
  sdr_source__c AS sdr_source,
  COUNT(*) AS deal_count,
  ROUND(SUM(acv_in_usd__c), 2) AS total_acv_usd,
  ROUND(AVG(acv_in_usd__c), 2) AS avg_acv_usd
FROM `data-analytics-306119.sfdc.Opportunity`
WHERE r360_record__c = true
  AND stagename = 'Closed Won'
  AND closedate >= '2026-01-01'
  AND closedate < '2026-04-01'
  AND type NOT IN ('Renewal', 'Credit Card', 'Consulting')
GROUP BY type, sales_rep_division__c, sdr_source__c
ORDER BY type, sales_rep_division__c, sdr_source__c;

-- Expected Output Format:
-- +----------+-----------+-----------+------------+---------------+
-- | type     | division  | sdr_source| deal_count | total_acv_usd |
-- +----------+-----------+-----------+------------+---------------+
-- | New Bus  | UK        | Inbound   |     X      |     $X,XXX    |
-- | New Bus  | US        | Inbound   |     X      |     $X,XXX    |
-- | Existing | US        | null      |     X      |     $X,XXX    |
-- +----------+-----------+-----------+------------+---------------+

-- ============================================================================
-- SECTION 2: POR WON DEALS VERIFICATION (BigQuery sfdc.Opportunity)
-- ============================================================================
-- Run this in BigQuery to get POR won deals

SELECT
  'POR' AS product,
  type,
  sales_rep_division__c AS division,
  sdr_source__c AS sdr_source,
  COUNT(*) AS deal_count,
  ROUND(SUM(acv_in_usd__c), 2) AS total_acv_usd,
  ROUND(AVG(acv_in_usd__c), 2) AS avg_acv_usd
FROM `data-analytics-306119.sfdc.Opportunity`
WHERE por_record__c = true
  AND stagename = 'Closed Won'
  AND closedate >= '2026-01-01'
  AND closedate < '2026-04-01'
  AND type NOT IN ('Renewal', 'Credit Card', 'Consulting')
GROUP BY type, sales_rep_division__c, sdr_source__c
ORDER BY type, sales_rep_division__c, sdr_source__c;

-- ============================================================================
-- SECTION 3: COMPARE WITH OpportunityViewTable
-- ============================================================================
-- This validates that sfdc.Opportunity matches sfdc.OpportunityViewTable

SELECT
  'R360' AS product,
  Type,
  Division,
  SDRSource,
  COUNT(*) AS deal_count,
  ROUND(SUM(ACV), 2) AS total_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE r360_record__c = true
  AND Won = true
  AND CloseDate >= '2026-01-01'
  AND CloseDate < '2026-04-01'
  AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
GROUP BY Type, Division, SDRSource
ORDER BY Type, Division, SDRSource;

-- ============================================================================
-- SECTION 4: DETAILED DEAL LIST FOR MANUAL VERIFICATION
-- ============================================================================
-- Use this to spot-check individual deals

SELECT
  name,
  id,
  type,
  stagename,
  closedate,
  sales_rep_division__c AS division,
  sdr_source__c AS sdr_source,
  acv_in_usd__c AS acv_usd,
  annual_contract_value__c AS acv_local,
  currencyisocode,
  r360_record__c,
  por_record__c
FROM `data-analytics-306119.sfdc.Opportunity`
WHERE (r360_record__c = true OR por_record__c = true)
  AND stagename = 'Closed Won'
  AND closedate >= '2026-01-01'
  AND closedate < '2026-04-01'
  AND type NOT IN ('Renewal', 'Credit Card', 'Consulting')
ORDER BY closedate DESC, name;

-- ============================================================================
-- SECTION 5: SALESFORCE DIRECT QUERY (Run in Salesforce SOQL)
-- ============================================================================
-- Copy this to Salesforce Developer Console to compare

/*
SELECT
  Name,
  Id,
  Type,
  StageName,
  CloseDate,
  Sales_Rep_Division__c,
  SDR_Source__c,
  ACV_in_USD__c,
  Annual_Contract_Value__c,
  CurrencyIsoCode,
  R360_Record__c,
  POR_Record__c
FROM Opportunity
WHERE (R360_Record__c = true OR POR_Record__c = true)
  AND StageName = 'Closed Won'
  AND CloseDate >= 2026-01-01
  AND CloseDate < 2026-04-01
  AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
ORDER BY CloseDate DESC
*/

-- ============================================================================
-- SECTION 6: FUNNEL METRICS FROM MARKETING TABLES
-- ============================================================================
-- R360 Marketing Funnel (MQL/SQL/SQO counts)

SELECT
  Division,
  SDRSource,
  SUM(CASE WHEN Stage = 'MQL' THEN 1 ELSE 0 END) AS mql_count,
  SUM(CASE WHEN Stage = 'SQL' THEN 1 ELSE 0 END) AS sql_count,
  SUM(CASE WHEN Stage = 'SAL' THEN 1 ELSE 0 END) AS sal_count,
  SUM(CASE WHEN Stage = 'SQO' THEN 1 ELSE 0 END) AS sqo_count,
  SUM(CASE WHEN Stage = 'Won' THEN 1 ELSE 0 END) AS won_count
FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
WHERE StageDate >= '2026-01-01' AND StageDate < '2026-04-01'
GROUP BY Division, SDRSource
ORDER BY Division, SDRSource;

-- POR Marketing Funnel
SELECT
  Division,
  SDRSource,
  SUM(CASE WHEN Stage = 'MQL' THEN 1 ELSE 0 END) AS mql_count,
  SUM(CASE WHEN Stage = 'SQL' THEN 1 ELSE 0 END) AS sql_count,
  SUM(CASE WHEN Stage = 'SAL' THEN 1 ELSE 0 END) AS sal_count,
  SUM(CASE WHEN Stage = 'SQO' THEN 1 ELSE 0 END) AS sqo_count,
  SUM(CASE WHEN Stage = 'Won' THEN 1 ELSE 0 END) AS won_count
FROM `data-analytics-306119.MarketingFunnel.PORInboundFunnel`
WHERE StageDate >= '2026-01-01' AND StageDate < '2026-04-01'
GROUP BY Division, SDRSource
ORDER BY Division, SDRSource;

-- ============================================================================
-- SECTION 7: USER-PROVIDED NUMBERS FOR COMPARISON
-- ============================================================================
--
-- R360 Numbers (provided by user):
-- +------------------------+-------+------------+
-- | Category               | Deals | ACV (USD)  |
-- +------------------------+-------+------------+
-- | New Business Global    |     7 |   $62,982  |
-- | New Business UK        |     2 |   $30,985  |
-- | AMER Inbound           |     3 |   $21,645  |
-- | Expansion              |    11 |   $16,980  |
-- +------------------------+-------+------------+
--
-- R360 Funnel (user provided):
-- MQL: 27, SQL: 11, SQO: 8, Won: 1 (New Business)
--
-- ============================================================================
-- SECTION 8: TARGET VERIFICATION (Excel vs BigQuery SOP)
-- ============================================================================
-- Compare targets from Excel "Plan by Month" vs BigQuery StrategicOperatingPlan

-- R360 Targets from SOP (combining R360 INBOUND + R360 NEW LOGO into NEW LOGO)
SELECT
  'R360' AS product,
  Region,
  CASE
    WHEN FunnelType IN ('R360 NEW LOGO', 'R360 INBOUND') THEN 'NEW LOGO'
    WHEN FunnelType = 'R360 EXPANSION' THEN 'EXPANSION'
    ELSE FunnelType
  END AS Category,
  ROUND(SUM(CASE WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31' THEN Target_ACV ELSE 0 END), 0) AS sop_q1_target
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType = 'R360'
  AND Percentile = 'P50'
  AND OpportunityType != 'RENEWAL'
GROUP BY Region, Category
HAVING sop_q1_target > 0
ORDER BY Region, Category;

-- Expected Excel targets for comparison:
-- +--------+-----------+---------------+---------------+------------+
-- | Region | Category  | SOP Q1 Target | Excel Q1 Tgt  | Difference |
-- +--------+-----------+---------------+---------------+------------+
-- | AMER   | NEW LOGO  |      $528,859 |     $525,160  |    +$3,699 |
-- | AMER   | EXPANSION |      $210,000 |     $210,000  |         $0 |
-- | APAC   | NEW LOGO  |       $20,400 |      $20,400  |         $0 |
-- | APAC   | EXPANSION |          $850 |         $850  |         $0 |
-- | EMEA   | NEW LOGO  |      $112,200 |     $112,200  |         $0 |
-- | EMEA   | EXPANSION |           N/A |           $0  |        N/A |
-- +--------+-----------+---------------+---------------+------------+
-- | R360 TOTAL        |      $872,309 |     $868,610  |    +$3,699 |
-- +--------+-----------+---------------+---------------+------------+

-- POR Targets from SOP (combining INBOUND + NEW LOGO)
SELECT
  'POR' AS product,
  Region,
  CASE
    WHEN FunnelType IN ('NEW LOGO', 'INBOUND') THEN 'NEW LOGO'
    ELSE FunnelType
  END AS Category,
  ROUND(SUM(CASE WHEN TargetDate BETWEEN '2026-01-01' AND '2026-03-31' THEN Target_ACV ELSE 0 END), 0) AS sop_q1_target
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType = 'POR'
  AND Percentile = 'P50'
  AND OpportunityType != 'RENEWAL'
GROUP BY Region, Category
HAVING sop_q1_target > 0
ORDER BY Region, Category;

-- Expected Excel targets for POR:
-- +--------+-----------+---------------+
-- | Region | Category  | Excel Q1 Tgt  |
-- +--------+-----------+---------------+
-- | AMER   | NEW LOGO  |     $524,260  |
-- | AMER   | MIGRATION |     $264,000  |
-- | AMER   | EXPANSION |     $832,000  |
-- | APAC   | NEW LOGO  |      $94,000  |
-- | APAC   | MIGRATION |      $58,650  |
-- | APAC   | EXPANSION |      $46,200  |
-- | EMEA   | NEW LOGO  |     $261,800  |
-- | EMEA   | MIGRATION |     $273,600  |
-- | EMEA   | EXPANSION |     $304,800  |
-- +--------+-----------+---------------+
-- | POR TOTAL         |   $2,659,310  |
-- +--------+-----------+---------------+

-- ============================================================================
-- SECTION 9: DISCREPANCY ANALYSIS NOTES
-- ============================================================================
--
-- POTENTIAL CAUSES OF DISCREPANCY:
-- 1. r360_record__c vs por_record__c flag mismatch
-- 2. Close date timing (deals closing on/after Jan 12 vs before)
-- 3. ACV field differences (acv_in_usd__c vs Annual_Contract_Value__c)
-- 4. Currency conversion timing
-- 5. Opportunity type classification differences
-- 6. Division/SDRSource null handling
-- 7. FunnelType "R360 INBOUND" not combined with "R360 NEW LOGO" (causes undercounting)
-- 8. Excel vs SOP target discrepancy ($3,699 for AMER R360 SMB)
--
-- VERIFICATION STEPS:
-- 1. Run Section 1 & 2 in BigQuery - compare totals
-- 2. Run Section 5 in Salesforce - compare with BQ results
-- 3. If discrepancy exists, run Section 4 to identify specific deals
-- 4. Cross-reference deal IDs between SF and BQ
-- 5. Run Section 8 to verify targets match Excel
--
-- ============================================================================

-- ============================================================================
-- SECTION 10: EXCEL TARGET REFERENCE (Source of Truth)
-- ============================================================================
-- Source: 2026 Bookings Plan Draft.xlsx (Plan by Month sheet)
-- DO NOT USE: "Copy of Plan by Month QA" sheet (outdated, lower values)
--
-- R360 Q1 2026 TARGETS (Excl. Renewals):
-- +--------+-----------+-------------+----------------------------------+
-- | Region | Category  | Q1 Target   | Notes                            |
-- +--------+-----------+-------------+----------------------------------+
-- | AMER   | NEW LOGO  |   $525,160  | SMB $403,560 + Strat $121,600    |
-- | AMER   | EXPANSION |   $210,000  |                                  |
-- | APAC   | NEW LOGO  |    $20,400  |                                  |
-- | APAC   | EXPANSION |       $850  |                                  |
-- | EMEA   | NEW LOGO  |   $112,200  | UK $112,200 + EU $0              |
-- | EMEA   | EXPANSION |         $0  |                                  |
-- +--------+-----------+-------------+----------------------------------+
-- | TOTAL  |           |   $868,610  |                                  |
-- +--------+-----------+-------------+----------------------------------+
--
-- POR Q1 2026 TARGETS (Excl. Renewals):
-- +--------+-----------+-------------+----------------------------------+
-- | Region | Category  | Q1 Target   | Notes                            |
-- +--------+-----------+-------------+----------------------------------+
-- | AMER   | NEW LOGO  |   $524,260  | SMB $358,160 + Strat $166,100    |
-- | AMER   | MIGRATION |   $264,000  |                                  |
-- | AMER   | EXPANSION |   $832,000  |                                  |
-- | APAC   | NEW LOGO  |    $94,000  |                                  |
-- | APAC   | MIGRATION |    $58,650  |                                  |
-- | APAC   | EXPANSION |    $46,200  |                                  |
-- | EMEA   | NEW LOGO  |   $261,800  | SMB $178,200 + Strat $83,600     |
-- | EMEA   | MIGRATION |   $273,600  |                                  |
-- | EMEA   | EXPANSION |   $304,800  |                                  |
-- +--------+-----------+-------------+----------------------------------+
-- | TOTAL  |           | $2,659,310  |                                  |
-- +--------+-----------+-------------+----------------------------------+
--
-- ============================================================================
