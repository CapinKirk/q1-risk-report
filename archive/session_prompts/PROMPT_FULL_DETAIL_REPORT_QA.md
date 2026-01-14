# Prompt: Full Detail Report Generation & QA

Copy this entire prompt into a new Claude Code window to generate and verify the risk analysis reports.

---

## Context

You are working on POR and R360 risk analysis reports. The following data quality fixes have been applied:

### Recent Fixes (2026-01-11)
1. **SDRSource N/A Default Logic** - N/A sources now map by opportunity type:
   - Existing Business / Renewal / Migration → AM SOURCED
   - New Business → AE SOURCED

2. **Case-Insensitive Matching** - Added UPPER() for SDRSource matching

3. **Tradeshow Source Added** - Explicit mapping for Tradeshow deals

### Outstanding Issue to Fix
**AE SOURCED and AM SOURCED deals often lack top-of-funnel metrics** (MQL, SQL, SAL, SQO) because they bypass the marketing funnel. When an opportunity exists but funnel stages are missing, we need to supplement the metrics.

**Business Logic:**
- For AE SOURCED: Rep creates opportunity directly → No MQL, SQL may exist from discovery call
- For AM SOURCED: Account Manager creates expansion opp → No MQL, SQL from customer request
- When Won exists but SQL/SQO are 0, impute backwards: Won=1 implies SQO>=1, SQL>=1

---

## Task 1: Fix Top-of-Funnel Metric Supplementation

Update `query_por_risk_analysis.sql` and `query_r360_risk_analysis.sql` to supplement funnel metrics for AE/AM SOURCED:

```sql
-- In the actuals aggregation, when source is AE SOURCED or AM SOURCED:
-- If actual_won > 0 but actual_sqo = 0, set actual_sqo = actual_won
-- If actual_sqo > 0 but actual_sql = 0, set actual_sql = actual_sqo
-- Rationale: A won deal implies it went through SQO and SQL stages

-- Example fix pattern:
CASE
  WHEN source IN ('AE SOURCED', 'AM SOURCED') AND actual_won > 0 AND actual_sqo = 0
  THEN actual_won
  ELSE actual_sqo
END AS actual_sqo,

CASE
  WHEN source IN ('AE SOURCED', 'AM SOURCED') AND COALESCE(actual_sqo, actual_won) > 0 AND actual_sql = 0
  THEN COALESCE(actual_sqo, actual_won)
  ELSE actual_sql
END AS actual_sql
```

---

## Task 2: Generate Full Detail Report

Create a new query `query_full_detail_report.sql` that outputs ALL segments (not just top 3 risks) with:

1. **All Dimensions**: Region, FunnelType, Source, Segment
2. **All Time Horizons**: MTD, QTD, Rolling 7d, Rolling 30d, Annual
3. **All Funnel Stages**: MQL, SQL, SAL, SQO, Won, ACV
4. **Status Classification**: ON_TRACK (>=90%), AT_RISK (70-89%), MISS (<70%)
5. **Diagnosis Fields**: Primary bottleneck stage, issue type (VOLUME/CONVERSION/HYBRID)

Output format should match this structure:
```
Region | FunnelType | Source | Segment | QTD_Target_ACV | QTD_Actual_ACV | QTD_Pacing_Pct | Status | Bottleneck_Stage | Issue_Type
```

---

## Task 3: QA Verification Queries

Run these verification queries and confirm outputs match expected values:

### QA-1: AMER NEW LOGO OUTBOUND SMB
```sql
-- Expected: 1 deal, $4,678 ACV
SELECT 'AMER_OUTBOUND_CHECK' AS test,
  COUNT(*) AS deal_count,
  ROUND(SUM(ACV), 2) AS total_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND por_record__c = true AND Division = 'US'
  AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10'
  AND Type = 'New Business'
  AND (SDRSource = 'Outbound' OR POR_SDRSource = 'Outbound')
  AND ACV > 0;
-- EXPECTED: deal_count=1, total_acv=4677.72
```

### QA-2: Source Distribution Validation
```sql
-- Verify N/A deals are correctly bucketed
SELECT
  Type,
  CASE
    WHEN UPPER(SDRSource) IN ('INBOUND','OUTBOUND','AE SOURCED','AM SOURCED','TRADESHOW')
    THEN UPPER(SDRSource)
    WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED (defaulted)'
    ELSE 'AE SOURCED (defaulted)'
  END AS mapped_source,
  COUNT(*) AS deals,
  ROUND(SUM(ACV), 0) AS acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND por_record__c = true AND Division = 'US'
  AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10'
  AND ACV > 0
GROUP BY 1, 2 ORDER BY 1, 2;
```

