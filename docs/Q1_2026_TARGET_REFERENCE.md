# Q1 2026 Target Reference Guide

**Last Updated:** 2026-01-12
**Author:** Data Analytics Team
**Status:** AUTHORITATIVE - Use these targets for all reports

---

## Source of Truth

| Data Type | Source | Notes |
|-----------|--------|-------|
| **Targets** | Excel "2026 Bookings Plan Draft.xlsx" | Use "Plan by Month" sheet ONLY |
| **Actuals** | BigQuery `sfdc.OpportunityViewTable` | Real-time Salesforce data |
| **Funnel Metrics** | BigQuery `MarketingFunnel.*` | MQL, SQL, SAL, SQO counts |

### DO NOT USE for Targets:
- BigQuery `StrategicOperatingPlan` - Has $3,699 discrepancy for AMER R360 SMB
- Excel "Copy of Plan by Month QA" sheet - Outdated with lower values

---

## Critical Dimension Definitions

### FunnelType (derived from Opportunity Type ONLY)
| Opportunity Type | FunnelType |
|-----------------|------------|
| New Business | NEW LOGO |
| Existing Business | EXPANSION |
| Migration | MIGRATION |
| Renewal | RENEWAL |

**WARNING:** "INBOUND" is NOT a FunnelType! It's a Source dimension.

### Source (derived from SDRSource field)
| SDRSource | Source |
|-----------|--------|
| Inbound | INBOUND |
| Outbound | OUTBOUND |
| AE Sourced | AE SOURCED |
| AM Sourced | AM SOURCED |
| Tradeshow | TRADESHOW |
| Partnerships | PARTNERSHIPS |
| N/A / NULL | Varies by Type (see below) |

**N/A Default Logic:**
- Existing Business / Renewal / Migration → AM SOURCED
- New Business → AE SOURCED

### Region Mapping
| Division | Region |
|----------|--------|
| US | AMER |
| UK | EMEA |
| AU | APAC |

---

## R360 Q1 2026 Targets

| Region | Category | Q1 Target | Breakdown |
|--------|----------|-----------|-----------|
| AMER | NEW LOGO | **$525,160** | SMB $403,560 + Strat $121,600 |
| AMER | EXPANSION | **$210,000** | |
| APAC | NEW LOGO | **$20,400** | |
| APAC | EXPANSION | **$850** | |
| EMEA | NEW LOGO | **$112,200** | UK $112,200 + EU $0 |
| EMEA | EXPANSION | **$0** | |
| **TOTAL** | | **$868,610** | Excludes Renewals |

### R360 QTD Target Calculation (As of Jan 12)
```
QTD % = 12 days / 90 days = 13.33%

AMER NEW LOGO QTD Target: $525,160 × 0.1333 = $70,021
AMER EXPANSION QTD Target: $210,000 × 0.1333 = $28,000
APAC NEW LOGO QTD Target: $20,400 × 0.1333 = $2,720
APAC EXPANSION QTD Target: $850 × 0.1333 = $113
EMEA NEW LOGO QTD Target: $112,200 × 0.1333 = $14,960
EMEA EXPANSION QTD Target: $0 × 0.1333 = $0

R360 TOTAL QTD Target: $868,610 × 0.1333 = $115,815
```

---

## POR Q1 2026 Targets

| Region | Category | Q1 Target | Breakdown |
|--------|----------|-----------|-----------|
| AMER | NEW LOGO | **$524,260** | SMB $358,160 + Strat $166,100 |
| AMER | MIGRATION | **$264,000** | |
| AMER | EXPANSION | **$832,000** | |
| APAC | NEW LOGO | **$94,000** | |
| APAC | MIGRATION | **$58,650** | |
| APAC | EXPANSION | **$46,200** | |
| EMEA | NEW LOGO | **$261,800** | SMB $178,200 + Strat $83,600 |
| EMEA | MIGRATION | **$273,600** | |
| EMEA | EXPANSION | **$304,800** | |
| **TOTAL** | | **$2,659,310** | Excludes Renewals |

### POR QTD Target Calculation (As of Jan 12)
```
QTD % = 12 days / 90 days = 13.33%

AMER NEW LOGO QTD Target: $524,260 × 0.1333 = $69,901
AMER MIGRATION QTD Target: $264,000 × 0.1333 = $35,200
AMER EXPANSION QTD Target: $832,000 × 0.1333 = $110,933
...

POR TOTAL QTD Target: $2,659,310 × 0.1333 = $354,575
```

---

## Known Data Quality Issues

### 1. BigQuery SOP vs Excel Discrepancy
| Metric | BigQuery SOP | Excel | Diff |
|--------|--------------|-------|------|
| AMER R360 SMB NEW LOGO Q1 | $407,259 | $403,560 | +$3,699 |

**Resolution:** Use hardcoded Excel targets in SQL queries (`excel_q1_targets` CTE)

### 2. FunnelType "R360 INBOUND" in SOP
BigQuery SOP incorrectly has "R360 INBOUND" as a FunnelType. When querying:
```sql
CASE
  WHEN FunnelType IN ('R360 NEW LOGO', 'R360 INBOUND') THEN 'NEW LOGO'
  WHEN FunnelType = 'R360 EXPANSION' THEN 'EXPANSION'
  ...
END
```

### 3. PARTNERSHIPS Target
SOP shows $3,740 but should be $0. Queries zero this out with CASE statement.

---

## File Reference

| File | Purpose |
|------|---------|
| `query_r360_risk_analysis.sql` | R360 risk analysis with correct targets |
| `query_por_risk_analysis.sql` | POR risk analysis with correct targets |
| `query_data_reconciliation.sql` | Data verification queries |
| `LESSONS_LEARNED_ACTUALS_DATA_QUALITY.md` | Data quality investigation findings |
| `GENERATE_RISK_REPORTS_PROMPT.md` | Instructions for generating reports |

---

## Validation Checklist

Before publishing any report:

- [ ] Targets match Excel "Plan by Month" sheet exactly
- [ ] FunnelTypes are ONLY: NEW LOGO, EXPANSION, MIGRATION, RENEWAL
- [ ] No "INBOUND" appearing as a FunnelType
- [ ] R360 PARTNERSHIPS shows $0 (not $3,740)
- [ ] QTD proration uses correct formula: Q1 Target × (Days / 90)
- [ ] Percentile filter is `P50` for all SOP queries
- [ ] Division filter includes only US/UK/AU
- [ ] R360 Total = $868,610, POR Total = $2,659,310

---

## Change Log

| Date | Change |
|------|--------|
| 2026-01-12 | Created reference document |
| 2026-01-12 | Added hardcoded Excel targets to SQL files |
| 2026-01-12 | Documented FunnelType vs Source distinction |
| 2026-01-12 | Identified $3,699 SOP discrepancy |
