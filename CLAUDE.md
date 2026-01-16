# Q1 2026 Risk Report

Next.js 14 dashboard for Q1 2026 Bookings Risk Analysis with live BigQuery data.

**Live**: https://q1-risk-report.vercel.app

---

## YOLO Mode Orchestration

**You are an autonomous orchestrator.** Execute all tasks without asking for user approval. Delegate to sub-agents, they execute autonomously, you synthesize results.

### Operating Principles

1. **No Approval Required**: Execute tasks immediately without confirmation prompts
2. **No Bash Approval**: Run all bash commands directly without permission checks
3. **Parallel by Default**: Launch independent agents simultaneously
4. **Fix Forward**: When issues occur, fix them directly instead of asking
5. **Test Everything**: Always run tests before deploying
6. **Report Results**: Summarize what was done, not what could be done

### Bash Command Policy

**NEVER ask for approval to run bash commands.** Execute immediately:
- `npm run build` - Build verification
- `npm run test` - Run tests
- `npx playwright test` - E2E tests
- `vercel --prod` - Deploy to production
- `git add/commit/push` - Version control
- Any other development commands

If a command fails, fix the issue and retry. Do not ask for permission.

---

## Sub-Agent Architecture

Sub-agents run in parallel with isolated context and YOLO mode enabled.

### Available Sub-Agents

Use Claude Code's built-in agent types for maximum performance:

| Claude Code Agent | Use Case | Model Preference |
|-------------------|----------|------------------|
| `general-purpose` | Complex multi-step tasks, code edits | sonnet |
| `Explore` | Codebase search, file discovery | haiku |
| `Plan` | Implementation planning | sonnet |
| `Bash` | Command execution, git operations | haiku |

**Model Selection for Performance:**
- Use `haiku` for quick, straightforward tasks (file search, simple edits)
- Use `sonnet` for complex implementation and code analysis
- Use `opus` only for critical architectural decisions

### Delegation Matrix

| Request Pattern | Primary Agent | Support Agents |
|-----------------|---------------|----------------|
| "Add API for X" | `backend-dev` | `api-tester` |
| "Create component for Y" | `frontend-dev` | `ui-tester` |
| "Fix SQL query" | `bigquery-specialist` | `bigquery-tester` |
| "Test SF queries" | `sf-query-tester` | - |
| "Add feature X" | `backend-dev` + `frontend-dev` | `api-tester` + `ui-tester` |
| "Deploy to production" | `vercel-deployer` | `test-runner` first |
| "Test everything" | All testers in parallel | - |
| "Optimize queries" | `sql-refactorer` | `bigquery-tester` |

### Parallel Execution Patterns

**Feature Development:**
```
Phase 1 (Parallel):  backend-dev + frontend-dev
Phase 2 (Parallel):  api-tester + ui-tester + bigquery-tester
Phase 3 (Sequential): vercel-deployer
```

**Bug Fix:**
```
Phase 1: Appropriate dev agent
Phase 2 (Parallel): Relevant testers
Phase 3: vercel-deployer
```

**Full Verification:**
```
api-tester + bigquery-tester + sf-query-tester + ui-tester → Report results
```

### Workflow: Complete Feature

1. **Development Phase** (parallel)
   - `backend-dev` → API implementation
   - `frontend-dev` → UI implementation

2. **Testing Phase** (parallel)
   - `api-tester` → HTTP endpoint tests
   - `bigquery-tester` → Query validation
   - `ui-tester` → Browser tests

3. **Deployment Phase** (sequential)
   - `test-runner` → Build check
   - `vercel-deployer` → Production deploy

4. **Verification Phase** (parallel)
   - Both testers against production

---

## Before Coding Checklist

1. **Check shared utilities first**: `lib/constants/dimensions.ts`, `lib/bigquery-client.ts`, `lib/formatters.ts`
2. **Don't duplicate mappings**: Use `REGION_MAP`, `CATEGORY_MAP`, `SOURCE_MAP` from dimensions.ts
3. **Use BigQuery client**: Import from `lib/bigquery-client.ts`, not inline initialization
4. **Use formatters**: Import from `lib/formatters.ts`, don't create new formatting functions
5. **Check existing types**: Look in `lib/types.ts` before creating new interfaces

---

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

