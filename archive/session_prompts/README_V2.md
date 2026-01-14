# Daily Revenue Operations Report V2

**An executive-friendly daily report with actionable insights, trend analysis, and specific recommendations.**

---

## 🎯 What's New in V2

V2 represents a complete transformation from basic metrics reporting to executive-grade intelligence:

### Major Improvements

**1. Executive-Grade Insights**
- ✅ Executive summary bullets (3-4 key takeaways)
- ✅ "Key Insight" section with data-driven observations
- ✅ Context around every number ("what this means")
- ✅ Trend indicators (↑↓→) throughout all metrics

**2. Enhanced Analytics**
- ✅ Week-over-week pacing comparisons
- ✅ Month-over-month trend indicators
- ✅ $ sums for all alert categories (not just counts)
- ✅ Smart date basis detection (Won_Date vs TargetDate)
- ✅ Gap analysis with actionable thresholds

**3. Actionable Recommendations**
- ✅ 8 specific action items with:
  - Stage labels ([MQL], [SQL], [SAL], [SQO], [WON], [RISK], [PROCESS], [OPPORTUNITY])
  - Specific owners (Marketing, Sales, AE team, etc.)
  - Expected outcomes and timelines
  - Dollar impacts and deal counts
- ✅ Ranked by priority and $ impact

**4. Improved Formatting**
- ✅ Better Slack markdown with visual hierarchy
- ✅ Currency formatted as $1.2M / $850K (not $1,234,567)
- ✅ Percentages with 1 decimal place
- ✅ Strategic emoji usage for visual scanning
- ✅ Main message under 1800 characters
- ✅ Comprehensive thread message with full details

**5. Better Data Quality**
- ✅ Robust null handling throughout
- ✅ Anomaly detection with clear notes
- ✅ Date basis validation and reporting
- ✅ Comprehensive error handling

---

## 📂 Files

| File | Purpose |
|------|---------|
| `query_1_improved.sql` | Enhanced report payload with trend analysis |
| `query_2_improved.sql` | Enhanced detail payload with $ sums |
| `generate_report_v2.py` | Python script for message formatting |
| `report_output_v2.json` | Sample output for 2026-01-10 |
| `README_V2.md` | This documentation |

---

## 🚀 Quick Start

### Prerequisites

- BigQuery authenticated via `gcloud auth login`
- Python 3.7+
- Access to `data-analytics-306119.Staging.StrategicOperatingPlan`

### Run the Report

```bash
# Make script executable
chmod +x generate_report_v2.py

# Generate report
python3 generate_report_v2.py
```

### Test Queries Only

```bash
# Dry run (validate syntax without executing)
bq query --use_legacy_sql=false --format=json --dry_run < query_1_improved.sql
bq query --use_legacy_sql=false --format=json --dry_run < query_2_improved.sql

# Execute queries directly
bq query --use_legacy_sql=false --format=json < query_1_improved.sql
bq query --use_legacy_sql=false --format=json < query_2_improved.sql
```

---

## 📊 Output Format

The script generates `report_output_v2.json` with:

```json
{
  "main_message": "Formatted Slack message (<1800 chars)",
  "thread_message": "Comprehensive thread message",
  "report_payload_json": "Raw JSON from Query 1",
  "detail_payload_json": "Raw JSON from Query 2",
  "query_1_sql": "Full SQL for Query 1",
  "query_2_sql": "Full SQL for Query 2",
  "errors": []
}
```

---

## 📈 Report Structure

### Main Message (<1800 chars)

```
*Daily Revenue Performance Report*
{date} | {percentile} targets | Week starts {day}

*🎯 Today's Snapshot*
• [3-4 bullets with most important numbers and context]

*📊 Pacing vs Target*
• WTD: [revenue & volume pacing with trend arrow]
• MTD: [revenue & volume pacing with trend arrow]

*🚨 Top Constraint*
• [Single biggest bottleneck with $ impact]

*⚠️ Critical Alerts*
• [Top 3 most urgent items requiring immediate attention]

*💡 Key Insight*
• [Data-driven observation explaining the "why"]

→ Thread below for detailed breakdowns and actions
```

### Thread Message (Comprehensive)

