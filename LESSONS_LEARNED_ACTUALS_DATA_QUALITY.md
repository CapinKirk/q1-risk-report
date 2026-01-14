# Lessons Learned: Actuals Data Quality Investigation
**Date:** January 11-12, 2026
**Last Updated:** January 12, 2026

## Updates (2026-01-12)
- Added Finding 6: FunnelType vs Source Dimension Confusion
- Added Finding 7: Excel vs BigQuery SOP Target Discrepancy
- Added Finding 8: Hardcoded Excel Targets Required

**Original Issue:** POR AMER OUTBOUND Actuals Discrepancy
**Expected:** 1 deal, $4,678 ACV
**Reported:** $31,200 ACV (incorrect)

---

## Root Cause Analysis

### Finding 1: SDRSource 'N/A' Incorrectly Defaulting to INBOUND

**Impact:** HIGH - 5,871 deals ($1.78M ACV) with SDRSource='N/A' were being incorrectly categorized as INBOUND source.

**Root Cause:** The source mapping logic had an `ELSE 'INBOUND'` fallback that caught all unrecognized SDRSource values, including 'N/A' and NULL.

**Before (Incorrect):**
```sql
CASE
  WHEN SDRSource = 'Outbound' THEN 'OUTBOUND'
  WHEN SDRSource = 'Inbound' THEN 'INBOUND'
  ...
  ELSE 'INBOUND'  -- Bug: N/A and unknown values default here
END
```

**After (Fixed):**
```sql
CASE
  WHEN UPPER(SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
  WHEN UPPER(SDRSource) = 'INBOUND' THEN 'INBOUND'
  ...
  WHEN SDRSource = 'N/A' OR SDRSource IS NULL THEN
    CASE
      WHEN UPPER(POR_SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
      ...
      -- Default by Type
      WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
      ELSE 'AE SOURCED'
    END
  WHEN Type IN ('Existing Business', 'Renewal', 'Migration') THEN 'AM SOURCED'
  ELSE 'AE SOURCED'
END
```

**Rationale:** SOP has no targets for 'N/A' source. Default varies by opportunity type:
- **EXPANSION / RENEWAL / MIGRATION** -> AM SOURCED (existing customer relationship)
- **NEW BUSINESS** -> AE SOURCED (new customer acquisition)

### Finding 2: Case Sensitivity Not Handled

**Impact:** MEDIUM - Could cause mismatches if SDRSource values have inconsistent casing.

**Solution:** Added `UPPER()` wrapper for case-insensitive matching.

### Finding 3: Tradeshow Source Missing

**Impact:** LOW - Tradeshow deals (23 deals, $234K) were falling into default bucket.

**Solution:** Added explicit `TRADESHOW` source mapping.

### Finding 4: SOP Table Has Duplicated Actuals Across Percentiles

**Impact:** HIGH if queried incorrectly - SOP.Actual_ACV is replicated across P50/P75/P90 rows.

**Key Rule:** When reading from SOP, ALWAYS filter by `Percentile = 'P50'` to avoid 3x overcounting.

**Correct:**
```sql
FROM StrategicOperatingPlan
WHERE Percentile = 'P50'  -- Required!
```

---

## Finding 5: AE/AM SOURCED Missing Top-of-Funnel Metrics

**Impact:** MEDIUM - Funnel conversion rates appear broken when Won > 0 but SQO/SQL = 0

**Root Cause:** AE SOURCED and AM SOURCED deals bypass the marketing funnel. Reps create opportunities directly without MQL/SQL tracking. This causes:
- Won = 5 but SQO = 0 (impossible in reality)
- Conversion rate calculations fail (division by zero)
- Funnel RCA incorrectly identifies "conversion" issues

**Status:** FIXED (2026-01-11)

**Solution Implemented:** Funnel metrics are now supplemented backwards from Won in all aggregated CTEs:
```sql
-- SQO: If Won > 0 but SQO = 0, set SQO = Won
CASE
  WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
    AND COALESCE(t.actual_sqo, 0) = 0
    AND COALESCE(a.actual_won, 0) > 0
  THEN COALESCE(a.actual_won, 0)
  ELSE COALESCE(t.actual_sqo, 0)
END AS actual_sqo

-- SQL: If SQO > 0 but SQL = 0, set SQL = SQO (or Won if SQO also 0)
CASE
  WHEN t.source IN ('AE SOURCED', 'AM SOURCED')
    AND COALESCE(t.actual_sql, 0) = 0
    AND (COALESCE(t.actual_sqo, 0) > 0 OR COALESCE(a.actual_won, 0) > 0)
  THEN GREATEST(COALESCE(t.actual_sqo, 0), COALESCE(a.actual_won, 0))
  ELSE COALESCE(t.actual_sql, 0)
END AS actual_sql
```