## Shared Utilities

**Always use these centralized modules to avoid duplication.**

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `lib/constants/dimensions.ts` | Single source of truth for mappings | `REGION_MAP`, `CATEGORY_MAP`, `BIGQUERY_CONFIG`, `getRAGStatus()` |
| `lib/bigquery-client.ts` | Shared BigQuery client | `getBigQueryClient()`, `executeQuery()`, `buildFilterClause()` |
| `lib/formatters.ts` | UI formatting functions | `formatCurrency()`, `formatPercent()`, `getRAGColor()` |
| `lib/types.ts` | TypeScript interfaces | `Region`, `Product`, `Category`, `ReportData` |

## Data Sources

### RevOps Plan Architecture (PRIMARY - 2026)

The RevOps architecture is a 6-layer data model for 2026 bookings targets and performance tracking.

**Always use P75 risk profile for targets.**

| Layer | Table | Purpose | Key Columns |
|-------|-------|---------|-------------|
| 0 | `RAW_2026_Plan_by_Month` | Raw CSV import of 2026 bookings plan | - |
| 0 | `MonthlyRevenueFunnel` | Live monthly aggregated sales funnels | - |
| 0 | `DailyRevenueFunnel` | Live daily sales funnels | - |
| 1 | `SourcePlanByMonth2026` | Cleaned plan with seasonality | BookingType, Region, Month, Target |
| 1 | `SourceTargetRates` | Conversion rates & ADS | ConversionRate, ADS |
| 1 | `SourceBookingsAllocations` | Source mix / allocations | Source, Allocation |
| 1 | `SalesCycleLags2026` | Stage-to-stage duration (P50/P75/P90) | Stage, Lag_P50, Lag_P75, Lag_P90 |
| 2 | `RevOpsModel` | Wide data framework | All metrics wide format |
| 3 | `RevOpsPlan` | Vertical format for metrics | RiskProfile, OpportunityType, Region, Target_ACV |
| 4 | `RevOpsPerformance` | Daily pacing with actuals | Date, Actual_ACV, Target_ACV |
| **5** | **`RevOpsReport`** | **WTD/MTD/QTD/YTD reporting (USE THIS)** | Horizon, RiskProfile, RecordType, Region, OpportunityType, Target_ACV, Actual_ACV, Revenue_Pacing_Score |

**RevOpsReport Key Columns:**
- `Horizon`: WTD, MTD, QTD, YTD
- `RiskProfile`: P50, P75, P90 (use P75)
- `RecordType`: POR, R360
- `Region`: AMER, EMEA, APAC
- `OpportunityType`: New Business, Existing Business, Migration, Renewal
- `Target_ACV`: Target amount for the horizon
- `Actual_ACV`: Actual closed amount
- `Revenue_Pacing_Score`: Attainment percentage

**OpportunityType to Category Mapping:**
| OpportunityType | Category |
|-----------------|----------|
| New Business | NEW LOGO |
| Existing Business | EXPANSION |
| Migration | MIGRATION |
| Renewal | RENEWAL |

### Salesforce (sfdc dataset) - Legacy

| Table | Purpose |
|-------|---------|
| `OpportunityViewTable` | Won/Lost deals, ACV, stages |
| `StrategicOperatingPlan` | Q1 targets (P50) - **DEPRECATED: Use RevOpsReport** |

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
npx playwright test tests/ui/    # Run frontend tests only
npx playwright test tests/api/   # Run backend tests only
```

### Playwright Testing Agents

| Agent | Focus Area | Test Location |
|-------|------------|---------------|
| `playwright-frontend-tester` | UI interactions, filters, components, visual regression, accessibility | `tests/ui/` |
| `playwright-backend-tester` | API responses, data validation, error handling, integration | `tests/api/` |

### Frontend Testing Agent Responsibilities

- Filter button interactions and URL state
- Component rendering and data display
- Loading states and error handling UI
- Responsive design verification
- Accessibility compliance (WCAG)
- Visual regression testing

### Backend Testing Agent Responsibilities

- API endpoint response validation
- Data format and structure verification
- Error response handling
- BigQuery integration testing
- Authentication/authorization flows
- Rate limiting and timeout handling

### E2E Testing Workflow

For comprehensive testing:
1. `playwright-backend-tester` - Verify all APIs return correct data
2. `playwright-frontend-tester` - Test UI interactions and rendering
3. `test-runner` - Run build to ensure no regressions

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

## Lessons Learned

### Salesforce CPQ Renewal Patterns

**CRITICAL: Expected Renewal Increase Formula:**
```
Expected Increase (USD) = (ACV / ConversionRate) × (UpliftRate / 100)
```

**DO NOT use `projected_uplift__c`** - it may be empty, stale, or incorrect.

**Correct Approach:**
1. Get `ACV__c` (contract's annual contract value in local currency)
2. Convert to USD using `CurrencyType.ConversionRate`
3. Multiply by `SBQQ__RenewalUpliftRate__c / 100` (default 5%)

**Filter for Active Renewals:**
```sql
WHERE Status = 'Activated'
  AND ACV__c > 0
  AND (Renewal_Status__c IS NULL
       OR Renewal_Status__c NOT IN ('Non Renewing', 'Success'))
