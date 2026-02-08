# API Routes Reference

## Main Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/report-data` | POST | Main data API (requires startDate, endDate) |
| `/api/renewals` | GET | Renewal forecasts |
| `/api/ai-analysis` | POST | AI insights generation |
| `/api/trend-analysis` | POST | Historical trends |

## report-data Response Structure

```typescript
{
  attainment_detail: AttainmentRow[],
  won_deals: Deal[],
  pipeline_deals: Deal[],
  lost_deals: Deal[],
  funnel_by_source: FunnelData[],
  funnel_by_category: FunnelData[],
  google_ads: AdMetrics[],
  mql_details: { POR: [], R360: [] },
  sql_details: { POR: [], R360: [] },
  sal_details: { POR: [], R360: [] },  // POR only
  sqo_details: { POR: [], R360: [] },
  period: { startDate, endDate, ... }
}
```

## Testing API

```bash
# With auth bypass
curl -X POST "https://q1-risk-report.vercel.app/api/report-data" \
  -H "x-playwright-test: e2e-test-bypass-2026" \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2026-01-01", "endDate": "2026-01-18"}'

# Check specific field
curl ... | jq '.sqo_details.POR | length'
```

## Key Functions in route.ts

| Function | Line ~Range | Purpose |
|----------|-------------|---------|
| `getRenewalTargetsFromRawPlan` | 43-86 | Renewal targets from RAW_2026_Plan_by_Month (uses Q1_Plan_2026) |
| `getSourceMixAllocations` | 93-137 | Source mix % for target allocation |
| `getWonDeals` | 786-828 | Won opportunities from OpportunityViewTable |
| `getLostDeals` | 830-873 | Lost opportunities |
| `getPipelineDeals` | 875-917 | Open pipeline |
| `getSALDetails` | 1660-1785 | SAL stage funnel records |
| `getSQODetails` | 1785-2117 | SQO stage funnel records |

## Target Data Sources

| Target Type | Primary Source | Fallback |
|-------------|----------------|----------|
| New Business | RevOpsReport (P90, QTD) | - |
| Expansion | RevOpsReport (P90, QTD) | - |
| Migration | RevOpsReport (P90, QTD) | - |
| **Renewal** | RAW_2026_Plan_by_Month.Q1_Plan_2026 | Q1_Actual_2025 |

**Note:** Renewal targets use `COALESCE(Q1_Plan_2026, Q1_Actual_2025, 0)` because new products like R360 have no prior year renewal history.

## Funnel Detail Data Sources (Updated 2026-02-08)

All funnel detail queries now use `DailyRevenueFunnel` (DRF) as the authoritative base, matching pacing counts exactly. Raw funnel tables are JOINed for enrichment only.

| Detail Type | Category | Base Source | Enrichment JOIN | Filter Criteria |
|-------------|----------|-------------|-----------------|-----------------|
| MQL Details | INBOUND | `DailyRevenueFunnel` | `InboundFunnel` | `d.MQL = 1` |
| MQL Details | EQL | `DailyRevenueFunnel` | `ExpansionFunnel`/`MigrationFunnel` | `d.MQL = 1, FunnelType IN ('EXPANSION','MIGRATION')` |
| MQL Details | STRATEGIC | `OpportunityViewTable` | — | `Type='New Business', ACV > 100000` |
| SQL Details | INBOUND | `DailyRevenueFunnel` | `InboundFunnel` + `OpportunityViewTable` | `d.SQL = 1` |
| SQL Details | NON-INBOUND | `DailyRevenueFunnel` | `NewLogoFunnel`/`ExpansionFunnel`/`MigrationFunnel` | `d.SQL = 1, FunnelType IN (...)` |
| SQL Details | STRATEGIC | `OpportunityViewTable` | — | Stage past Qualification |
| SAL Details | INBOUND | `DailyRevenueFunnel` | `InboundFunnel` + `OpportunityViewTable` | `d.SAL = 1` |
| SAL Details | EXPANSION | `OpportunityViewTable` | — | `Type='Existing Business'` + past Needs Analysis stage |
| SAL Details | MIGRATION | `OpportunityViewTable` | — | `Type='Migration'` + past Needs Analysis stage |
| SAL Details | STRATEGIC | `OpportunityViewTable` | — | Stage past Needs Analysis |
| SQO Details | INBOUND | `DailyRevenueFunnel` | `InboundFunnel` + `OpportunityViewTable` | `d.SQO = 1` |
| SQO Details | NON-INBOUND | `DailyRevenueFunnel` | `NewLogoFunnel`/`ExpansionFunnel`/`MigrationFunnel` | `d.SQO = 1, FunnelType IN (...)` |
| SQO Details | STRATEGIC | `OpportunityViewTable` | — | Stage at Proposal+ |

**DRF-Based Query Pattern:**
```sql
FROM DailyRevenueFunnel d
LEFT JOIN InboundFunnel f ON d.OpportunityID = f.OpportunityID
LEFT JOIN OpportunityViewTable o ON d.OpportunityID = o.Id
WHERE d.RecordType = 'POR'
  AND UPPER(d.FunnelType) = 'INBOUND'
  AND d.SQL = 1  -- or SAL = 1, SQO = 1
  AND d.CaptureDate BETWEEN startDate AND endDate
```

**STRATEGIC category** uses `DRF.Segment = 'Strategic'` for INBOUND, or `OVT.Type = 'New Business' AND ACV > 100000` for direct OVT queries.

**SAL Stage Criteria for EXPANSION/MIGRATION (OVT-based):**
```sql
-- Opportunities past Needs Analysis stage (Stage 3) OR Won
WHERE (StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR Won)
```

## Funnel Status Determination (Updated 2026-02-04)

**Status fields use only Tier 1-2 (`o` alias — direct OpportunityID or ConvertedOpportunityId):**
```sql
CASE
  WHEN o.Won = true THEN 'WON'
  WHEN o.IsClosed = true AND (o.Won IS NULL OR o.Won = false) THEN 'LOST'
  WHEN f.SQO_DT IS NOT NULL THEN 'CONVERTED_SQO'
  WHEN f.SAL_DT IS NOT NULL THEN 'CONVERTED_SAL'
  WHEN DATE_DIFF(CURRENT_DATE(), CAST(f.SQL_DT AS DATE), DAY) > 21 THEN 'STALLED'
  ELSE 'ACTIVE'
END
```

**STALLED Thresholds:** SQL = 21 days. Must be less than max record age in date range.

**Display fields (opportunity_name, stage, ACV)** can safely COALESCE across all 7 tiers.

**Never use `Won_DT IS NOT NULL` for status** — unreliable, records at Discovery stage can have it populated.