```
*📉 MTD Biggest Gaps* (ranked by $ impact)
  [Top 6 gaps with context and pocket details]

*📈 MTD Wins* (learn from success)
  [Top 3 wins with overperformance metrics]

*🏆 MTD Top Performers* (celebrate)
  [Top 6 deals by actual ACV]

*🎣 Inbound MQL WTD Status*
  [Top 6 gaps with % to goal]

*🎬 Actions Required - Next 48 Hours*
  1. [MQL] Specific action with owner and outcome
  2. [SQL] Specific action with owner and outcome
  ... (up to 8 actions)

*📋 Alert Details*
  • Past due: {count} deals totaling ${sum}
  • Missed leads: {count} opportunities (${sum} impact)
  • At-risk: {count} deals worth ${sum}

*🔍 Data Quality Notes*
  • Anomalies or "All clear"
  • Date basis used
  • Generation timestamp
```

---

## 🔍 Key Features Explained

### 1. Smart Date Basis Detection

V2 automatically detects whether to use `Won_Date` or `TargetDate` for actuals:

```sql
-- Check which field has actual ACV data
CASE
  WHEN SUM(Actual_ACV WHERE Won_Date IN [MTD]) > 0
  THEN 'Won_Date'
  ELSE 'TargetDate'
END AS date_basis
```

This ensures actuals are never zero due to wrong date field.

### 2. Trend Analysis

Compares current period to prior period:

- **WoW**: Current week vs same time last week
- **MoM**: Current month vs same time last month
- **Trend Arrows**: ↑ improving, ↓ worsening, → stable

### 3. $ Sum Alerts

V1 only showed counts. V2 shows both count AND $ impact:

```
• Past due: 352 deals totaling $899K
```

This helps prioritize which alerts need immediate attention.

### 4. Specific Actions

V1 actions were generic:
```
• SQL: Review SQL conversion rates
```

V2 actions are specific:
```
• [MQL] Marketing to launch targeted campaign for AMER|SMB
  (need 86 MQLs) - target 50% gap closure by Friday
```

---

## 🎨 Formatting Guidelines

### Currency

- Use K/M suffix: `$1.2M`, `$850K`
- Whole dollars only (no cents)
- Always include comma separators

### Percentages

- 1 decimal place: `95.6%`
- Use "N/A" for null values

### Trend Arrows

- ↑ = improving (current > prior)
- ↓ = worsening (current < prior)
- → = stable (no significant change)

### Pockets

Format as: `Region|Segment|Source`
Example: `AMER|SMB|INBOUND`

---

## 📐 Data Model

### StrategicOperatingPlan Table

**Date Fields:**
- `TargetDate` - Planned/target date
- `Won_Date` - Actual won date (may be null)

**Dimensions:**
- `RecordType` - POR, R360
- `OpportunityType` - NEW BUSINESS, EXISTING BUSINESS, RENEWAL, MIGRATION
- `FunnelType` - EXPANSION, MIGRATION, R360 NEW LOGO
- `Region` - AMER, EMEA, APAC
- `Segment` - SMB, STRATEGIC, N/A
- `Source` - INBOUND, AE SOURCED, AM SOURCED, ALL

**Metrics:**
- `Target_*` / `Actual_*` for MQL, SQL, SAL, SQO, Won, ACV
- `*_Variance` - Actual - Target
- `*_Revenue_Slippage` - Revenue impact at each stage
- `*_Pacing_Alert` - Alert indicators

---

## 🔧 Configuration

### Modify Parameters

Edit the `params` CTE in both SQL files:

```sql
params AS (
  SELECT
    DATE('2026-01-10') AS as_of_date,      -- Report date
    'P50' AS percentile,                    -- P50, P75, etc.
    'MONDAY' AS week_starts_on              -- MONDAY, SUNDAY, etc.
)
```

### Adjust Thresholds

In `generate_report_v2.py`, modify:

```python
# Revenue pacing insight threshold
if mtd_pacing < 0.7:  # Change from 0.7 (70%)

# Volume pacing thresholds
if wtd_vol_pacing > 1.2:  # Strong performance (120%)
elif wtd_vol_pacing < 0.8:  # Lagging (80%)

# Significant trend change
if abs(pacing_change) > 0.05:  # Change from 0.05 (5%)
```

---

## 📊 Comparison: V1 vs V2

### V1 Output (POOR)

```
*Daily Revenue Performance Report* | 2026-01-10 | P50

*Pacing*
• WTD: Booked $827,683 of $866,122 (pace 95.6%)
• MTD: Booked $850,569 of $1,443,538 (pace 58.9%)

*Biggest constraint*
• WTD: SQL slippage $-56,695
• MTD: WON slippage $-408,660

*Alerts*
• Past due under pacing: 352
• Missed lead window: 4876
• Upcoming 14d won risk: 630
```

