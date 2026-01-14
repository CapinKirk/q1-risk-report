# Comprehensive Bookings Risk Report - Regeneration Prompt

Copy and paste this entire prompt to regenerate the full risk analysis report with current data.

---

## PROMPT TO COPY

```
Generate a comprehensive Bookings Risk Analysis Report for POR and R360.

## STEP 1: Run the BigQuery Query

Execute the comprehensive risk analysis query:

```bash
bq query --use_legacy_sql=false --format=json < "/Users/prestonharris/Risk Report/query_comprehensive_risk_analysis.sql"
```

The query uses CURRENT_DATE() so it will automatically pull the latest data.

## STEP 2: Format the Results

Using the JSON output, create a formatted report with these sections:

### A. EXECUTIVE SUMMARY
- Overall attainment % (POR + R360 combined)
- QTD days elapsed and % through quarter
- Top 3 risk pockets by gap
- Key wins (categories exceeding target)

### B. ATTAINMENT SCORECARD (Table Format)
```
+--------+--------+----------+-----------+---------+----------+---------+--------+
| Product| Region | Category | Q1 Target | QTD Tgt | Actual   | Attain% | RAG    |
+--------+--------+----------+-----------+---------+----------+---------+--------+
```
Use emoji RAG indicators: ✅ GREEN (≥90%), ⚠️ YELLOW (70-89%), 🔴 RED (<70%)

### C. FUNNEL PACING (INBOUND)
Show MQL, SQL, SAL, SQO pacing by product/region with:
- Actual vs Target counts
- Pacing %
- Conversion rates (MQL→SQL, SQL→SAL, etc.)

### D. CLOSE LOST ANALYSIS
Top 5 loss reasons by ACV for each product:
- Loss reason name
- Deal count
- Lost ACV
- % of total losses

### E. PIPELINE HEALTH
- Pipeline coverage ratios by region/category
- Average pipeline age (flag if >180 days as stale)
- Assessment (Adequate >2x, Marginal 1-2x, Insufficient <1x)

### F. WIN/LOSS RATES
- Win rate % by product/region
- Highlight any <50% win rates as critical

### G. GOOGLE ADS SUMMARY
- Impressions, Clicks, Spend
- CTR, CPC, CPA
- Marketing ROI calculation

### H. TOP RISK POCKETS (Ranked)
List top 10 underperforming segments by gap:
1. [Product] [Region] [Category]: $X gap (Y% attainment)
   - Root cause: [pipeline/conversion/volume issue]
   - Recommended action: [specific action]

### I. KEY INSIGHTS & RECOMMENDATIONS
3-5 actionable insights based on the data:
- What's working
- What needs immediate attention
- Strategic recommendations

## STEP 3: Output Format

Provide two versions:

1. **Slack-Ready Version** (under 4000 characters)
   - Use *bold* for headers
   - Use bullet points
   - Include emoji RAG indicators
   - Truncate to key metrics only

2. **Full Report Version** (Markdown)
   - Complete tables
   - All segments
   - Detailed analysis
   - Charts/visualizations where helpful

## DATA NOTES

- Q1 2026 runs Jan 1 - Mar 31 (90 days)
- POR Q1 Target: $2,659,310
- R360 Q1 Target: $868,610
- Combined Q1 Target: $3,527,920
- Renewals are EXCLUDED from this analysis
- Funnel metrics are INBOUND channel only
- Google Ads are SEARCH network only

## REFERENCE FILES

- Query: `/Users/prestonharris/Risk Report/query_comprehensive_risk_analysis.sql`
- Docs: `/Users/prestonharris/Risk Report/COMPREHENSIVE_RISK_REPORT_DOCUMENTATION.md`
- Shared: `/Users/prestonharris/Risk Report/SHARED_RESOURCES.md`
```

---

## QUICK RUN COMMANDS

### Run Comprehensive Report
```bash
cd "/Users/prestonharris/Risk Report/"
bq query --use_legacy_sql=false --format=json < query_comprehensive_risk_analysis.sql
```

### Run Top of Funnel Only
```bash
bq query --use_legacy_sql=false --format=json < query_top_of_funnel_enhanced.sql
```

### Run POR Risk Only
```bash
bq query --use_legacy_sql=false --format=json < query_por_risk_analysis.sql
```

### Run R360 Risk Only
```bash
bq query --use_legacy_sql=false --format=json < query_r360_risk_analysis.sql
```

---

## ALTERNATIVE: Direct Data Input Prompt

If you've already run the query and have the JSON output, use this prompt:

```
I have the following BigQuery results from the Comprehensive Risk Analysis query.
Parse this JSON and generate a formatted risk report following the structure in
/Users/prestonharris/Risk Report/COMPREHENSIVE_RISK_REPORT_DOCUMENTATION.md

JSON Data:
[paste JSON here]

Include:
1. Executive Summary
2. Attainment Scorecard with RAG status
3. Funnel Pacing (MQL→SQL→SAL→SQO)
4. Close Lost Analysis with top reasons
5. Pipeline Health assessment
6. Win/Loss rates
7. Google Ads efficiency
8. Top Risk Pockets ranked by gap
9. Actionable recommendations

Format for both Slack (brief) and full report (detailed).
```

---

## SCHEDULED REFRESH

For automated daily reports, set up a BigQuery scheduled query:

1. Go to BigQuery Console → Scheduled Queries
2. Create new scheduled query
3. Paste `query_comprehensive_risk_analysis.sql` contents
4. Set schedule: Daily at 6:00 AM UTC
5. Destination: BigQuery table or GCS export
6. Enable email notifications

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-12 | Initial comprehensive report prompt |

---

## CONTACT

AI Center of Excellence Team
