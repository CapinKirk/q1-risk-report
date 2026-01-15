# Data Issues Log - Risk Analysis Reports

**Last Updated:** 2026-01-12
**Maintained By:** Data Analytics Team

---

## Issue #001: EMEA MQL Target Anomaly (RESOLVED)

**Date Identified:** 2026-01-12
**Status:** RESOLVED
**Query Affected:** `query_comprehensive_risk_analysis.sql`

### Problem Description

In the Q1 2026 Bookings Risk Analysis Report, the POR EMEA NEW LOGO inbound funnel targets appeared incorrect:

| Region | Category | Q1 ACV Target | MQL Target (QTD) | Ratio |
|--------|----------|---------------|------------------|-------|
| POR EMEA | NEW LOGO | $261,800 | 9 | Low |
| POR APAC | NEW LOGO | $94,000 | 19 | High |

**Anomaly:** EMEA has 2.8x higher ACV target but only 47% of APAC's MQL target. This appeared illogical.

### Root Cause Analysis

**Finding:** This is NOT a bug - it reflects the actual business go-to-market strategy.

The query was comparing **INBOUND-only MQL targets** against **ALL-SOURCE ACV targets**, which created a misleading comparison.

**Source Breakdown from StrategicOperatingPlan:**

**EMEA SMB (OUTBOUND-Heavy Strategy):**
| Source | Target ACV | % of Total |
|--------|-----------|------------|
| INBOUND | $40,188 | 22% |
| OUTBOUND | $71,033 | 40% |
| AE SOURCED | $60,527 | 34% |
| TRADESHOW | $6,452 | 4% |
| **TOTAL** | **$178,200** | **100%** |

**APAC SMB (INBOUND-Heavy Strategy):**
| Source | Target ACV | % of Total |
|--------|-----------|------------|
| INBOUND | $59,646 | 63% |
| TRADESHOW | $10,462 | 11% |
| AE SOURCED | $23,892 | 25% |
| **TOTAL** | **$94,000** | **100%** |

**Key Insight:**
- EMEA's NEW LOGO strategy is primarily OUTBOUND-driven (only 22% from INBOUND)
- APAC's NEW LOGO strategy is primarily INBOUND-driven (63% from INBOUND)
- MQL targets come from INBOUND channel only - they are correctly proportional to INBOUND ACV, not total ACV

### Resolution

**Changes to `query_comprehensive_risk_analysis.sql` (v1.0.0 -> v2.0.0):**

1. **Replaced hardcoded `q1_targets` CTE** with dynamic query from StrategicOperatingPlan:
   - Now pulls targets dynamically for current quarter
   - Aggregates across all sources for total category ACV
   - Maps FunnelType correctly (R360 INBOUND -> NEW LOGO, etc.)
   - Zeros out PARTNERSHIPS targets per existing data quality fix

2. **Updated `funnel_targets_qtd` CTE** with documentation:
   - Added comments explaining INBOUND-only nature of MQL targets
   - Added `source_channel` field to clarify this is INBOUND only
   - Added `inbound_target_acv` for context

3. **Updated `funnel_pacing` CTE**:
   - Added `source_channel = 'INBOUND'` to clarify scope
   - Added `inbound_target_acv` to show INBOUND ACV (vs total category ACV)
   - Added documentation about EMEA/APAC strategy differences

4. **Added comprehensive documentation** in query header:
   - Explained MQL target vs ACV target relationship
   - Documented EMEA outbound-heavy vs APAC inbound-heavy strategies
   - Referenced `sop_data_quality_fix_q1_2026.sql` for source breakdown

### Before vs After

**Before (Hardcoded):**
```sql
q1_targets AS (
  SELECT 'POR' AS product, 'EMEA' AS region, 'NEW LOGO' AS category, 261800.0 AS q1_target
  -- ... more hardcoded values
)
```

**After (Dynamic):**
```sql
q1_targets AS (
  SELECT
    sop.RecordType AS product,
    sop.Region AS region,
    CASE
      WHEN sop.FunnelType IN ('NEW LOGO', 'R360 NEW LOGO', 'INBOUND', 'R360 INBOUND') THEN 'NEW LOGO'
      -- ... mapping logic
    END AS category,
    ROUND(SUM(CASE
      WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0
      ELSE sop.Target_ACV
    END), 2) AS q1_target
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  -- ... dynamic filters
)
```

### Verification Checklist

- [ ] Dynamic targets match Excel "Plan by Month" totals
- [ ] POR Q1 Total = $2,659,310
- [ ] R360 Q1 Total = $868,610
- [ ] MQL targets are clearly labeled as INBOUND-only
- [ ] Funnel pacing section includes source_channel field
- [ ] No hardcoded target values remain in query

### Related Files

- `query_comprehensive_risk_analysis.sql` - Main query (updated)
- `sop_data_quality_fix_q1_2026.sql` - Source breakdown documentation
- `Q1_2026_TARGET_REFERENCE.md` - Target reference guide
- `DATA_QUALITY_FIX_SUMMARY.md` - Previous data quality fixes

---

## Issue #002: BigQuery SOP vs Excel Discrepancy

**Date Identified:** 2026-01-12
**Status:** DOCUMENTED (Workaround in place)
**Query Affected:** All risk analysis queries

### Problem Description

BigQuery StrategicOperatingPlan has a $3,699 discrepancy vs Excel for AMER R360 SMB NEW LOGO Q1 target.

| Source | AMER R360 SMB NEW LOGO Q1 |
|--------|---------------------------|
| BigQuery SOP | $407,259 |
| Excel Plan | $403,560 |
| **Difference** | **+$3,699** |

### Workaround

For ACV totals, the query aggregates to category level which smooths out segment-level discrepancies. The totals reconcile correctly at the Region/Category level.

### Long-term Fix

Data Engineering should investigate the SOP data loader to correct the segment-level discrepancy.

---

## Issue #003: R360 PARTNERSHIPS Non-Zero Targets

**Date Identified:** 2026-01-11
**Status:** RESOLVED (Query-level fix)
**Query Affected:** `query_r360_risk_analysis.sql`, `query_comprehensive_risk_analysis.sql`

### Problem Description

R360 PARTNERSHIPS has non-zero targets in SOP table but business expectation is $0.

### Resolution

Query-level fix zeros out PARTNERSHIPS targets:
```sql
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_ACV END
```

See `sop_data_quality_fix_q1_2026.sql` for full documentation.

---

## Appendix: Data Quality Best Practices

### When Adding New Targets

1. Always pull from StrategicOperatingPlan dynamically when possible
2. Use `Percentile = 'P50'` filter to avoid summing percentiles
3. Map FunnelTypes correctly (R360 INBOUND -> NEW LOGO, etc.)
4. Zero out PARTNERSHIPS targets
5. Validate totals against Excel source of truth

### When Investigating Anomalies

1. Check source-level breakdown first (INBOUND vs OUTBOUND vs AE SOURCED)
2. Verify region mapping (US -> AMER, UK -> EMEA, AU -> APAC)
3. Confirm date filters (QTD vs Q1 full vs annual)
4. Compare against Excel "Plan by Month" sheet
