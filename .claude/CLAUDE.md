# Q1 2026 Risk Report - AI Agent Context

## Project Overview

Next.js 14 (App Router) dashboard for Q1 2026 Bookings Risk Analysis. Displays revenue attainment, pipeline coverage, funnel metrics (MQL/SQL/SAL/SQO), and actionable insights for sales leadership.

**Live URL**: https://q1-risk-report.vercel.app
**Repository**: https://github.com/CapinKirk/q1-risk-report

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | App Router framework |
| TypeScript | 5.x | Type safety |
| React | 18.x | UI components |
| Recharts | 3.x | Data visualization |
| BigQuery | - | Data warehouse |
| NextAuth | 4.x | Google OAuth authentication |
| Playwright | 1.x | E2E testing |

## Quick Start Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # Check code style
npm run generate-data # Refresh data from BigQuery
```

## Project Structure

```
q1-risk-report/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (BigQuery integration)
│   │   ├── report-data/    # Main data endpoint (POST)
│   │   ├── trend-analysis/ # Trend comparison endpoint
│   │   └── refresh/        # Data refresh endpoint
│   ├── analysis/           # Trend analysis page
│   ├── auth/               # Authentication pages
│   ├── page.tsx            # Main dashboard
│   └── layout.tsx          # Root layout with auth
├── components/             # React components (flat structure)
│   ├── ui/                 # Reusable UI primitives
│   ├── *                   # Feature components
│   └── index.ts            # Barrel exports
├── lib/                    # Utilities and business logic
│   ├── types.ts            # TypeScript type definitions
│   ├── formatters.ts       # Number/currency formatting
│   ├── filterData.ts       # Region/product filtering
│   └── auth.ts             # NextAuth configuration
├── types/                  # Additional type definitions
├── sql/                    # SQL queries (organized)
│   ├── reports/            # Report generation queries
│   └── diagnostics/        # Data validation queries
├── scripts/                # Python scripts
│   └── generate-data.py    # BigQuery data generation
├── data/                   # Generated JSON data
│   └── report-data.json    # Pre-generated report data
├── tests/                  # Playwright tests
├── docs/                   # Documentation
└── archive/                # Historical/reference files
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/api/report-data/route.ts` | Main BigQuery queries for all report data |
| `app/page.tsx` | Main dashboard page with filtering |
| `lib/types.ts` | All TypeScript interfaces |
| `lib/filterData.ts` | Client-side data filtering logic |
| `sql/reports/comprehensive-risk-analysis.sql` | Master BigQuery query |

## Data Architecture

### Data Sources (BigQuery)

| Table | Dataset | Purpose |
|-------|---------|---------|
| `OpportunityViewTable` | sfdc | Won/Lost deals, ACV, stages |
| `InboundFunnel` | MarketingFunnel | POR MQL/SQL/SAL/SQO funnel |
| `R360InboundFunnel` | MarketingFunnel | R360 funnel metrics |
| `StrategicOperatingPlan` | sfdc | Q1 targets (P50) |
| `GoogleAds_*` | GoogleAds_* | Ad performance metrics |

### Key Fields

- **Division/Region Mapping**: US→AMER, UK→EMEA, AU→APAC
- **Product**: POR (Point of Rental), R360 (Record360)
- **Category**: NEW LOGO, EXPANSION, MIGRATION
- **Funnel Stages**: MQL_DT → SQL_DT → SAL_DT → SQO_DT

### Data Flow

1. BigQuery tables → `app/api/report-data/route.ts` (live queries)
2. API response → `app/page.tsx` (client-side filtering)
3. Filtered data → Components (visualization)

## Code Conventions

### Naming

- **Files**: kebab-case for folders, PascalCase for components
- **Components**: PascalCase (e.g., `AttainmentTable.tsx`)
- **Types**: PascalCase with descriptive suffixes (e.g., `ReportData`, `AttainmentRow`)
- **Functions**: camelCase (e.g., `formatCurrency`, `filterByRegion`)

### Component Pattern

```typescript
'use client';  // For client components

import { useState } from 'react';
import { SomeType } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

interface ComponentProps {
  data: SomeType;
}

export default function ComponentName({ data }: ComponentProps) {
  const [state, setState] = useState(initialValue);

  return (
    <section>
      {/* JSX with inline styles or CSS classes */}
    </section>
  );
}
```

### API Route Pattern

```typescript
import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Query BigQuery
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ endpoint: '/api/...', method: 'POST', ... });
}
```

## Common Workflows

### Adding a New Report Section

1. Create component in `components/` (e.g., `NewSection.tsx`)
2. Add required types to `lib/types.ts`
3. Add data query to `app/api/report-data/route.ts`
4. Import and add component to `app/page.tsx`
5. Add filtering logic if needed to `lib/filterData.ts`

### Adding a New BigQuery Query

1. Write SQL in `sql/reports/` or `sql/diagnostics/`
2. Add query function in `app/api/report-data/route.ts`
3. Define response types in `lib/types.ts`
4. Call from component or page

### Debugging Data Issues

1. Check `sql/diagnostics/` for validation queries
2. Use `/api/report-data` POST endpoint with filters
3. Compare with BigQuery console
4. Check `archive/qa_diagnostics/` for historical queries

## Environment Variables

```bash
# Required for production
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_CLOUD_PROJECT=data-analytics-306119
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-domain.vercel.app

# Optional
REFRESH_API_KEY=api-key-for-refresh-endpoint
```

## Authentication

- Google OAuth via NextAuth
- Restricted to `@pointofrental.com` and `@record360.com` emails
- Middleware protects all routes except `/auth/*` and `/api/auth/*`

## Testing

```bash
npx playwright test                    # Run all tests
npx playwright test tests/smoke.spec.ts  # Run specific test
npx playwright test --ui               # Interactive mode
```

## Deployment

- **Platform**: Vercel
- **Trigger**: Push to `main` branch
- **Build**: `npm run build`
- **Region**: iad1 (US East)

## Important Notes

1. **BigQuery Credentials**: On Vercel, credentials are stored in `GOOGLE_CREDENTIALS_JSON` env var as JSON string
2. **Data Freshness**: Report data is fetched live from BigQuery on each request
3. **Filtering**: All filtering is client-side after API response
4. **Source Field**: `SDRSource` field maps to funnel source attribution

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Unrecognized name" in BigQuery | Check column exists in schema, use correct table alias |
| 404 on new API route | Ensure `route.ts` file exists, redeploy to Vercel |
| Auth redirect loop | Check `NEXTAUTH_URL` matches deployed URL |
| Data mismatch | Verify date range, check `SpiralyzeTest` and `MQL_Reverted` filters |

## Related Documentation

- See `docs/architecture/` for system design details
- See `sql/reports/` for query documentation
- See `archive/session_prompts/` for historical context
