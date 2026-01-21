# Critical Lessons Learned

## Funnel Data Source Hierarchy (EXPANSION/MIGRATION)

**SOURCE OF TRUTH for funnel summary metrics:**
- `Staging.DailyRevenueFunnel` - Pre-aggregated daily counts by FunnelType
- Uses `SUM(SQO)` per day, aggregated by `CaptureDate`
- Filter: `UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION', 'MIGRATION', 'R360 MIGRATION')`

**Detail records (for drill-down):**
- `MarketingFunnel.ExpansionFunnel` - Raw records with `SQO_DT`
- `MarketingFunnel.MigrationFunnel` - Raw records with `SQO_DT`

**Verified Values (as of 2026-01-18):**
| Source | POR EXPANSION | POR MIGRATION |
|--------|---------------|---------------|
| DailyRevenueFunnel QTD | **134** ✅ | 13 |
| RevOpsReport QTD (P75) | **134** ✅ | 13 |
| ExpansionFunnel SQO_DT QTD | 183 | n/a |
| MigrationFunnel SQO_DT QTD | n/a | 26 |
| MigrationFunnel Last 90 Days | n/a | 175 |

**POR Migration QTD (Verified 2026-01-18):**
| Stage | Value |
|-------|-------|
| EQL | 54 |
| SQL | 23 |
| SAL | 14 |
| SQO | 13 |

## Salesforce CPQ Renewals

**Formula:**
```
Expected Increase (USD) = (ACV__c / ConversionRate) * (SBQQ__RenewalUpliftRate__c / 100)
```

**DO NOT use `projected_uplift__c`** - often empty/stale.

**Currency Conversion:**
| Currency | Rate | USD Value |
|----------|------|-----------|
| USD | 1.0 | $1.00 |
| GBP | 0.79 | $1.27 |
| AUD | 1.5 | $0.67 |
| EUR | 0.91 | $1.10 |

**Filter Active Renewals:**
```sql
WHERE Status = 'Activated'
  AND ACV__c > 0
  AND Renewal_Status__c NOT IN ('Non Renewing', 'Success')
```

## Vercel Limitations

- **No SF CLI** in serverless - use BigQuery sync instead
- Contract queries fall back to BigQuery `sfdc.ContractViewTable`

## Common Query Errors

**"Column not found in alias"**: Check if column exists in source table before JOINing.
- InboundFunnel lacks: Lost_DT, ClosedLostReason, ACV
- Use simplified queries without JOINs when possible

**Deduplication**: Always use ROW_NUMBER() PARTITION BY email/ID to avoid duplicates.

## Funnel Detail Tables (SAL/SQO/SQL/MQL)

**CRITICAL: Avoid complex JOINs in funnel queries.**

When queries fail silently (return empty arrays), the cause is usually:
1. **Column doesn't exist** in source table (e.g., `o.IsWon`, `o.IsClosed`)
2. **Table doesn't exist** (e.g., R360ExpansionFunnel)
3. **JOIN mismatch** - alias references non-existent columns

**Pattern that works:**
```sql
-- Simplified query - no JOINs, derive status from funnel dates only
CASE
  WHEN f.Won_DT IS NOT NULL THEN 'WON'
  WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SQO_DT AS DATE), DAY) > 60 THEN 'STALLED'
  ELSE 'ACTIVE'
END AS status,
CAST(NULL AS STRING) AS opportunity_stage,  -- NULL instead of JOIN
CAST(NULL AS FLOAT64) AS opportunity_acv,
'N/A' AS loss_reason
```

**Pattern that fails:**
```sql
-- Complex JOINs - prone to column mismatch errors
LEFT JOIN OpportunityViewTable o ON f.OpportunityID = o.Id
...
WHEN o.IsClosed = true AND o.IsWon = false THEN 'LOST'  -- May not exist
o.StageName AS opportunity_stage,  -- Column name mismatch
```

## Funnel Table Column Differences

| Table | Identifier Column | Has EQL_DT | Has SAL_DT |
|-------|------------------|------------|------------|
| InboundFunnel | OpportunityID/LeadId/ContactId | No (uses MQL_DT) | Yes |
| ExpansionFunnel | OpportunityID | Yes | No |
| MigrationFunnel | OpportunityID | Yes | Yes |
| R360InboundFunnel | OpportunityID/LeadId/Email | No (uses MQL_DT) | No |

