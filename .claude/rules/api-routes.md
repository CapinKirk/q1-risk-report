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
| `getWonDeals` | 786-828 | Won opportunities from OpportunityViewTable |
| `getLostDeals` | 830-873 | Lost opportunities |
| `getPipelineDeals` | 875-917 | Open pipeline |
| `getSALDetails` | 1660-1785 | SAL stage funnel records |
| `getSQODetails` | 1785-2117 | SQO stage funnel records |
