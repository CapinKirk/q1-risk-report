# Data Quality Audit Report: BigQuery SOP vs Excel Source of Truth

**Audit Date:** 2026-01-12
**Auditor:** Automated Data Quality System
**Scope:** Q1 2026 Targets (January-March)
**BigQuery Tables:** `data-analytics-306119.Staging.StrategicOperatingPlan`, `data-analytics-306119.sfdc.OpportunityViewTable`
**Excel Source of Truth:** "2026 Bookings Plan Draft.xlsx" (Plan by Month sheet)

---

## Executive Summary

### Critical Issues Found: 7

| Priority | Issue | Impact | Revenue at Risk |
|----------|-------|--------|-----------------|
| **CRITICAL** | "INBOUND" FunnelType in POR SOP | $361,431 in orphaned targets | $361,431 |
| **CRITICAL** | "R360 INBOUND" FunnelType in R360 SOP | $213,302 in orphaned targets | $213,302 |
| **HIGH** | Missing P25 percentile in SOP | Cannot generate P25 forecasts | N/A |
| **HIGH** | $3,699 AMER R360 SMB target discrepancy | Overstated Q1 target | $3,699 |
| **HIGH** | PARTNERSHIPS source has $3,740 target (should be $0) | Phantom target | $3,740 |
| **MEDIUM** | R360 RENEWAL uses wrong FunnelType | Mapping issues | $73,389 |
| **MEDIUM** | Orphaned actuals (no matching target) | $55,159 unmapped revenue | $55,159 |

**Total Revenue at Risk from Data Quality Issues: ~$710,720**

---

## 1. Target Validation (SOP vs Excel)

### 1.1 POR Q1 2026 Target Comparison

| Region | Category | Excel Target | SOP Target* | SOP INBOUND FunnelType | Combined SOP | Variance |
|--------|----------|--------------|-------------|------------------------|--------------|----------|
| AMER | NEW LOGO | $524,260 | $306,723 | $217,537 | $524,260 | $0 |
| AMER | MIGRATION | $264,000 | $264,000 | $0 | $264,000 | $0 |
| AMER | EXPANSION | $832,000 | $832,000 | $0 | $832,000 | $0 |
| APAC | NEW LOGO | $94,000 | $34,354 | $59,646 | $94,000 | $0 |
| APAC | MIGRATION | $58,650 | $58,650 | $0 | $58,650 | $0 |
| APAC | EXPANSION | $46,200 | $46,200 | $0 | $46,200 | $0 |
| EMEA | NEW LOGO | $261,800 | $177,552 | $84,248 | $261,800 | $0 |
| EMEA | MIGRATION | $273,600 | $273,600 | $0 | $273,600 | $0 |
| EMEA | EXPANSION | $304,800 | $304,800 | $0 | $304,800 | $0 |
| **TOTAL** | | **$2,659,310** | **$2,297,879** | **$361,431** | **$2,659,310** | **$0** |

*SOP Target = Target under FunnelType="NEW LOGO" only (excludes INBOUND FunnelType)

**Finding:** POR targets MATCH Excel when INBOUND FunnelType targets are merged into NEW LOGO.

### 1.2 R360 Q1 2026 Target Comparison

| Region | Category | Excel Target | SOP NEW LOGO | SOP R360 INBOUND | Combined | Variance | Status |
|--------|----------|--------------|--------------|------------------|----------|----------|--------|
| AMER | NEW LOGO | $525,160 | $362,875 | $165,984 | $528,859 | **+$3,699** | **DISCREPANCY** |
| AMER | EXPANSION | $210,000 | $210,000 | $0 | $210,000 | $0 | OK |
| APAC | NEW LOGO | $20,400 | $15,972 | $4,428 | $20,400 | $0 | OK |
| APAC | EXPANSION | $850 | $850 | $0 | $850 | $0 | OK |
| EMEA | NEW LOGO | $112,200 | $69,310 | $42,890 | $112,200 | $0 | OK |
| EMEA | EXPANSION | $0 | N/A | N/A | N/A | N/A | OK |
| **TOTAL** | | **$868,610** | **$448,157** | **$213,302** | **$661,459** | **+$3,699** | |

**Finding:** AMER R360 SMB NEW LOGO has $3,699 discrepancy (BQ $528,859 vs Excel $525,160).

### 1.3 PARTNERSHIPS Target Issue

| Product | Region | Segment | Source | Q1 Target | Expected | Status |
|---------|--------|---------|--------|-----------|----------|--------|
| R360 | AMER | SMB | PARTNERSHIPS | $3,740.10 | $0 | **INCORRECT** |