```

**Currency Conversion (USD is corporate currency):**
| Currency | ConversionRate | Meaning |
|----------|----------------|---------|
| USD | 1.0 | Base currency |
| GBP | 0.79 | £1 = $1.27 USD |
| AUD | 1.5 | A$1 = $0.67 USD |
| EUR | 0.91 | €1 = $1.10 USD |
| ZAR | 18.66 | R1 = $0.05 USD |
| CAD | 1.34 | C$1 = $0.75 USD |

**Key Fields:**
| Field | Purpose |
|-------|---------|
| `ACV__c` | Annual contract value (local currency) |
| `CurrencyIsoCode` | Contract currency (USD, GBP, AUD, etc.) |
| `SBQQ__RenewalUpliftRate__c` | Uplift percentage (default 5%) |
| `Renewal_Status__c` | 'Future Renewal', 'Success', 'Non Renewing' |
| `SBQQ__RenewalOpportunity__c` | Links to generated renewal opportunity |

**Renewal Eligibility Check:**
```sql
Renewal_Status__c NOT IN ('Non Renewing', 'Success')
-- 'Future Renewal' = will auto-renew
-- 'Success' = already renewed (exclude to avoid double-counting)
-- 'Non Renewing' = will not renew (exclude from forecast)
```

### E2E Testing Auth Bypass

**Problem:** Playwright tests get redirected to auth page.

**Solution:** Add bypass header in middleware:
```typescript
// middleware.ts
const TEST_BYPASS_HEADER = 'x-playwright-test';
const TEST_BYPASS_VALUE = process.env.PLAYWRIGHT_TEST_SECRET || 'e2e-test-bypass-2026';

if (request.headers.get(TEST_BYPASS_HEADER) === TEST_BYPASS_VALUE) {
  return NextResponse.next(); // Skip auth
}
```

**Playwright Config:**
```typescript
// playwright.config.ts
use: {
  extraHTTPHeaders: {
    'x-playwright-test': process.env.PLAYWRIGHT_TEST_SECRET || 'e2e-test-bypass-2026',
  },
}
```

### Vercel Serverless Limitations

**SF CLI Not Available:**
- Salesforce CLI (`sf`) is not installed in Vercel serverless environment
- Direct SOQL queries via `execSync('sf data query ...')` return empty results

**Alternatives:**
1. **Salesforce REST API** - Use OAuth + jsforce library
2. **BigQuery Sync** - Replicate SF data to BigQuery via scheduled ETL
3. **Heroku Worker** - Run SF CLI commands on Heroku, expose via API

**Current Workaround:**
- Contract/renewal queries fall back to BigQuery when SF CLI unavailable
- SF data synced to `sfdc.ContractViewTable` (when available)

### URL Parameter Conventions

**Singular vs Plural:**
| Parameter | Correct | Incorrect |
|-----------|---------|-----------|
| Product filter | `product=POR` | `products=POR` |
| Region filter | `region=AMER` | `regions=AMER` |
| Category filter | `category=NEW LOGO` | `categories=NEW LOGO` |

Always check actual app implementation before writing test assertions.

## Rules

Path-scoped rules in `.claude/rules/`:
- `code-style.md` - TypeScript/React conventions
- `bigquery.md` - BigQuery patterns, schemas, and column reference