### QA-3: Funnel Metric Supplementation Check
```sql
-- For AE/AM SOURCED, verify Won > 0 implies SQO > 0
SELECT
  source,
  SUM(actual_won) AS total_won,
  SUM(actual_sqo) AS total_sqo,
  SUM(actual_sql) AS total_sql,
  CASE WHEN SUM(actual_won) > 0 AND SUM(actual_sqo) = 0 THEN 'NEEDS_FIX' ELSE 'OK' END AS sqo_status,
  CASE WHEN SUM(actual_sqo) > 0 AND SUM(actual_sql) = 0 THEN 'NEEDS_FIX' ELSE 'OK' END AS sql_status
FROM (
  -- Run the actuals CTE from your query here
  SELECT ...
)
WHERE source IN ('AE SOURCED', 'AM SOURCED')
GROUP BY source;
```

### QA-4: Cross-Product Comparison
```sql
-- Compare POR vs R360 totals to ensure no data leakage
SELECT
  'POR' AS product, COUNT(*) AS deals, ROUND(SUM(ACV), 0) AS acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND por_record__c = true
  AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10' AND ACV > 0

UNION ALL

SELECT
  'R360' AS product, COUNT(*) AS deals, ROUND(SUM(ACV), 0) AS acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND r360_record__c = true
  AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10' AND ACV > 0;
```

### QA-5: Percentile Filter Verification
```sql
-- Ensure SOP queries filter by P50 to avoid 3x overcounting
SELECT Percentile, COUNT(*) AS rows, ROUND(SUM(Target_ACV), 0) AS target_sum
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType = 'POR' AND Region = 'AMER' AND FunnelType = 'NEW LOGO' AND Source = 'OUTBOUND'
  AND TargetDate BETWEEN '2026-01-01' AND '2026-01-10'
GROUP BY Percentile;
-- VERIFY: P50, P75, P90 have SAME target values (duplicated by design)
-- CRITICAL: Query must filter WHERE Percentile = 'P50'
```

---

## Task 4: Expected Output Validation

After running the full detail report, validate these specific segments:

| Region | FunnelType | Source | Segment | Expected QTD Actual ACV | Expected Deals |
|--------|------------|--------|---------|------------------------|----------------|
| AMER | NEW LOGO | OUTBOUND | SMB | $4,678 | 1 |
| AMER | NEW LOGO | AE SOURCED | SMB | $5,675 | 1 (from N/A default) |
| AMER | EXPANSION | AM SOURCED | N/A | ~$90,033 | 9 |
| AMER | EXPANSION | INBOUND | N/A | ~$54,580 | 8 |

---

## Task 5: Update Documentation

After fixes are verified, update `LESSONS_LEARNED_ACTUALS_DATA_QUALITY.md` with:

1. New section on "Funnel Metric Supplementation for AE/AM SOURCED"
2. QA checklist for future report runs
3. Any new edge cases discovered

---

## Files to Modify

1. `query_por_risk_analysis.sql` - Add funnel metric supplementation
2. `query_r360_risk_analysis.sql` - Same fix
3. `query_full_detail_report.sql` - Create new (all segments, all metrics)
4. `LESSONS_LEARNED_ACTUALS_DATA_QUALITY.md` - Update with new learnings

---

## Success Criteria

- [ ] AMER NEW LOGO OUTBOUND shows exactly 1 deal, $4,678
- [ ] N/A sources correctly default by opportunity type
- [ ] AE/AM SOURCED deals have SQO >= Won count (supplemented)
- [ ] All 21 segments appear in full detail report
- [ ] No percentile duplication (P50 filter applied)
- [ ] POR and R360 totals are independent (no cross-product leakage)

---

## Commands to Run

```bash
# Test POR query
bq query --use_legacy_sql=false --format=json < query_por_risk_analysis.sql | head -50

# Test R360 query
bq query --use_legacy_sql=false --format=json < query_r360_risk_analysis.sql | head -50

# Generate full report
bq query --use_legacy_sql=false --format=pretty < query_full_detail_report.sql

# Run QA suite
bq query --use_legacy_sql=false --format=pretty < qa_verification_queries.sql
```
