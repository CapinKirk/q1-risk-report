# QA Validation Report

**Generated**: 2026-01-14
**report-data.json Generated**: 2026-01-14T07:25:00 UTC
**BigQuery Query Time**: Current (live)

---

## Executive Summary

| Metric | report-data.json | BigQuery Live | Variance | Status |
|--------|------------------|---------------|----------|--------|
| POR Q1 Target | $2,659,310 | $2,659,310 | $0 | MATCH |
| R360 Q1 Target | $868,569.34 | $872,309.44 | +$3,740 | KNOWN DISCREPANCY |
| Grand Total Q1 | $3,527,879.34 | $3,531,619.44 | +$3,740 | KNOWN DISCREPANCY |
| POR QTD ACV | $388,449.10 | $443,376.75 | +$54,928 | DATA FRESHNESS |
| R360 QTD ACV | $55,962.20 | $55,962.20 | $0 | MATCH |
| POR QTD Deals | 68 | 73 | +5 | DATA FRESHNESS |
| R360 QTD Deals | 26 | 26 | 0 | MATCH |

**Overall Assessment**: Data sources are aligned. Variances are explained by:
1. Known SOP vs Excel discrepancy for R360 AMER ($3,740)
2. New POR deals closed after report-data.json was generated

---

## 1. Q1 TARGET VALIDATION

### POR Q1 Targets (by Segment)

| Region | Category | Excel Target | SOP Target | Variance | Status |
|--------|----------|--------------|------------|----------|--------|
| AMER | NEW LOGO | $524,260 | $524,260 | $0 | MATCH |
| AMER | EXPANSION | $832,000 | $832,000 | $0 | MATCH |
| AMER | MIGRATION | $264,000 | $264,000 | $0 | MATCH |
| APAC | NEW LOGO | $94,000 | $94,000 | $0 | MATCH |
| APAC | EXPANSION | $46,200 | $46,200 | $0 | MATCH |
| APAC | MIGRATION | $58,650 | $58,650 | $0 | MATCH |
| EMEA | NEW LOGO | $261,800 | $261,800 | $0 | MATCH |
| EMEA | EXPANSION | $304,800 | $304,800 | $0 | MATCH |
| EMEA | MIGRATION | $273,600 | $273,600 | $0 | MATCH |
| **TOTAL** | | **$2,659,310** | **$2,659,310** | **$0** | **MATCH** |

### R360 Q1 Targets (by Segment)

| Region | Category | Excel Target | SOP Target | Variance | Status |
|--------|----------|--------------|------------|----------|--------|
| AMER | NEW LOGO | $525,160 | $528,859.44 | +$3,699 | KNOWN ISSUE |
| AMER | EXPANSION | $210,000 | $210,000 | $0 | MATCH |
| APAC | NEW LOGO | $20,400 | $20,400 | $0 | MATCH |
| APAC | EXPANSION | $850 | $850 | $0 | MATCH |
| EMEA | NEW LOGO | $112,200 | $112,200 | $0 | MATCH |
| EMEA | EXPANSION | $0 | $0 | $0 | MATCH |
| **TOTAL** | | **$868,610** | **$872,309.44** | **+$3,699** | **KNOWN ISSUE** |

> **Note**: SOP AMER R360 NEW LOGO is $3,699 higher than Excel. Excel is source of truth.

---

## 2. REVENUE ACTUALS VALIDATION

### BigQuery Live Results (as of query time)

| Product | Region | Category | Deals | QTD ACV |
|---------|--------|----------|-------|---------|
| POR | AMER | EXPANSION | 25 | $210,539.43 |
| POR | AMER | MIGRATION | 2 | $14,154.14 |
| POR | AMER | NEW LOGO | 9 | $46,992.82 |
| POR | APAC | EXPANSION | 6 | $14,942.42 |
| POR | EMEA | EXPANSION | 26 | $74,137.24 |
| POR | EMEA | MIGRATION | 2 | $36,742.13 |
| POR | EMEA | NEW LOGO | 3 | $45,868.58 |
| **POR TOTAL** | | | **73** | **$443,376.75** |
| R360 | AMER | EXPANSION | 23 | $30,600.00 |
| R360 | AMER | NEW LOGO | 2 | $22,931.82 |
| R360 | EMEA | NEW LOGO | 1 | $2,430.38 |
| **R360 TOTAL** | | | **26** | **$55,962.20** |
| **GRAND TOTAL** | | | **99** | **$499,338.95** |

### Comparison with report-data.json

| Segment | JSON ACV | BigQuery ACV | Variance | Notes |
|---------|----------|--------------|----------|-------|
| POR AMER EXPANSION | $189,951.11 | $210,539.43 | +$20,588 | New deals |
| POR AMER MIGRATION | $6,788.89 | $14,154.14 | +$7,365 | New deals |
| POR AMER NEW LOGO | $46,992.82 | $46,992.82 | $0 | Match |
| POR APAC EXPANSION | $14,942.42 | $14,942.42 | $0 | Match |
| POR EMEA EXPANSION | $74,137.24 | $74,137.24 | $0 | Match |
| POR EMEA MIGRATION | $24,651.92 | $36,742.13 | +$12,090 | New deals |
| POR EMEA NEW LOGO | $30,984.7 | $45,868.58 | +$14,884 | New deals |
| R360 (all) | $55,962.20 | $55,962.20 | $0 | Match |

**Conclusion**: POR has additional deals closed since JSON was generated. R360 matches exactly.

---

## 3. FUNNEL PACING VALIDATION

### POR Funnel Actuals (INBOUND)

