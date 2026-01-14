# Top of Funnel Pacing Report - Reusable Prompt

Copy and paste this prompt to generate an updated report:

---

```
Run the BigQuery query at /Users/prestonharris/Risk Report/query_top_of_funnel_enhanced.sql and format the results as a Slack-ready message with the following structure:

1. **Header**: Report title with date and period info
2. **Google Ads Summary**: Table with POR and R360 metrics (Impressions, Clicks, Spend, Conversions, CPC, CPA)
3. **Funnel Pacing by Product/Region**: Table showing MQL, SQL, SQO, Won with Actual/Target and Pacing % - use emoji indicators (✅ ≥90%, ⚠️ 70-89%, 🔴 <70%)
4. **Attribution Metrics**: Cost per MQL, Cost per Won, Marketing ROI for each product
5. **Alerts Section**: Critical issues (0% pacing), Warnings (low pacing regions), Wins (exceeding targets)
6. **Month-End Forecast**: Projected values based on current pace
7. **Recommendations**: 2-3 actionable items based on the data

Format for Slack:
- Use *bold* for headers and key metrics
- Use bullet points (•) for lists
- Keep tables aligned with monospace formatting where needed
- Include trend arrows (↑↓→) for MoM changes
- Total message should be under 4000 characters for Slack compatibility

Execute the query using: bq query --use_legacy_sql=false --format=json < "/Users/prestonharris/Risk Report/query_top_of_funnel_enhanced.sql"

Output the formatted Slack message that I can copy directly.
```

---

## Notes
- Query location: `/Users/prestonharris/Risk Report/query_top_of_funnel_enhanced.sql`
- Archives stored in: `/Users/prestonharris/Risk Report/archive/`
- Known issue: Bookings metric may need manual verification
- Data sources: Google Ads (POR & R360), DailyRevenueFunnel, StrategicOperatingPlan
