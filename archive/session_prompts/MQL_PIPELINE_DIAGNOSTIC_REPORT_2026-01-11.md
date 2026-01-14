# R360 MQL Pipeline Diagnostic Report
**Date:** 2026-01-11
**Analyst:** QA Remediation Process
**Status:** ISSUE CONFIRMED - DATA PIPELINE DEFECT

## Executive Summary

Investigation confirmed a **data pipeline defect** where `Staging.StrategicOperatingPlan.Actual_MQL` is not properly syncing from `MarketingFunnel.R360InboundFunnel`. The R360 risk analysis query has been correctly updated to use the funnel directly as the source of truth for MQL actuals.

## Discrepancy Details

| Region | Funnel MQL | SOP MQL | Variance | Status |
|--------|-----------|---------|----------|--------|
| AMER   | 16        | 9       | +7       | UNDER-SYNCED |
| EMEA   | 6         | 0       | +6       | MISSING |
| APAC   | 0         | 0       | 0        | N/A |

## Daily Breakdown Analysis

### AMER Region (Jan 1-10, 2026)

| Date | Funnel MQL | SOP MQL | Variance |
|------|-----------|---------|----------|
| Jan 2 | 5 | 0 | -5 |
| Jan 3 | 0 | 4 | +4 |
| Jan 4 | 0 | 1 | +1 |
| Jan 5 | 2 | 1 | -1 |
| Jan 6 | 2 | 1 | -1 |
| Jan 7 | 4 | 1 | -3 |
| Jan 8 | 1 | 1 | 0 |
| Jan 9 | 1 | 0 | -1 |
| Jan 10 | 1 | 0 | -1 |
| **Total** | **16** | **9** | **-7** |

**Observations:**
1. SOP is delayed by 1 day (Jan 2 funnel data appears as Jan 3 in SOP)
2. Even with date shift, counts don't match - suggesting partial sync
3. Jan 9-10 data not yet synced to SOP

### EMEA Region (Jan 1-10, 2026)

| Date | Funnel MQL | SOP MQL | Variance |
|------|-----------|---------|----------|
| Jan 4 | 1 | 0 | -1 |
| Jan 5 | 3 | 0 | -3 |
| Jan 7 | 2 | 0 | -2 |
| **Total** | **6** | **0** | **-6** |

**Observations:**
1. EMEA MQL data is completely missing from SOP
2. Likely a region filter issue in the sync pipeline
3. Data exists in funnel but not propagating to SOP

## Root Cause Analysis

### Likely Issues:
1. **Sync Delay**: SOP sync job may run with 1-2 day lag
2. **Region Mapping**: EMEA region may not be mapped correctly in sync
3. **Partial Sync**: Sync may be dropping records or using wrong aggregation

### Data Flow:
```
MarketingFunnel.R360InboundFunnel (SOURCE OF TRUTH)
         ↓ [ETL Sync Job - DEFECTIVE]
Staging.StrategicOperatingPlan.Actual_MQL (STALE/INCOMPLETE)
```

## Resolution

### Current Fix (Applied)
The R360 risk analysis query has been updated to:
1. Source MQL actuals directly from `MarketingFunnel.R360InboundFunnel`
2. Bypass the broken SOP `Actual_MQL` field
3. Apply proper filters (SpiralyzeTest, MQL_Reverted, Region)

### Recommended Actions

1. **IMMEDIATE**: No action needed - query fix is in place
2. **SHORT-TERM**: Data Engineering should investigate the SOP sync pipeline
3. **LONG-TERM**: Consider deprecating SOP Actual_MQL and using funnel directly

## Data Sources

- **Funnel Table**: `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
- **SOP Table**: `data-analytics-306119.Staging.StrategicOperatingPlan`
- **Time Period Analyzed**: 2026-01-01 to 2026-01-10

## Validation Queries

See: `/Users/prestonharris/qa_mql_diagnostic_queries.sql`

Key query for ongoing monitoring:
```sql
-- Compare Funnel vs SOP MQL by region
WITH funnel_data AS (
  SELECT Region, COUNT(DISTINCT Email) AS funnel_mql
  FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
  WHERE MQL_DT IS NOT NULL
    AND CAST(MQL_DT AS DATE) BETWEEN DATE('2026-01-01') AND DATE('2026-01-10')
    AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
    AND MQL_Reverted = false
    AND Region IS NOT NULL
    AND Email IS NOT NULL
  GROUP BY Region
),
sop_data AS (
  SELECT Region, SUM(Actual_MQL) AS sop_mql
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
  WHERE RecordType = 'R360' AND Percentile = 'P50'
    AND FunnelType = 'R360 INBOUND' AND Source = 'INBOUND'
    AND TargetDate BETWEEN DATE('2026-01-01') AND DATE('2026-01-10')
  GROUP BY Region
)
SELECT
  COALESCE(f.Region, s.Region) AS region,
  COALESCE(f.funnel_mql, 0) AS funnel_mql,
  COALESCE(CAST(s.sop_mql AS INT64), 0) AS sop_mql,
  COALESCE(f.funnel_mql, 0) - COALESCE(CAST(s.sop_mql AS INT64), 0) AS variance
FROM funnel_data f
FULL OUTER JOIN sop_data s ON f.Region = s.Region
ORDER BY region;
```

## Next Steps

- [ ] Escalate to Data Engineering for SOP sync pipeline investigation
- [ ] Monitor variance weekly until pipeline is fixed
- [ ] No query changes needed - current implementation is correct
