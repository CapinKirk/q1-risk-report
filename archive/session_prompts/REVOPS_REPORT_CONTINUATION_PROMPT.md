# RevOps Daily Report - Continuation Prompt

## Context
You are continuing work on a Daily Revenue Operations Report system that queries BigQuery and generates formatted Slack messages. The previous session built a working prototype that needs significant improvement.

## BigQuery Connection
- **Project**: `data-analytics-306119`
- **Dataset**: `Staging`
- **Table**: `StrategicOperatingPlan`
- **CLI Access**: Already authenticated via `gcloud auth login` as kirk.bennett@pointofrental.com
- **Command**: `bq query --use_legacy_sql=false --format=json < query.sql`

## Previous Work (Archived in `/Users/prestonharris/revops_report_archive_v1/`)
The previous session created:
1. `query_1.sql` - Report payload query (returns single JSON string)
2. `query_2.sql` - Detail payload query (returns single JSON string)
3. `generate_report.py` - Python script to run queries and format messages
4. `report_output.json` - Sample output

**What Works:**
- BigQuery queries execute successfully
- JSON payloads are generated correctly
- Basic Slack message formatting
- Correct date calculations (WTD, MTD, QTD, YTD)
- Alert counting (past due, missed lead window, upcoming risk)
- Anomaly detection (SAL>SQL, SQO>SAL, WON>SQO)

**What Needs Major Improvement:**
1. **Report Quality**: Messages are too basic and not actionable
2. **Insights**: No trend analysis or comparisons to prior periods
3. **Prioritization**: Alerts aren't ranked by severity/impact
4. **Clarity**: Too many numbers without context
5. **Actions**: Generic actions that aren't specific enough
6. **Formatting**: Poor use of Slack formatting capabilities

## Your Mission
Build an **exceptional** daily RevOps report that executives would actually want to read and act upon.

## Required Runtime Inputs
Create a system that accepts these parameters:
```json
{
  "as_of_date": "2026-01-10",
  "percentile": "P50",
  "week_starts_on": "MONDAY",
  "dataset_table": "data-analytics-306119.Staging.StrategicOperatingPlan",
  "dry_run": true
}
```

## Data Model (StrategicOperatingPlan table)
**Date Fields:**
- `TargetDate` - The planned/target date
- `Won_Date` - Actual won date (may be null if not yet won)

**Dimension Fields:**
- `RecordType` - e.g., "POR", "R360"
- `OpportunityType` - e.g., "NEW BUSINESS", "EXISTING BUSINESS", "RENEWAL", "MIGRATION"
- `FunnelType` - e.g., "EXPANSION", "MIGRATION", "R360 NEW LOGO"
- `Region` - e.g., "AMER", "EMEA", "APAC"
- `Segment` - e.g., "SMB", "STRATEGIC", "N/A"
- `Source` - e.g., "INBOUND", "AE SOURCED", "AM SOURCED", "ALL"

**Target/Actual Metrics:**
- `Target_MQL`, `Actual_MQL`
- `Target_SQL`, `Actual_SQL`
- `Target_SAL`, `Actual_SAL`
- `Target_SQO`, `Actual_SQO`
- `Target_Won`, `Actual_Won`
- `Target_ACV`, `Actual_ACV`

**Variance/Slippage Fields:**
- `ACV_Variance` - Actual - Target ACV
- `MQL_Revenue_Slippage`, `SQL_Revenue_Slippage`, `SQO_Revenue_Slippage`, `Won_Count_Revenue_Slippage`

**Alert Fields:**
- `MQL_Pacing_Alert` - Contains "Missed Lead Window" for problematic rows
- `RealTime_Pacing_Alert` - Other pacing issues

## Critical Requirements

### 1. Date Basis Logic (CRITICAL - FIX FROM V1)
**Problem in V1:** The query may use the wrong date field, causing all actuals to show as zero.