**Files Modified:**
- `query_por_risk_analysis.sql` - Applied fix to annual_aggregated, mtd_aggregated, qtd_aggregated, rolling_7d_aggregated, rolling_30d_aggregated
- `query_r360_risk_analysis.sql` - Same fix applied to all aggregated CTEs

**Rationale:** A closed-won deal logically passed through SQO and SQL stages, even if not formally tracked.

---

## Data Quality Rules

### Rule 1: Use OpportunityViewTable for Won/ACV Actuals

**Do:** Pull Won count and ACV from OpportunityViewTable
```sql
SELECT SUM(ACV), COUNT(*)
FROM OpportunityViewTable
WHERE Won = true
```

**Don't:** Use SOP.Actual_ACV for Won/ACV metrics (it may be stale or duplicated)

### Rule 2: Always Filter SOP by Percentile

**Do:**
```sql
FROM StrategicOperatingPlan WHERE Percentile = 'P50'
```

**Don't:**
```sql
FROM StrategicOperatingPlan  -- Missing percentile = 3x overcounting!
```

### Rule 3: Type-Based Default for Unknown Sources

**Do:** Map unknown/null sources based on opportunity type:
- Existing Business / Renewal / Migration → AM SOURCED
- New Business → AE SOURCED

**Don't:** Default all unknown sources to INBOUND (causes inflation)

### Rule 4: Case-Insensitive Field Matching

**Do:**
```sql
WHEN UPPER(SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
```

**Don't:**
```sql
WHEN SDRSource = 'Outbound' THEN 'OUTBOUND'  -- May miss 'OUTBOUND' or 'outbound'
```

### Rule 5: Validate Actuals Against Source of Truth

Before publishing any report, validate totals against:
1. OpportunityViewTable (for Won/ACV)
2. Salesforce reports (for cross-check)

---

## SDRSource Value Distribution (POR 2025-2026)

| SDRSource | Deal Count | Total ACV | Mapping |
|-----------|------------|-----------|---------|
| N/A | 5,871 | $1.78M | **Varies by Type** (was incorrectly all INBOUND) |
| AM Sourced | 1,066 | $3.32M | AM SOURCED |
| Inbound | 359 | $3.28M | INBOUND |
| AE Sourced | 191 | $2.18M | AE SOURCED |
| Outbound | 55 | $2.31M | OUTBOUND |
| Tradeshow | 23 | $0.23M | TRADESHOW |

**N/A Default Logic by Type:**
- Existing Business (EXPANSION) -> AM SOURCED
- Renewal -> AM SOURCED
- Migration -> AM SOURCED
- New Business -> AE SOURCED

---

## Files Modified

1. **query_por_risk_analysis.sql** - Updated source mapping logic, added funnel metric supplementation
2. **query_r360_risk_analysis.sql** - Updated source mapping logic (same fix), added funnel metric supplementation

## Files Created (2026-01-11)

3. **query_full_detail_report.sql** - Full detail report showing ALL segments (not just top 3 risks)
   - Outputs ~28 rows for POR (all segment combinations)
   - Includes: Region, FunnelType, Source, Segment
   - Metrics: QTD Target/Actual ACV, Pacing %, Status (ON_TRACK/AT_RISK/MISS)
   - Analysis: Bottleneck Stage, Issue Type (VOLUME/CONVERSION/HYBRID)
   - Full funnel: MQL, SQL, SAL, SQO, Won, ACV targets and actuals

---

## Validation Queries

### Check Source Distribution (Run Before Reports)
```sql
SELECT
  CASE
    WHEN UPPER(SDRSource) = 'INBOUND' THEN 'INBOUND'
    WHEN UPPER(SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
    WHEN UPPER(SDRSource) = 'AE SOURCED' THEN 'AE SOURCED'
    WHEN UPPER(SDRSource) = 'AM SOURCED' THEN 'AM SOURCED'
    WHEN UPPER(SDRSource) = 'TRADESHOW' THEN 'TRADESHOW'
    ELSE 'N/A'
  END AS mapped_source,
  COUNT(*) AS deal_count,
  ROUND(SUM(ACV), 0) AS total_acv
FROM sfdc.OpportunityViewTable
WHERE Won = true AND por_record__c = true
  AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10'
  AND ACV > 0
GROUP BY 1
ORDER BY total_acv DESC;
```

