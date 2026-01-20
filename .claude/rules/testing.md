# Testing Guide

## CRITICAL: Verify All Changes via Playwright

**Every change must be verified via Playwright tests before marking complete.**

## Commands

```bash
npm run build            # Build verification (always run first)
npx playwright test      # All E2E tests
npx playwright test tests/api/   # Backend only
npx playwright test tests/ui/    # Frontend only
npx playwright test tests/ui/ai-analysis-styling.spec.ts  # Specific test
```

## Auth Bypass for Tests

Header: `x-playwright-test: e2e-test-bypass-2026`

```bash
# Test API locally
curl -s "http://localhost:3000/api/report-data" \
  -H "x-playwright-test: e2e-test-bypass-2026" | jq '.'

# Test production
curl -s "https://q1-risk-report.vercel.app/api/report-data" \
  -H "x-playwright-test: e2e-test-bypass-2026" | jq '.'
```

## URL Parameters (Singular)

| Correct | Incorrect |
|---------|-----------|
| `product=POR` | `products=POR` |
| `region=AMER` | `regions=AMER` |
| `category=NEW LOGO` | `categories=NEW LOGO` |

## Test Agent Responsibilities

**Backend (`tests/api/`)**: API responses, data structure, error handling, BigQuery integration
**Frontend (`tests/ui/`)**: UI interactions, filters, components, accessibility, styling consistency

## Multi-Agent Testing Workflow

```
1. Make code changes
2. npm run build (verify locally)
3. git commit && git push
4. vercel --prod (deploy)
5. Wait 90 seconds for propagation
6. npx playwright test (verify on production)
7. All tests must pass before done
```

## Test File Reference

| Test | Purpose | Run Command |
|------|---------|-------------|
| `ai-analysis-styling.spec.ts` | AI Analysis component styling | `npx playwright test tests/ui/ai-analysis-styling.spec.ts` |
| `filters.spec.ts` | Filter interactions | `npx playwright test tests/ui/filters.spec.ts` |
| `dark-mode.spec.ts` | Dark mode styling | `npx playwright test tests/ui/dark-mode.spec.ts` |
| `table-sorting.spec.ts` | Table sorting | `npx playwright test tests/ui/table-sorting.spec.ts` |
| `report-data.spec.ts` | Main API validation | `npx playwright test tests/api/report-data.spec.ts` |

## Styling Consistency Tests

When testing CSS consistency between components:

```typescript
// Get computed styles
const style = await locator.evaluate((el) => {
  const computed = window.getComputedStyle(el);
  return {
    backgroundColor: computed.backgroundColor,
    borderRadius: computed.borderRadius,
    width: computed.width,
  };
});

// Compare styles between components
expect(style1.backgroundColor).toBe(style2.backgroundColor);
```

## Common Test Patterns

### Wait for network idle
```typescript
await page.waitForLoadState('networkidle');
```

### Check computed CSS
```typescript
const bgColor = await page.locator('.btn-primary').evaluate(
  (el) => window.getComputedStyle(el).backgroundColor
);
expect(bgColor).toBe('rgb(37, 99, 235)'); // #2563eb
```

### Visual regression screenshots
```typescript
await page.locator('[data-testid="section"]').screenshot({
  path: 'tests/test-results/section-screenshot.png'
});
```
