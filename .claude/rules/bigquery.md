---
paths:
  - "**/*.sql"
  - "app/api/**/*.ts"
---

# BigQuery Data Patterns

## RevOps Architecture (PRIMARY - 2026)

**Always use P75 risk profile for targets. Query RevOpsReport for all performance metrics.**

### Staging Dataset - RevOps Tables

**RevOpsReport** (Layer 5) - **PRIMARY TABLE FOR ALL REPORTING**
- Columns: Horizon, RiskProfile, RecordType, Region, OpportunityType, Period_Start_Date, Target_ACV, Actual_ACV, Revenue_Pacing_Score
- Use: WTD/MTD/QTD/YTD targets and actuals
- Filter: `RiskProfile = 'P75'` for standard reporting

**RevOpsPerformance** (Layer 4) - Daily pacing
- Columns: Date, RecordType, Region, OpportunityType, RiskProfile, Target_ACV, Actual_ACV
- Use: Daily attainment tracking

**RevOpsPlan** (Layer 3) - Vertical format
- Columns: RiskProfile, RecordType, Region, OpportunityType, Target_ACV
- Use: Reference for target breakdowns

**Source Tables** (Layer 1):
- `SourcePlanByMonth2026` - Monthly plan with seasonality
- `SourceTargetRates` - Conversion rates & ADS
- `SourceBookingsAllocations` - Source mix allocations
- `SalesCycleLags2026` - Stage duration (P50/P75/P90)

**Raw Data** (Layer 0):
- `RAW_2026_Plan_by_Month` - CSV import with Q1 targets
- `MonthlyRevenueFunnel` - Monthly aggregated funnels
- `DailyRevenueFunnel` - Daily funnels

### RAW_2026_Plan_by_Month (Critical for Renewals)

**Division format:** `AMER POR`, `EMEA POR`, `APAC POR`, `AMER R360`, `EMEA R360`, `APAC R360`, `Total`

**Key columns:**
| Column | Purpose |
|--------|---------|
| Q1_Plan_2026 | **Primary** Q1 target (use for new products like R360 renewals) |
| Q1_Actual_2025 | Prior year Q1 actuals (may be $0 for new products) |
| Booking_Type | `Renewal`, `New`, `Expansion`, `Migration` |

**Renewal target pattern:**
```sql
SELECT Division, Booking_Type,
  ROUND(COALESCE(Q1_Plan_2026, Q1_Actual_2025, 0), 2) AS q1_target
FROM `Staging.RAW_2026_Plan_by_Month`
WHERE LOWER(Booking_Type) = 'renewal'
```

### Source Target Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `Source_2026_POR_Targets` | POR annual targets by funnel/source | Funnel_Type, Region, Annual_Booking_Target |
| `Source_2026_R360_Targets` | R360 annual targets | Same structure |
| `Source_2026_Bookings_Targets` | Combined with rates | Target_ADS, Rate_SQO_Won, Rate_SQL_SQO |

### Standard RevOpsReport Query Pattern
```sql
SELECT
  RecordType AS product,
  Region AS region,
  OpportunityType,
  ROUND(COALESCE(Target_ACV, 0), 2) AS target,
  ROUND(COALESCE(Actual_ACV, 0), 2) AS actual,
  ROUND(COALESCE(Revenue_Pacing_Score, 0), 2) AS attainment_pct
FROM `data-analytics-306119.Staging.RevOpsReport`
WHERE Horizon = 'QTD'
  AND RiskProfile = 'P75'
  AND Period_Start_Date = '2026-01-01'
  AND RecordType IN ('POR', 'R360')
  AND Region IN ('AMER', 'EMEA', 'APAC')
```

## Legacy Tables

### sfdc (Salesforce)

**OpportunityViewTable** - Core opportunity data
- Columns: Id, OpportunityName, AccountName, contactid, Division, Type, StageName, ACV, Won, CloseDate, por_record__c, SDRSource, POR_SDRSource
- Grain: One row per opportunity

**StrategicOperatingPlan** - DEPRECATED (use RevOpsReport)
- Columns: Quarter, Product, Division, TargetMRR
- Note: Contains P50 targets only

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
