-- ============================================================================
-- POR RISK ANALYSIS QUERY
-- Version: 4.2.0
-- Last Updated: 2026-01-12
-- Report Period: Q1 2026 QTD (January 1-12, 2026)
-- Scope: EXCLUDES RENEWALS (New Logo + Expansion + Migration only)
-- ============================================================================
--
-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║                         EXECUTIVE SUMMARY                                 ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║ POR at 96.5% QTD attainment - STRONG performance, near target pace.      ║
-- ║ Expansion OUTPERFORMING across all regions (131-238% attainment).        ║
-- ║ AMER Migration is CRITICAL MISS - zero bookings against $35K QTD target. ║
-- ║ EMEA performing well - Migration 130%, New Logo 89% (both trending up).  ║
-- ║ KEY WIN: Expansion driving results with $231.9K actual vs $157.7K target.║
-- ║ KEY ISSUE: AMER Migration and APAC New Logo at 0% - need pipeline focus. ║
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
-- | AMER   | New Logo   |   $524,260 | $69,901 |    $31,998 |   45.8% | 🔴 RED  |
-- | AMER   | Expansion  |   $832,000 |$110,933 |   $145,750 |  131.4% | 🟢 GREEN|
-- | AMER   | Migration  |   $264,000 | $35,200 |        $0  |    0.0% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | AMER SUBTOTAL       | $1,620,260 |$216,034 |   $177,748 |   82.3% | 🟡 YELLOW|
-- +--------+------------+------------+---------+------------+---------+--------+
-- | EMEA   | New Logo   |   $261,800 | $34,907 |    $30,985 |   88.8% | 🟡 YELLOW|
-- | EMEA   | Expansion  |   $304,800 | $40,640 |    $71,498 |  175.9% | 🟢 GREEN|
-- | EMEA   | Migration  |   $273,600 | $36,480 |    $47,356 |  129.8% | 🟢 GREEN|
-- +--------+------------+------------+---------+------------+---------+--------+
-- | EMEA SUBTOTAL       |   $840,200 |$112,027 |   $149,839 |  133.7% | 🟢 GREEN|
-- +--------+------------+------------+---------+------------+---------+--------+
-- | APAC   | New Logo   |    $94,000 | $12,533 |        $0  |    0.0% | 🔴 RED  |
-- | APAC   | Expansion  |    $46,200 |  $6,160 |    $14,644 |  237.7% | 🟢 GREEN|
-- | APAC   | Migration  |    $58,650 |  $7,820 |        $0  |    0.0% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | APAC SUBTOTAL       |   $198,850 | $26,513 |    $14,644 |   55.2% | 🔴 RED  |
-- +--------+------------+------------+---------+------------+---------+--------+
-- | GRAND TOTAL         | $2,659,310 |$354,575 |   $342,231 |   96.5% | 🟢 GREEN|
-- +--------+------------+------------+---------+------------+---------+--------+
--
-- ============================================================================
--                         REGIONAL BREAKDOWN (QTD ACTUALS)
-- ============================================================================
--
--   AMER (US):
--   ├── New Logo:   5 deals  │ $31,998 ACV (45.8% of QTD target)
--   ├── Expansion: 19 deals  │ $145,750 ACV (131.4% of QTD target)
--   └── Migration:  0 deals  │ $0 ACV (0.0% of QTD target)
--   ═══ TOTAL:     24 deals  │ $177,748 ACV
--
--   EMEA (UK):
--   ├── New Logo:   2 deals  │ $30,985 ACV (88.8% of QTD target)
--   ├── Expansion: 24 deals  │ $71,498 ACV (175.9% of QTD target)
--   └── Migration:  1 deal   │ $47,356 ACV (129.8% of QTD target)
--   ═══ TOTAL:     27 deals  │ $149,839 ACV
--
--   APAC (AU):
--   ├── New Logo:   0 deals  │ $0 ACV (0.0% of QTD target)
--   ├── Expansion:  5 deals  │ $14,644 ACV (237.7% of QTD target)
--   └── Migration:  0 deals  │ $0 ACV (0.0% of QTD target)
--   ═══ TOTAL:      5 deals  │ $14,644 ACV
--
-- ============================================================================
-- ║                    FULL FUNNEL RCA - MISSED CATEGORIES                   ║
-- ============================================================================
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 1. AMER NEW LOGO - 33.6% Attainment ($63,155 Gap to QTD Target)         │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      5 deals / $31,998 ACV
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             100% (no losses yet - good sign)
--    ├── Open Pipeline:        269 opps / $624,150 ACV
--    └── Avg Pipeline Age:     431 days (MODERATELY AGED)
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ $624K pipeline exists - coverage looks adequate     ║
--    ║               ║ But 431 day avg age suggests need for fresh leads   ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ Win rate is strong (100%) - conversion not issue    ║
--    ║               ║ Volume of deals closing is the constraint           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ Only 5 deals closed - need more late-stage opps     ║
--    ║               ║ No losses = quality deals, but too few of them      ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → Accelerate late-stage pipeline - pull forward closeable deals
--    → Marketing: Increase MQL volume to feed pipeline
--    → Sales: Focus on advancing existing pipeline vs new prospecting
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 2. AMER MIGRATION - 0.0% Attainment ($32,267 Gap to QTD Target)         │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      0 deals / $0 ACV
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             N/A (no closed deals)
--    ├── Open Pipeline:        79 opps / $405,588 ACV
--    └── Avg Pipeline Age:     84 days (HEALTHY - recent pipeline)
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ $406K pipeline with healthy 84-day age              ║
--    ║               ║ Pipeline coverage = 1.5x Q1 target (adequate)       ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ 79 opportunities but none closing - stage issue?    ║
--    ║               ║ May need deal acceleration or pricing flexibility   ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ TIMING ISSUE - pipeline exists but not converting   ║
--    ║               ║ Migration deals typically have longer sales cycles  ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → URGENT: Review top 10 Migration opps by close date
--    → Identify any deals that can be pulled into January
--    → Check Migration Specialist capacity and deal coverage
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 3. APAC NEW LOGO - 0.0% Attainment ($15,624 Gap to QTD Target)          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      0 deals / $0 ACV
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             N/A (no closed deals)
--    ├── Open Pipeline:        27 opps / $1,339,349 ACV
--    └── Avg Pipeline Age:     111 days
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ STRONG - $1.34M pipeline vs $128K Q1 target         ║
--    ║               ║ Pipeline coverage = 10.5x (excellent)               ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ 27 opps but none closing yet                        ║
--    ║               ║ APAC deals may have longer evaluation cycles        ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ Pipeline quality or sales execution concern         ║
--    ║               ║ 0 wins with massive pipeline = conversion gap       ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → Review APAC pipeline quality - validate deal stages are accurate
--    → Check if any large deals are in negotiation that could close soon
--    → Consider APAC-specific sales enablement or pricing strategy
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 4. APAC MIGRATION - 0.0% Attainment ($7,168 Gap to QTD Target)          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    FUNNEL METRICS:
--    ├── Won Deals (QTD):      0 deals / $0 ACV
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             N/A (no closed deals)
--    ├── Open Pipeline:        17 opps / $110,761 ACV
--    └── Avg Pipeline Age:     118 days
--
--    ROOT CAUSE ANALYSIS:
--    ╔═══════════════╦═════════════════════════════════════════════════════╗
--    ║ FUNNEL STAGE  ║ DIAGNOSIS                                           ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ TOP OF FUNNEL ║ $111K pipeline vs $59K Q1 target = 1.9x coverage    ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ MID FUNNEL    ║ 17 opportunities at healthy age (118 days)          ║
--    ╠═══════════════╬═════════════════════════════════════════════════════╣
--    ║ BOTTOM FUNNEL ║ No conversions yet - timing or execution issue      ║
--    ╚═══════════════╩═════════════════════════════════════════════════════╝
--
--    RECOMMENDATION:
--    → Review APAC Migration pipeline by expected close date
--    → Confirm Migration Specialist coverage for AU market
--    → May be timing issue - check deals expected in late Jan/Feb
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ 5. EMEA NEW LOGO - 58.2% Attainment ($22,256 Gap to QTD Target)         │
-- │ 6. EMEA EXPANSION - 52.1% Attainment ($17,854 Gap to QTD Target)        │
-- └─────────────────────────────────────────────────────────────────────────┘
--
--    EMEA NEW LOGO FUNNEL METRICS:
--    ├── Won Deals (QTD):      2 deals / $30,985 ACV
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             100%
--    ├── Open Pipeline:        122 opps / $388,177 ACV
--    └── Avg Pipeline Age:     281 days
--
--    EMEA EXPANSION FUNNEL METRICS:
--    ├── Won Deals (QTD):      29 deals / $19,399 ACV (low ACV/deal)
--    ├── Lost Deals (QTD):     0 deals / $0 ACV
--    ├── Win Rate:             100%
--    ├── Open Pipeline:        503 opps / -$9,926 ACV (negative pipeline?)
--    └── Avg Pipeline Age:     768 days (VERY STALE)
--
--    ANALYSIS: EMEA Expansion shows 768-day pipeline age with negative
--    pipeline ACV - indicates stale/churned opps that need cleanup.
--    New Logo pipeline is healthier but still needs acceleration.
--
--    RECOMMENDATION:
--    → EMEA Expansion: Urgent pipeline scrub needed - remove stale opps
--    → EMEA New Logo: Accelerate 122 opps in pipeline - good coverage
--    → Both categories have 100% win rate - focus on closing volume
--
-- ============================================================================
-- ║                    PIPELINE COVERAGE ANALYSIS                            ║
-- ============================================================================
--
-- +--------+------------+-----------+-------------+----------+----------------+
-- | Region | Category   | Q1 Target | Pipeline $  | Coverage | Assessment     |
-- +--------+------------+-----------+-------------+----------+----------------+
-- | AMER   | New Logo   |  $778,561 |    $624,150 |    0.8x  | INSUFFICIENT   |
-- | AMER   | Expansion  |  $832,000 |    $272,287 |    0.3x  | LOW (but 142%) |
-- | AMER   | Migration  |  $264,000 |    $405,588 |    1.5x  | Adequate       |
-- | EMEA   | New Logo   |  $435,601 |    $388,177 |    0.9x  | MARGINAL       |
-- | EMEA   | Expansion  |  $304,800 |     -$9,926 |   -0.0x  | STALE/CLEANUP  |
-- | EMEA   | Migration  |  $273,600 |    $726,890 |    2.7x  | Strong         |
-- | APAC   | New Logo   |  $127,837 |  $1,339,349 |   10.5x  | Excess/Quality?|
-- | APAC   | Expansion  |   $46,200 |      $6,648 |    0.1x  | LOW (but 259%) |
-- | APAC   | Migration  |   $58,650 |    $110,761 |    1.9x  | Adequate       |
-- +--------+------------+-----------+-------------+----------+----------------+
--
-- NOTE: EMEA Expansion shows negative pipeline - requires data cleanup.
-- APAC New Logo has massive pipeline but zero conversions - quality concern.
--
-- ============================================================================
--                          PRIORITY ACTION ITEMS
-- ============================================================================
--
-- ┌── CRITICAL (This Week) ──────────────────────────────────────────────────┐
-- │ [ ] AMER Migration: Review top 10 deals by close date - find pull-fwd    │
-- │ [ ] APAC New Logo: Validate pipeline quality on $1.3M pipeline           │
-- │ [ ] EMEA Expansion: Pipeline scrub - negative ACV indicates stale data   │
-- │ [ ] APAC: Confirm rep capacity for both New Logo and Migration           │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌── HIGH PRIORITY (This Month) ────────────────────────────────────────────┐
-- │ [ ] AMER New Logo: Increase late-stage pipeline - only $624K vs $779K tgt│
-- │ [ ] Marketing: Review APAC lead quality - high volume but no conversion  │
-- │ [ ] RevOps: Implement pipeline hygiene across all regions                │
-- │ [ ] Sales Ops: Stage accuracy audit for APAC opportunities               │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ┌── ONGOING MONITORING ────────────────────────────────────────────────────┐
-- │ [ ] Weekly pipeline coverage by region/category                          │
-- │ [ ] Migration deal velocity tracking                                     │
-- │ [ ] APAC conversion rate monitoring                                      │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- ============================================================================
-- ║                    LOSS REASON ANALYSIS (Q1 2026 QTD)                    ║
-- ============================================================================
--
-- POR CLOSED-LOST DEALS (Q1 2026 QTD):
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ ZERO CLOSED-LOST DEALS in Q1 2026 QTD for New Logo/Expansion/Migration    ║
-- ║ This aligns with the 100% win rates shown in the attainment scorecard.    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- ANALYSIS:
-- While 100% win rates appear positive, combined with low attainment this
-- indicates the PRIMARY ISSUE is DEAL VOLUME, not conversion quality.
--
-- +----------------------------+-------+------------+
-- | Loss Reason                | Deals | Lost ACV   |
-- +----------------------------+-------+------------+
-- | (No losses in period)      |     0 |       $0   |
-- +----------------------------+-------+------------+
--
-- IMPLICATION:
-- The funnel bottleneck for POR is NOT at the Closed Lost stage.
-- Focus areas should be:
-- → AMER Migration: Pipeline velocity (0 deals closed with $406K pipeline)
-- → APAC New Logo: Pipeline generation (zero activity)
-- → AMER New Logo: Deal acceleration (33.6% attainment)
--
-- COMPETITOR ANALYSIS:
-- No competitor losses to analyze for Q1 2026 QTD.
--
-- ============================================================================
-- ║                    TOP-OF-FUNNEL ANALYSIS (MQL→Won)                      ║
-- ============================================================================
--
-- POR INBOUND FUNNEL (Q1 2026 QTD):
-- +----------+------+------+------+------+------+----------------+
-- | Division | MQL  | SQL  | SAL  | SQO  | Won  | MQL→SQL Rate   |
-- +----------+------+------+------+------+------+----------------+
-- | US       |   58 |   34 |   24 |    7 |    2 |   58.6%        |
-- | UK       |   13 |    3 |    1 |    1 |    1 |   23.1%        |
-- | AU       |    6 |    3 |    2 |    2 |    0 |   50.0%        |
-- +----------+------+------+------+------+------+----------------+
-- | TOTAL    |   77 |   40 |   27 |   10 |    3 |   51.9%        |
-- +----------+------+------+------+------+------+----------------+
--
-- NOTE: SDRSource=Inbound shows 34 SQL, 24 SAL, 7 SQO, 2 Won for US
-- MQL counts appear in separate rows (SDRSource=NULL)
--
-- CONVERSION RATES:
-- ┌─────────────┬─────────┬─────────┬─────────┬─────────────────────────────┐
-- │ Stage       │ US Rate │ UK Rate │ AU Rate │ Assessment                  │
-- ├─────────────┼─────────┼─────────┼─────────┼─────────────────────────────┤
-- │ MQL→SQL     │  58.6%  │  23.1%  │  50.0%  │ UK significantly behind     │
-- │ SQL→SAL     │  70.6%  │  33.3%  │  66.7%  │ UK struggles at SQL stage   │
-- │ SAL→SQO     │  29.2%  │ 100.0%  │ 100.0%  │ US bottleneck at SAL→SQO    │
-- │ SQO→Won     │  28.6%  │ 100.0%  │   0.0%  │ AU critical - 0 wins from 2 │
-- └─────────────┴─────────┴─────────┴─────────┴─────────────────────────────┘
--
-- DROP-OFF ANALYSIS:
-- +----------+---------------+---------------+---------------+---------------+
-- | Division | MQL Dropout % | SQL Dropout % | SAL Dropout % | SQO Dropout % |
-- +----------+---------------+---------------+---------------+---------------+
-- | US       |     41.4%     |     29.4%     |     70.8%     |     71.4%     |
-- | UK       |     76.9%     |     66.7%     |      0.0%     |      0.0%     |
-- | AU       |     50.0%     |     33.3%     |      0.0%     |    100.0%     |
-- +----------+---------------+---------------+---------------+---------------+
--
-- CRITICAL FINDINGS:
-- 1. US: SAL→SQO (70.8% dropout) and SQO→Won (71.4% dropout) are major leaks
-- 2. UK: MQL→SQL (76.9% dropout) is the primary bottleneck
-- 3. AU: SQO→Won (100% dropout) - 2 SQOs but 0 wins
--
-- UNQUALIFIED REASONS:
-- +------------------------+-------+
-- | Reason                 | Count |
-- +------------------------+-------+
-- | Unresponsive           |     2 |
-- | Spam                   |     1 |
-- | No fit                 |     1 |
-- | No budget              |     1 |
-- +------------------------+-------+
--
-- ROOT CAUSE SYNTHESIS:
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. POR has ZERO losses in Q1 QTD - volume is the issue, not conversion   ║
-- ║ 2. UK MQL→SQL is only 23.1% - severe lead quality or SDR capacity issue  ║
-- ║ 3. US SAL→SQO (70.8% dropout) suggests qualification bar may be too high ║
-- ║ 4. AU has 0 wins from 2 SQOs - small sample but needs monitoring         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- RECOMMENDED ACTIONS:
-- → UK Marketing: Investigate 76.9% MQL dropout - lead quality check
-- → US Sales: Review SAL→SQO process - 70.8% dropout is opportunity loss
-- → AU: Monitor closely - small sample but concerning trend
-- → AMER Migration: Pipeline exists but not closing - deal review needed
--
-- ============================================================================
--                     BIGQUERY ANALYSIS QUERY
-- ============================================================================
-- Shows MTD, QTD, Rolling 7d, Rolling 30d attainment for each risk pocket
-- ACTUALS SOURCE: OpportunityViewTable (live data)
-- TARGETS SOURCE: StrategicOperatingPlan (planning data)
-- FILTER: por_record__c = true, Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
--
-- CHANGE LOG:
-- 2026-01-12 v4.2.0: CRITICAL FIX - FunnelType mapping corrected
--   - FunnelTypes now ONLY: NEW LOGO, EXPANSION, MIGRATION, RENEWAL
--   - Source (INBOUND, OUTBOUND, etc.) is separate dimension
--   - Removed incorrect "INBOUND" FunnelType mapping from New Business
-- 2026-01-11 v4.1.0: Added Loss Reason Analysis and Top-of-Funnel MQL RCA sections
-- 2026-01-11 v4.0.0: Full Funnel RCA with pipeline metrics (EXCLUDES RENEWALS)
-- 2026-01-11 v3.0.0: Added Executive Summary and Funnel RCA sections
-- 2026-01-11 v2.1.0: QA Remediation
--   - Removed non-existent Segment__c field reference (field does not exist)
--   - STRATEGIC segment now determined by ACV >= $100K threshold only
--   - Added documentation for future field mapping
-- 2026-01-11 v2.0.0: MIGRATION fix recovered $24.6K in orphaned actuals
-- 2026-01-10 v1.0.0: Initial multi-horizon implementation
-- ============================================================================
WITH
  params AS (
    SELECT DATE('2026-01-12') AS as_of_date, 'P50' AS percentile, 'POR' AS product_filter
  ),

  -- ============================================================================
  -- EXCEL Q1 2026 TARGETS (Source: 2026 Bookings Plan Draft.xlsx - "Plan by Month")
  -- These are the authoritative targets from the Excel planning document
  -- ============================================================================
  excel_q1_targets AS (
    -- POR Q1 2026 Targets from Excel (Plan by Month sheet)
    SELECT 'AMER' AS region, 'NEW LOGO' AS category, 524260.0 AS q1_target  -- SMB $358,160 + Strat $166,100
    UNION ALL SELECT 'AMER', 'MIGRATION', 264000.0
    UNION ALL SELECT 'AMER', 'EXPANSION', 832000.0
    UNION ALL SELECT 'APAC', 'NEW LOGO', 94000.0
    UNION ALL SELECT 'APAC', 'MIGRATION', 58650.0
    UNION ALL SELECT 'APAC', 'EXPANSION', 46200.0
    UNION ALL SELECT 'EMEA', 'NEW LOGO', 261800.0  -- SMB $178,200 + Strat $83,600
    UNION ALL SELECT 'EMEA', 'MIGRATION', 273600.0
    UNION ALL SELECT 'EMEA', 'EXPANSION', 304800.0
  ),

  excel_total AS (
    SELECT SUM(q1_target) AS total_q1_target  -- Should be $2,659,310
    FROM excel_q1_targets
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
      CASE
        WHEN Type = 'Existing Business' THEN 'EXPANSION'
        WHEN Type = 'New Business' THEN 'NEW LOGO'
        WHEN Type = 'Migration' THEN 'MIGRATION'
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
        -- Any non-INBOUND source must map to AM SOURCED to avoid orphaned actuals
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
      AND por_record__c = true
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
  -- TARGETS FROM STRATEGIC OPERATING PLAN
  -- DATA QUALITY NOTES:
  -- - Percentile filter ensures we only get P50 (avoids summing P25/P50/P75/P90)
  -- - SDRSource field mapping: INBOUND source -> INBOUND funnel, others -> NEW LOGO funnel
  -- - See sop_data_quality_fix_q1_2026.sql for full documentation of source mapping issues
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
      -- Keep actuals for MQL/SQL/SAL/SQO (funnel metrics not in OpportunityViewTable)
      sop.Actual_MQL,
      sop.Actual_SQL,
      sop.Actual_SAL,
      sop.Actual_SQO
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop, params
    WHERE sop.RecordType = params.product_filter
      AND sop.Percentile = params.percentile  -- CRITICAL: Filter by percentile to avoid summing P25/P50/P75/P90
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
      t.annual_target_mql, t.annual_actual_mql,
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
      t.target_mql, t.actual_mql,
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
      t.target_mql, t.actual_mql,
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
      t.target_mql, t.actual_mql,
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
      t.target_mql, t.actual_mql,
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
  -- ============================================================================
  top_risks_per_region AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY region ORDER BY annual_acv_gap DESC) AS rank_in_region
    FROM risk_pockets_with_attainment
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
