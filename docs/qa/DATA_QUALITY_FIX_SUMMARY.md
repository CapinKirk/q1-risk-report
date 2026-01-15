# Data Quality Fix Summary - Risk Analysis Queries

## Problem Identified

The risk analysis queries were using a **narrow MTD date filter** (Jan 1-10, 2026) that captured only **1.9% of the available data**. This created sparse, unrealistic reports with many segments showing 0 or very low MQL counts.

### Root Cause

The queries filtered ALL funnel metrics (MQL, SQL, SAL, SQO, Won) by:
```sql
WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
  AND RecordType = params.product_filter
  AND OpportunityType != 'RENEWAL'
```

This narrow 10-day window worked okay for the main report (which aggregates all products together), but failed for risk analysis because:
1. Risk queries segment data by product (POR vs R360)
2. Further segment by Region, FunnelType, Source, Segment
3. The narrow filter left insufficient data in each segment

## Data Before Fix

**R360 Inbound with MTD Filter (Jan 1-10):**
- Records: 150 (out of 6,579 total) = **2.3% of data**
- Target MQLs: 151 (out of 7,965 total) = **1.9% of data**
- Actual MQLs: 131

This caused risk segments to show unrealistically low numbers like:
- "17 actual vs 77 target MQLs" for R360 INBOUND | INBOUND | SMB
- "0 actual vs 2 target MQLs" for some APAC segments

## Solution Implemented

**Changed the date filter from MTD to Full Year (2026):**

**Before:**
```sql
WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
  AND RecordType = params.product_filter
  AND OpportunityType != 'RENEWAL'
```

**After:**
```sql
WHERE RecordType = params.product_filter
  AND OpportunityType != 'RENEWAL'
  AND EXTRACT(YEAR FROM date_basis) = 2026  -- Focus on current year only
```

### Rationale

For **risk analysis**, we need to see ALL risk pockets across the entire forecast/pipeline, not just opportunities closing in a narrow 10-day window. Risk analysis is about identifying where gaps exist across the full year, not just MTD performance.

## Data After Fix

**R360 Inbound with Full Year Filter:**
- Records: **6,579** (100% of 2026 data)
- Target MQLs: **7,965** (100% of targets)
- Actual MQLs: **604**
- MQL Attainment: 7.6%

Example risk segments now show realistic numbers:
- R360 INBOUND | INBOUND | SMB (AMER): **41 actual vs 636 target MQLs**
- R360 INBOUND | INBOUND | SMB (APAC): **1 actual vs 132 target MQLs**

## Impact

### Before Fix
- ❌ Only 2.3% of data visible
- ❌ Many segments showed 0 or unrealistically low MQLs
- ❌ Risk analysis was misleading - couldn't see real risk pockets
- ❌ User correctly identified data looked impossible

### After Fix
- ✅ 100% of 2026 data visible
- ✅ All segments show realistic MQL/funnel metrics
- ✅ Risk pockets properly identified across full year
- ✅ Data now matches business expectations

## Files Modified

1. `/Users/prestonharris/query_por_risk_analysis.sql` - Line 31-33
2. `/Users/prestonharris/query_r360_risk_analysis.sql` - Line 31-33

Both queries now use:
```sql
WHERE RecordType = params.product_filter
  AND OpportunityType != 'RENEWAL'
  AND EXTRACT(YEAR FROM date_basis) = 2026
```

## Validation Queries Run

1. **Debug script**: Analyzed data availability with different filters
2. **Comparison query**: Showed MTD captures only 150 records vs 6,579 total
3. **Final validation**: Confirmed full dataset now appears in reports

## Reports Generated

- `/Users/prestonharris/report_por_risks.txt` - Updated POR risk analysis
- `/Users/prestonharris/report_r360_risks.txt` - Updated R360 risk analysis

Both reports now show comprehensive risk analysis across the full 2026 year.

## Recommendation

The main report query (`query_1_improved.sql`) should **remain unchanged** as it's designed for daily/weekly scorecard tracking (WTD/MTD/QTD/YTD). The narrow MTD filter is appropriate there because it aggregates all products together.

The risk analysis queries now correctly use a broader filter appropriate for identifying risk pockets across the full forecast horizon.

---

## Additional Fix: R360 PARTNERSHIPS Targets (2026-01-11)

### Problem
R360 PARTNERSHIPS has non-zero target values in the SOP table, but business expectation for Q1 2026 is $0 for all PARTNERSHIPS metrics.

**Current SOP Table Values (Incorrect):**
| Metric | Value |
|--------|-------|
| Target_SQL | 3 |
| Target_SAL | 3 |
| Target_SQO | 3 |
| Target_Won | 3 |
| Target_ACV | $3,740 |

**Expected Values:**
All should be $0.

### Key Insight
When PARTNERSHIPS targets are zeroed out, the remaining source totals (INBOUND, OUTBOUND, AE SOURCED, TRADESHOW) sum correctly to expected Q1 2026 targets (~$403,560).

### Solution
Query-level fix in `query_r360_risk_analysis.sql` (targets_base CTE):

```sql
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_Won END AS Target_Won,
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_ACV END AS Target_ACV,
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_MQL END AS Target_MQL,
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_SQL END AS Target_SQL,
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_SAL END AS Target_SAL,
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_SQO END AS Target_SQO,
```

**NOTE:** AE SOURCED does NOT need /100 correction - raw value ($128K) is correct.

### Related Documentation
- `/Users/prestonharris/sop_data_quality_fix_q1_2026.sql` - Full documentation
- `/Users/prestonharris/GENERATE_RISK_REPORTS_PROMPT.md` - Session prompt for report generation