**Solution:** Implement smart date basis detection:
```sql
-- Check which date field has actual ACV data
sum_by_won_date = SUM(Actual_ACV WHERE Won_Date IN [MTD window])
sum_by_target_date = SUM(Actual_ACV WHERE TargetDate IN [MTD window])

IF sum_by_won_date > 0:
    use Won_Date as date_basis
ELSE:
    use TargetDate as date_basis
```

Return `actuals_date_basis` in the output JSON and note it in the report.

### 2. Report Structure

**MAIN MESSAGE (< 1800 chars):**
```
*Daily Revenue Performance Report*
{as_of_date} | {percentile} targets | Week starts {week_starts_on}

*🎯 Today's Snapshot*
• [3-4 bullets with the most important numbers and what they mean]

*📊 Pacing vs Target*
• WTD: [revenue & volume pacing with trend indicator]
• MTD: [revenue & volume pacing with trend indicator]

*🚨 Top Constraint*
• [The single biggest bottleneck with $ impact]

*⚠️ Critical Alerts*
• [Top 3 most urgent items requiring immediate attention]

*💡 Key Insight*
• [One data-driven observation that explains the "why"]

→ Thread below for detailed breakdowns and actions
```

**THREAD MESSAGE (comprehensive):**
```
*📉 MTD Biggest Gaps* (ranked by $ impact)
• [Top 6 with context: why it matters, what pocket, trend]

*📈 MTD Wins* (learn from success)
• [Top 3 with context: what's working, can we replicate?]

*🏆 MTD Top Performers* (celebrate)
• [Top 6 deals/pockets by actual ACV]

*🎣 Inbound MQL WTD Status*
• [Top 6 gaps with % to goal]

*🎬 Actions Required - Next 48 Hours*
1. **MQL Stage**: [Specific action with owner hint and expected outcome]
2. **SQL Stage**: [Specific action with owner hint and expected outcome]
3. **SAL Stage**: [Specific action with owner hint and expected outcome]
4. **SQO Stage**: [Specific action with owner hint and expected outcome]
5. **WON Stage**: [Specific action with owner hint and expected outcome]
6. **Risk Mitigation**: [Specific action for upcoming at-risk deals]
7. **Process Fix**: [Specific action based on anomalies]
8. **Opportunity**: [Specific action to capitalize on bright spots]

*📋 Alert Details*
• Past due under pacing: {count} deals totaling ${sum}
• Missed lead windows: {count} opportunities
• At-risk (next 14d): {count} deals worth ${sum}

*🔍 Data Quality Notes*
• [Anomalies if any, or "All clear"]
• Actual ACV basis: {date_field}
• Generated: {timestamp}
```

### 3. Query Design Principles

**Query 1 - Report Payload:**
- WTD/MTD/QTD/YTD scorecards (all sources + inbound)
- Worst slippage by stage for each horizon
- Worst 5 pacing pockets per horizon
- **NEW: Include week-over-week and month-over-month comparisons**
- Return as single JSON string in one row, one column named `report_payload_json`

**Query 2 - Detail Payload:**
- Top variance drivers (worst 6 MTD)
- Top positive variance (best 3 MTD)
- Top booked deals (highest ACV, top 6 MTD)
- Inbound MQL gaps (top 6 WTD)
- Alert details with items (past_due, missed_lead, upcoming_risk)
- Anomaly counts
- **NEW: Calculate $ sums for alerts, not just counts**
- **NEW: Add trend indicators (improving/worsening)**
- Return as single JSON string in one row, one column named `detail_payload_json`

### 4. BigQuery Query Rules
- Standard SQL only (no legacy SQL)
- No `SELECT *` anywhere
- Use CTEs for clarity
- Aggregate once per grain, not multiple times
- Use `QUALIFY` for window function filtering
- Use `SAFE_DIVIDE` for division
- Use `COALESCE` for null handling
- Avoid subqueries in JOIN predicates
- Use `STRUCT` and `ARRAY` for JSON generation
- Test date basis logic thoroughly

