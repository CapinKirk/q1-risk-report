---
paths:
  - "**/*.sql"
  - "app/api/**/*.ts"
---

# BigQuery Data Patterns

## Datasets & Tables

### sfdc (Salesforce)

**OpportunityViewTable** - Core opportunity data
- Columns: Id, OpportunityName, AccountName, contactid, Division, Type, StageName, ACV, Won, CloseDate, por_record__c, SDRSource, POR_SDRSource
- Grain: One row per opportunity

**StrategicOperatingPlan** - Q1 2026 targets
- Columns: Quarter, Product, Division, TargetMRR
- Grain: One row per (Product, Division, Quarter)

### MarketingFunnel

**InboundFunnel** - POR lead progression
- Columns: LeadID, ContactID, LeadEmail, ContactEmail, Company, Division, SDRSource, MQL_DT, SQL_DT, SAL_DT, SQO_DT, OpportunityID, Status, Won, WonACV
- Grain: One row per lead

**R360InboundFunnel** - R360 lead progression
- Same structure as InboundFunnel

### Google Ads

**GoogleAds_POR_8275359090**
- `ads_CampaignBasicStats_*` - POR campaign metrics (impressions, clicks, cost, conversions)
- `ads_Campaign_*` - POR campaign metadata

**GoogleAds_Record360_3799591491**
- `ads_CampaignBasicStats_*` - R360 campaign metrics
- `ads_Campaign_*` - R360 campaign metadata

## Key Mappings

| Business Concept | Field | Values |
|------------------|-------|--------|
| Region | Division | US→AMER, UK→EMEA, AU→APAC |
| Category | Type | New Business→NEW LOGO, Existing→EXPANSION |
| Product | por_record__c | true→POR, false→R360 |

## Required Filters

Always include on funnel queries:
```sql
(SpiralyzeTest IS NULL OR SpiralyzeTest = false)  -- Exclude test data
(MQL_Reverted IS NULL OR MQL_Reverted = false)    -- Exclude reverted
Division IN ('US', 'UK', 'AU')                     -- Valid divisions only
```

## Common Patterns

| Pattern | Usage |
|---------|-------|
| Safe division | `SAFE_DIVIDE(num, NULLIF(denom, 0))` |
| NULL-safe sum | `COALESCE(SUM(value), 0)` |
| Date cast | `CAST(SQL_DT AS DATE)` |

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Unrecognized name" | Check column name/alias |
| "Missing GROUP BY" | Add field to GROUP BY |
| "Division by zero" | Use SAFE_DIVIDE |
