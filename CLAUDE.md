# Q1 2026 Risk Report

Next.js 14 dashboard for Q1 2026 Bookings Risk Analysis with live BigQuery data.

**Live**: https://q1-risk-report.vercel.app

## Commands

```bash
npm run dev          # Dev server at localhost:3000
npm run build        # Production build
npm run lint         # Code style check
npx playwright test  # Run E2E tests
```

## Architecture

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 App Router + TypeScript |
| Data | BigQuery (live queries via API routes) |
| Auth | Google OAuth - @pointofrental.com / @record360.com |
| Deploy | Vercel (auto-deploy on push to main) |

## Key Paths

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Main dashboard |
| `app/analysis/page.tsx` | Trend analysis page |
| `app/api/report-data/route.ts` | Main data API (BigQuery) |
| `lib/types.ts` | TypeScript interfaces |
| `lib/filterData.ts` | Client-side filtering |
| `components/` | React components |

## Data Sources

### Salesforce (sfdc dataset)

| Table | Purpose |
|-------|---------|
| `OpportunityViewTable` | Won/Lost deals, ACV, stages |
| `StrategicOperatingPlan` | Q1 targets (P50) |

### Marketing Funnel (MarketingFunnel dataset)

| Table | Purpose |
|-------|---------|
| `InboundFunnel` | POR MQL/SQL/SAL/SQO stages |
| `R360InboundFunnel` | R360 funnel metrics |

### Google Ads

| Table | Purpose |
|-------|---------|
| `GoogleAds_POR_8275359090.ads_CampaignBasicStats_*` | POR ad performance |
| `GoogleAds_Record360_3799591491.ads_CampaignBasicStats_*` | R360 ad performance |

## Key Mappings

| Concept | Mapping |
|---------|---------|
| Division→Region | US=AMER, UK=EMEA, AU=APAC |
| Product | `por_record__c=true` → POR, else R360 |
| Category | New Business=NEW LOGO, Existing=EXPANSION |
| Funnel Flow | MQL_DT → SQL_DT → SAL_DT → SQO_DT |

## Testing

```bash
npx playwright test              # Run all E2E tests
npx playwright test --debug      # With inspector
npx playwright test --ui         # Interactive UI mode
```

## Debugging

| Issue | Solution |
|-------|----------|
| BigQuery 403 | Check `GOOGLE_CREDENTIALS_JSON` is valid |
| Auth redirect loop | Clear cookies, verify `NEXTAUTH_URL` |
| Data mismatch | Run `sql/diagnostics/` queries |

## Environment Variables

```
GOOGLE_CREDENTIALS_JSON  # BigQuery service account JSON
GOOGLE_CLOUD_PROJECT     # data-analytics-306119
NEXTAUTH_SECRET          # Auth secret
NEXTAUTH_URL             # Deployed URL
```

## Rules

Path-scoped rules in `.claude/rules/`:
- `code-style.md` - TypeScript/React conventions
- `bigquery.md` - BigQuery patterns, schemas, and column reference
