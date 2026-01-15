# QA Cross-Reference Guide

## Data Architecture Overview

### Data Flow
```
BigQuery (Source of Truth)
    |
    v
Python Scripts (generate-data.py)
    |
    v
data/report-data.json (Static snapshot)
    |
    v
Next.js App (Production display)
```

### API vs Static Data
- **Production App**: Uses `data/report-data.json` (real BigQuery data)
- **Trend Analysis API**: Uses **mock data** (BigQuery not accessible on Vercel)
- The trend-analysis API generates realistic-looking mock data for demo purposes

---

## Data Sources

### 1. Revenue Actuals
**Source**: `data-analytics-306119.sfdc.OpportunityViewTable`

| Field | Purpose |
|-------|---------|
| `Won` | Filter for closed-won deals |
| `CloseDate` | Date deal closed (for QTD filtering) |
| `ACV` | Annual Contract Value in USD |
| `Division` | US/UK/AU -> AMER/EMEA/APAC |
| `Type` | New Business/Existing Business/Migration |
| `SDRSource` | INBOUND/OUTBOUND/AE SOURCED/AM SOURCED |
| `por_record__c` | true = POR deal |
| `r360_record__c` | true = R360 deal |

**Exclusions**: Renewal, Credit Card, Consulting, ACV <= 0

### 2. Funnel Actuals (MQL/SQL/SAL/SQO)
**POR Source**: `data-analytics-306119.MarketingFunnel.InboundFunnel`
**R360 Source**: `data-analytics-306119.MarketingFunnel.R360InboundFunnel`

| Field | Purpose |
|-------|---------|
| `CaptureDate` | When lead was captured (used for MQL) |
| `MQL_DT` | Date lead became MQL |
| `SQL_DT` | Date lead became SQL |
| `SAL_DT` | Date lead became SAL (POR only) |
| `SQO_DT` | Date lead became SQO |
| `SpiralyzeTest` | Exclude test leads (false) |
| `MQL_Reverted` | Exclude reverted MQLs (false) |

**Important**: MQL uses `CaptureDate` (not `MQL_DT`) for accurate counts

### 3. Targets
**Source**: `data-analytics-306119.Staging.StrategicOperatingPlan`

| Field | Purpose |
|-------|---------|
| `RecordType` | POR or R360 |
| `Region` | AMER/EMEA/APAC |
| `FunnelType` | NEW LOGO/EXPANSION/MIGRATION |
| `Source` | INBOUND/OUTBOUND/etc. |
| `TargetDate` | Date for daily targets |
| `Percentile` | P50 (always use this) |
| `Target_ACV` | ACV target for the day |
| `Target_MQL/SQL/SAL/SQO` | Funnel targets |

**Excel Source of Truth**: `2026 Bookings Plan Draft.xlsx` (Plan by Month sheet)

---

## Expected Values (Q1 2026)

### Q1 Full-Quarter Targets

| Product | Q1 Target | Source |
|---------|-----------|--------|
| POR | $2,659,310 | Excel |
| R360 | $868,569.34 | Excel |
| **Grand Total** | **$3,527,879.34** | Excel |

### POR Q1 Targets by Segment

| Region | Category | Q1 Target |
|--------|----------|-----------|
| AMER | NEW LOGO | $524,260 |
| AMER | EXPANSION | $832,000 |
| AMER | MIGRATION | $264,000 |
| APAC | NEW LOGO | $94,000 |
| APAC | EXPANSION | $46,200 |
| APAC | MIGRATION | $58,650 |
| EMEA | NEW LOGO | $261,800 |
| EMEA | EXPANSION | $304,800 |
| EMEA | MIGRATION | $273,600 |
| **POR TOTAL** | | **$2,659,310** |

### R360 Q1 Targets by Segment

| Region | Category | Q1 Target |
|--------|----------|-----------|
| AMER | NEW LOGO | $525,160 |
| AMER | EXPANSION | $210,000 |
| APAC | NEW LOGO | $20,400 |
| APAC | EXPANSION | $850 |
| EMEA | NEW LOGO | $112,200 |
| EMEA | EXPANSION | $0 |
| **R360 TOTAL** | | **$868,610** |

> **Note**: SOP shows $872,309 for R360 (a $3,699 discrepancy from Excel)