**Deduplication Standard**: Always use `COALESCE(OpportunityID, LeadId, ContactId)` for POR or `COALESCE(OpportunityID, LeadId, Email)` for R360. Do NOT use email-only deduplication as it misses records with NULL email but valid OpportunityID.

## 7-Tier Opportunity Linking Strategy (Updated 2026-01-20)

Funnel records often lack direct OpportunityID. Use cascading 7-tier strategy to maximize opportunity matches:

| Tier | Strategy | Tables Used | Match Field |
|------|----------|-------------|-------------|
| 1 | Direct OpportunityID | Funnel.OpportunityID → OpportunityViewTable | f.OpportunityID |
| 2 | Lead ConvertedOpportunityId | Lead.ConvertedOpportunityId → OpportunityViewTable | l.ConvertedOpportunityId |
| 3 | Exact OpportunityName match | Pre-computed CTE by OpportunityName | f.OpportunityName |
| 4 | ContactId → Account → Opp | Contact.AccountId → Opp.AccountId | f.ContactId |
| 5 | Email → Contact → Account → Opp | Contact.Email → Contact.AccountId → Opp | f.Email |
| 6 | Fuzzy Company Name | Normalized company name (remove Inc/LLC/Ltd) | REGEXP_REPLACE(f.Company) |
| 7 | Account.Name direct match | Account.Name → Account.Id → Opp.AccountId | f.Company |

**Key implementation patterns:**
```sql
-- Tier 7 CTE
account_matched_opps AS (
  SELECT DISTINCT
    LOWER(TRIM(a.Name)) AS account_name,
    FIRST_VALUE(o.Id) OVER (PARTITION BY a.Id ORDER BY o.CreatedDate DESC) AS opp_id
  FROM Account a
  INNER JOIN OpportunityViewTable o ON a.Id = o.AccountId
  WHERE a.Name IS NOT NULL AND a.Name != ''
    AND o.por_record__c = true  -- or false for R360
)

-- CASCADE JOINs (each tier only fires if previous tiers failed)
LEFT JOIN account_matched_opps amo
  ON LOWER(TRIM(f.Company)) = amo.account_name
  AND NULLIF(f.OpportunityID, '') IS NULL
  AND l.ConvertedOpportunityId IS NULL
  AND nmo.opp_id IS NULL AND cao.opp_id IS NULL
  AND emo.opp_id IS NULL AND fnmo.opp_id IS NULL

-- COALESCE for opportunity_id
COALESCE(NULLIF(f.OpportunityID, ''), l.ConvertedOpportunityId,
         nmo.opp_id, cao.opp_id, emo.opp_id, fnmo.opp_id, amo.opp_id) AS opportunity_id
```

**Applied to functions:**
- `getSQLDetails()` - POR + R360 queries
- `getSALDetails()` - POR only
- `getSQODetails()` - POR + R360 queries

## Funnel Pacing Override Pattern

RevOpsReport contains **stale** funnel actuals. Override with live funnel queries:

```typescript
// Override EXPANSION/MIGRATION actuals with live funnel data
for (const f of porExpansionFunnel as any[]) {
  const key = `${f.product}-${f.region}-EXPANSION`;
  const existing = funnelDataMap.get(key);
  if (existing) {
    existing.actual_mql = parseInt(f.actual_mql) || 0;
    existing.actual_sql = parseInt(f.actual_sql) || 0;
    existing.actual_sqo = parseInt(f.actual_sqo) || 0;
  }
}
```

## API Testing

**Always test with dates:**
```bash
curl -X POST "URL/api/report-data" \
  -H "x-playwright-test: e2e-test-bypass-2026" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2026-01-01", "endDate": "2026-01-18"}'
```

**GET without dates returns documentation, not data.**

## BigQuery Table Reference (Discovered 2026-01-18)

