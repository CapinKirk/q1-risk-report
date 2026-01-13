# Q1 2026 Risk Report

Interactive web dashboard for the Q1 2026 Bookings Risk Analysis Report with region filtering.

## Features

- **Executive Summary**: Key metrics at a glance (Q1 targets, QTD actuals, pipeline coverage)
- **Attainment by Region & Product**: POR and R360 breakdown with RAG status
- **Source Attainment**: Channel performance (Inbound, Outbound, AE/AM Sourced, etc.)
- **Full Funnel Analysis**: MQL → SQL → SAL → SQO progression
- **Hits & Misses**: On-track vs needs-attention with RCA
- **Pipeline Coverage**: Health analysis by region
- **Lost Opportunities**: Loss reasons and impact analysis
- **Google Ads Performance**: Marketing metrics

### Region Filtering

Filter all data by region using the dropdown at the top:
- **All Regions** (default)
- **AMER** - Americas
- **EMEA** - Europe, Middle East, Africa
- **APAC** - Asia Pacific

Filter selection persists in URL params for easy sharing: `?region=AMER` or `?region=AMER,EMEA`

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- Google Cloud `bq` CLI (for data refresh)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the report.

### Production Build

```bash
npm run build
npm start
```

## Data Management

### Pre-generated Data

The report uses pre-generated JSON data from BigQuery, stored in `data/report-data.json`.

### Refresh Data

To refresh data from BigQuery:

```bash
npm run generate-data
```

Or via API (if deployed with API key):

```bash
curl -X POST https://your-domain.vercel.app/api/refresh \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit: Q1 2026 Risk Report web app"
git remote add origin https://github.com/your-org/q1-risk-report.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and import your repository
2. Configure environment variables:
   - `REFRESH_API_KEY`: Secret key for the /api/refresh endpoint

### 3. Deploy

Vercel will automatically deploy on push to main branch.

## Project Structure

```
q1-risk-report/
├── app/
│   ├── page.tsx              # Main report page
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/refresh/route.ts  # Data refresh API
├── components/
│   ├── RegionFilter.tsx      # Region filter bar
│   ├── ExecutiveSummary.tsx  # Section 1
│   ├── AttainmentTable.tsx   # Section 2
│   ├── SourceAttainment.tsx  # Section 3
│   ├── HitsMisses.tsx        # Section 4
│   ├── PipelineCoverage.tsx  # Section 5
│   ├── LostOpportunities.tsx # Section 6
│   └── GoogleAdsPerf.tsx     # Section 7
├── lib/
│   ├── types.ts              # TypeScript interfaces
│   ├── formatters.ts         # Number/currency formatting
│   └── filterData.ts         # Region filtering logic
├── data/
│   └── report-data.json      # Pre-generated BigQuery data
├── scripts/
│   └── generate-data.py      # Data refresh script
├── query_comprehensive_risk_analysis.sql  # BigQuery query
└── generate_html_report_v26.py            # Legacy HTML generator
```

## Data Sources

- **OpportunityViewTable**: Won/Lost deals, ACV
- **DailyRevenueFunnel**: MQL, SQL, SAL, SQO
- **StrategicOperatingPlan**: P50 targets
- **GoogleAds**: POR + R360 campaign stats

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS (matching legacy report design)
- **Deployment**: Vercel
- **Data**: BigQuery
