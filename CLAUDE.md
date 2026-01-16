# Q1 2026 Risk Report

Next.js 14 dashboard for Q1 2026 Bookings Risk Analysis with live BigQuery data.

**Live**: https://q1-risk-report.vercel.app

---

## Sub-Agent Architecture

**You are an orchestrator.** Delegate specialized work to sub-agents for faster, higher-quality delivery. Sub-agents run in parallel with isolated context.

### Available Sub-Agents

| Agent | Use When | Model |
|-------|----------|-------|
| `bigquery-specialist` | SQL queries, data validation, schema work | sonnet |
| `vercel-deployer` | Deployments, env vars, production logs | haiku |
| `nextjs-api-builder` | Creating/modifying API routes | sonnet |
| `react-dashboard` | React components, UI, styling | sonnet |
| `ai-integrator` | OpenAI integration, prompts, AI features | opus |
| `code-reviewer` | Code quality review, security checks | sonnet |
| `test-runner` | Run tests, verify builds, E2E tests | haiku |
| `sql-refactorer` | SQL optimization, query deduplication | sonnet |
| `playwright-frontend-tester` | UI/UX E2E tests, visual regression, accessibility | sonnet |
| `playwright-backend-tester` | API E2E tests, endpoint validation, integration tests | sonnet |
| `meta-agent` | Creating new sub-agents | opus |

### Delegation Rules

1. **Always delegate** specialized work to the appropriate sub-agent
2. **Run parallel agents** when tasks are independent (up to 10 concurrent)
3. **Orchestrate only** - gather requirements, delegate work, synthesize results
4. **Create new agents** with `meta-agent` when a recurring pattern emerges

### When to Use Each Agent

```
User: "Fix the SQL query for funnel metrics"
→ Delegate to: bigquery-specialist

User: "Deploy to production"
→ Delegate to: vercel-deployer

User: "Add a new API endpoint for X"
→ Delegate to: nextjs-api-builder

User: "Create a component to show Y"
→ Delegate to: react-dashboard

User: "Add AI analysis for Z"
→ Delegate to: ai-integrator

User: "Review this code before commit"
→ Delegate to: code-reviewer

User: "Run tests and check the build"
→ Delegate to: test-runner

User: "Optimize this SQL query"
→ Delegate to: sql-refactorer

User: "Test the dashboard UI interactions"
→ Delegate to: playwright-frontend-tester

User: "Write E2E tests for the filter buttons"
→ Delegate to: playwright-frontend-tester

User: "Verify the API endpoints return correct data"
→ Delegate to: playwright-backend-tester

User: "Test the renewals API integration"
→ Delegate to: playwright-backend-tester

User: "Create a new agent for..."
→ Delegate to: meta-agent
```

### Parallel Execution Example

For a request like "Add AI-powered pipeline analysis with a new API and component":
1. Launch `ai-integrator` for prompt/API design
2. Launch `nextjs-api-builder` for route implementation
3. Launch `react-dashboard` for UI component
4. Synthesize results and integrate

### Pre-Commit Workflow

Before any commit, run these agents in sequence:
1. `code-reviewer` - Check for issues
2. `test-runner` - Verify build and tests pass
3. Then commit if all passes

### Refactoring Workflow

For optimization tasks:
1. `sql-refactorer` - Optimize queries
2. `code-reviewer` - Validate changes
3. `test-runner` - Ensure no regressions

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

## Rules

Path-scoped rules in `.claude/rules/`:
- `code-style.md` - TypeScript/React conventions
- `bigquery.md` - BigQuery patterns, schemas, and column reference
