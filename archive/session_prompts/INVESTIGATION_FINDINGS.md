# Investigation Findings - Data Quality Questions

## Question 1: Is 132 Target MQLs for APAC R360 Inbound SMB Too High?

### Finding: ✅ **132 MQLs is CORRECT - This is the actual target in the source data**

**Regional Comparison for R360 Inbound SMB:**
| Region | Target MQLs | Actual MQLs | Target ACV | ACV/MQL |
|--------|-------------|-------------|------------|---------|
| AMER   | 4,011       | 106         | $1.67M     | $416    |
| EMEA   | 636         | 41          | $811K      | $1,275  |
| APAC   | **132**     | **1**       | **$78K**   | **$592** |

**Analysis:**
- APAC represents **3.3%** of AMER's MQL target (132 vs 4,011)
- APAC represents **20.8%** of EMEA's MQL target (132 vs 636)
- APAC is the smallest market for R360 Inbound SMB
- The $78K ACV target for 36 won deals is proportionally appropriate
- Only 1 actual MQL achieved so far (0.8% attainment) - this is the REAL risk

**Conclusion:** 132 is not high - it's actually quite low compared to other regions. The concern should be that they only have 1 actual MQL against a 132 target (99% below target).

---

## Question 2: Missing Pipeline Data - Why Are Some Segments Showing 0s?

### Finding: ✅ **This is SOURCE DATA characteristic - not a query bug**

**Affected Segments:**
All **STRATEGIC** segments have NO funnel pipeline targets in the source data:

| RecordType | Region | Segment   | Total Records | MQL Target | Won Target | Target ACV |
|------------|--------|-----------|---------------|------------|------------|------------|
| POR        | AMER   | STRATEGIC | 2,190         | 0          | 72         | $2.27M     |
| R360       | AMER   | STRATEGIC | 1,095         | 0          | 36         | $1.92M     |
| POR        | EMEA   | STRATEGIC | 3,285         | 0          | 108        | $1.14M     |
| POR        | APAC   | STRATEGIC | 558           | 0          | 0          | $0         |

**Examples from Reports:**
- POR APAC: "INBOUND | INBOUND | STRATEGIC" - $1.5M gap, 0 across all funnel stages
- R360 AMER: "NEW LOGO | AE SOURCED | STRATEGIC" - $1.9M gap, 0 across all funnel stages

**Why This Happens:**
Strategic deals appear to bypass the standard MQL→SQL→SAL→SQO funnel in the data model. They go directly to Won targets without intermediate funnel stages defined.

**Potential Reasons:**
1. Strategic deals have different sales motion (direct to executive, no marketing funnel)
2. Data isn't captured the same way for strategic accounts
3. Strategic targets are set at Won level without working backwards to funnel metrics
4. Historical data model limitation

---

## Recommendations for Data Quality Improvement

### 1. STRATEGIC Segment Funnel Data
**Issue:** Strategic segments have Won targets but no funnel pipeline
**Impact:** Cannot perform proper risk analysis or forecast pipeline health
**Options:**
- **Option A:** Exclude STRATEGIC segment from risk reports (they don't follow standard funnel)
- **Option B:** Request source data team to populate funnel targets for strategic deals
- **Option C:** Calculate assumed funnel based on historical conversion rates
- **Option D:** Flag as "Direct to Won" segment type and report separately

### 2. APAC R360 Performance
**Issue:** APAC R360 Inbound SMB has 1 actual vs 132 target MQLs (0.8% attainment)
**Impact:** Massive underperformance indicating marketing/demand gen issue
**Recommendation:** Escalate to APAC marketing leadership - virtually no inbound pipeline

### 3. Query Improvements for Next Session
**Option to Consider:** Add a filter to exclude segments with missing funnel data:

```sql
WHERE RecordType = params.product_filter
  AND OpportunityType != 'RENEWAL'
  AND EXTRACT(YEAR FROM date_basis) = 2026
  AND (Target_MQL > 0 OR Target_SQL > 0 OR Target_SQO > 0)  -- Exclude no-funnel segments
```

This would remove the "0/0/0/0" risks from reports and focus on segments with actual funnel data.

---

## Summary

| Finding | Status | Action Needed |
|---------|--------|---------------|
| APAC 132 MQL target | ✅ Correct | None - data is accurate |
| Missing STRATEGIC funnel | ✅ Identified | Business decision on how to handle |
| Risk queries working | ✅ Fixed | Date filter corrected, showing full 2026 data |
| Reports accurate | ✅ Validated | Ready for use with understanding of STRATEGIC limitation |

All technical issues have been resolved. The remaining concerns are **source data characteristics** that require business process decisions, not technical fixes.
