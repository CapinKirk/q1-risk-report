# Q1 2026 Risk Report

Interactive web dashboard for Q1 2026 Bookings Risk Analysis with real-time BigQuery data.

**Live**: [https://q1-risk-report.vercel.app](https://q1-risk-report.vercel.app)

## Features

- **Executive Summary**: Key metrics at a glance (Q1 targets, QTD actuals, pipeline coverage)
- **Attainment by Region & Product**: POR and R360 breakdown with RAG status
- **Source Attainment**: Channel performance (Inbound, Outbound, AE/AM Sourced)
- **Full Funnel Analysis**: MQL → SQL → SAL → SQO progression with Salesforce links
- **Trend Analysis**: Period-over-period comparison with charts
- **Pipeline Coverage**: Health analysis by region
- **Lost Opportunities**: Loss reasons and impact analysis
- **Google Ads Performance**: Marketing metrics

### Filtering

- **Products**: POR, R360, or both
- **Regions**: AMER, EMEA, APAC
- **Date Range**: Custom date selection

## Quick Start

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # Check code style
```

## Project Structure

```
q1-risk-report/
├── .claude/            # AI agent configuration
│   ├── CLAUDE.md       # Main AI context
│   └── rules/          # Code style, BigQuery patterns
├── app/                # Next.js App Router
│   ├── api/            # API routes (BigQuery)
│   ├── analysis/       # Trend analysis page
│   └── auth/           # Authentication
├── components/         # React components
├── lib/                # Utilities and types
├── types/              # TypeScript definitions
├── sql/                # SQL queries (organized)
│   ├── reports/        # Report generation
│   └── diagnostics/    # Validation queries
├── scripts/            # Python scripts
├── data/               # Generated data
├── docs/               # Documentation
│   ├── architecture/   # System design
│   ├── reports/        # Analysis reports
│   └── qa/             # QA documentation
├── tests/              # Playwright tests
└── archive/            # Historical reference
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

- **OpportunityViewTable**: Won/Lost deals, ACV
- **InboundFunnel**: POR MQL/SQL/SAL/SQO
- **R360InboundFunnel**: R360 funnel metrics
- **StrategicOperatingPlan**: Q1 targets (P50)
- **GoogleAds**: Ad performance

## Authentication

Access restricted to `@pointofrental.com` and `@record360.com` emails via Google OAuth.

## Environment Variables

```bash
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_CLOUD_PROJECT=data-analytics-306119
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://your-domain.vercel.app
```

## Documentation

- [AI Agent Context](.claude/CLAUDE.md) - For AI-assisted development
- [SQL Queries](sql/README.md) - BigQuery documentation
- [Architecture](docs/architecture/) - System design

## Development

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for detailed development guidelines.
