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
| New Business | RevOpsReport (P75, QTD) | - |
| Expansion | RevOpsReport (P75, QTD) | - |
| Migration | RevOpsReport (P75, QTD) | - |
| **Renewal** | RAW_2026_Plan_by_Month.Q1_Plan_2026 | Q1_Actual_2025 |

**Note:** Renewal targets use `COALESCE(Q1_Plan_2026, Q1_Actual_2025, 0)` because new products like R360 have no prior year renewal history.

## Funnel Detail Data Sources

| Detail Type | Category | Data Source | Filter Criteria |
|-------------|----------|-------------|-----------------|
| SAL Details | NEW LOGO | `InboundFunnel` | `SAL_DT IS NOT NULL` |
| SAL Details | EXPANSION | `OpportunityViewTable` | `Type='Existing Business'` + past Needs Analysis stage |
| SAL Details | MIGRATION | `OpportunityViewTable` | `Type='Migration'` + past Needs Analysis stage |
| SQO Details | All | `InboundFunnel` + `OpportunityViewTable` | `SQO_DT IS NOT NULL` or Won/Proposal stage |
| SQL Details | All | `InboundFunnel` | `SQL_DT IS NOT NULL` |
| MQL Details | NEW LOGO | `InboundFunnel` | `MQL_DT IS NOT NULL` |

**SAL Stage Criteria for EXPANSION/MIGRATION:**
```sql
-- Opportunities past Needs Analysis stage (Stage 3) OR Won
WHERE (StageName NOT IN ('Discovery', 'Qualification', 'Needs Analysis') OR Won)
```
