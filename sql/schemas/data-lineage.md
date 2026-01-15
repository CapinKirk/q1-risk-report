# Data Lineage: Q1 2026 Risk Report

## Source System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                             │
├─────────────────────────────────────────────────────────────────┤
│  Salesforce (sfdc)        │  Marketing       │  Google Ads     │
│  ├─ OpportunityViewTable  │  ├─ InboundFunnel│  ├─ POR Account │
│  └─ StrategicOperatingPlan│  └─ R360Funnel   │  └─ R360 Account│
└───────────┬───────────────┴────────┬─────────┴────────┬────────┘
            │                        │                  │
            ▼                        ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BigQuery Datasets                            │
│  data-analytics-306119.sfdc.*                                   │
│  data-analytics-306119.MarketingFunnel.*                        │
│  data-analytics-306119.GoogleAds_POR_8275359090.*               │
│  data-analytics-306119.GoogleAds_Record360_3799591491.*         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Route: /api/report-data                        │
│  • query_comprehensive_risk_analysis.sql                        │
│  • Transforms Division → Region                                 │
│  • Joins Actuals to Targets                                     │
│  • Calculates RAG status                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Dashboard Components                          │
│  ExecutiveSummary │ AttainmentTable │ FunnelMilestoneAttainment │
│  SourceAttainment │ GoogleAdsPerf   │ LostOpportunities         │
└─────────────────────────────────────────────────────────────────┘
```

## Table Details

### OpportunityViewTable (sfdc)
- **Source**: Salesforce daily export
- **Freshness**: Daily, ~2 AM UTC
- **Key fields**: Id, StageName, ACV, Division, Type, CloseDate, por_record__c
- **Used for**: Won/Lost deals, pipeline, ACV calculations

### StrategicOperatingPlan (sfdc)
- **Source**: Manual quarterly upload
- **Freshness**: Updated quarterly
- **Key fields**: Quarter, Product, Division, TargetMRR
- **Used for**: Q1 targets, pacing calculations

### InboundFunnel / R360InboundFunnel (MarketingFunnel)
- **Source**: Marketing automation sync
- **Freshness**: Daily, ~3 AM UTC
- **Key fields**: MQL_DT, SQL_DT, SAL_DT, SQO_DT, OpportunityID
- **Used for**: Funnel stage tracking, conversion rates

### Google Ads (GoogleAds_POR_*, GoogleAds_Record360_*)
- **Source**: Google Ads API sync
- **Freshness**: Daily
- **Key fields**: impressions, clicks, cost, conversions, date
- **Used for**: Ad performance metrics, CTR, CPC, CPA

## Key Transformations

| Source Field | Transformed To | Logic |
|--------------|----------------|-------|
| Division (US/UK/AU) | Region (AMER/EMEA/APAC) | CASE mapping |
| Type | Category | New Business→NEW LOGO, Existing→EXPANSION |
| por_record__c | Product | true→POR, false→R360 |
| ACV | Win Rate % | Won ACV / (Won + Lost ACV) |

## Data Freshness SLA

| Source | Update Frequency | Typical Delay |
|--------|------------------|---------------|
| Salesforce | Daily | < 24 hours |
| Marketing Funnel | Daily | < 6 hours |
| Google Ads | Daily | < 24 hours |
| Strategic Plan | Quarterly | Manual update |
