# SQL Queries

BigQuery queries for the Q1 2026 Risk Report.

## Directory Structure

```
sql/
├── reports/          # Report generation queries
└── diagnostics/      # Data validation and debugging queries
```

## Reports

| File | Purpose |
|------|---------|
| `query_comprehensive_risk_analysis.sql` | Master query for full report (all metrics) |
| `query_por_risk_analysis.sql` | POR-specific risk analysis |
| `query_r360_risk_analysis.sql` | R360-specific risk analysis |
| `por-full-detail.sql` | POR funnel detail with opportunity links |
| `r360-full-detail.sql` | R360 funnel detail with opportunity links |
| `query_trend_analysis.sql` | Trend comparison between date periods |
| `query_marketing_funnel_pacing.sql` | Marketing funnel pacing by source |
| `query_top_of_funnel_report.sql` | Top-of-funnel MQL/SQL metrics |
| `query_top_of_funnel_enhanced.sql` | Enhanced TOF with source breakdown |
| `query_r360_q1_2026_quarterly_goals.sql` | R360 quarterly goal tracking |

## Diagnostics

| File | Purpose |
|------|---------|
| `query_data_reconciliation.sql` | Cross-check data sources for consistency |
| `query_qa_cross_reference.sql` | QA validation queries |

## Usage

### Running in BigQuery Console

1. Open [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Select project: `data-analytics-306119`
3. Copy query content and paste in query editor
4. Modify date parameters as needed
5. Run query

### Key Parameters to Modify

Most queries accept these date filters:
```sql
-- Update these dates as needed
AND CAST(MQL_DT AS DATE) >= '2026-01-01'
AND CAST(MQL_DT AS DATE) <= '2026-01-15'
```

### Standard Filters

Always include these for clean data:
```sql
-- Exclude test records
AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)

-- Exclude reverted MQLs
AND (MQL_Reverted IS NULL OR MQL_Reverted = false)

-- Filter by division
AND Division IN ('US', 'UK', 'AU')
```

## Data Sources

| Table | Dataset | Description |
|-------|---------|-------------|
| `OpportunityViewTable` | `sfdc` | Salesforce opportunities |
| `InboundFunnel` | `MarketingFunnel` | POR funnel stages |
| `R360InboundFunnel` | `MarketingFunnel` | R360 funnel stages |
| `StrategicOperatingPlan` | `sfdc` | Q1 targets |
| `DailyRevenueFunnel` | `Staging` | Daily aggregates |

## Archived Queries

Historical and debugging queries are in `archive/debug_queries/` and `archive/qa_diagnostics/`.
