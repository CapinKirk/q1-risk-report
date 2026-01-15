# Enhanced Top of Funnel Pacing Report

## Documentation v2.0.0

**Created:** 2026-01-12
**Author:** AI Center of Excellence
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Data Sources](#data-sources)
3. [Time Horizons](#time-horizons)
4. [Field Definitions](#field-definitions)
5. [Calculation Methodology](#calculation-methodology)
6. [RAG Status Thresholds](#rag-status-thresholds)
7. [Alerting Logic](#alerting-logic)
8. [Usage Instructions](#usage-instructions)
9. [Output Formats](#output-formats)

---

## Overview

The Enhanced Top of Funnel Pacing Report provides comprehensive visibility into marketing performance by combining Google Ads metrics with marketing funnel data. It enables:

- Real-time pacing against targets
- Multi-horizon trend analysis (MTD, QTD, Rolling periods)
- Full funnel visualization from Impressions to Won ACV
- Google Ads attribution to downstream funnel stages
- Automated alerting on critical thresholds
- Month-end forecasting based on current run rates

### Key Features

| Feature | Description |
|---------|-------------|
| Time Flexibility | MTD, QTD, Rolling 7d, Rolling 30d, WoW, MoM |
| Full Funnel | Impressions -> Clicks -> Conversions -> MQL -> SQL -> SAL -> SQO -> Won -> ACV |
| Attribution | Cost per MQL/SQL/SQO/Won, Marketing ROI, Blended CAC |
| Forecasting | Projected month-end, required daily rates |
| Alerting | RAG status, critical alerts, warnings, wins |
| Benchmarks | Conversion rate targets at each stage |

---

## Data Sources

### 1. Funnel Actuals - DailyRevenueFunnel

**Table:** `data-analytics-306119.Staging.DailyRevenueFunnel`

| Column | Type | Description |
|--------|------|-------------|
| RecordType | STRING | Product identifier (POR, R360) |
| Region | STRING | Geographic region (AMER, EMEA, APAC) |
| FunnelType | STRING | Lead source type (INBOUND, R360 INBOUND) |
| Source | STRING | Channel source |
| CaptureDate | DATE | Date lead was captured (use for MQL timing) |
| MQL | INT64 | Marketing Qualified Leads count |
| SQL | INT64 | Sales Qualified Leads count |
| SAL | INT64 | Sales Accepted Leads count |
| SQO | INT64 | Sales Qualified Opportunities count |
| Won | INT64 | Closed Won deals count |
| WonACV | FLOAT64 | Annual Contract Value of Won deals |

**Key Filters:**
- `UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND')` for inbound-only
- `RecordType IN ('POR', 'R360')` for product filtering
- Use `CaptureDate` (not MQL_DT) for date filtering

### 2. Funnel Targets - StrategicOperatingPlan

**Table:** `data-analytics-306119.Staging.StrategicOperatingPlan`

| Column | Type | Description |
|--------|------|-------------|
| RecordType | STRING | Product identifier |
| Region | STRING | Geographic region |
| FunnelType | STRING | Funnel type |
| Source | STRING | Must be 'INBOUND' |
| Percentile | STRING | Target percentile (P50) |
| TargetDate | DATE | Date target applies to |
| OpportunityType | STRING | Must exclude 'RENEWAL' |
| Target_MQL | FLOAT64 | Daily MQL target |
| Target_SQL | FLOAT64 | Daily SQL target |
| Target_SAL | FLOAT64 | Daily SAL target |
| Target_SQO | FLOAT64 | Daily SQO target |
| Target_Won | FLOAT64 | Daily Won target |
| Target_ACV | FLOAT64 | Daily ACV target |

**Key Filters:**
- `Percentile = 'P50'` for P50 targets
- `Source = 'INBOUND'`
- `OpportunityType != 'RENEWAL'`

### 3. Google Ads - POR

**Table:** `data-analytics-306119.GoogleAds_POR_8275359090.ads_CampaignBasicStats_8275359090`

| Column | Type | Description |
|--------|------|-------------|
| segments_date | DATE | Date of metrics |
| segments_ad_network_type | STRING | Network type (SEARCH, DISPLAY, etc.) |
| campaign_id | INT64 | Campaign identifier |
| metrics_impressions | INT64 | Number of ad impressions |
| metrics_clicks | INT64 | Number of ad clicks |
| metrics_cost_micros | INT64 | Cost in micros (divide by 1,000,000 for USD) |
| metrics_conversions | FLOAT64 | Number of conversions |

**Key Filter:** `segments_ad_network_type = 'SEARCH'` for search ads only

### 4. Google Ads - R360

**Table:** `data-analytics-306119.GoogleAds_Record360_3799591491.ads_CampaignBasicStats_3799591491`

Same schema as POR Google Ads table.

---

## Time Horizons

| Horizon | Start Date | End Date | Use Case |
|---------|------------|----------|----------|
| MTD | First day of current month | Today | Primary pacing view |
| QTD | First day of current quarter | Today | Quarterly tracking |
| ROLLING_7D | Today - 6 days | Today | Weekly trend analysis |
| ROLLING_30D | Today - 29 days | Today | Monthly trend smoothing |
| PRIOR_MONTH | Prior month matching days | Prior month same day | MoM comparison |

---

## Field Definitions

### Google Ads Metrics

| Field | Formula | Description |
|-------|---------|-------------|
| impressions | SUM(metrics_impressions) | Total ad views |
| clicks | SUM(metrics_clicks) | Total ad clicks |
| ad_spend_usd | SUM(metrics_cost_micros) / 1,000,000 | Total spend in USD |
| conversions | SUM(metrics_conversions) | Total tracked conversions |
| ctr_pct | (clicks / impressions) * 100 | Click-through rate % |
| cpc_usd | ad_spend_usd / clicks | Cost per click in USD |
| cpa_usd | ad_spend_usd / conversions | Cost per acquisition in USD |

### Funnel Metrics

| Field | Formula | Description |
|-------|---------|-------------|
| actual_mql | SUM(MQL) | Total MQLs in period |
| target_mql | SUM(Target_MQL) | Target MQLs for period |
| mql_variance | actual_mql - target_mql | Gap to target (+ is ahead) |
| mql_pacing_pct | (actual_mql / target_mql) * 100 | Pacing percentage |

*Same pattern applies to SQL, SAL, SQO, Won, and ACV metrics.*

### Conversion Rates

| Field | Formula | Benchmark |
|-------|---------|-----------|
| mql_to_sql_rate | (SQL / MQL) * 100 | 50% |
| sql_to_sal_rate | (SAL / SQL) * 100 | 70% |
| sal_to_sqo_rate | (SQO / SAL) * 100 | 60% |
| sqo_to_won_rate | (Won / SQO) * 100 | 30% |
| mql_to_won_rate | (Won / MQL) * 100 | N/A (efficiency) |

### Attribution Metrics

| Field | Formula | Description |
|-------|---------|-------------|
| cost_per_mql | ad_spend_usd / total_mql | Marketing cost to generate one MQL |
| cost_per_sql | ad_spend_usd / total_sql | Marketing cost per SQL |
| cost_per_sqo | ad_spend_usd / total_sqo | Marketing cost per SQO |
| cost_per_won | ad_spend_usd / total_won | Marketing cost per closed deal |
| marketing_roi | total_acv / ad_spend_usd | Revenue return on ad spend |
| blended_cac | ad_spend_usd / total_won | Blended customer acquisition cost |

### Forecasting Metrics

| Field | Formula | Description |
|-------|---------|-------------|
| daily_rate | actual / days_elapsed | Current daily run rate |
| projected_eom | daily_rate * total_days_in_month | Projected month-end if pace continues |
| required_daily | (target - actual) / days_remaining | Daily rate needed to hit target |

---

## Calculation Methodology

### 1. Period Determination

```sql
-- MTD dates
mtd_start = DATE_TRUNC(CURRENT_DATE(), MONTH)
period_end = CURRENT_DATE()
mtd_days_elapsed = DATE_DIFF(period_end, mtd_start, DAY) + 1
mtd_total_days = DATE_DIFF(LAST_DAY(mtd_start), mtd_start, DAY) + 1
```

### 2. Pacing Calculation

```sql
pacing_pct = SAFE_DIVIDE(actual, target) * 100
```

Uses `SAFE_DIVIDE` to handle division by zero, returning NULL instead of error.

### 3. Forecasting

```sql
-- Current daily rate
daily_rate = actual / days_elapsed

-- Projected month end
projected = daily_rate * total_days_in_month

-- Required daily rate to hit target
required_daily = (full_month_target - actual) / days_remaining
```

### 4. Trend Analysis (MoM)

```sql
-- Change percentage
change_pct = ((current - prior) / prior) * 100

-- Trend direction
trend = CASE
  WHEN current > prior THEN 'IMPROVING'
  WHEN current < prior THEN 'DECLINING'
  ELSE 'STABLE'
END
```

### 5. Attribution (Google Ads to Funnel)

Assumes all inbound MQLs are influenced by Google Ads (primary channel attribution):

```sql
cost_per_mql = ad_spend_usd / total_mql
marketing_roi = total_acv / ad_spend_usd
```

---

## RAG Status Thresholds

| Status | Pacing Range | Color | Action |
|--------|--------------|-------|--------|
| GREEN | >= 90% | Green | On track - maintain pace |
| AMBER | 70% - 89% | Yellow | At risk - investigate |
| RED | < 70% | Red | Off track - urgent action |
| N/A | NULL | Gray | No target or data |

### RAG Assignment Logic

```sql
rag_status = CASE
  WHEN pacing_pct IS NULL THEN 'N/A'
  WHEN pacing_pct >= 90 THEN 'GREEN'
  WHEN pacing_pct >= 70 THEN 'AMBER'
  ELSE 'RED'
END
```

---

## Alerting Logic

### Critical Alerts

| Condition | Trigger | Urgency |
|-----------|---------|---------|
| Zero Pacing | Any stage at 0% with target > 0 | CRITICAL |

### Warning Alerts

| Condition | Trigger | Urgency |
|-----------|---------|---------|
| MQL Pacing Low | MQL < 70% pacing | WARNING |
| Won Pacing Low | Won < 50% pacing | WARNING |
| CPA High | CPA > $500 | WARNING |
| Below Benchmark | Conversion rate below target | WARNING |

### Wins

| Condition | Trigger |
|-----------|---------|
| Exceeding Target | Any stage >= 120% pacing |

### Recommendations Generation

```sql
recommendations = CASE
  WHEN COUNT(RED MQL regions) > 0 THEN
    'URGENT: Increase ad spend or optimize campaigns'
  WHEN COUNT(below benchmark conversions) > 0 THEN
    'REVIEW: Conversion below benchmark - assess lead quality'
  WHEN MAX(cpa) > 500 THEN
    'OPTIMIZE: CPA exceeds threshold - review targeting'
END
```

---

## Usage Instructions

### Running the SQL Query

```bash
# Execute in BigQuery
bq query --use_legacy_sql=false --format=json \
  < query_top_of_funnel_enhanced.sql
```

### Running the Python Script

```bash
# Navigate to report directory
cd /Users/prestonharris/Risk\ Report/

# Run with all output formats
python3 generate_tof_report.py --format all

# Run with JSON only
python3 generate_tof_report.py --format json --output-dir ./output

# Run with table display only
python3 generate_tof_report.py --format table
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| --output-dir, -o | Directory for output files | Current directory |
| --format, -f | Output format (json, table, all) | all |
| --query-file, -q | SQL query file path | query_top_of_funnel_enhanced.sql |

---

## Output Formats

### 1. JSON Structure

```json
{
  "generated_at": "timestamp",
  "report_date": "YYYY-MM-DD",
  "percentile": "P50",
  "period": {
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD",
    "days_elapsed": number,
    "days_remaining": number,
    "total_days_in_month": number
  },
  "google_ads": {
    "POR": { ... },
    "R360": { ... }
  },
  "google_ads_by_horizon": {
    "POR": { "MTD": {...}, "QTD": {...}, ... },
    "R360": { ... }
  },
  "funnel_metrics": {
    "POR": {
      "summary": { totals },
      "by_region": [ { region details with RAG } ]
    },
    "R360": { ... }
  },
  "full_funnel": {
    "POR": { stages with conversion rates },
    "R360": { ... }
  },
  "attribution": {
    "POR": { cost metrics, ROI },
    "R360": { ... }
  },
  "forecasting": {
    "POR": [ { region forecasts } ],
    "R360": [ ... ]
  },
  "trends": {
    "POR": [ { MoM comparisons } ],
    "R360": [ ... ]
  },
  "insights": {
    "alerts": { critical, warnings, wins },
    "recommendations": [ strings ]
  },
  "benchmarks": {
    "mql_to_sql": 0.50,
    "sql_to_sal": 0.70,
    "sal_to_sqo": 0.60,
    "sqo_to_won": 0.30
  }
}
```

### 2. Executive Summary (Terminal)

```
================================================================================
TOP OF FUNNEL PACING REPORT - EXECUTIVE SUMMARY
Generated: 2026-01-12T15:30:00.000000Z
Period: 2026-01-01 to 2026-01-12 (12 days)
================================================================================

GOOGLE ADS PERFORMANCE (MTD)
----------------------------------------
POR:
  Impressions: 9,399
  Clicks: 947 (CTR: 10.08%)
  Spend: $8.70K
  Conversions: 45
  CPC: $9.19 | CPA: $193.36
...
```

### 3. Detailed Tables (Terminal)

Includes:
- Detailed pacing by region with RAG indicators
- Conversion rates with benchmark flags
- Full funnel visualization (ASCII)
- Month-end forecasts
- MoM trend analysis

---

## File Inventory

| File | Purpose |
|------|---------|
| query_top_of_funnel_enhanced.sql | BigQuery SQL query |
| generate_tof_report.py | Python report generator |
| sample_tof_report_output.json | Example JSON output |
| TOF_REPORT_DOCUMENTATION.md | This documentation |

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-01-12 | Initial enhanced version with full feature set |
| 1.0.0 | 2026-01-12 | Basic MTD pacing (superseded) |

---

## Support

For questions or issues, contact the AI Center of Excellence team.
