# Testing Guide

## Commands

```bash
npm run build            # Build verification (always run first)
npx playwright test      # All E2E tests
npx playwright test tests/api/   # Backend only
npx playwright test tests/ui/    # Frontend only
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
**Frontend (`tests/ui/`)**: UI interactions, filters, components, accessibility