### 5. Message Formatting Rules
- Use Slack markdown (`*bold*`, `_italic_`)
- Use emoji sparingly but effectively for visual scanning
- Currency: whole dollars with commas (e.g., `$1,234,567`)
- Percentages: 1 decimal place (e.g., `95.6%`)
- Trends: use ↑↓→ arrows
- Keep main message under 1800 chars
- Thread message can be longer but stay focused
- Each action must include a stage label {MQL, SQL, SAL, SQO, Won, Process, Risk}
- Each action must reference specific data from the payload

### 6. Output Format
Return a **single JSON object** with these keys:
```json
{
  "main_message": "The formatted main Slack message",
  "thread_message": "The formatted thread Slack message",
  "report_payload_json": "The raw JSON string from Query 1",
  "detail_payload_json": "The raw JSON string from Query 2",
  "query_1_sql": "The full SQL for Query 1",
  "query_2_sql": "The full SQL for Query 2",
  "errors": []
}
```

## Success Criteria

Your report is successful if:

1. **Executive would read it**: Clear, concise, actionable insights
2. **Numbers tell a story**: Context around every metric
3. **Actions are specific**: Not "improve X" but "do Y to improve X by Z"
4. **Alerts are prioritized**: Most impactful issues first
5. **Trends are visible**: Week-over-week, month-over-month comparisons
6. **Quality is evident**: Data anomalies noted, basis documented
7. **Format is scannable**: Good use of structure, bullets, emoji
8. **Zero errors**: Queries execute successfully, all formatting correct

## Example of Excellent vs Poor

**POOR (what v1 did):**
```
• MTD: Booked $850,569 of $1,443,538 (pace 58.9%)
```

**EXCELLENT (what you should do):**
```
• MTD: $851K of $1.4M (59% ↓ from 95% last MTD) - $593K gap
  Revenue pacing down due to AMER Expansion shortfall (-$120K)
```

**POOR (what v1 did):**
```
• SQL: Review SQL conversion rates and engagement strategies
```

**EXCELLENT (what you should do):**
```
• SQL: Sales leadership to audit 15 stalled SQL opps in AMER|SMB|INBOUND
  (Worth $45K, stuck 14+ days) - target 30% conversion by Friday
```

## Deliverables

1. **query_1_improved.sql** - Enhanced report payload query
2. **query_2_improved.sql** - Enhanced detail payload query
3. **generate_report_v2.py** - Improved Python script with better formatting
4. **Run the report** - Execute for 2026-01-10 and show me the output
5. **README.md** - Document how to run it, what changed, and why it's better

## Starting Point

Review the archived v1 files to understand what was built, then rebuild from scratch with the improvements. You have full access to BigQuery via the authenticated `bq` CLI.

**Start by:**
1. Reviewing the v1 output to see what needs improvement
2. Analyzing the data model and available fields
3. Designing enhanced queries with trend analysis
4. Building better message formatting with clear insights
5. Testing thoroughly with the bq CLI

## Key Improvements to Make

### Analytics Enhancements:
- [ ] Add week-over-week pacing comparison
- [ ] Add month-over-month trend indicators
- [ ] Calculate $ sums for alert categories (not just counts)
- [ ] Identify patterns in winners vs losers
- [ ] Detect if gaps are getting better or worse

### Message Enhancements:
- [ ] Add executive summary bullets (3-4 key takeaways)
- [ ] Include "Key Insight" section with data-driven observation
- [ ] Better action items with specific owners, metrics, timelines
- [ ] Rank alerts by $ impact, not alphabetically
- [ ] Add trend arrows (↑↓→) throughout
- [ ] Better emoji usage for visual scanning
- [ ] Context around every number ("what this means")

### Technical Enhancements:
- [ ] Robust date basis detection with validation
- [ ] Error handling for missing data
- [ ] Query performance optimization
- [ ] Better JSON structure for easier parsing
- [ ] Comprehensive logging

**Make this a report that executives look forward to reading every morning.**

Good luck! 🚀