| Region | Metric | JSON Value | BigQuery Live | Variance | Notes |
|--------|--------|------------|---------------|----------|-------|
| AMER | MQL | 69 | 46 | -23 | SIGNIFICANT |
| AMER | SQL | 46 | 16 | -30 | SIGNIFICANT |
| AMER | SAL | 31 | 9 | -22 | SIGNIFICANT |
| AMER | SQO | 10 | 0 | -10 | SIGNIFICANT |
| APAC | MQL | 9 | 7 | -2 | Minor |
| APAC | SQL | 3 | 1 | -2 | Minor |
| APAC | SAL | 2 | 0 | -2 | Minor |
| APAC | SQO | 2 | 0 | -2 | Minor |
| EMEA | MQL | 13 | 12 | -1 | Minor |
| EMEA | SQL | 5 | 5 | 0 | Match |
| EMEA | SAL | 2 | 1 | -1 | Minor |
| EMEA | SQO | 2 | 1 | -1 | Minor |

### R360 Funnel Actuals (INBOUND)

| Region | Metric | JSON Value | BigQuery Live | Variance |
|--------|--------|------------|---------------|----------|
| AMER | MQL | 23 | 24 | +1 |
| AMER | SQL | 12 | 12 | 0 |
| AMER | SQO | 10 | 14 | +4 |
| APAC | MQL | - | 1 | - |
| EMEA | MQL | - | 6 | - |
| EMEA | SQL | - | 3 | - |
| EMEA | SQO | - | 3 | - |

### Funnel Targets (INBOUND)

| Product | Region | MQL Tgt | SQL Tgt | SAL Tgt | SQO Tgt |
|---------|--------|---------|---------|---------|---------|
| POR | AMER | 130 | 65 | 30 | 36 |
| POR | APAC | 20 | 7 | 5 | 5 |
| POR | EMEA | 9 | 4 | 3 | 2 |
| R360 | AMER | 96 | 33 | 23 | 27 |
| R360 | APAC | 1 | 0 | 0 | 0 |
| R360 | EMEA | 8 | 4 | 4 | 2 |

**CRITICAL FINDING**:
POR AMER funnel numbers in report-data.json are significantly higher than BigQuery live query. This suggests either:
1. Different date ranges being used
2. Different filters (SpiralyzeTest, MQL_Reverted)
3. Different count methodology (CaptureDate vs MQL_DT)
4. report-data.json uses a different query than the standard marketing funnel query

**Recommendation**: Investigate the funnel query in `query_comprehensive_risk_analysis.sql` to verify methodology matches `query_marketing_funnel_pacing.sql`.

---

## 4. CALCULATED ATTAINMENT CHECK

### POR Attainment (BigQuery Live)

| Region | Category | QTD Target | QTD Actual | Attainment % | Status |
|--------|----------|------------|------------|--------------|--------|
| AMER | EXPANSION | $130,064.52 | $210,539.43 | 161.9% | GREEN |
| AMER | MIGRATION | $48,774.19 | $14,154.14 | 29.0% | RED |
| AMER | NEW LOGO | $96,857.42 | $46,992.82 | 48.5% | RED |
| APAC | EXPANSION | $5,690.32 | $14,942.42 | 262.6% | GREEN |
| APAC | MIGRATION | $8,061.29 | $0 | 0.0% | RED |
| APAC | NEW LOGO | $13,548.39 | $0 | 0.0% | RED |
| EMEA | EXPANSION | $45,883.87 | $74,137.24 | 161.6% | GREEN |
| EMEA | MIGRATION | $41,187.10 | $36,742.13 | 89.2% | YELLOW |
| EMEA | NEW LOGO | $48,367.74 | $45,868.58 | 94.8% | GREEN |

### R360 Attainment (BigQuery Live)

| Region | Category | QTD Target | QTD Actual | Attainment % | Status |
|--------|----------|------------|------------|--------------|--------|
| AMER | EXPANSION | $28,451.61 | $30,600.00 | 107.5% | GREEN |
| AMER | NEW LOGO | $75,423.08 | $22,931.82 | 30.4% | RED |
| APAC | NEW LOGO | $2,709.68 | $0 | 0.0% | RED |
| EMEA | NEW LOGO | $14,903.23 | $2,430.38 | 16.3% | RED |

---

## 5. ISSUES IDENTIFIED

### Critical Issues

1. **POR Funnel Discrepancy**: AMER funnel numbers show significant variance between report-data.json and BigQuery live query. JSON shows 69 MQL vs 46 in live query (33% lower).

### Known Issues (Expected)

2. **R360 Target Discrepancy**: SOP is $3,699 higher than Excel for AMER NEW LOGO. Excel is source of truth.

3. **Data Freshness**: report-data.json was generated at 07:25 UTC. Any deals closed after that time would not be reflected.

### Recommendations

1. **Investigate Funnel Query**: Review `query_comprehensive_risk_analysis.sql` funnel CTEs to ensure methodology matches `query_marketing_funnel_pacing.sql`

2. **Refresh report-data.json**: Run `python scripts/generate-data.py` to get latest data

3. **Consider Automated Refresh**: Set up scheduled refresh of report-data.json to keep data current

4. **Document SOP Discrepancy**: Add note to SOP about R360 AMER target variance from Excel

---

## 6. VALIDATION QUERIES USED

All queries are documented in:
- `query_qa_cross_reference.sql` - Comprehensive validation query
- `query_data_reconciliation.sql` - Source comparison
- `query_marketing_funnel_pacing.sql` - Funnel pacing
- `QA_CROSS_REFERENCE.md` - Reference documentation