---

## Funnel Pacing Reference (report-data.json)

### POR Funnel (INBOUND)

| Region | MQL (A/T) | SQL (A/T) | SAL (A/T) | SQO (A/T) |
|--------|-----------|-----------|-----------|-----------|
| AMER | 69/65 (106%) | 46/32 (144%) | 31/25 (124%) | 10/16 (63%) |
| APAC | 9/19 (47%) | 3/6 (50%) | 2/5 (40%) | 2/5 (40%) |
| EMEA | 13/8 (163%) | 5/3 (167%) | 2/2 (100%) | 2/1 (200%) |

### R360 Funnel (INBOUND)

| Region | MQL (A/T) | SQL (A/T) | SQO (A/T) |
|--------|-----------|-----------|-----------|
| AMER | 23/68 (34%) | 12/23 (52%) | 10/17 (59%) |
| APAC | TBD | TBD | TBD |
| EMEA | TBD | TBD | TBD |

---

## QA Validation Checklist

### 1. Revenue Actuals Validation
- [ ] Run `query_qa_cross_reference.sql` Section 1
- [ ] Compare `revenue_by_product` with `product_totals` in report-data.json
- [ ] Verify POR QTD ACV matches
- [ ] Verify R360 QTD ACV matches
- [ ] Verify deal counts match

### 2. Target Validation
- [ ] Run `query_qa_cross_reference.sql` Section 4
- [ ] Compare SOP targets with Excel targets above
- [ ] Note any discrepancies (expect $3,699 for R360 AMER)

### 3. Attainment Calculation Validation
- [ ] Attainment % = (QTD Actual / QTD Target) * 100
- [ ] QTD Target = (Q1 Target / 90) * Days Elapsed
- [ ] Gap = QTD Actual - QTD Target
- [ ] RAG Status: GREEN >= 90%, YELLOW 70-89%, RED < 70%

### 4. Funnel Metrics Validation
- [ ] Run `query_marketing_funnel_pacing.sql`
- [ ] Compare actual_mql, target_mql with funnel_pacing in report-data.json
- [ ] Verify conversion rates: MQL->SQL, SQL->SAL, SAL->SQO

### 5. Grand Total Validation
- [ ] Grand Total QTD ACV = Sum of all product QTD ACV
- [ ] Grand Total QTD Target = Sum of all product QTD Target
- [ ] Grand Total Attainment = Grand Total ACV / Grand Total Target * 100

---

## Known Discrepancies

| Issue | Impact | Resolution |
|-------|--------|------------|
| SOP R360 AMER SMB +$3,699 | Minor target inflation | Use Excel as source of truth |
| "R360 INBOUND" FunnelType | Causes undercounting | Combine with "R360 NEW LOGO" |
| Source vs FunnelType confusion | Wrong category attribution | FunnelType = NEW LOGO/EXPANSION/MIGRATION only |

---

## Validation Queries

### Quick Validation (Run in BigQuery)

```sql
-- Total Q1 Target Check
SELECT
  RecordType,
  ROUND(SUM(Target_ACV), 2) AS q1_target
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE Percentile = 'P50'
  AND OpportunityType != 'RENEWAL'
  AND TargetDate BETWEEN '2026-01-01' AND '2026-03-31'
GROUP BY RecordType;
-- Expected: POR ~$2,659,310, R360 ~$868,569
```

```sql
-- QTD Actual ACV Check
SELECT
  CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product,
  COUNT(*) AS deals,
  ROUND(SUM(ACV), 2) AS qtd_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  AND CloseDate >= '2026-01-01'
  AND CloseDate <= CURRENT_DATE()
  AND Type NOT IN ('Renewal', 'Credit Card', 'Consulting')
  AND ACV > 0
GROUP BY product;
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `query_qa_cross_reference.sql` | Comprehensive validation query |
| `query_data_reconciliation.sql` | Data source comparison |
| `query_marketing_funnel_pacing.sql` | Funnel actuals vs targets |
| `query_por_risk_analysis.sql` | POR risk analysis with RCA |
| `query_r360_risk_analysis.sql` | R360 risk analysis |
| `query_comprehensive_risk_analysis.sql` | Full combined analysis |
| `data/report-data.json` | Current production data snapshot |