**Root Cause:** Excel shows PARTNERSHIPS Q1 target as $0, but SOP has $3,740.10 loaded.

---

## 2. Dimension Mapping Audit

### 2.1 Invalid FunnelType Values

#### POR FunnelTypes in SOP
| FunnelType | Valid? | Issue |
|------------|--------|-------|
| NEW LOGO | Yes | OK |
| EXPANSION | Yes | OK |
| MIGRATION | Yes | OK |
| RENEWAL | Yes | OK |
| **INBOUND** | **NO** | INBOUND is a SOURCE, not a FunnelType |

#### R360 FunnelTypes in SOP
| FunnelType | Valid? | Issue |
|------------|--------|-------|
| R360 NEW LOGO | Yes | OK |
| R360 EXPANSION | Yes | OK |
| **R360 INBOUND** | **NO** | INBOUND is a SOURCE, not a FunnelType |
| R360 RENEWAL | Partial | Should be just "RENEWAL" for consistency |

### 2.2 Source Values in SOP

#### POR Sources
| Source | Valid? |
|--------|--------|
| AE SOURCED | Yes |
| AM SOURCED | Yes |
| INBOUND | Yes |
| OUTBOUND | Yes |
| TRADESHOW | Yes |
| ALL | Yes (Renewals only) |

#### R360 Sources
| Source | Valid? | Issue |
|--------|--------|-------|
| AE SOURCED | Yes | OK |
| AM SOURCED | Yes | OK |
| INBOUND | Yes | OK |
| OUTBOUND | Yes | OK |
| TRADESHOW | Yes | OK |
| **PARTNERSHIPS** | Partial | Target should be $0 per Excel |
| ALL | Yes (Renewals only) | OK |

### 2.3 "Dead" Target Rows (Invalid FunnelType)

These target rows have FunnelTypes that cannot receive any actuals:

| Product | Region | FunnelType | Source | Segment | Q1 Target | Status |
|---------|--------|------------|--------|---------|-----------|--------|
| POR | AMER | INBOUND | INBOUND | SMB | $142,246 | DEAD |
| POR | AMER | INBOUND | INBOUND | STRATEGIC | $75,291 | DEAD |
| POR | APAC | INBOUND | INBOUND | SMB | $59,646 | DEAD |
| POR | EMEA | INBOUND | INBOUND | SMB | $34,080 | DEAD |
| POR | EMEA | INBOUND | INBOUND | STRATEGIC | $50,167 | DEAD |
| R360 | AMER | R360 INBOUND | INBOUND | SMB | $165,984 | DEAD |
| R360 | APAC | R360 INBOUND | INBOUND | SMB | $4,428 | DEAD |
| R360 | EMEA | R360 INBOUND | INBOUND | SMB | $42,890 | DEAD |
| R360 | AMER | R360 RENEWAL | ALL | N/A | $73,389 | DEAD* |

*R360 RENEWAL should be mapped as "RENEWAL" to match actuals mapping

**Total Dead Target Revenue: $647,121**

---

## 3. Actuals Mapping Validation

### 3.1 SDRSource Values in Actuals (Q1 2026)

| SDRSource | Occurrences | Maps To SOP Source |
|-----------|-------------|-------------------|
| AE Sourced | 4 | AE SOURCED |
| AM Sourced | 57 | AM SOURCED |
| Inbound | 27 | INBOUND |
| N/A | 58 | Varies by Type* |
| Outbound | 2 | OUTBOUND |
| Partnerships | 8 | PARTNERSHIPS |

*N/A defaults: Existing Business/Migration/Renewal → AM SOURCED; New Business → AE SOURCED

### 3.2 Type Values in Actuals (Q1 2026)

| Type | Occurrences | Total ACV | Maps To FunnelType |
|------|-------------|-----------|-------------------|
| Existing Business | 81 | $239,953 | EXPANSION / R360 EXPANSION |
| Migration | 1 | $24,652 | MIGRATION / R360 MIGRATION |
| New Business | 10 | $88,345 | NEW LOGO / R360 NEW LOGO |
| Renewal | 40 | $12,819 | RENEWAL |
| Consulting | 9 | $0 | Excluded |
| Credit Card | 15 | $0 | Excluded |

### 3.3 Orphaned Actuals (No Matching Target)

#### POR Orphaned Actuals

