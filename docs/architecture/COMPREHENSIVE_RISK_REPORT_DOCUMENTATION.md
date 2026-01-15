# Comprehensive Bookings Risk Analysis Report

## Documentation v1.0.0

**Created:** 2026-01-12
**Author:** AI Center of Excellence
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Report Components](#report-components)
3. [Data Flow Diagram](#data-flow-diagram)
4. [Output Structure](#output-structure)
5. [Key Metrics Definitions](#key-metrics-definitions)
6. [Running the Reports](#running-the-reports)
7. [Interpreting Results](#interpreting-results)
8. [Troubleshooting](#troubleshooting)

---

## Executive Summary

The Comprehensive Bookings Risk Analysis Report provides a unified view of sales performance across both POR and R360 products. It combines:

- **Bookings Attainment**: QTD actual vs target by region/category
- **Full Funnel Metrics**: MQL → SQL → SAL → SQO → Won pacing
- **Close Lost Analysis**: Loss reasons with ACV impact
- **Competitor Intelligence**: Where captured, competitor loss analysis
- **Pipeline Health**: Coverage ratios, aging, and velocity
- **Google Ads Attribution**: Marketing spend efficiency

### Key Features

| Feature | Description |
|---------|-------------|
| Dual Product | POR and R360 in single report |
| Dynamic Dates | Uses CURRENT_DATE() - no manual updates |
| Full Funnel | Complete MQL→Won visibility |
| Loss Analysis | Top loss reasons by ACV |
| RAG Status | Automatic traffic light indicators |
| Pipeline Coverage | Remaining target vs pipeline ratio |

---

## Report Components

### 1. Attainment Scorecard

Shows QTD performance against prorated Q1 targets:

```
+--------+----------+-----------+---------+----------+---------+--------+
| Region | Category | Q1 Target | QTD Tgt | Actual   | Attain% | RAG    |
+--------+----------+-----------+---------+----------+---------+--------+
| AMER   | New Logo | $524,260  | $69,901 | $31,998  | 45.8%   | RED    |
| AMER   | Expansion| $832,000  | $110,933| $145,750 | 131.4%  | GREEN  |
```

### 2. Funnel Pacing (Inbound)

MQL → SQL → SAL → SQO conversion tracking:

```
+---------+--------+--------+--------+--------+----------+----------+
| Product | Region | MQL    | SQL    | SAL    | SQO      | MQL→SQL% |
|         |        | Act/Tgt| Act/Tgt| Act/Tgt| Act/Tgt  |          |
+---------+--------+--------+--------+--------+----------+----------+
| POR     | AMER   | 58/111 | 34/55  | 24/40  | 7/31     | 58.6%    |
```

### 3. Close Lost Analysis

Top reasons for lost deals by ACV:

```
+------------------------+-------+------------+------------+
| Loss Reason            | Deals | Lost ACV   | % of Total |
+------------------------+-------+------------+------------+
| Pricing was too high   | 9     | $102,504   | 68.9%      |
| Not Ready to Buy       | 6     | $29,406    | 19.8%      |
```

### 4. Pipeline Coverage

Coverage ratio of pipeline vs remaining target:

```
+--------+----------+-----------+-------------+----------+
| Region | Category | Remaining | Pipeline    | Coverage |
+--------+----------+-----------+-------------+----------+
| AMER   | New Logo | $492,262  | $624,150    | 1.3x     |
| EMEA   | Migration| $226,244  | $726,890    | 3.2x     |
```

### 5. Google Ads Summary

Marketing spend and efficiency metrics:

```
+---------+------------+--------+---------+--------+--------+
| Product | Impressions| Clicks | Spend   | CPC    | CPA    |
+---------+------------+--------+---------+--------+--------+
| POR     | 9,399      | 947    | $8,700  | $9.19  | $193   |
| R360    | 3,242      | 312    | $2,150  | $6.89  | $215   |
```

---

## Data Flow Diagram

```
                    ┌─────────────────────┐
                    │ OpportunityViewTable │
                    │   (Won/Lost Deals)   │
                    └─────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Won Actuals   │   │ Lost Actuals    │   │ Open Pipeline   │
│ (QTD ACV/Cnt) │   │ (Loss Reasons)  │   │ (Coverage)      │
└───────┬───────┘   └────────┬────────┘   └────────┬────────┘
        │                    │                     │
        └────────────────────┼─────────────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │ Attainment Summary  │
                    │ + Loss Analysis     │
                    └─────────┬───────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌─────────────────┐                       ┌─────────────────┐
│ DailyRevenue    │                       │ StrategicOp     │
│ Funnel (Actuals)│                       │ Plan (Targets)  │
└────────┬────────┘                       └────────┬────────┘
         │                                         │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Funnel Pacing   │
                  │ (MQL→SQO)       │
                  └────────┬────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌─────────────────┐                   ┌─────────────────┐
│ Google Ads POR  │                   │ Google Ads R360 │
└────────┬────────┘                   └────────┬────────┘
         │                                     │
         └─────────────────┬───────────────────┘
                           │
                           ▼
                  ┌─────────────────────────┐
                  │  COMPREHENSIVE REPORT   │
                  │  (JSON Output)          │
                  └─────────────────────────┘
```

---

## Output Structure

### JSON Schema (Simplified)

```json
{
  "generated_at_utc": "2026-01-12T15:30:00Z",
  "report_date": "2026-01-12",
  "percentile": "P50",

  "period": {
    "quarter_start": "2026-01-01",
    "as_of_date": "2026-01-12",
    "days_elapsed": 12,
    "days_remaining": 78,
    "total_days": 90,
    "quarter_pct_complete": 13.3
  },

  "grand_total": {
    "total_q1_target": 3527920,
    "total_qtd_acv": 387093,
    "total_qtd_attainment_pct": 73.2,
    "total_win_rate_pct": 65.4
  },

  "product_totals": {
    "POR": { ... },
    "R360": { ... }
  },

  "attainment_detail": {
    "POR": [ array of region/category rows ],
    "R360": [ array of region/category rows ]
  },

  "top_risk_pockets": [
    { "product": "R360", "region": "AMER", "category": "NEW LOGO", "qtd_gap": -47089, ... }
  ],

  "funnel_pacing": {
    "POR": [ array of region funnel metrics ],
    "R360": [ array of region funnel metrics ]
  },

  "loss_reasons": {
    "POR": [ array of top loss reasons ],
    "R360": [ array of top loss reasons ]
  },

  "competitor_losses": [ array of competitor data ],

  "google_ads": {
    "POR": { impressions, clicks, spend, cpc, cpa },
    "R360": { impressions, clicks, spend, cpc, cpa }
  },

  "quarterly_targets": {
    "POR_Q1_target": 2659310,
    "R360_Q1_target": 868610,
    "combined_Q1_target": 3527920
  }
}
```

---

## Key Metrics Definitions

### Attainment Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| QTD Target | Q1_Target × (Days_Elapsed / 90) | Prorated target |
| QTD Attainment % | QTD_Actual / QTD_Target × 100 | Pacing percentage |
| Q1 Progress % | QTD_Actual / Q1_Target × 100 | Full quarter progress |
| QTD Gap | QTD_Actual - QTD_Target | Absolute variance |

### Pipeline Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| Pipeline Coverage | Pipeline_ACV / (Q1_Target - QTD_Actual) | Coverage ratio |
| Avg Age Days | AVG(CURRENT_DATE - CreatedDate) | Pipeline freshness |

### Win/Loss Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| Win Rate % | Won_Deals / (Won_Deals + Lost_Deals) × 100 | Closing success |
| Lost ACV % | Lost_ACV_Reason / Total_Lost_ACV × 100 | Loss reason impact |

### Funnel Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| MQL→SQL Rate | SQL / MQL × 100 | Lead qualification |
| SQL→SAL Rate | SAL / SQL × 100 | Sales acceptance |
| SAL→SQO Rate | SQO / SAL × 100 | Opportunity creation |
| SQO→Won Rate | Won / SQO × 100 | Closing conversion |

---

## Running the Reports

### Option 1: BigQuery Console

1. Open [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Copy contents of `query_comprehensive_risk_analysis.sql`
3. Paste into query editor
4. Click "Run"
5. Copy JSON output

### Option 2: BigQuery CLI

```bash
# Navigate to report directory
cd "/Users/prestonharris/Risk Report/"

# Run comprehensive report
bq query --use_legacy_sql=false --format=json < query_comprehensive_risk_analysis.sql > output_$(date +%Y-%m-%d).json

# Run with pretty formatting
bq query --use_legacy_sql=false --format=prettyjson < query_comprehensive_risk_analysis.sql
```

### Option 3: Scheduled Query

Set up a scheduled query in BigQuery to run daily and export to GCS or email.

---

## Interpreting Results

### RAG Status Guide

| Status | Attainment | Action |
|--------|------------|--------|
| 🟢 GREEN | ≥90% | Maintain pace, share best practices |
| 🟡 YELLOW | 70-89% | Investigate, accelerate pipeline |
| 🔴 RED | <70% | Urgent intervention needed |

### Risk Pocket Prioritization

1. **Largest Gap**: Sort by `qtd_gap` ascending (most negative first)
2. **Strategic Impact**: Prioritize New Logo over Expansion
3. **Recoverability**: Check pipeline coverage - 2x+ is recoverable

### Loss Reason Actions

| Top Reason | Recommended Action |
|------------|-------------------|
| Pricing too high | Competitive analysis, pricing flexibility |
| Not Ready to Buy | Nurture program, lead scoring |
| Competitor | Battlecards, feature comparison |
| No Budget | Qualification improvement, payment terms |
| Timing | Nurture sequence, re-engagement |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Resolution |
|-------|-------|------------|
| Empty results | No data in date range | Check date parameters |
| Null attainment | Zero target | Expected for some segments |
| Mismatched totals | Excluded renewals | By design - report excludes renewals |
| Missing funnel data | SOP sync lag | Check DailyRevenueFunnel freshness |

### Data Quality Checks

```sql
-- Check for data freshness
SELECT MAX(CloseDate) AS latest_close
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true;

-- Check funnel sync
SELECT MAX(CaptureDate) AS latest_capture
FROM `data-analytics-306119.Staging.DailyRevenueFunnel`;
```

---

## Related Reports

| Report | File | Use Case |
|--------|------|----------|
| Top of Funnel Only | `query_top_of_funnel_enhanced.sql` | Marketing focus |
| POR Only | `query_por_risk_analysis.sql` | POR deep dive |
| R360 Only | `query_r360_risk_analysis.sql` | R360 deep dive |

---

## Support

For questions or issues, contact the AI Center of Excellence team.
