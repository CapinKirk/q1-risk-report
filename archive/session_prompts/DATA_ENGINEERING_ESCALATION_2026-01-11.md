# Data Engineering Escalation: R360 MQL Sync Pipeline Issue

**Priority:** Medium
**Date:** 2026-01-11
**Requested By:** Analytics Team (QA Remediation)
**Ticket Type:** Data Pipeline Investigation

---

## Summary

The `Staging.StrategicOperatingPlan.Actual_MQL` field is not properly syncing from `MarketingFunnel.R360InboundFunnel` for R360 inbound leads. This is causing significant discrepancies between the source of truth (funnel) and the SOP table used for reporting.

---

## Issue Details

### Verified Discrepancy (as of 2026-01-11)

| Region | Funnel MQL | SOP MQL | Variance | Issue Type |
|--------|-----------|---------|----------|------------|
| AMER   | 16        | 10      | 6        | Under-synced |
| EMEA   | 6         | 0       | 6        | Missing |
| APAC   | 0         | 0       | 0        | N/A |

### Observations

1. **EMEA Data Missing:** EMEA region MQL data exists in the funnel but is completely absent from SOP
2. **AMER Partial Sync:** AMER data has a variance of 6 MQL (funnel higher than SOP)
3. **Sync Delay:** SOP appears to have 1-2 day lag in syncing MQL data

---

## Affected Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `data-analytics-306119.MarketingFunnel.R360InboundFunnel` | Source of truth for MQL | Working correctly |
| `data-analytics-306119.Staging.StrategicOperatingPlan` | Target for Actual_MQL | Sync incomplete |

---

## Root Cause Hypotheses

1. **Region Filter Issue:** The sync pipeline may have a region filter that excludes EMEA
2. **Date/Time Lag:** Sync job may run with significant delay
3. **Aggregation Bug:** Sync may be using wrong aggregation logic or missing records

---

## Diagnostic Queries

The following queries are available for investigation:
- File: `/Users/prestonharris/qa_mql_diagnostic_queries.sql`

**Quick comparison query:**
```sql
WITH funnel_data AS (
  SELECT Region, COUNT(DISTINCT Email) AS funnel_mql
  FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
  WHERE MQL_DT IS NOT NULL
    AND CAST(MQL_DT AS DATE) BETWEEN DATE('2026-01-01') AND CURRENT_DATE()
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
    AND TargetDate BETWEEN DATE('2026-01-01') AND CURRENT_DATE()
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

---

## Workaround Applied

The R360 risk analysis query has been updated to source MQL actuals directly from `MarketingFunnel.R360InboundFunnel`, bypassing the broken SOP field. This ensures accurate reporting while the sync issue is being resolved.

---

## Requested Actions

1. **Investigate** the SOP sync pipeline for R360 `Actual_MQL`
2. **Identify** why EMEA region data is not being synced
3. **Fix** the sync logic to capture all regions
4. **Reduce** sync lag from 1-2 days to near real-time if possible
5. **Validate** fix by comparing funnel vs SOP counts post-deployment

---

## Contact

For questions about this escalation, please contact the Analytics team.

---

*Escalation created: 2026-01-11*