| Region | FunnelType | Source | Segment | Deals | ACV | Issue |
|--------|------------|--------|---------|-------|-----|-------|
| AMER | NEW LOGO | INBOUND | SMB | 3 | $21,645 | No "NEW LOGO + INBOUND" target row |
| EMEA | NEW LOGO | INBOUND | SMB | 1 | $16,785 | No "NEW LOGO + INBOUND" target row |
| AMER | RENEWAL | AM SOURCED | SMB | 24 | $12,736 | RENEWAL uses N/A segment in SOP |
| EMEA | RENEWAL | AM SOURCED | SMB | 2 | $916 | RENEWAL uses N/A segment in SOP |
| APAC | RENEWAL | AM SOURCED | SMB | 3 | $323 | RENEWAL uses N/A segment in SOP |

**POR Orphaned Total: $52,405**

#### R360 Orphaned Actuals

| Region | FunnelType | Source | Segment | Deals | ACV | Issue |
|--------|------------|--------|---------|-------|-----|-------|
| AMER | RENEWAL | AM SOURCED | SMB | 6 | $7,704 | RENEWAL uses N/A segment in SOP |
| AMER | R360 EXPANSION | PARTNERSHIPS | N/A | 8 | $4,800 | No PARTNERSHIPS target for EXPANSION |
| EMEA | R360 NEW LOGO | INBOUND | SMB | 1 | $2,430 | No "R360 NEW LOGO + INBOUND" target |

**R360 Orphaned Total: $14,934**

**Combined Orphaned Revenue: $67,339**

---

## 4. Cross-Walk Analysis

### 4.1 POR Target-to-Actuals Mapping Paths

| SOP Target Row | Can Receive Actuals? | Issue |
|----------------|---------------------|-------|
| NEW LOGO + AE SOURCED + SMB | Yes | OK |
| NEW LOGO + OUTBOUND + SMB | Yes | OK |
| NEW LOGO + OUTBOUND + STRATEGIC | Yes | OK |
| NEW LOGO + TRADESHOW + SMB | Yes | OK |
| **INBOUND + INBOUND + SMB** | **NO** | INBOUND is not a valid FunnelType |
| **INBOUND + INBOUND + STRATEGIC** | **NO** | INBOUND is not a valid FunnelType |
| EXPANSION + AM SOURCED + N/A | Yes | OK |
| EXPANSION + INBOUND + N/A | Yes | OK |
| MIGRATION + AM SOURCED + N/A | Yes | OK |
| MIGRATION + INBOUND + N/A | Yes | OK |
| RENEWAL + ALL + N/A | Partial | Actuals have SMB segment |

### 4.2 R360 Target-to-Actuals Mapping Paths

| SOP Target Row | Can Receive Actuals? | Issue |
|----------------|---------------------|-------|
| R360 NEW LOGO + AE SOURCED + SMB | Yes | OK |
| R360 NEW LOGO + AE SOURCED + STRATEGIC | Yes | OK |
| R360 NEW LOGO + OUTBOUND + SMB | Yes | OK |
| R360 NEW LOGO + PARTNERSHIPS + SMB | Partial | Low target ($3,740) |
| R360 NEW LOGO + TRADESHOW + SMB | Yes | OK |
| **R360 INBOUND + INBOUND + SMB** | **NO** | R360 INBOUND is not valid FunnelType |
| R360 EXPANSION + AM SOURCED + N/A | Yes | OK |
| R360 EXPANSION + INBOUND + N/A | Yes | OK |
| **R360 RENEWAL + ALL + N/A** | **NO** | Should be "RENEWAL" not "R360 RENEWAL" |

---

## 5. Percentile Filter Check

### 5.1 Percentiles Available in SOP

| Product | P25 | P50 | P75 | P90 |
|---------|-----|-----|-----|-----|
| POR | **MISSING** | 11,501 rows | 11,501 rows | 11,501 rows |
| R360 | **MISSING** | 6,760 rows | 6,760 rows | 6,760 rows |

**Finding:** P25 percentile is MISSING from SOP. Only P50, P75, P90 exist.

### 5.2 Percentile Filter Validation

Current queries correctly filter to `Percentile = 'P50'` which avoids the 3x or 4x inflation issue.

---

## 6. Recommended Fixes for Rev Analytics

### Priority: CRITICAL (Fix Immediately)

#### Fix 1: Merge INBOUND FunnelType into NEW LOGO (POR)
```sql
-- Change FunnelType from "INBOUND" to "NEW LOGO" for all POR INBOUND rows
UPDATE `data-analytics-306119.Staging.StrategicOperatingPlan`
SET FunnelType = 'NEW LOGO'
WHERE RecordType = 'POR'
  AND FunnelType = 'INBOUND';
-- Affected rows: ~3,600 (90 days × 4 region/segment combos × ~10 rows)
-- Target impact: $361,431 Q1
```

