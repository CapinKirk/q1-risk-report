# Q1 2026 Risk Report

Interactive web dashboard for Q1 2026 Bookings Risk Analysis with real-time BigQuery data.

**Live**: [https://q1-risk-report.vercel.app](https://q1-risk-report.vercel.app)

## Features

- **Executive Summary**: Q1 targets, QTD actuals, pipeline coverage
- **Attainment by Region & Product**: POR and R360 with RAG status
- **Source Attainment**: Inbound, Outbound, AE/AM Sourced
- **Full Funnel Analysis**: MQL → SQL → SAL → SQO with Salesforce links
- **Google Ads Performance**: Impressions, clicks, CTR, CPC, CPA by product
- **Trend Analysis**: Period-over-period comparison charts
- **Pipeline Coverage**: Health analysis by region
- **Lost Opportunities**: Loss reasons and impact

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npx playwright test  # Run E2E tests
```

## Project Structure

```
q1-risk-report/
├── CLAUDE.md               # AI agent context
├── .claude/rules/          # Path-scoped rules (bigquery.md, code-style.md)
├── app/                    # Next.js App Router
│   ├── api/                # API routes (BigQuery)
│   ├── analysis/           # Trend analysis page
│   └── auth/               # Authentication
├── components/             # React components (25 files)
├── lib/                    # Utilities and types
├── sql/                    # SQL queries
│   ├── reports/            # Report generation
│   ├── diagnostics/        # Validation queries
│   └── schemas/            # Data lineage docs
├── scripts/                # Python scripts
├── tests/                  # Playwright tests
└── archive/                # Historical files
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 | App Router framework |
| TypeScript | Type safety |
| BigQuery | Data warehouse |
| NextAuth | Google OAuth |
| Recharts | Charts |
| Playwright | E2E testing |
| Vercel | Deployment |

## Data Sources

| Dataset | Table | Purpose |
|---------|-------|---------|
| sfdc | OpportunityViewTable | Won/Lost deals, ACV |
| sfdc | StrategicOperatingPlan | Q1 targets (P50) |
| MarketingFunnel | InboundFunnel | POR MQL/SQL/SAL/SQO |
| MarketingFunnel | R360InboundFunnel | R360 funnel metrics |
| GoogleAds_POR_* | ads_CampaignBasicStats | POR ad performance |
| GoogleAds_Record360_* | ads_CampaignBasicStats | R360 ad performance |

## Environment Variables

```bash
GOOGLE_CREDENTIALS_JSON    # BigQuery service account
GOOGLE_CLOUD_PROJECT       # data-analytics-306119
NEXTAUTH_SECRET            # Auth secret
NEXTAUTH_URL               # Deployed URL
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - AI agent context
- [sql/schemas/](sql/schemas/) - Data lineage
- [sql/](sql/) - BigQuery queries
