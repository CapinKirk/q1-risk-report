-- ============================================================================
-- R360 RISK ANALYSIS QUERY
-- Version: 4.2.0
-- Last Updated: 2026-01-12
-- Report Period: Q1 2026 QTD (January 1-12, 2026)
-- Scope: EXCLUDES RENEWALS (New Logo + Expansion only)
-- ============================================================================
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║                         EXECUTIVE SUMMARY                                 ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║ R360 at 38.7% QTD attainment - CRITICALLY BEHIND target pace.            ║
-- ║ AMER New Logo at 32.7% attainment - primary risk pocket ($47.1K gap).    ║
-- ║ EMEA New Logo at 16.2% attainment - only 1 deal closed.                  ║
-- ║ APAC has ZERO bookings YTD across all categories.                        ║
-- ║ AMER Expansion at 69.6% - only category near pace.                       ║
-- ║ KEY ISSUE: Loss reasons show "Not Ready to Buy" as top cause (46% ACV).  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║                ATTAINMENT SCORECARD (QTD) - EXCL. RENEWALS               ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║ RAG Thresholds: 🟢 ≥90% | 🟡 70-89% | 🔴 <70%                            ║
-- ║ QTD = 12 days / 90 days = 13.33% of Q1 target                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- +--------+------------+------------+---------+------------+---------+--------+
-- | Region | Category   | Q1 Target  | QTD Tgt | Actual ACV | Attain% | Status |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | AMER   | New Logo   |   $525,160 | $70,021 |    $22,932 |   32.7% | 🔴 RED  |
-- | AMER   | Expansion  |   $210,000 | $28,000 |    $19,500 |   69.6% | 🟡 YELLOW|
-- +--------+------------+------------+---------+------------+---------+--------+
-- | AMER SUBTOTAL       |   $735,160 | $98,021 |    $42,432 |   43.3% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | EMEA   | New Logo   |   $112,200 | $14,960 |     $2,430 |   16.2% | 🔴 RED  |
-- | EMEA   | Expansion  |        $0  |     $0  |        $0  |    N/A  | -       |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | EMEA SUBTOTAL       |   $112,200 | $14,960 |     $2,430 |   16.2% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | APAC   | New Logo   |    $20,400 |  $2,720 |        $0  |    0.0% | 🔴 RED  |
-- | APAC   | Expansion  |       $850 |    $113 |        $0  |    0.0% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | APAC SUBTOTAL       |    $21,250 |  $2,833 |        $0  |    0.0% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | GRAND TOTAL         |   $868,610 |$115,815 |    $44,862 |   38.7% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
--
-- NOTE: Targets from 2026 Bookings Plan Draft.xlsx (Plan by Month sheet)
--
-- ============================================================================
--                         REGIONAL BREAKDOWN (QTD ACTUALS)
-- ============================================================================
--
--   AMER (US):
--   ├── New Logo:  2 deals  │ $22,932 ACV (32.5% of QTD target)
--   └── Expansion: 12 deals │ $19,500 ACV (69.6% of QTD target)
--   ═══ TOTAL:     14 deals │ $42,432 ACV
--
--   EMEA (UK):
--   ├── New Logo:  1 deal   │ $2,430 ACV (16.2% of QTD target)
--   └── Expansion: 0 deals  │ $0 ACV
--   ═══ TOTAL:     1 deal   │ $2,430 ACV
--
--   APAC (AU):
--   └── No closed deals QTD (0 New Logo, 0 Expansion)
--
-- ============================================================================
-- ║                    FULL FUNNEL RCA - MISSED CATEGORIES                   ║
-- ============================================================================
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 1. AMER NEW LOGO - 35.7% Attainment ($41,253 Gap to QTD Target)         │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      2 deals / $22,932 ACV
--    ├── Lost Deals (QTD):     14 deals / $124,464 ACV
--    ├── Win Rate:             12.5% (CRITICAL - industry avg ~20%)
--    ├── Open Pipeline:        678 opps / $11,436,571 ACV
--    └── Avg Pipeline Age:     1,776 days (STALE - needs cleanup)
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ Pipeline VOLUME is NOT the issue ($11.4M exists)    ║
--    ║               ║ But avg age of 1,776 days = STALE/ZOMBIE opps       ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ High volume of aged opps suggests poor qualification║
--    ║               ║ May need pipeline scrub to identify real opps       ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ 12.5% WIN RATE is the PRIMARY ISSUE                 ║
--    ║               ║ Lost 14 deals ($124K) vs Won 2 deals ($23K)         ║
--    ║               ║ Lost deal ACV 5.4x higher than won deal ACV         ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → Conduct win/loss analysis on the 14 lost deals
--    → Scrub pipeline to remove stale opps (>365 days)
--    → Focus on closing deals in late-stage pipeline vs adding new leads
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 2. EMEA NEW LOGO - 17.7% Attainment ($11,283 Gap to QTD Target)         │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      1 deal / $2,430 ACV
--    ├── Lost Deals (QTD):     6 deals / $24,304 ACV
--    ├── Win Rate:             14.3% (CRITICAL)
--    ├── Open Pipeline:        242 opps / $639,513 ACV
--    └── Avg Pipeline Age:     1,771 days (STALE)
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ $639K pipeline exists but extremely stale           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ Pipeline age suggests qualification issues          ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ 14.3% win rate with 6 losses vs 1 win               ║
--    ║               ║ Lost deal ACV 10x higher than won deal              ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → Review the 6 lost deals - understand competitive landscape
--    → EMEA may need different sales approach or product positioning
--    → Pipeline scrub needed - 1,771 day avg age is unacceptable
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 3. APAC NEW LOGO - 0.0% Attainment ($2,493 Gap to QTD Target)           │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      0 deals / $0 ACV
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             N/A (no closed deals)
--    ├── Open Pipeline:        2 opps / $11,040 ACV
--    └── Avg Pipeline Age:     185 days
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ CRITICAL GAP - Only 2 opps in entire pipeline       ║
--    ║               ║ $11K pipeline vs $20K Q1 target = insufficient      ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ Insufficient pipeline to diagnose conversion        ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ No closed deals - pipeline generation is the issue  ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → APAC needs lead generation investment - pipeline near empty
--    → Consider regional marketing campaign or partner channel
--    → Small target ($20K/Q) may not justify dedicated resources
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4. APAC EXPANSION - 0.0% Attainment ($104 Gap to QTD Target)            │
-- │    EMEA EXPANSION - N/A ($0 Target)                                     │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS (APAC Expansion):
--    ├── Won Deals (QTD):      0 deals
--    ├── Open Pipeline:        0 opps / $0 ACV
--    └── Avg Pipeline Age:     N/A
--
--    ANALYSIS: APAC Expansion target is de minimis ($850/Q, $104 QTD).
--    EMEA Expansion has $0 target. Low priority for action.
--
-- ============================================================================
-- ║                    PIPELINE COVERAGE ANALYSIS                            ║
-- ============================================================================
--
-- +--------+------------+-----------+-------------+----------+----------------+
-- | Region | Category   | Q1 Target | Pipeline $  | Coverage | Assessment     |
-- +--------+------------+-----------+-------------+----------+----------------+
-- | AMER   | New Logo   |  $525,147 | $11,436,571 |   21.8x  | Excess/Stale   |
-- | AMER   | Expansion  |  $210,000 |    $540,990 |    2.6x  | Adequate       |
-- | EMEA   | New Logo   |  $112,200 |    $639,513 |    5.7x  | Excess/Stale   |
-- | EMEA   | Expansion  |       $0  |     $26,985 |     N/A  | No target      |
-- | APAC   | New Logo   |   $20,400 |     $11,040 |    0.5x  | INSUFFICIENT   |
-- | APAC   | Expansion  |      $850 |         $0  |    0.0x  | INSUFFICIENT   |
-- +--------+------------+-----------+-------------+----------+----------------+
--
-- NOTE: High pipeline coverage with low win rates indicates QUALITY issue,
-- not quantity issue. Pipeline scrub and deal qualification review needed.
--
-- ============================================================================
--                          PRIORITY ACTION ITEMS
-- ============================================================================
--
-- ┌── CRITICAL (This Week) ──────────────────────────────────────────────────┐
-- │ [ ] AMER: Win/Loss analysis on 14 lost New Logo deals ($124K lost ACV)   │
-- │ [ ] AMER: Pipeline scrub - close/disqualify opps >365 days old           │
-- │ [ ] EMEA: Review 6 lost deals - identify competitive/product gaps        │
-- │ [ ] APAC: Assess if R360 APAC target is realistic given market size      │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌── HIGH PRIORITY (This Month) ────────────────────────────────────────────┐
-- │ [ ] Sales Enablement: Win rate improvement training for New Logo sales   │
-- │ [ ] Product: Review if R360 positioning needs adjustment for EMEA market │
-- │ [ ] Marketing: Evaluate lead quality - high pipeline but low conversion  │
-- │ [ ] RevOps: Implement pipeline hygiene - auto-close stale opportunities  │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌── ONGOING MONITORING ────────────────────────────────────────────────────┐
-- │ [ ] Weekly win rate tracking by region/category                          │
-- │ [ ] Pipeline age distribution report                                     │
-- │ [ ] Lost deal reason analysis                                            │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- ║                    LOSS REASON ANALYSIS (Q1 2026 QTD)                    ║
-- ============================================================================
--
-- R360 NEW LOGO LOSSES (20 deals / $148,768 ACV):
-- +----------------------------+-------+------------+------------+
-- | Loss Reason                | Deals | Lost ACV   | % of Losses|
-- +----------------------------+-------+------------+------------+
-- | Pricing was too high       |     9 | $102,504   |   68.9%    |
-- | Not Ready to Buy           |     6 |  $29,406   |   19.8%    |
-- | Not Interested             |     2 |   $7,440   |    5.0%    |
-- | Unresponsive               |     2 |   $3,038   |    2.0%    |
-- | Timing                     |     1 |   $6,380   |    4.3%    |
-- +----------------------------+-------+------------+------------+
--
-- KEY INSIGHT: 68.9% of lost ACV is due to PRICING - this is the #1 issue.
-- "Not Ready to Buy" accounts for 30% of deals but only 19.8% of ACV.
--
-- TOP COMPETITORS:
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ DATA GAP: Competitor fields (Lost_to_Competitor__c, DB_Competitor__c)     ║
-- ║ are NULL for all 20 lost deals. Recommend mandatory competitor capture    ║
-- ║ on Closed Lost stage in Salesforce.                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- LOSS ANALYSIS BY REGION:
-- - AMER: Primary losses from 14 deals ($124,464 ACV) - 12.5% win rate
-- - EMEA: 6 deals lost ($24,304 ACV) - 14.3% win rate
-- - APAC: 0 deals lost (0 closed total)
--
-- RECOMMENDATIONS FROM LOSS ANALYSIS:
-- → PRICING STRATEGY: 69% of lost ACV is pricing-related
--   - Review competitive pricing analysis
--   - Consider tiered pricing or flexible payment terms
--   - Analyze deal size where pricing is most sensitive
--
-- → DEAL TIMING: "Not Ready to Buy" deals should be recycled to nurture
--   - Implement lead scoring for buying readiness
--   - Create long-term nurture campaigns for premature demos
--
-- ============================================================================
-- ║                    TOP-OF-FUNNEL ANALYSIS (MQL→Won)                      ║
-- ============================================================================
--
-- R360 INBOUND FUNNEL (Q1 2026 QTD):
-- +----------+------+------+------+------+------+----------------+
-- | Division | MQL  | SQL  | Demo | SQO  | Won  | MQL→SQL Rate   |
-- +----------+------+------+------+------+------+----------------+
-- | US       |   18 |    7 |    5 |    5 |    0 |   38.9%        |
-- | UK       |    5 |    4 |    3 |    3 |    1 |   80.0%        |
-- | AU       |    0 |    0 |    0 |    0 |    0 |    N/A         |
-- +----------+------+------+------+------+------+----------------+
-- | TOTAL    |   23 |   11 |    8 |    8 |    1 |   47.8%        |
-- +----------+------+------+------+------+------+----------------+
--
-- CONVERSION RATES:
-- ┌─────────────┬─────────┬─────────┬──────────────────────────────────────┐
-- │ Stage       │ US Rate │ UK Rate │ Assessment                           │
-- ├─────────────┼─────────┼─────────┼──────────────────────────────────────┤
-- │ MQL→SQL     │  38.9%  │  80.0%  │ US underperforming - lead quality?   │
-- │ SQL→Demo    │  71.4%  │  75.0%  │ Healthy conversion                   │
-- │ Demo→SQO    │ 100.0%  │ 100.0%  │ Strong demo-to-pipeline              │
-- │ SQO→Won     │   0.0%  │  33.3%  │ CRITICAL ISSUE - deals not closing   │
-- └─────────────┴─────────┴─────────┴──────────────────────────────────────┘
--
-- DROP-OFF ANALYSIS:
-- +----------+---------------+---------------+---------------+---------------+
-- | Division | MQL Dropout % | SQL Dropout % | Demo Dropout% | SQO Dropout % |
-- +----------+---------------+---------------+---------------+---------------+
-- | US       |     61.1%     |     28.6%     |      0.0%     |    100.0%     |
-- | UK       |     20.0%     |     25.0%     |      0.0%     |     66.7%     |
-- +----------+---------------+---------------+---------------+---------------+
--
-- CRITICAL FINDING: SQO→Won dropout is 100% in US, 66.7% in UK
-- Deals are reaching SQO stage but not closing - this aligns with low win rates
--
-- UNQUALIFIED REASONS:
-- +------------------------+-------+
-- | Reason                 | Count |
-- +------------------------+-------+
-- | Not target profile     |     4 |
-- | Bad Contact Info       |     2 |
-- | No fit                 |     2 |
-- +------------------------+-------+
--
-- ROOT CAUSE SYNTHESIS:
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. PRICING is the dominant loss reason (69% of lost ACV)                  ║
-- ║ 2. MQL→SQL conversion in US (38.9%) lags UK (80%) significantly           ║
-- ║ 3. SQO→Won is the critical bottleneck - deals reach pipeline but don't    ║
-- ║    close (0% US, 33% UK)                                                  ║
-- ║ 4. No competitor data captured - blind spot in competitive intelligence   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- RECOMMENDED ACTIONS:
-- → Sales: Price objection handling training + competitive battlecards
-- → Marketing: Improve US lead quality (38.9% MQL→SQL vs 80% UK)
-- → Product: Competitive feature analysis for pricing justification
-- → RevOps: Mandate competitor field on Closed Lost stage
--
-- ============================================================================
--                     BIGQUERY ANALYSIS QUERY
-- ============================================================================
-- Shows MTD, QTD, Rolling 7d, Rolling 30d attainment for each risk pocket
-- ACTUALS SOURCE: OpportunityViewTable (live data)
-- FILTER: r360_record__c = true, Type NOT IN ('Renewal')
-- MQL ACTUALS SOURCE: MarketingFunnel.R360InboundFunnel (for INBOUND funnel)
-- EQL ACTUALS SOURCE: OpportunityViewTable (for EXPANSION funnel)
-- TARGETS SOURCE: StrategicOperatingPlan (planning data)
-- NOTE: EXPANSION funnel uses EQL (Expansion Qualified Lead) as top-of-funnel, NOT MQL
--
-- CHANGE LOG:
-- 2026-01-12 v4.2.0: CRITICAL FIX - FunnelType mapping corrected
--   - FunnelTypes now ONLY: R360 NEW LOGO, R360 EXPANSION, R360 MIGRATION, RENEWAL
--   - Source (INBOUND, OUTBOUND, etc.) is separate dimension
--   - Removed incorrect "R360 INBOUND" FunnelType mapping from New Business
-- 2026-01-11 v4.0.0: Added Loss Reason Analysis and Top-of-Funnel MQL RCA sections
-- 2026-01-11 v3.0.0: Added Executive Summary and Funnel RCA sections
-- 2026-01-11 v2.1.0: QA Remediation
--   - Removed non-existent Segment__c field reference (field does not exist)
--   - STRATEGIC segment now determined by ACV >= $100K threshold only
--   - MQL data sourced from MarketingFunnel (SOP sync is broken - see MQL_PIPELINE_DIAGNOSTIC_REPORT)
-- 2026-01-11 v2.0.0: Initial R360 implementation with funnel MQL integration
-- ============================================================================
WITH
  params AS (
    SELECT DATE('2026-01-12') AS as_of_date, 'P50' AS percentile, 'R360' AS product_filter
  ),

  -- ============================================================================
  -- EXCEL Q1 2026 TARGETS (Source: 2026 Bookings Plan Draft.xlsx - "Plan by Month")
  -- These are the authoritative targets from the Excel planning document
  -- ============================================================================
  excel_q1_targets AS (
    -- R360 Q1 2026 Targets from Excel (Plan by Month sheet)
    SELECT 'AMER' AS region, 'NEW LOGO' AS category, 525160.0 AS q1_target  -- SMB $403,560 + Strat $121,600
    UNION ALL SELECT 'AMER', 'EXPANSION', 210000.0
    UNION ALL SELECT 'APAC', 'NEW LOGO', 20400.0
    UNION ALL SELECT 'APAC', 'EXPANSION', 850.0
    UNION ALL SELECT 'EMEA', 'NEW LOGO', 112200.0  -- UK $112,200 + EU $0
    UNION ALL SELECT 'EMEA', 'EXPANSION', 0.0
  ),

  excel_total AS (
    SELECT SUM(q1_target) AS total_q1_target  -- Should be $868,610
    FROM excel_q1_targets
  ),

  -- ============================================================================
  -- GLOBAL TARGET VALIDATION (2026 New Logo SMB Targets by Source - AMER only)
  -- Expected targets to validate regional SOP sums against
  -- ============================================================================
  expected_global_targets AS (
    SELECT 'INBOUND' AS source, 785880.0 AS expected_annual_acv, 166000.0 AS expected_q1_acv, 0.4113 AS expected_q1_pct
    UNION ALL SELECT 'TRADESHOW', 169920.0, 34560.0, 0.0856
    UNION ALL SELECT 'OUTBOUND', 318600.0, 75000.0, 0.1858
    UNION ALL SELECT 'AE SOURCED', 531000.0, 128000.0, 0.3172
    UNION ALL SELECT 'PARTNERSHIPS', 318600.0, 0.0, 0.0000
  ),

  global_target_totals AS (
    SELECT
      SUM(expected_annual_acv) AS expected_total_annual,  -- Should be $2,124,000
      SUM(expected_q1_acv) AS expected_total_q1           -- Should be $403,560 (AMER SMB only)
    FROM expected_global_targets
  ),

  -- Date window calculations
  dates AS (
    SELECT
      p.*,
      -- Current period start dates
      DATE_TRUNC(p.as_of_date, MONTH) AS mtd_start,
      DATE_TRUNC(p.as_of_date, QUARTER) AS qtd_start,
      DATE_TRUNC(p.as_of_date, YEAR) AS ytd_start,
      -- Rolling period start dates
      DATE_SUB(p.as_of_date, INTERVAL 7 DAY) AS rolling_7d_start,
      DATE_SUB(p.as_of_date, INTERVAL 30 DAY) AS rolling_30d_start
    FROM params p
  ),

  -- ============================================================================
  -- ACTUALS FROM OPPORTUNITY VIEW TABLE (Live Data)
  -- Source of truth for Won/ACV actuals with dimension mapping
  -- CRITICAL: Division filter ensures only valid regions are included
  -- ============================================================================
  actuals_from_opportunities AS (
    SELECT
      -- Region: Division -> AMER/EMEA/APAC
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,

      -- FunnelType: Derived from Type only
      -- CORRECTED 2026-01-12: FunnelTypes are ONLY: NEW LOGO, EXPANSION, MIGRATION, RENEWAL
      -- Source (INBOUND, OUTBOUND, etc.) is a separate dimension
      -- R360 SOP uses 'R360 ' prefix for FunnelType (e.g., 'R360 NEW LOGO')
      CASE
        WHEN Type = 'Existing Business' THEN 'R360 EXPANSION'
        WHEN Type = 'New Business' THEN 'R360 NEW LOGO'
        WHEN Type = 'Migration' THEN 'R360 MIGRATION'
        WHEN Type = 'Renewal' THEN 'RENEWAL'
        ELSE 'OTHER'
      END AS funnel_type,

      -- Source: Derived from SDRSource (primary) with POR_SDRSource fallback
      -- SDRSource is populated for Existing Business; POR_SDRSource often NULL
      -- Renewals always AM SOURCED
      -- DATA QUALITY FIX 2026-01-11:
      --   - Added case-insensitive matching (UPPER)
      --   - Added Tradeshow as valid source
      --   - N/A default varies by Type:
      --     * Existing Business (EXPANSION) / Renewal / Migration -> AM SOURCED
      --     * New Business -> AE SOURCED
      CASE
        WHEN Type = 'Renewal' THEN 'AM SOURCED'
        -- MIGRATION FIX 2026-01-11: SOP only has AM SOURCED and INBOUND for Migration
        WHEN Type = 'Migration' AND UPPER(COALESCE(SDRSource, POR_SDRSource, '')) = 'INBOUND' THEN 'INBOUND'
        WHEN Type = 'Migration' THEN 'AM SOURCED'
        -- Primary: SDRSource field (case-insensitive)
        WHEN UPPER(SDRSource) = 'INBOUND' THEN 'INBOUND'
        WHEN UPPER(SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
        WHEN UPPER(SDRSource) = 'AE SOURCED' THEN 'AE SOURCED'
        WHEN UPPER(SDRSource) = 'AM SOURCED' THEN 'AM SOURCED'
        WHEN UPPER(SDRSource) = 'TRADESHOW' THEN 'TRADESHOW'
        WHEN SDRSource = 'N/A' OR SDRSource IS NULL THEN
          -- Fallback: Check POR_SDRSource first
          CASE
            WHEN UPPER(POR_SDRSource) = 'INBOUND' THEN 'INBOUND'
            WHEN UPPER(POR_SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
            WHEN UPPER(POR_SDRSource) = 'AE SOURCED' THEN 'AE SOURCED'
            WHEN UPPER(POR_SDRSource) = 'AM SOURCED' THEN 'AM SOURCED'
            WHEN UPPER(POR_SDRSource) = 'TRADESHOW' THEN 'TRADESHOW'
            -- Default by Type: EXPANSION/Renewal/Migration -> AM SOURCED, New Business -> AE SOURCED
            WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
            ELSE 'AE SOURCED'
          END
        -- Unknown SDRSource value: default by Type
        WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
        ELSE 'AE SOURCED'
      END AS source,

      -- STRATEGIC FIX 2026-01-11: ACV >= 100K USD threshold defines STRATEGIC segment
      -- NOTE: Segment__c field does NOT exist in OpportunityViewTable. Available fields:
      --   - OpportunitySegment (values: "1. Velocity", "2. SMB")
      --   - account_segment__c
      -- Currently using ACV threshold only. Add field check if STRATEGIC values become available.
      -- EXPANSION/MIGRATION use N/A (matches SOP), others check for STRATEGIC criteria first
      CASE
        WHEN Type IN ('Existing Business', 'Migration') THEN 'N/A'
        WHEN ACV >= 100000 THEN 'STRATEGIC'
        ELSE 'SMB'
      END AS segment,

      -- OpportunityType: Direct from Type (for filtering renewals)
      Type AS opportunity_type,

      -- Date for filtering
      CloseDate,

      -- Metrics (each row = 1 won opp)
      1 AS actual_won,
      ACV AS actual_acv

    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE Won = true
      AND r360_record__c = true  -- R360 filter (different from POR)
      AND Type NOT IN ('Consulting', 'Credit Card')
      AND ACV > 0  -- CRITICAL: Excludes churn/downgrades with negative ACV
      AND Division IN ('US', 'UK', 'AU')  -- CRITICAL: Only valid divisions
  ),

  -- ============================================================================
  -- TIME-WINDOWED ACTUALS (aggregated by dimensions)
  -- ============================================================================
  actuals_annual AS (
    SELECT
      region, funnel_type, source, segment, opportunity_type,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_from_opportunities, dates
    WHERE EXTRACT(YEAR FROM CloseDate) = EXTRACT(YEAR FROM dates.as_of_date)
    GROUP BY region, funnel_type, source, segment, opportunity_type
  ),

  actuals_mtd AS (
    SELECT
      region, funnel_type, source, segment, opportunity_type,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_from_opportunities, dates
    WHERE CloseDate BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment, opportunity_type
  ),

  actuals_qtd AS (
    SELECT
      region, funnel_type, source, segment, opportunity_type,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_from_opportunities, dates
    WHERE CloseDate BETWEEN dates.qtd_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment, opportunity_type
  ),

  actuals_rolling_7d AS (
    SELECT
      region, funnel_type, source, segment, opportunity_type,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_from_opportunities, dates
    WHERE CloseDate BETWEEN dates.rolling_7d_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment, opportunity_type
  ),

  actuals_rolling_30d AS (
    SELECT
      region, funnel_type, source, segment, opportunity_type,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_from_opportunities, dates
    WHERE CloseDate BETWEEN dates.rolling_30d_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment, opportunity_type
  ),

  -- ============================================================================
  -- MQL ACTUALS FROM R360INBOUNDFUNNEL (More accurate than StrategicOperatingPlan)
  -- Source: MarketingFunnel.R360InboundFunnel with proper filters
  -- Filters: Excludes SpiralyzeTest, excludes MQL_Reverted
  -- ============================================================================
  mql_from_funnel AS (
    SELECT
      Region AS region,
      CAST(MQL_DT AS DATE) AS mql_date,
      COUNT(DISTINCT Email) AS mql_count
    FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
    WHERE MQL_DT IS NOT NULL
      AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
      AND MQL_Reverted = false
      AND Region IS NOT NULL
      AND Email IS NOT NULL
    GROUP BY Region, CAST(MQL_DT AS DATE)
  ),

  -- Aggregated MQL by region for different time periods
  mql_annual AS (
    SELECT region, SUM(mql_count) AS actual_mql
    FROM mql_from_funnel, dates
    WHERE EXTRACT(YEAR FROM mql_date) = EXTRACT(YEAR FROM dates.as_of_date)
    GROUP BY region
  ),

  mql_mtd AS (
    SELECT region, SUM(mql_count) AS actual_mql
    FROM mql_from_funnel, dates
    WHERE mql_date BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY region
  ),

  mql_qtd AS (
    SELECT region, SUM(mql_count) AS actual_mql
    FROM mql_from_funnel, dates
    WHERE mql_date BETWEEN dates.qtd_start AND dates.as_of_date
    GROUP BY region
  ),

  mql_r7d AS (
    SELECT region, SUM(mql_count) AS actual_mql
    FROM mql_from_funnel, dates
    WHERE mql_date BETWEEN dates.rolling_7d_start AND dates.as_of_date
    GROUP BY region
  ),

  mql_r30d AS (
    SELECT region, SUM(mql_count) AS actual_mql
    FROM mql_from_funnel, dates
    WHERE mql_date BETWEEN dates.rolling_30d_start AND dates.as_of_date
    GROUP BY region
  ),

  -- ============================================================================
  -- EQL ACTUALS FROM OPPORTUNITY VIEW TABLE (for EXPANSION funnel)
  -- Source: OpportunityViewTable with ExpansionQualified = true
  -- EQL is the top-of-funnel metric for Expansion, replacing MQL
  -- ============================================================================
  eql_from_opportunities AS (
    SELECT
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      -- Source: Use SDRSource to categorize by Inbound/AM Sourced/Partnerships
      CASE
        WHEN SDRSource = 'Inbound' THEN 'INBOUND'
        WHEN SDRSource = 'AM Sourced' THEN 'AM SOURCED'
        WHEN SDRSource = 'Partnerships' THEN 'PARTNERSHIPS'
        WHEN SDRSource = 'Outbound' THEN 'OUTBOUND'
        WHEN SDRSource = 'AE Sourced' THEN 'AE SOURCED'
        ELSE 'OTHER'
      END AS source,
      ExpansionQualifiedDate AS eql_date
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE r360_record__c = true
      AND Type = 'Existing Business'
      AND ExpansionQualified = true
      AND ExpansionQualifiedDate IS NOT NULL
      AND Division IN ('US', 'UK', 'AU')
  ),

  -- Aggregated EQL by region and source for different time periods
  eql_annual AS (
    SELECT region, source, COUNT(*) AS actual_eql
    FROM eql_from_opportunities, dates
    WHERE EXTRACT(YEAR FROM eql_date) = EXTRACT(YEAR FROM dates.as_of_date)
    GROUP BY region, source
  ),

  eql_mtd AS (
    SELECT region, source, COUNT(*) AS actual_eql
    FROM eql_from_opportunities, dates
    WHERE eql_date BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY region, source
  ),

  eql_qtd AS (
    SELECT region, source, COUNT(*) AS actual_eql
    FROM eql_from_opportunities, dates
    WHERE eql_date BETWEEN dates.qtd_start AND dates.as_of_date
    GROUP BY region, source
  ),

  eql_r7d AS (
    SELECT region, source, COUNT(*) AS actual_eql
    FROM eql_from_opportunities, dates
    WHERE eql_date BETWEEN dates.rolling_7d_start AND dates.as_of_date
    GROUP BY region, source
  ),

  eql_r30d AS (
    SELECT region, source, COUNT(*) AS actual_eql
    FROM eql_from_opportunities, dates
    WHERE eql_date BETWEEN dates.rolling_30d_start AND dates.as_of_date
    GROUP BY region, source
  ),

  -- ============================================================================
  -- TARGETS FROM STRATEGIC OPERATING PLAN
  -- Note: Actual_MQL from SOP is replaced with mql_from_funnel data
  -- DATA QUALITY FIX: PARTNERSHIPS targets should be $0 (zeroed in query)
  -- Expected Q1 2026 AMER targets:
  --   INBOUND: $166,000, TRADESHOW: $34,560, OUTBOUND: $75,000,
  --   AE SOURCED: $128,000, PARTNERSHIPS: $0
  -- ============================================================================
  targets_base AS (
    SELECT
      sop.Region AS region,
      sop.FunnelType AS funnel_type,
      sop.Source AS source,
      sop.Segment AS segment,
      sop.OpportunityType AS opportunity_type,
      sop.TargetDate,
      -- CORRECTION: Data quality fix for R360 SOP targets:
      -- PARTNERSHIPS: Expected Q1 2026 target is $0 - zero out ALL metrics
      -- NOTE: AE SOURCED does NOT need /100 correction - raw value is correct ($128K)
      CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_Won END AS Target_Won,
      CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_ACV END AS Target_ACV,
      CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_MQL END AS Target_MQL,
      CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_SQL END AS Target_SQL,
      CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_SAL END AS Target_SAL,
      CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_SQO END AS Target_SQO,
      -- Keep SOP actuals for SQL/SAL/SQO (MQL now comes from mql_from_funnel)
      sop.Actual_MQL,  -- Will be overridden with funnel data for INBOUND
      sop.Actual_SQL,
      sop.Actual_SAL,
      sop.Actual_SQO
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop, params
    WHERE sop.RecordType = params.product_filter
      AND sop.Percentile = params.percentile  -- CRITICAL: Filter by percentile to avoid summing P25/P50/P75/P90
  ),

  -- ============================================================================
  -- SOP DIAGNOSTIC: Show breakdown by Region, FunnelType, Source for Q1 2026
  -- Use this to understand the data structure and identify double-counting
  -- ============================================================================
  sop_diagnostic AS (
    SELECT
      t.region,
      t.funnel_type,
      t.source,
      t.segment,
      SUM(CASE WHEN t.TargetDate BETWEEN DATE('2026-01-01') AND DATE('2026-03-31') THEN t.Target_ACV ELSE 0 END) AS q1_target_acv
    FROM targets_base t
    WHERE t.funnel_type IN ('R360 NEW LOGO', 'R360 INBOUND')
      AND t.segment = 'SMB'
      AND t.opportunity_type != 'RENEWAL'
    GROUP BY t.region, t.funnel_type, t.source, t.segment
    HAVING SUM(CASE WHEN t.TargetDate BETWEEN DATE('2026-01-01') AND DATE('2026-03-31') THEN t.Target_ACV ELSE 0 END) > 0
  ),

  -- ============================================================================
  -- SOP REGIONAL SUMS BY SOURCE (for validation against global targets)
  -- FIXED: Filter to AMER only since expected_global_targets are AMER planning values
  -- FIXED: Avoid FunnelType double-counting by matching Source to correct FunnelType:
  --   - INBOUND source → R360 INBOUND funnel only
  --   - Other sources → R360 NEW LOGO funnel only
  -- ============================================================================
  sop_regional_sums AS (
    SELECT
      t.source,
      SUM(CASE WHEN EXTRACT(YEAR FROM t.TargetDate) = 2026 THEN t.Target_ACV ELSE 0 END) AS sop_annual_acv,
      SUM(CASE WHEN t.TargetDate BETWEEN DATE('2026-01-01') AND DATE('2026-03-31') THEN t.Target_ACV ELSE 0 END) AS sop_q1_acv
    FROM targets_base t
    WHERE t.segment = 'SMB'
      AND t.opportunity_type != 'RENEWAL'
      AND t.region = 'AMER'  -- CRITICAL: Filter to AMER (expected targets are AMER-only)
      -- CRITICAL: Match Source to correct FunnelType to avoid double-counting
      AND (
        (t.source = 'INBOUND' AND t.funnel_type = 'R360 INBOUND')
        OR (t.source != 'INBOUND' AND t.funnel_type = 'R360 NEW LOGO')
      )
    GROUP BY t.source
  ),

  -- Compare SOP sums to expected global targets
  global_target_validation AS (
    SELECT
      COALESCE(e.source, s.source) AS source,
      COALESCE(e.expected_annual_acv, 0) AS expected_annual_acv,
      COALESCE(s.sop_annual_acv, 0) AS sop_annual_acv,
      COALESCE(s.sop_annual_acv, 0) - COALESCE(e.expected_annual_acv, 0) AS annual_variance,
      COALESCE(e.expected_q1_acv, 0) AS expected_q1_acv,
      COALESCE(s.sop_q1_acv, 0) AS sop_q1_acv,
      COALESCE(s.sop_q1_acv, 0) - COALESCE(e.expected_q1_acv, 0) AS q1_variance,
      CASE
        WHEN ABS(COALESCE(s.sop_annual_acv, 0) - COALESCE(e.expected_annual_acv, 0)) > 1000 THEN 'MISMATCH'
        ELSE 'OK'
      END AS validation_status
    FROM expected_global_targets e
    FULL OUTER JOIN sop_regional_sums s ON e.source = s.source
  ),

  -- Global summary: total actuals vs total targets across all sources
  global_new_logo_summary AS (
    SELECT
      SUM(sop_annual_acv) AS sop_total_annual_target,
      SUM(sop_q1_acv) AS sop_total_q1_target,
      -- Actual ACV from opportunities (will join later)
      2124000.0 AS expected_total_annual,  -- Known expected value (AMER only)
      403560.0 AS expected_total_q1        -- Known expected value (AMER only)
    FROM sop_regional_sums
  ),

  -- Full regional breakdown for debugging (all regions, not just AMER)
  sop_all_regions_summary AS (
    SELECT
      t.region,
      t.source,
      SUM(CASE WHEN t.TargetDate BETWEEN DATE('2026-01-01') AND DATE('2026-03-31') THEN t.Target_ACV ELSE 0 END) AS q1_target_acv
    FROM targets_base t
    WHERE t.segment = 'SMB'
      AND t.opportunity_type != 'RENEWAL'
      AND (
        (t.source = 'INBOUND' AND t.funnel_type = 'R360 INBOUND')
        OR (t.source != 'INBOUND' AND t.funnel_type = 'R360 NEW LOGO')
      )
    GROUP BY t.region, t.source
  ),

  -- ============================================================================
  -- EXPANSION ATTAINMENT BY REGION (for rollup filter logic)
  -- Calculate total EXPANSION ACV attainment per region
  -- ============================================================================
  expansion_targets_by_region AS (
    SELECT
      t.region,
      SUM(CASE WHEN EXTRACT(YEAR FROM t.TargetDate) = 2026 THEN t.Target_ACV ELSE 0 END) AS expansion_target_acv
    FROM targets_base t
    WHERE t.funnel_type = 'R360 EXPANSION'
      AND t.opportunity_type != 'RENEWAL'
    GROUP BY t.region
  ),

  expansion_actuals_by_region AS (
    SELECT
      CASE Division
        WHEN 'US' THEN 'AMER'
        WHEN 'UK' THEN 'EMEA'
        WHEN 'AU' THEN 'APAC'
      END AS region,
      SUM(ACV) AS expansion_actual_acv
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`, dates
    WHERE Won = true
      AND r360_record__c = true
      AND Type = 'Existing Business'  -- EXPANSION
      AND ACV > 0
      AND Division IN ('US', 'UK', 'AU')
      AND EXTRACT(YEAR FROM CloseDate) = EXTRACT(YEAR FROM dates.as_of_date)
    GROUP BY 1
  ),

  expansion_attainment_by_region AS (
    SELECT
      t.region,
      t.expansion_target_acv,
      COALESCE(a.expansion_actual_acv, 0) AS expansion_actual_acv,
      SAFE_DIVIDE(COALESCE(a.expansion_actual_acv, 0), t.expansion_target_acv) AS expansion_attainment,
      CASE
        WHEN SAFE_DIVIDE(COALESCE(a.expansion_actual_acv, 0), t.expansion_target_acv) >= 1.0 THEN true
        ELSE false
      END AS expansion_at_target
    FROM expansion_targets_by_region t
    LEFT JOIN expansion_actuals_by_region a ON t.region = a.region
  ),

  -- ============================================================================
  -- ANNUAL AGGREGATION (for ranking by ACV gap)
  -- Targets from SOP, Actuals from OpportunityViewTable
  -- ============================================================================
  annual_targets AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(Target_Won) AS annual_target_won,
      SUM(Target_ACV) AS annual_target_acv,
      SUM(Target_MQL) AS annual_target_mql,
      SUM(Target_SQL) AS annual_target_sql,
      SUM(Target_SAL) AS annual_target_sal,
      SUM(Target_SQO) AS annual_target_sqo,
      -- Funnel actuals from SOP (not available in OpportunityViewTable)
      SUM(Actual_MQL) AS annual_actual_mql,
      SUM(Actual_SQL) AS annual_actual_sql,
      SUM(Actual_SAL) AS annual_actual_sal,
      SUM(Actual_SQO) AS annual_actual_sqo
    FROM targets_base, dates
    WHERE opportunity_type != 'RENEWAL'
      AND EXTRACT(YEAR FROM TargetDate) = 2026
    GROUP BY region, funnel_type, source, segment
  ),

  annual_actuals AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(actual_won) AS annual_actual_won,
      SUM(actual_acv) AS annual_actual_acv
    FROM actuals_annual
    WHERE opportunity_type != 'Renewal'
    GROUP BY region, funnel_type, source, segment
  ),

  -- ============================================================================
  -- FUNNEL METRIC SUPPLEMENTATION FIX (2026-01-11):
  -- AE SOURCED and AM SOURCED deals bypass marketing funnel, so SOP has
  -- actual_sqo/actual_sql = 0 even when actual_won > 0. This breaks conversion
  -- rate calculations. Fix: supplement missing funnel metrics from downstream:
  --   - If won > 0 but sqo = 0, set sqo = won (a won deal must have been an SQO)
  --   - If sqo > 0 but sql = 0, set sql = sqo (an SQO must have been an SQL)
  -- ============================================================================
  annual_aggregated AS (
    SELECT
      t.region, t.funnel_type, t.source, t.segment,
      t.annual_target_won,
      COALESCE(a.annual_actual_won, 0) AS annual_actual_won,
      t.annual_target_acv,
      COALESCE(a.annual_actual_acv, 0) AS annual_actual_acv,
      t.annual_target_mql,
      -- Use funnel MQL for INBOUND funnel type, EQL for EXPANSION funnel type
      CASE
        WHEN t.funnel_type = 'R360 INBOUND' AND t.source = 'INBOUND' THEN COALESCE(mql.actual_mql, 0)
        WHEN t.funnel_type = 'R360 EXPANSION' THEN COALESCE(eql.actual_eql, 0)
        ELSE COALESCE(t.annual_actual_mql, 0)
      END AS annual_actual_mql,
      t.annual_target_sql,
      -- FIX: Supplement SQL from SQO for AE/AM SOURCED if SQL=0 but SQO>0
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.annual_actual_sql, 0) = 0
          AND (
            COALESCE(t.annual_actual_sqo, 0) > 0
            OR COALESCE(a.annual_actual_won, 0) > 0
          )
        THEN GREATEST(COALESCE(t.annual_actual_sqo, 0), COALESCE(a.annual_actual_won, 0))
        ELSE COALESCE(t.annual_actual_sql, 0)
      END AS annual_actual_sql,
      t.annual_target_sal, t.annual_actual_sal,
      t.annual_target_sqo,
      -- FIX: Supplement SQO from Won for AE/AM SOURCED if SQO=0 but Won>0
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.annual_actual_sqo, 0) = 0
          AND COALESCE(a.annual_actual_won, 0) > 0
        THEN COALESCE(a.annual_actual_won, 0)
        ELSE COALESCE(t.annual_actual_sqo, 0)
      END AS annual_actual_sqo
    FROM annual_targets t
    LEFT JOIN annual_actuals a USING (region, funnel_type, source, segment)
    LEFT JOIN mql_annual mql ON t.region = mql.region
    LEFT JOIN eql_annual eql ON t.region = eql.region AND t.source = eql.source
  ),

  -- ============================================================================
  -- TIME HORIZON AGGREGATIONS
  -- ============================================================================

  -- MTD Targets
  mtd_targets AS (
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
      AND TargetDate BETWEEN dates.mtd_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment
  ),

  mtd_actuals AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_mtd
    WHERE opportunity_type != 'Renewal'
    GROUP BY region, funnel_type, source, segment
  ),

  mtd_aggregated AS (
    SELECT
      t.region, t.funnel_type, t.source, t.segment,
      t.target_won, COALESCE(a.actual_won, 0) AS actual_won,
      t.target_acv, COALESCE(a.actual_acv, 0) AS actual_acv,
      t.target_mql,
      -- Use funnel MQL for INBOUND funnel type, EQL for EXPANSION funnel type
      CASE
        WHEN t.funnel_type = 'R360 INBOUND' AND t.source = 'INBOUND' THEN COALESCE(mql.actual_mql, 0)
        WHEN t.funnel_type = 'R360 EXPANSION' THEN COALESCE(eql.actual_eql, 0)
        ELSE COALESCE(t.actual_mql, 0)
      END AS actual_mql,
      t.target_sql,
      -- FIX: Supplement SQL from SQO for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sql, 0) = 0
          AND (COALESCE(t.actual_sqo, 0) > 0 OR COALESCE(a.actual_won, 0) > 0)
        THEN GREATEST(COALESCE(t.actual_sqo, 0), COALESCE(a.actual_won, 0))
        ELSE COALESCE(t.actual_sql, 0)
      END AS actual_sql,
      t.target_sal, t.actual_sal,
      t.target_sqo,
      -- FIX: Supplement SQO from Won for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sqo, 0) = 0
          AND COALESCE(a.actual_won, 0) > 0
        THEN COALESCE(a.actual_won, 0)
        ELSE COALESCE(t.actual_sqo, 0)
      END AS actual_sqo
    FROM mtd_targets t
    LEFT JOIN mtd_actuals a USING (region, funnel_type, source, segment)
    LEFT JOIN mql_mtd mql ON t.region = mql.region
    LEFT JOIN eql_mtd eql ON t.region = eql.region AND t.source = eql.source
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

  qtd_actuals AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_qtd
    WHERE opportunity_type != 'Renewal'
    GROUP BY region, funnel_type, source, segment
  ),

  qtd_aggregated AS (
    SELECT
      t.region, t.funnel_type, t.source, t.segment,
      t.target_won, COALESCE(a.actual_won, 0) AS actual_won,
      t.target_acv, COALESCE(a.actual_acv, 0) AS actual_acv,
      t.target_mql,
      -- Use funnel MQL for INBOUND funnel type, EQL for EXPANSION funnel type
      CASE
        WHEN t.funnel_type = 'R360 INBOUND' AND t.source = 'INBOUND' THEN COALESCE(mql.actual_mql, 0)
        WHEN t.funnel_type = 'R360 EXPANSION' THEN COALESCE(eql.actual_eql, 0)
        ELSE COALESCE(t.actual_mql, 0)
      END AS actual_mql,
      t.target_sql,
      -- FIX: Supplement SQL from SQO for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sql, 0) = 0
          AND (COALESCE(t.actual_sqo, 0) > 0 OR COALESCE(a.actual_won, 0) > 0)
        THEN GREATEST(COALESCE(t.actual_sqo, 0), COALESCE(a.actual_won, 0))
        ELSE COALESCE(t.actual_sql, 0)
      END AS actual_sql,
      t.target_sal, t.actual_sal,
      t.target_sqo,
      -- FIX: Supplement SQO from Won for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sqo, 0) = 0
          AND COALESCE(a.actual_won, 0) > 0
        THEN COALESCE(a.actual_won, 0)
        ELSE COALESCE(t.actual_sqo, 0)
      END AS actual_sqo
    FROM qtd_targets t
    LEFT JOIN qtd_actuals a USING (region, funnel_type, source, segment)
    LEFT JOIN mql_qtd mql ON t.region = mql.region
    LEFT JOIN eql_qtd eql ON t.region = eql.region AND t.source = eql.source
  ),

  -- Rolling 7d Targets
  rolling_7d_targets AS (
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
      AND TargetDate BETWEEN dates.rolling_7d_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment
  ),

  rolling_7d_actuals AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_rolling_7d
    WHERE opportunity_type != 'Renewal'
    GROUP BY region, funnel_type, source, segment
  ),

  rolling_7d_aggregated AS (
    SELECT
      t.region, t.funnel_type, t.source, t.segment,
      t.target_won, COALESCE(a.actual_won, 0) AS actual_won,
      t.target_acv, COALESCE(a.actual_acv, 0) AS actual_acv,
      t.target_mql,
      -- Use funnel MQL for INBOUND funnel type, EQL for EXPANSION funnel type
      CASE
        WHEN t.funnel_type = 'R360 INBOUND' AND t.source = 'INBOUND' THEN COALESCE(mql.actual_mql, 0)
        WHEN t.funnel_type = 'R360 EXPANSION' THEN COALESCE(eql.actual_eql, 0)
        ELSE COALESCE(t.actual_mql, 0)
      END AS actual_mql,
      t.target_sql,
      -- FIX: Supplement SQL from SQO for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sql, 0) = 0
          AND (COALESCE(t.actual_sqo, 0) > 0 OR COALESCE(a.actual_won, 0) > 0)
        THEN GREATEST(COALESCE(t.actual_sqo, 0), COALESCE(a.actual_won, 0))
        ELSE COALESCE(t.actual_sql, 0)
      END AS actual_sql,
      t.target_sal, t.actual_sal,
      t.target_sqo,
      -- FIX: Supplement SQO from Won for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sqo, 0) = 0
          AND COALESCE(a.actual_won, 0) > 0
        THEN COALESCE(a.actual_won, 0)
        ELSE COALESCE(t.actual_sqo, 0)
      END AS actual_sqo
    FROM rolling_7d_targets t
    LEFT JOIN rolling_7d_actuals a USING (region, funnel_type, source, segment)
    LEFT JOIN mql_r7d mql ON t.region = mql.region
    LEFT JOIN eql_r7d eql ON t.region = eql.region AND t.source = eql.source
  ),

  -- Rolling 30d Targets
  rolling_30d_targets AS (
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
      AND TargetDate BETWEEN dates.rolling_30d_start AND dates.as_of_date
    GROUP BY region, funnel_type, source, segment
  ),

  rolling_30d_actuals AS (
    SELECT
      region, funnel_type, source, segment,
      SUM(actual_won) AS actual_won,
      SUM(actual_acv) AS actual_acv
    FROM actuals_rolling_30d
    WHERE opportunity_type != 'Renewal'
    GROUP BY region, funnel_type, source, segment
  ),

  rolling_30d_aggregated AS (
    SELECT
      t.region, t.funnel_type, t.source, t.segment,
      t.target_won, COALESCE(a.actual_won, 0) AS actual_won,
      t.target_acv, COALESCE(a.actual_acv, 0) AS actual_acv,
      t.target_mql,
      -- Use funnel MQL for INBOUND funnel type, EQL for EXPANSION funnel type
      CASE
        WHEN t.funnel_type = 'R360 INBOUND' AND t.source = 'INBOUND' THEN COALESCE(mql.actual_mql, 0)
        WHEN t.funnel_type = 'R360 EXPANSION' THEN COALESCE(eql.actual_eql, 0)
        ELSE COALESCE(t.actual_mql, 0)
      END AS actual_mql,
      t.target_sql,
      -- FIX: Supplement SQL from SQO for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sql, 0) = 0
          AND (COALESCE(t.actual_sqo, 0) > 0 OR COALESCE(a.actual_won, 0) > 0)
        THEN GREATEST(COALESCE(t.actual_sqo, 0), COALESCE(a.actual_won, 0))
        ELSE COALESCE(t.actual_sql, 0)
      END AS actual_sql,
      t.target_sal, t.actual_sal,
      t.target_sqo,
      -- FIX: Supplement SQO from Won for AE/AM SOURCED
      CASE
        WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
          AND COALESCE(t.actual_sqo, 0) = 0
          AND COALESCE(a.actual_won, 0) > 0
        THEN COALESCE(a.actual_won, 0)
        ELSE COALESCE(t.actual_sqo, 0)
      END AS actual_sqo
    FROM rolling_30d_targets t
    LEFT JOIN rolling_30d_actuals a USING (region, funnel_type, source, segment)
    LEFT JOIN mql_r30d mql ON t.region = mql.region
    LEFT JOIN eql_r30d eql ON t.region = eql.region AND t.source = eql.source
  ),

  -- ============================================================================
  -- COMBINE ALL HORIZONS INTO RISK POCKETS
  -- ============================================================================
  risk_pockets AS (
    SELECT
      a.region, a.funnel_type, a.source, a.segment,

      -- Annual metrics (for ranking)
      a.annual_target_acv,
      a.annual_actual_acv,
      (a.annual_target_acv - a.annual_actual_acv) AS annual_acv_gap,
      SAFE_DIVIDE(a.annual_actual_acv, a.annual_target_acv) AS annual_acv_pacing,

      -- MTD metrics
      COALESCE(mtd.target_mql, 0) AS mtd_target_mql, COALESCE(mtd.actual_mql, 0) AS mtd_actual_mql,
      COALESCE(mtd.target_sql, 0) AS mtd_target_sql, COALESCE(mtd.actual_sql, 0) AS mtd_actual_sql,
      COALESCE(mtd.target_sal, 0) AS mtd_target_sal, COALESCE(mtd.actual_sal, 0) AS mtd_actual_sal,
      COALESCE(mtd.target_sqo, 0) AS mtd_target_sqo, COALESCE(mtd.actual_sqo, 0) AS mtd_actual_sqo,
      COALESCE(mtd.target_won, 0) AS mtd_target_won, COALESCE(mtd.actual_won, 0) AS mtd_actual_won,
      COALESCE(mtd.target_acv, 0) AS mtd_target_acv, COALESCE(mtd.actual_acv, 0) AS mtd_actual_acv,

      -- QTD metrics
      COALESCE(qtd.target_mql, 0) AS qtd_target_mql, COALESCE(qtd.actual_mql, 0) AS qtd_actual_mql,
      COALESCE(qtd.target_sql, 0) AS qtd_target_sql, COALESCE(qtd.actual_sql, 0) AS qtd_actual_sql,
      COALESCE(qtd.target_sal, 0) AS qtd_target_sal, COALESCE(qtd.actual_sal, 0) AS qtd_actual_sal,
      COALESCE(qtd.target_sqo, 0) AS qtd_target_sqo, COALESCE(qtd.actual_sqo, 0) AS qtd_actual_sqo,
      COALESCE(qtd.target_won, 0) AS qtd_target_won, COALESCE(qtd.actual_won, 0) AS qtd_actual_won,
      COALESCE(qtd.target_acv, 0) AS qtd_target_acv, COALESCE(qtd.actual_acv, 0) AS qtd_actual_acv,

      -- Rolling 7d metrics
      COALESCE(r7.target_mql, 0) AS r7d_target_mql, COALESCE(r7.actual_mql, 0) AS r7d_actual_mql,
      COALESCE(r7.target_sql, 0) AS r7d_target_sql, COALESCE(r7.actual_sql, 0) AS r7d_actual_sql,
      COALESCE(r7.target_sal, 0) AS r7d_target_sal, COALESCE(r7.actual_sal, 0) AS r7d_actual_sal,
      COALESCE(r7.target_sqo, 0) AS r7d_target_sqo, COALESCE(r7.actual_sqo, 0) AS r7d_actual_sqo,
      COALESCE(r7.target_won, 0) AS r7d_target_won, COALESCE(r7.actual_won, 0) AS r7d_actual_won,
      COALESCE(r7.target_acv, 0) AS r7d_target_acv, COALESCE(r7.actual_acv, 0) AS r7d_actual_acv,

      -- Rolling 30d metrics
      COALESCE(r30.target_mql, 0) AS r30d_target_mql, COALESCE(r30.actual_mql, 0) AS r30d_actual_mql,
      COALESCE(r30.target_sql, 0) AS r30d_target_sql, COALESCE(r30.actual_sql, 0) AS r30d_actual_sql,
      COALESCE(r30.target_sal, 0) AS r30d_target_sal, COALESCE(r30.actual_sal, 0) AS r30d_actual_sal,
      COALESCE(r30.target_sqo, 0) AS r30d_target_sqo, COALESCE(r30.actual_sqo, 0) AS r30d_actual_sqo,
      COALESCE(r30.target_won, 0) AS r30d_target_won, COALESCE(r30.actual_won, 0) AS r30d_actual_won,
      COALESCE(r30.target_acv, 0) AS r30d_target_acv, COALESCE(r30.actual_acv, 0) AS r30d_actual_acv

    FROM annual_aggregated a
    LEFT JOIN mtd_aggregated mtd USING (region, funnel_type, source, segment)
    LEFT JOIN qtd_aggregated qtd USING (region, funnel_type, source, segment)
    LEFT JOIN rolling_7d_aggregated r7 USING (region, funnel_type, source, segment)
    LEFT JOIN rolling_30d_aggregated r30 USING (region, funnel_type, source, segment)
    WHERE a.annual_target_acv > 0 AND (a.annual_target_acv - a.annual_actual_acv) > 0
  ),

  -- ============================================================================
  -- CALCULATE ATTAINMENT AND TRENDS
  -- ============================================================================
  risk_pockets_with_attainment AS (
    SELECT
      rp.*,

      -- MTD attainment percentages
      SAFE_DIVIDE(rp.mtd_actual_mql, rp.mtd_target_mql) AS mtd_mql_attainment,
      SAFE_DIVIDE(rp.mtd_actual_sql, rp.mtd_target_sql) AS mtd_sql_attainment,
      SAFE_DIVIDE(rp.mtd_actual_sal, rp.mtd_target_sal) AS mtd_sal_attainment,
      SAFE_DIVIDE(rp.mtd_actual_sqo, rp.mtd_target_sqo) AS mtd_sqo_attainment,
      SAFE_DIVIDE(rp.mtd_actual_won, rp.mtd_target_won) AS mtd_won_attainment,
      SAFE_DIVIDE(rp.mtd_actual_acv, rp.mtd_target_acv) AS mtd_acv_attainment,

      -- QTD attainment percentages
      SAFE_DIVIDE(rp.qtd_actual_mql, rp.qtd_target_mql) AS qtd_mql_attainment,
      SAFE_DIVIDE(rp.qtd_actual_sql, rp.qtd_target_sql) AS qtd_sql_attainment,
      SAFE_DIVIDE(rp.qtd_actual_sal, rp.qtd_target_sal) AS qtd_sal_attainment,
      SAFE_DIVIDE(rp.qtd_actual_sqo, rp.qtd_target_sqo) AS qtd_sqo_attainment,
      SAFE_DIVIDE(rp.qtd_actual_won, rp.qtd_target_won) AS qtd_won_attainment,
      SAFE_DIVIDE(rp.qtd_actual_acv, rp.qtd_target_acv) AS qtd_acv_attainment,

      -- Rolling 7d attainment percentages
      SAFE_DIVIDE(rp.r7d_actual_mql, rp.r7d_target_mql) AS r7d_mql_attainment,
      SAFE_DIVIDE(rp.r7d_actual_sql, rp.r7d_target_sql) AS r7d_sql_attainment,
      SAFE_DIVIDE(rp.r7d_actual_sal, rp.r7d_target_sal) AS r7d_sal_attainment,
      SAFE_DIVIDE(rp.r7d_actual_sqo, rp.r7d_target_sqo) AS r7d_sqo_attainment,
      SAFE_DIVIDE(rp.r7d_actual_won, rp.r7d_target_won) AS r7d_won_attainment,
      SAFE_DIVIDE(rp.r7d_actual_acv, rp.r7d_target_acv) AS r7d_acv_attainment,

      -- Rolling 30d attainment percentages
      SAFE_DIVIDE(rp.r30d_actual_mql, rp.r30d_target_mql) AS r30d_mql_attainment,
      SAFE_DIVIDE(rp.r30d_actual_sql, rp.r30d_target_sql) AS r30d_sql_attainment,
      SAFE_DIVIDE(rp.r30d_actual_sal, rp.r30d_target_sal) AS r30d_sal_attainment,
      SAFE_DIVIDE(rp.r30d_actual_sqo, rp.r30d_target_sqo) AS r30d_sqo_attainment,
      SAFE_DIVIDE(rp.r30d_actual_won, rp.r30d_target_won) AS r30d_won_attainment,
      SAFE_DIVIDE(rp.r30d_actual_acv, rp.r30d_target_acv) AS r30d_acv_attainment,

      -- TREND DETECTION: Compare Rolling 7d vs MTD
      -- Positive delta = Improving, Negative delta = Declining
      CASE
        WHEN rp.mtd_target_mql > 0 AND rp.r7d_target_mql > 0 THEN
          SAFE_DIVIDE(rp.r7d_actual_mql, rp.r7d_target_mql) - SAFE_DIVIDE(rp.mtd_actual_mql, rp.mtd_target_mql)
        ELSE NULL
      END AS mql_trend_delta,

      CASE
        WHEN rp.mtd_target_won > 0 AND rp.r7d_target_won > 0 THEN
          SAFE_DIVIDE(rp.r7d_actual_won, rp.r7d_target_won) - SAFE_DIVIDE(rp.mtd_actual_won, rp.mtd_target_won)
        ELSE NULL
      END AS won_trend_delta,

      CASE
        WHEN rp.mtd_target_acv > 0 AND rp.r7d_target_acv > 0 THEN
          SAFE_DIVIDE(rp.r7d_actual_acv, rp.r7d_target_acv) - SAFE_DIVIDE(rp.mtd_actual_acv, rp.mtd_target_acv)
        ELSE NULL
      END AS acv_trend_delta

    FROM risk_pockets rp
  ),

  -- ============================================================================
  -- TOP 3 RISKS PER REGION (ranked by annual ACV gap)
  -- EXPANSION FILTER: Excludes EXPANSION rows if region's total EXPANSION ACV >= 100% target
  -- This ensures EXPANSION detail rows only appear when EXPANSION rollup is actually missing
  -- ============================================================================
  risk_pockets_filtered AS (
    SELECT
      rp.*,
      COALESCE(exp.expansion_at_target, false) AS region_expansion_at_target,
      COALESCE(exp.expansion_attainment, 0) AS region_expansion_attainment
    FROM risk_pockets_with_attainment rp
    LEFT JOIN expansion_attainment_by_region exp ON rp.region = exp.region
    WHERE
      -- Include row if:
      -- 1. It's NOT an EXPANSION funnel type, OR
      -- 2. It IS EXPANSION but the region's expansion is below target (<100%)
      rp.funnel_type != 'R360 EXPANSION'
      OR COALESCE(exp.expansion_at_target, false) = false
  ),

  top_risks_per_region AS (
    SELECT
      *,
      ROW_NUMBER() OVER (PARTITION BY region ORDER BY annual_acv_gap DESC) AS rank_in_region
    FROM risk_pockets_filtered
    QUALIFY ROW_NUMBER() OVER (PARTITION BY region ORDER BY annual_acv_gap DESC) <= 3
  )

-- ============================================================================
-- OUTPUT JSON WITH NESTED TIME HORIZONS
-- ============================================================================
SELECT TO_JSON_STRING(STRUCT(
  CAST(CURRENT_TIMESTAMP() AS STRING) AS generated_at_utc,
  d.as_of_date,
  d.percentile,
  d.product_filter AS product,
  'OpportunityViewTable' AS actuals_source,

  -- Date window info for reference
  STRUCT(
    d.mtd_start AS mtd_start,
    d.qtd_start AS qtd_start,
    d.rolling_7d_start AS rolling_7d_start,
    d.rolling_30d_start AS rolling_30d_start,
    d.as_of_date AS as_of_date
  ) AS date_windows,

  -- Global New Logo SMB Target Summary (AMER only - matches expected planning values)
  (SELECT AS STRUCT
    gns.expected_total_annual AS expected_annual_target,
    gns.sop_total_annual_target AS sop_annual_target,
    gns.sop_total_annual_target - gns.expected_total_annual AS annual_target_variance,
    CASE WHEN ABS(gns.sop_total_annual_target - gns.expected_total_annual) > 1000 THEN 'MISMATCH' ELSE 'OK' END AS annual_validation_status,
    gns.expected_total_q1 AS expected_q1_target,
    gns.sop_total_q1_target AS sop_q1_target,
    gns.sop_total_q1_target - gns.expected_total_q1 AS q1_target_variance,
    -- Include per-source validation details
    ARRAY(
      SELECT AS STRUCT source, expected_annual_acv, sop_annual_acv, annual_variance, validation_status
      FROM global_target_validation ORDER BY expected_annual_acv DESC
    ) AS source_validation,
    -- Include full regional breakdown for debugging
    ARRAY(
      SELECT AS STRUCT region, source, q1_target_acv
      FROM sop_all_regions_summary ORDER BY source, region
    ) AS regional_breakdown
  FROM global_new_logo_summary gns) AS global_target_summary,

  -- Expansion Attainment by Region (for transparency on filter decisions)
  ARRAY(
    SELECT AS STRUCT
      region,
      expansion_target_acv,
      expansion_actual_acv,
      expansion_attainment,
      expansion_at_target,
      CASE WHEN expansion_at_target THEN 'EXPANSION rows excluded from top risks' ELSE 'EXPANSION rows eligible for top risks' END AS filter_status
    FROM expansion_attainment_by_region ORDER BY region
  ) AS expansion_rollup_status,

  STRUCT(
    ARRAY(
      SELECT AS STRUCT
        region, funnel_type, source, segment, rank_in_region,

        -- Annual summary
        annual_target_acv, annual_actual_acv, annual_acv_gap, annual_acv_pacing,

        -- MTD horizon
        STRUCT(
          mtd_target_mql AS target_mql, mtd_actual_mql AS actual_mql, mtd_mql_attainment AS mql_attainment,
          mtd_target_sql AS target_sql, mtd_actual_sql AS actual_sql, mtd_sql_attainment AS sql_attainment,
          mtd_target_sal AS target_sal, mtd_actual_sal AS actual_sal, mtd_sal_attainment AS sal_attainment,
          mtd_target_sqo AS target_sqo, mtd_actual_sqo AS actual_sqo, mtd_sqo_attainment AS sqo_attainment,
          mtd_target_won AS target_won, mtd_actual_won AS actual_won, mtd_won_attainment AS won_attainment,
          mtd_target_acv AS target_acv, mtd_actual_acv AS actual_acv, mtd_acv_attainment AS acv_attainment
        ) AS mtd,

        -- QTD horizon
        STRUCT(
          qtd_target_mql AS target_mql, qtd_actual_mql AS actual_mql, qtd_mql_attainment AS mql_attainment,
          qtd_target_sql AS target_sql, qtd_actual_sql AS actual_sql, qtd_sql_attainment AS sql_attainment,
          qtd_target_sal AS target_sal, qtd_actual_sal AS actual_sal, qtd_sal_attainment AS sal_attainment,
          qtd_target_sqo AS target_sqo, qtd_actual_sqo AS actual_sqo, qtd_sqo_attainment AS sqo_attainment,
          qtd_target_won AS target_won, qtd_actual_won AS actual_won, qtd_won_attainment AS won_attainment,
          qtd_target_acv AS target_acv, qtd_actual_acv AS actual_acv, qtd_acv_attainment AS acv_attainment
        ) AS qtd,

        -- Rolling 7d horizon
        STRUCT(
          r7d_target_mql AS target_mql, r7d_actual_mql AS actual_mql, r7d_mql_attainment AS mql_attainment,
          r7d_target_sql AS target_sql, r7d_actual_sql AS actual_sql, r7d_sql_attainment AS sql_attainment,
          r7d_target_sal AS target_sal, r7d_actual_sal AS actual_sal, r7d_sal_attainment AS sal_attainment,
          r7d_target_sqo AS target_sqo, r7d_actual_sqo AS actual_sqo, r7d_sqo_attainment AS sqo_attainment,
          r7d_target_won AS target_won, r7d_actual_won AS actual_won, r7d_won_attainment AS won_attainment,
          r7d_target_acv AS target_acv, r7d_actual_acv AS actual_acv, r7d_acv_attainment AS acv_attainment
        ) AS rolling_7d,

        -- Rolling 30d horizon
        STRUCT(
          r30d_target_mql AS target_mql, r30d_actual_mql AS actual_mql, r30d_mql_attainment AS mql_attainment,
          r30d_target_sql AS target_sql, r30d_actual_sql AS actual_sql, r30d_sql_attainment AS sql_attainment,
          r30d_target_sal AS target_sal, r30d_actual_sal AS actual_sal, r30d_sal_attainment AS sal_attainment,
          r30d_target_sqo AS target_sqo, r30d_actual_sqo AS actual_sqo, r30d_sqo_attainment AS sqo_attainment,
          r30d_target_won AS target_won, r30d_actual_won AS actual_won, r30d_won_attainment AS won_attainment,
          r30d_target_acv AS target_acv, r30d_actual_acv AS actual_acv, r30d_acv_attainment AS acv_attainment
        ) AS rolling_30d,

        -- Trend indicators (positive = improving, negative = declining)
        STRUCT(
          mql_trend_delta,
          won_trend_delta,
          acv_trend_delta,
          CASE
            WHEN mql_trend_delta > 0.10 THEN 'improving'
            WHEN mql_trend_delta < -0.10 THEN 'declining'
            ELSE 'stable'
          END AS mql_trend,
          CASE
            WHEN won_trend_delta > 0.10 THEN 'improving'
            WHEN won_trend_delta < -0.10 THEN 'declining'
            ELSE 'stable'
          END AS won_trend,
          CASE
            WHEN acv_trend_delta > 0.10 THEN 'improving'
            WHEN acv_trend_delta < -0.10 THEN 'declining'
            ELSE 'stable'
          END AS acv_trend
        ) AS trends

      FROM top_risks_per_region WHERE region = 'AMER' ORDER BY rank_in_region
    ) AS AMER,

    ARRAY(
      SELECT AS STRUCT
        region, funnel_type, source, segment, rank_in_region,
        annual_target_acv, annual_actual_acv, annual_acv_gap, annual_acv_pacing,
        STRUCT(
          mtd_target_mql AS target_mql, mtd_actual_mql AS actual_mql, mtd_mql_attainment AS mql_attainment,
          mtd_target_sql AS target_sql, mtd_actual_sql AS actual_sql, mtd_sql_attainment AS sql_attainment,
          mtd_target_sal AS target_sal, mtd_actual_sal AS actual_sal, mtd_sal_attainment AS sal_attainment,
          mtd_target_sqo AS target_sqo, mtd_actual_sqo AS actual_sqo, mtd_sqo_attainment AS sqo_attainment,
          mtd_target_won AS target_won, mtd_actual_won AS actual_won, mtd_won_attainment AS won_attainment,
          mtd_target_acv AS target_acv, mtd_actual_acv AS actual_acv, mtd_acv_attainment AS acv_attainment
        ) AS mtd,
        STRUCT(
          qtd_target_mql AS target_mql, qtd_actual_mql AS actual_mql, qtd_mql_attainment AS mql_attainment,
          qtd_target_sql AS target_sql, qtd_actual_sql AS actual_sql, qtd_sql_attainment AS sql_attainment,
          qtd_target_sal AS target_sal, qtd_actual_sal AS actual_sal, qtd_sal_attainment AS sal_attainment,
          qtd_target_sqo AS target_sqo, qtd_actual_sqo AS actual_sqo, qtd_sqo_attainment AS sqo_attainment,
          qtd_target_won AS target_won, qtd_actual_won AS actual_won, qtd_won_attainment AS won_attainment,
          qtd_target_acv AS target_acv, qtd_actual_acv AS actual_acv, qtd_acv_attainment AS acv_attainment
        ) AS qtd,
        STRUCT(
          r7d_target_mql AS target_mql, r7d_actual_mql AS actual_mql, r7d_mql_attainment AS mql_attainment,
          r7d_target_sql AS target_sql, r7d_actual_sql AS actual_sql, r7d_sql_attainment AS sql_attainment,
          r7d_target_sal AS target_sal, r7d_actual_sal AS actual_sal, r7d_sal_attainment AS sal_attainment,
          r7d_target_sqo AS target_sqo, r7d_actual_sqo AS actual_sqo, r7d_sqo_attainment AS sqo_attainment,
          r7d_target_won AS target_won, r7d_actual_won AS actual_won, r7d_won_attainment AS won_attainment,
          r7d_target_acv AS target_acv, r7d_actual_acv AS actual_acv, r7d_acv_attainment AS acv_attainment
        ) AS rolling_7d,
        STRUCT(
          r30d_target_mql AS target_mql, r30d_actual_mql AS actual_mql, r30d_mql_attainment AS mql_attainment,
          r30d_target_sql AS target_sql, r30d_actual_sql AS actual_sql, r30d_sql_attainment AS sql_attainment,
          r30d_target_sal AS target_sal, r30d_actual_sal AS actual_sal, r30d_sal_attainment AS sal_attainment,
          r30d_target_sqo AS target_sqo, r30d_actual_sqo AS actual_sqo, r30d_sqo_attainment AS sqo_attainment,
          r30d_target_won AS target_won, r30d_actual_won AS actual_won, r30d_won_attainment AS won_attainment,
          r30d_target_acv AS target_acv, r30d_actual_acv AS actual_acv, r30d_acv_attainment AS acv_attainment
        ) AS rolling_30d,
        STRUCT(
          mql_trend_delta, won_trend_delta, acv_trend_delta,
          CASE WHEN mql_trend_delta > 0.10 THEN 'improving' WHEN mql_trend_delta < -0.10 THEN 'declining' ELSE 'stable' END AS mql_trend,
          CASE WHEN won_trend_delta > 0.10 THEN 'improving' WHEN won_trend_delta < -0.10 THEN 'declining' ELSE 'stable' END AS won_trend,
          CASE WHEN acv_trend_delta > 0.10 THEN 'improving' WHEN acv_trend_delta < -0.10 THEN 'declining' ELSE 'stable' END AS acv_trend
        ) AS trends
      FROM top_risks_per_region WHERE region = 'EMEA' ORDER BY rank_in_region
    ) AS EMEA,

    ARRAY(
      SELECT AS STRUCT
        region, funnel_type, source, segment, rank_in_region,
        annual_target_acv, annual_actual_acv, annual_acv_gap, annual_acv_pacing,
        STRUCT(
          mtd_target_mql AS target_mql, mtd_actual_mql AS actual_mql, mtd_mql_attainment AS mql_attainment,
          mtd_target_sql AS target_sql, mtd_actual_sql AS actual_sql, mtd_sql_attainment AS sql_attainment,
          mtd_target_sal AS target_sal, mtd_actual_sal AS actual_sal, mtd_sal_attainment AS sal_attainment,
          mtd_target_sqo AS target_sqo, mtd_actual_sqo AS actual_sqo, mtd_sqo_attainment AS sqo_attainment,
          mtd_target_won AS target_won, mtd_actual_won AS actual_won, mtd_won_attainment AS won_attainment,
          mtd_target_acv AS target_acv, mtd_actual_acv AS actual_acv, mtd_acv_attainment AS acv_attainment
        ) AS mtd,
        STRUCT(
          qtd_target_mql AS target_mql, qtd_actual_mql AS actual_mql, qtd_mql_attainment AS mql_attainment,
          qtd_target_sql AS target_sql, qtd_actual_sql AS actual_sql, qtd_sql_attainment AS sql_attainment,
          qtd_target_sal AS target_sal, qtd_actual_sal AS actual_sal, qtd_sal_attainment AS sal_attainment,
          qtd_target_sqo AS target_sqo, qtd_actual_sqo AS actual_sqo, qtd_sqo_attainment AS sqo_attainment,
          qtd_target_won AS target_won, qtd_actual_won AS actual_won, qtd_won_attainment AS won_attainment,
          qtd_target_acv AS target_acv, qtd_actual_acv AS actual_acv, qtd_acv_attainment AS acv_attainment
        ) AS qtd,
        STRUCT(
          r7d_target_mql AS target_mql, r7d_actual_mql AS actual_mql, r7d_mql_attainment AS mql_attainment,
          r7d_target_sql AS target_sql, r7d_actual_sql AS actual_sql, r7d_sql_attainment AS sql_attainment,
          r7d_target_sal AS target_sal, r7d_actual_sal AS actual_sal, r7d_sal_attainment AS sal_attainment,
          r7d_target_sqo AS target_sqo, r7d_actual_sqo AS actual_sqo, r7d_sqo_attainment AS sqo_attainment,
          r7d_target_won AS target_won, r7d_actual_won AS actual_won, r7d_won_attainment AS won_attainment,
          r7d_target_acv AS target_acv, r7d_actual_acv AS actual_acv, r7d_acv_attainment AS acv_attainment
        ) AS rolling_7d,
        STRUCT(
          r30d_target_mql AS target_mql, r30d_actual_mql AS actual_mql, r30d_mql_attainment AS mql_attainment,
          r30d_target_sql AS target_sql, r30d_actual_sql AS actual_sql, r30d_sql_attainment AS sql_attainment,
          r30d_target_sal AS target_sal, r30d_actual_sal AS actual_sal, r30d_sal_attainment AS sal_attainment,
          r30d_target_sqo AS target_sqo, r30d_actual_sqo AS actual_sqo, r30d_sqo_attainment AS sqo_attainment,
          r30d_target_won AS target_won, r30d_actual_won AS actual_won, r30d_won_attainment AS won_attainment,
          r30d_target_acv AS target_acv, r30d_actual_acv AS actual_acv, r30d_acv_attainment AS acv_attainment
        ) AS rolling_30d,
        STRUCT(
          mql_trend_delta, won_trend_delta, acv_trend_delta,
          CASE WHEN mql_trend_delta > 0.10 THEN 'improving' WHEN mql_trend_delta < -0.10 THEN 'declining' ELSE 'stable' END AS mql_trend,
          CASE WHEN won_trend_delta > 0.10 THEN 'improving' WHEN won_trend_delta < -0.10 THEN 'declining' ELSE 'stable' END AS won_trend,
          CASE WHEN acv_trend_delta > 0.10 THEN 'improving' WHEN acv_trend_delta < -0.10 THEN 'declining' ELSE 'stable' END AS acv_trend
        ) AS trends
      FROM top_risks_per_region WHERE region = 'APAC' ORDER BY rank_in_region
    ) AS APAC
  ) AS top_risks_by_region
)) AS risk_analysis_json
FROM dates d CROSS JOIN params