#### Fix 2: Merge R360 INBOUND FunnelType into R360 NEW LOGO
```sql
-- Change FunnelType from "R360 INBOUND" to "R360 NEW LOGO" for all R360 INBOUND rows
UPDATE `data-analytics-306119.Staging.StrategicOperatingPlan`
SET FunnelType = 'R360 NEW LOGO'
WHERE RecordType = 'R360'
  AND FunnelType = 'R360 INBOUND';
-- Affected rows: ~2,700 (90 days × 3 region combos × ~10 rows)
-- Target impact: $213,302 Q1
```

### Priority: HIGH (Fix This Week)

#### Fix 3: Correct AMER R360 SMB NEW LOGO Target
```sql
-- Reduce AMER R360 SMB target by $3,699 to match Excel
-- Option A: Adjust SMB INBOUND allocation
-- Option B: Adjust SMB AE SOURCED allocation
-- Recommend consulting Excel for exact source breakdown
```

#### Fix 4: Zero Out PARTNERSHIPS Target
```sql
-- Set PARTNERSHIPS target to $0 for R360
UPDATE `data-analytics-306119.Staging.StrategicOperatingPlan`
SET Target_ACV = 0, Target_Won = 0
WHERE RecordType = 'R360'
  AND Source = 'PARTNERSHIPS'
  AND FunnelType = 'R360 NEW LOGO';
-- Target impact: $3,740 Q1
```

#### Fix 5: Fix R360 RENEWAL FunnelType
```sql
-- Change "R360 RENEWAL" to "RENEWAL" for consistency
UPDATE `data-analytics-306119.Staging.StrategicOperatingPlan`
SET FunnelType = 'RENEWAL'
WHERE RecordType = 'R360'
  AND FunnelType = 'R360 RENEWAL';
-- Target impact: $73,389 Q1
```

#### Fix 6: Add P25 Percentile Data
```sql
-- P25 percentile is missing from SOP
-- Load P25 data from source planning system
-- Estimated rows needed: ~18,261 (POR + R360)
```

### Priority: MEDIUM (Fix This Month)

#### Fix 7: Add NEW LOGO + INBOUND Target Rows
The current SOP structure uses "INBOUND" as a FunnelType rather than having NEW LOGO rows with Source=INBOUND. After Fix 1/2, also verify:
- NEW LOGO + INBOUND + SMB targets exist for each region
- NEW LOGO + INBOUND + STRATEGIC targets exist where applicable

#### Fix 8: Align Segment Values for RENEWAL
RENEWAL targets use Segment="N/A" but actuals map to Segment="SMB". Either:
- Change SOP RENEWAL segment to "SMB", OR
- Change actuals mapping to use "N/A" for renewals

#### Fix 9: Add R360 EXPANSION + PARTNERSHIPS Target (Optional)
If PARTNERSHIPS deals are expected for R360 EXPANSION, add target row:
- Current actuals: 8 deals, $4,800
- Current target: $0 (no row exists)

---

## 7. SQL Queries Used (For Reproducibility)

### Query 1: SOP Targets by Dimension
```sql
SELECT
  RecordType, Region, FunnelType, Source, Segment, Percentile,
  SUM(Target_ACV) as Q1_Target_ACV
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType IN ('POR', 'R360')
  AND Percentile = 'P50'
  AND TargetDate >= '2026-01-01'
  AND TargetDate <= '2026-03-31'
GROUP BY RecordType, Region, FunnelType, Source, Segment, Percentile
ORDER BY RecordType, Region, FunnelType, Source, Segment;
```

### Query 2: Unique FunnelType Values
```sql
SELECT DISTINCT RecordType, FunnelType
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType IN ('POR', 'R360')
ORDER BY RecordType, FunnelType;
```

### Query 3: Unique Source Values
```sql
SELECT DISTINCT RecordType, Source
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType IN ('POR', 'R360')
ORDER BY RecordType, Source;
```

### Query 4: Percentile Check
```sql
SELECT DISTINCT RecordType, Percentile, COUNT(*) as row_count
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType IN ('POR', 'R360')
GROUP BY RecordType, Percentile
ORDER BY RecordType, Percentile;
```

