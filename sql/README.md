# SQL Queries

BigQuery queries for Q1 2026 Risk Report.

## Structure

```
sql/
├── reports/       # Report generation queries
├── diagnostics/   # Data validation queries
└── schemas/       # Data lineage documentation
```

## Key Queries

| File | Purpose |
|------|---------|
| `query_comprehensive_risk_analysis.sql` | Master query (all metrics) |
| `query_trend_analysis.sql` | Period comparison |
| `query_marketing_funnel_pacing.sql` | Funnel pacing by source |
| `query_top_of_funnel_report.sql` | TOF with Google Ads |
| `por-full-detail.sql` / `r360-full-detail.sql` | Detail with links |

## Data Sources

See `schemas/data-lineage.md` for complete source documentation.

| Dataset | Tables |
|---------|--------|
| sfdc | OpportunityViewTable, StrategicOperatingPlan |
| MarketingFunnel | InboundFunnel, R360InboundFunnel |
| GoogleAds_POR_* | ads_CampaignBasicStats, ads_Campaign |
| GoogleAds_Record360_* | ads_CampaignBasicStats, ads_Campaign |

## Usage

1. Open [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Project: `data-analytics-306119`
3. See `.claude/rules/bigquery.md` for required filters