### Cross-Check SOP Actuals vs OpportunityViewTable
```sql
-- Should return 0 rows if data is consistent
SELECT * FROM (
  SELECT 'SOP' AS source, SUM(Actual_ACV) AS total
  FROM Staging.StrategicOperatingPlan
  WHERE RecordType = 'POR' AND Percentile = 'P50'
    AND TargetDate BETWEEN '2026-01-01' AND '2026-01-10'

  UNION ALL

  SELECT 'OppView' AS source, SUM(ACV) AS total
  FROM sfdc.OpportunityViewTable
  WHERE Won = true AND por_record__c = true
    AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10'
    AND ACV > 0
)
-- Totals should match (within rounding)
```

---

## Summary

| Issue | Impact | Status |
|-------|--------|--------|
| N/A source defaulting to INBOUND | High - 5,871 deals miscounted | FIXED (by Type) |
| Case sensitivity in source matching | Medium | FIXED |
| Missing Tradeshow source | Low | FIXED |
| SOP percentile duplication risk | High if not filtered | Documented |
| AE/AM SOURCED missing funnel metrics | Medium - broken conversion rates | FIXED (2026-01-11) |

### N/A Default Logic (Final)
| Opportunity Type | N/A Source Maps To |
|-----------------|-------------------|
| Existing Business (EXPANSION) | AM SOURCED |
| Renewal | AM SOURCED |
| Migration | AM SOURCED |
| New Business | AE SOURCED |

**Key Takeaway:** Always use OpportunityViewTable as source of truth for actuals, and verify SDRSource distribution before publishing reports.

---

## Finding 6: FunnelType vs Source Dimension Confusion (2026-01-12)

**Impact:** HIGH - Incorrect FunnelType mapping causes double-counting or missing targets

**Root Cause:** BigQuery SOP has "R360 INBOUND" and "INBOUND" listed as FunnelTypes, but INBOUND is actually a **Source dimension**, not a FunnelType.

**Valid FunnelTypes (ONLY these):**
- NEW LOGO (or R360 NEW LOGO)
- EXPANSION (or R360 EXPANSION)
- MIGRATION (or R360 MIGRATION)
- RENEWAL

**Source Dimension (separate from FunnelType):**
- INBOUND
- OUTBOUND
- AE SOURCED
- AM SOURCED
- TRADESHOW
- PARTNERSHIPS

**Before (Incorrect):**
```sql
-- Treated INBOUND as a FunnelType
CASE
  WHEN Type = 'New Business' AND SDRSource = 'Inbound' THEN 'R360 INBOUND'  -- WRONG!
  WHEN Type = 'New Business' THEN 'R360 NEW LOGO'
```

**After (Correct):**
```sql
-- FunnelType derived from Type ONLY
CASE
  WHEN Type = 'New Business' THEN 'NEW LOGO'  -- All New Business = NEW LOGO
  WHEN Type = 'Existing Business' THEN 'EXPANSION'
  WHEN Type = 'Migration' THEN 'MIGRATION'
  WHEN Type = 'Renewal' THEN 'RENEWAL'
END AS funnel_type,

-- Source is a SEPARATE dimension
CASE
  WHEN UPPER(SDRSource) = 'INBOUND' THEN 'INBOUND'
  WHEN UPPER(SDRSource) = 'OUTBOUND' THEN 'OUTBOUND'
  ...
END AS source
```

**SOP Query Fix:** When querying SOP, combine "R360 INBOUND" + "R360 NEW LOGO" FunnelTypes:
```sql
SELECT
  Region,
  CASE
    WHEN FunnelType IN ('R360 NEW LOGO', 'R360 INBOUND') THEN 'NEW LOGO'
    WHEN FunnelType = 'R360 EXPANSION' THEN 'EXPANSION'
    ELSE FunnelType
  END AS Category,
  SUM(Target_ACV) AS q1_target
FROM StrategicOperatingPlan
WHERE Percentile = 'P50'
GROUP BY Region, Category;
```

---

## Finding 7: Excel vs BigQuery SOP Target Discrepancy (2026-01-12)

**Impact:** MEDIUM - SOP targets don't exactly match Excel planning document

**Root Cause:** BigQuery StrategicOperatingPlan has slightly different targets than Excel "2026 Bookings Plan Draft.xlsx"

**Example Discrepancy Found:**
| Metric | BigQuery SOP | Excel | Difference |
|--------|--------------|-------|------------|
| AMER R360 SMB NEW LOGO Q1 | $407,259 | $403,560 | +$3,699 |
| AMER R360 Total NEW LOGO Q1 | $528,859 | $525,160 | +$3,699 |