### MarketingFunnel Dataset Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `InboundFunnel` | POR inbound leads | MQL_DT, SQL_DT, SAL_DT, SQO_DT, Division |
| `ExpansionFunnel` | POR expansion opps | EQL_DT, SQL_DT, SQO_DT, Division, OpportunityID |
| `MigrationFunnel` | POR migration opps | EQL_DT, SQL_DT, SAL_DT, SQO_DT, MigrationCase |
| `NewLogoFunnel` | POR new logo | MQL_DT, SQL_DT, SAL_DT, SQO_DT, Type='New Business' |
| `OutboundFunnel` | POR outbound | CaptureDate, SQL, SAL, SQO (STRING 'true'/'false') |
| `R360InboundFunnel` | R360 inbound | MQL_DT, SQL_DT, SQO_DT |
| `R360ExpansionFunnel` | R360 expansion | Similar to ExpansionFunnel |
| `R360NewLogoFunnel` | R360 new logo | Similar to NewLogoFunnel |
| `R360OutboundFunnel` | R360 outbound | Similar to OutboundFunnel |
| `FunnelStageConversion_AMER` | WIDE table with stage flags | SQO (INT64 0/1), ExpansionOpp, MigrationOpp, QualifiedDate |
| `FunnelStageConversion_APAC_EMEA` | WIDE table for non-AMER | Same as AMER |
| `FunnelStageConversion_Record360` | R360 WIDE table | Similar structure |
| `ClosedLostFunnel` | Lost opportunities | For drill-down on losses |
| `SQOCountByMonth` | Monthly SQO aggregates | Pre-aggregated by month |

### Staging Dataset Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `DailyRevenueFunnel` | **Primary source** for daily funnel | RecordType, FunnelType, CaptureDate, SQO, MQL, SQL, SAL |
| `RevOpsReport` | **Primary source** for bookings/revenue | Horizon, RiskProfile='P75', OpportunityType, Actual_SQO |
| `MonthlyRevenueFunnel` | Monthly aggregates | Similar to Daily |
| `BookingsPlan2026` | 2026 targets | Plan/Target values |

### FunnelStageConversion Table Notes
**CRITICAL**: These tables do NOT have `CaptureDate`, `FunnelType`, or `Category` columns.
- Use `ExpansionOpp = true` / `MigrationOpp = true` for filtering
- Use `QualifiedDate` or `CreatedDate` for date filtering
- `SQO` column is INT64 (0 or 1), not a count

### DailyRevenueFunnel FunnelTypes (QTD 2026-01-18)
| RecordType | FunnelType | SQO Count |
|------------|------------|-----------|
| POR | Expansion | 134 |
| R360 | R360 New Logo | 29 |
| R360 | R360 Expansion | 28 |
| POR | Inbound | 20 |
| R360 | R360 Inbound | 14 |
| POR | Migration | 13 |
| POR | New Logo | 10 |

## Renewal Targets: Use Q1_Plan_2026, Not Prior Year (2026-01-20)

**Problem:** R360 AMER Renewal Q1 target was showing $0.

**Root Cause:** Query used `Q1_Actual_2025` from `RAW_2026_Plan_by_Month` for renewal targets. R360 had no renewal revenue in 2025, so Q1_Actual_2025 = $0.

**Solution:** Use `COALESCE(Q1_Plan_2026, Q1_Actual_2025, 0)` to prefer planned target when prior year is missing:

```sql
SELECT
  Division,
  Booking_Type,
  ROUND(COALESCE(Q1_Plan_2026, Q1_Actual_2025, 0), 2) AS q1_target
FROM `Staging.RAW_2026_Plan_by_Month`
WHERE LOWER(Booking_Type) = 'renewal'
```

**Key insight:** New products (like R360 renewals) won't have prior year actuals. Always prefer current year plan as primary source.

## Lost Summary Filters: Include N/A Loss Reasons (2026-01-20)

**Problem:** SAL Lost summary showed 0 records despite having 3+ records with status='LOST'.

**Root Cause:** Filter excluded records where `loss_reason === 'N/A'`:
```typescript
// BAD: Excludes valid lost records
.filter(s => s.sal_status === 'LOST' && s.loss_reason && s.loss_reason !== 'N/A')
```

**Solution:** Include all lost records, display "No Reason Provided" for N/A:
```typescript
// GOOD: Includes all lost records
.filter(s => s.sal_status === 'LOST')
.forEach(s => {
  const reason = (s.loss_reason && s.loss_reason !== 'N/A')
    ? s.loss_reason
    : 'No Reason Provided';
  // ...
});
```