### Query 5: Actuals Distribution
```sql
SELECT
  Division, Type, SDRSource,
  COUNT(*) as deal_count,
  SUM(ACV) as total_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  AND (por_record__c = true OR r360_record__c = true)
  AND CloseDate >= '2026-01-01'
  AND CloseDate <= '2026-03-31'
  AND ACV > 0
  AND Division IN ('US', 'UK', 'AU')
GROUP BY Division, Type, SDRSource
ORDER BY Division, Type, SDRSource;
```

### Query 6: Dead Target Detection
```sql
WITH valid_funnel_types AS (
  SELECT 'POR' as RecordType, 'NEW LOGO' as FunnelType UNION ALL
  SELECT 'POR', 'EXPANSION' UNION ALL
  SELECT 'POR', 'MIGRATION' UNION ALL
  SELECT 'POR', 'RENEWAL' UNION ALL
  SELECT 'R360', 'R360 NEW LOGO' UNION ALL
  SELECT 'R360', 'R360 EXPANSION' UNION ALL
  SELECT 'R360', 'R360 MIGRATION' UNION ALL
  SELECT 'R360', 'RENEWAL'
)
SELECT s.RecordType, s.Region, s.FunnelType, s.Source, s.Segment,
       SUM(s.Target_ACV) as q1_target
FROM `data-analytics-306119.Staging.StrategicOperatingPlan` s
LEFT JOIN valid_funnel_types v
  ON s.RecordType = v.RecordType AND s.FunnelType = v.FunnelType
WHERE s.Percentile = 'P50'
  AND s.TargetDate >= '2026-01-01'
  AND s.TargetDate <= '2026-03-31'
  AND v.FunnelType IS NULL
GROUP BY s.RecordType, s.Region, s.FunnelType, s.Source, s.Segment
ORDER BY s.RecordType, s.Region, s.FunnelType;
```

---

## 8. Issue Priority Matrix

| # | Issue | Priority | Category | Revenue Impact | Effort |
|---|-------|----------|----------|----------------|--------|
| 1 | INBOUND FunnelType in POR | CRITICAL | Structural | $361,431 | Low |
| 2 | R360 INBOUND FunnelType in R360 | CRITICAL | Structural | $213,302 | Low |
| 3 | Missing P25 percentile | HIGH | Data Gap | N/A | Medium |
| 4 | $3,699 AMER R360 discrepancy | HIGH | Accuracy | $3,699 | Low |
| 5 | PARTNERSHIPS $3,740 target | HIGH | Accuracy | $3,740 | Low |
| 6 | R360 RENEWAL FunnelType | MEDIUM | Consistency | $73,389 | Low |
| 7 | Orphaned actuals (segment mismatch) | MEDIUM | Mapping | $55,159 | Medium |

---

## 9. Validation Checklist

After fixes are applied, verify:

- [ ] No "INBOUND" FunnelType rows exist for POR
- [ ] No "R360 INBOUND" FunnelType rows exist for R360
- [ ] PARTNERSHIPS Source has $0 target for Q1
- [ ] AMER R360 SMB NEW LOGO Q1 total = $521,461 (after removing $3,699 + merging INBOUND)
- [ ] P25 percentile rows exist for both POR and R360
- [ ] R360 RENEWAL FunnelType changed to just "RENEWAL"
- [ ] POR Q1 Total = $2,659,310 (matches Excel)
- [ ] R360 Q1 Total = $868,610 (matches Excel)

---

## Appendix A: Excel Target Reference (Authoritative)

### POR Q1 2026 (Excel Source of Truth)
| Region | Category | Q1 Target |
|--------|----------|-----------|
| AMER | NEW LOGO | $524,260 |
| AMER | MIGRATION | $264,000 |
| AMER | EXPANSION | $832,000 |
| APAC | NEW LOGO | $94,000 |
| APAC | MIGRATION | $58,650 |
| APAC | EXPANSION | $46,200 |
| EMEA | NEW LOGO | $261,800 |
| EMEA | MIGRATION | $273,600 |
| EMEA | EXPANSION | $304,800 |
| **TOTAL** | | **$2,659,310** |

### R360 Q1 2026 (Excel Source of Truth)
| Region | Category | Q1 Target |
|--------|----------|-----------|
| AMER | NEW LOGO | $525,160 |
| AMER | EXPANSION | $210,000 |
| APAC | NEW LOGO | $20,400 |
| APAC | EXPANSION | $850 |
| EMEA | NEW LOGO | $112,200 |
| EMEA | EXPANSION | $0 |
| **TOTAL** | | **$868,610** |

---

**Report Generated:** 2026-01-12
**Next Audit Scheduled:** After Rev Analytics fixes applied