**Solution:** Use Excel "Plan by Month" sheet as source of truth. Hardcode Excel values in SQL queries.

**Excel File:** `2026 Bookings Plan Draft.xlsx`
- **Authoritative Sheet:** "Plan by Month"
- **Outdated Sheet:** "Copy of Plan by Month QA" (has different, lower values - DO NOT USE)

---

## Finding 8: Hardcoded Excel Targets Required (2026-01-12)

**Impact:** HIGH - Reports must match Excel planning document exactly

**Solution Implemented:** Added `excel_q1_targets` CTE with hardcoded values from Excel:

**R360 Q1 2026 Targets (from Excel "Plan by Month"):**
```sql
excel_q1_targets AS (
  SELECT 'AMER' AS region, 'NEW LOGO' AS category, 525160.0 AS q1_target
  UNION ALL SELECT 'AMER', 'EXPANSION', 210000.0
  UNION ALL SELECT 'APAC', 'NEW LOGO', 20400.0
  UNION ALL SELECT 'APAC', 'EXPANSION', 850.0
  UNION ALL SELECT 'EMEA', 'NEW LOGO', 112200.0
  UNION ALL SELECT 'EMEA', 'EXPANSION', 0.0
)
-- R360 Total: $868,610 (excl. Renewals)
```

**POR Q1 2026 Targets (from Excel "Plan by Month"):**
```sql
excel_q1_targets AS (
  SELECT 'AMER' AS region, 'NEW LOGO' AS category, 524260.0 AS q1_target
  UNION ALL SELECT 'AMER', 'MIGRATION', 264000.0
  UNION ALL SELECT 'AMER', 'EXPANSION', 832000.0
  UNION ALL SELECT 'APAC', 'NEW LOGO', 94000.0
  UNION ALL SELECT 'APAC', 'MIGRATION', 58650.0
  UNION ALL SELECT 'APAC', 'EXPANSION', 46200.0
  UNION ALL SELECT 'EMEA', 'NEW LOGO', 261800.0
  UNION ALL SELECT 'EMEA', 'MIGRATION', 273600.0
  UNION ALL SELECT 'EMEA', 'EXPANSION', 304800.0
)
-- POR Total: $2,659,310 (excl. Renewals)
```

**Files Modified:**
- `query_r360_risk_analysis.sql` - Added excel_q1_targets CTE
- `query_por_risk_analysis.sql` - Added excel_q1_targets CTE

---

## QA Checklist (Run Before Publishing Reports)

### Pre-Flight Checks
- [ ] **Percentile Filter**: Verify `WHERE Percentile = 'P50'` in all SOP queries
- [ ] **Product Filter**: Confirm `por_record__c = true` (POR) or `r360_record__c = true` (R360)
- [ ] **Date Range**: Validate QTD start = first day of quarter
- [ ] **Division Filter**: Only US/UK/AU included (maps to AMER/EMEA/APAC)

### Source Mapping Validation
- [ ] **OUTBOUND Count**: Matches expected deal count
- [ ] **N/A Defaults**: Expansion/Renewal/Migration → AM SOURCED, New Business → AE SOURCED
- [ ] **No INBOUND Inflation**: N/A deals NOT going to INBOUND

### Funnel Metric Validation
- [ ] **AE/AM SOURCED**: If Won > 0, then SQO >= Won (supplemented)
- [ ] **Conversion Rates**: No division by zero errors
- [ ] **MQL Source**: Comes from MarketingFunnel tables, not SOP

### Cross-Checks
- [ ] **SOP vs OppView Actuals**: Totals should match (within rounding)
- [ ] **POR vs R360**: No cross-product leakage
- [ ] **Regional Totals**: AMER + EMEA + APAC = Global

### Specific Segment Verification
```
AMER NEW LOGO OUTBOUND SMB: Expected 1 deal, $4,678
AMER NEW LOGO AE SOURCED SMB: Includes N/A New Business deals
AMER EXPANSION AM SOURCED N/A: Includes N/A Existing Business deals
```

---

## Verification (Post-Fix)

AMER Q1 2026 QTD (Jan 1-10) Source Distribution:

| Source | Deals | ACV |
|--------|-------|-----|
| AM SOURCED | 9 | $90,033 |
| INBOUND | 10 | $72,314 |
| AE SOURCED | 1 | $5,675 |
| OUTBOUND | 1 | $4,678 |

**OUTBOUND correctly shows 1 deal, $4,678** (as expected)