**Problems:**
- ❌ No context (what does 58.9% mean?)
- ❌ No trends (is this better or worse?)
- ❌ No actions (what should we do?)
- ❌ Raw numbers ($850,569 vs $851K)
- ❌ Alerts are just counts (how much $ at risk?)

### V2 Output (EXCELLENT)

```
*Daily Revenue Performance Report*
2026-01-10 | P50 targets | Week starts MONDAY

*🎯 Today's Snapshot*
• MTD revenue at 58.9% - need $593K to hit target
• WTD deal volume strong at 135.8% (153 wins)

*📊 Pacing vs Target*
• WTD: $828K of $866K (95.6% ↑) | 153/112 wins
• MTD: $851K of $1.4M (58.9% ↑) | 165/187 wins

*🚨 Top Constraint*
• WON stage slipping $409K

*⚠️ Critical Alerts*
• *352 past due deals* worth $899K need immediate attention
• *630 at-risk deals* (next 14d) totaling $1.8M

*💡 Key Insight*
• AMER|AM SOURCED driving wins - replicate success in other regions
```

**Improvements:**
- ✅ Context: "need $593K to hit target"
- ✅ Trends: ↑ improving
- ✅ Clarity: $851K vs $850,569
- ✅ $ Impact: "worth $899K"
- ✅ Insights: "replicate success in other regions"
- ✅ Actions: (in thread message)

---

## 🎯 Success Criteria

A successful V2 report should:

1. ✅ **Executive would read it** - Clear, concise, scannable
2. ✅ **Numbers tell a story** - Context around every metric
3. ✅ **Actions are specific** - Who, what, when, expected outcome
4. ✅ **Alerts are prioritized** - $ impact drives priority
5. ✅ **Trends are visible** - WoW, MoM comparisons
6. ✅ **Quality is evident** - Anomalies noted, basis documented
7. ✅ **Format is scannable** - Good structure, bullets, emoji
8. ✅ **Zero errors** - Queries execute, formatting correct

---

## 🐛 Troubleshooting

### Query Fails with "No data"

Check date basis detection - may need to adjust date ranges.

### All Actuals Show Zero

Date basis detection failed. Manually verify which date field has actual data:

```sql
SELECT
  SUM(CASE WHEN Won_Date BETWEEN '2026-01-01' AND '2026-01-10' THEN Actual_ACV ELSE 0 END) as by_won_date,
  SUM(CASE WHEN TargetDate BETWEEN '2026-01-01' AND '2026-01-10' THEN Actual_ACV ELSE 0 END) as by_target_date
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
```

### Python Script Errors

Check Python version (requires 3.7+):
```bash
python3 --version
```

Ensure BigQuery CLI is authenticated:
```bash
gcloud auth list
```

---

## 📝 Change Log

### V2.0 (2026-01-11)
- Complete rewrite of queries and formatting
- Added trend analysis (WoW, MoM)
- Added $ sums for all alerts
- Added specific action items (8 total)
- Added executive summary bullets
- Added key insight generation
- Improved formatting throughout
- Robust null handling
- Better error messages

### V1.0 (2026-01-10)
- Initial basic report
- WTD/MTD/QTD/YTD scorecards
- Simple alert counting
- Basic Slack formatting

---

## 🚀 Future Enhancements

Potential improvements for V3:

1. **Predictive Analytics**
   - Forecast month-end performance
   - Win probability scoring
   - Pipeline velocity trends

2. **Automated Actions**
   - Create JIRA tickets for critical alerts
   - Send targeted Slack DMs to owners
   - Auto-schedule follow-up meetings

3. **Interactive Elements**
   - Slack buttons for drill-downs
   - Real-time dashboard links
   - Chart/graph generation

4. **AI-Powered Insights**
   - Automatic root cause analysis
   - Success pattern detection
   - Recommendation engine

---

## 📞 Support

For questions or issues:

1. Check this README first
2. Review query comments for logic
3. Inspect sample output (`report_output_v2.json`)
4. Verify BigQuery access and authentication

---

## 📜 License

Internal use only - Point of Rental Software

---

**Built with ❤️ by the RevOps Analytics Team**

*Making data actionable, one insight at a time.*