**Key insight:** Status-based summaries should filter by status alone. Missing metadata (like loss_reason) shouldn't exclude records from the summary.

## Verified Q1 2026 Targets (2026-01-20)

**Source:** `Staging.RevOpsReport` with `RiskProfile='P75'`, `Horizon='QTD'`, `Period_Start_Date='2026-01-01'`

| Product | Q1 Target |
|---------|-----------|
| POR | $3,121,250 |
| R360 | $941,999 |
| **Total** | **$4,063,249** |

**By Category (R360):**
| Category | Q1 Target |
|----------|-----------|
| EXPANSION | $210,850 |
| NEW LOGO | $657,760 |
| RENEWAL | $73,389 |

**By Category (POR):**
| Category | Q1 Target |
|----------|-----------|
| EXPANSION | $1,183,000 |
| MIGRATION | $596,250 |
| NEW LOGO | $880,060 |
| RENEWAL | $461,940 |

## SAL Details: Multiple Data Sources Required (2026-01-20)

**Problem:** SAL Details "Opp Type" filters showed only NEW LOGO records, even though funnel summary showed EXPANSION (121) and MIGRATION (4) SAL records.

**Root Cause:** SAL Details query only pulled from `InboundFunnel`, which exclusively contains New Logo (inbound) leads. EXPANSION and MIGRATION SAL records come from a different source.

**Data Source Architecture:**
| Category | SAL Data Source | SAL Criteria |
|----------|-----------------|--------------|
| NEW LOGO | `InboundFunnel.SAL_DT` | Has SAL_DT date |
| EXPANSION | `OpportunityViewTable` where Type='Existing Business' | Stage past Needs Analysis OR Won |
| MIGRATION | `OpportunityViewTable` where Type='Migration' | Stage past Needs Analysis OR Won |

**Solution:** UNION ALL multiple data sources in SAL Details query:
```sql
-- InboundFunnel for NEW LOGO (existing query)
ranked_sals AS (
  SELECT ... FROM InboundFunnel f
  WHERE f.SAL_DT IS NOT NULL
),
-- OpportunityViewTable for EXPANSION/MIGRATION
expansion_migration_sals AS (
  SELECT
    'POR' AS product,
    CASE o.Division WHEN 'US' THEN 'AMER' ... END AS region,
    o.Id AS record_id,
    CASE WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
         WHEN o.Type = 'Migration' THEN 'MIGRATION' END AS category,
    ...
  FROM OpportunityViewTable o
  WHERE o.Type IN ('Existing Business', 'Migration')
    AND o.ACV > 0
    -- SAL stage = past Needs Analysis OR Won
    AND (o.StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR o.Won)
)
SELECT * FROM ranked_sals WHERE rn = 1
UNION ALL
SELECT * FROM expansion_migration_sals WHERE rn = 1
```

**Key Insights:**
1. **Funnel tables are category-specific**: InboundFunnel = New Logo only
2. **SAL stage for EXPANSION/MIGRATION**: Determined by stage progression, not a date field
3. **Category derivation**: Always derive from `Opportunity.Type`, never hardcode
4. **UNION pattern**: Combine multiple data sources to populate all filter options

**Category Derivation from Opportunity.Type:**
```sql
CASE
  WHEN o.Type = 'Existing Business' THEN 'EXPANSION'
  WHEN o.Type = 'Migration' THEN 'MIGRATION'
  WHEN o.Type = 'Strategic' THEN 'STRATEGIC'
  ELSE 'NEW LOGO'
END AS category
```

## RAW_2026_Plan_by_Month Division Format

Division values include product suffix:
- `AMER POR`, `EMEA POR`, `APAC POR`
- `AMER R360`, `EMEA R360`, `APAC R360`
- `Total` (grand total row)

Parse with:
```typescript
const division = row.Division.toUpperCase();
const region = division.includes('AMER') ? 'AMER'
  : division.includes('EMEA') ? 'EMEA'
  : division.includes('APAC') ? 'APAC' : null;
const product = division.includes('R360') ? 'R360'
  : division.includes('POR') ? 'POR' : null;
```
