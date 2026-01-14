# URGENT: Data Quality Issue in Risk Reports - Resume Prompt

## 🚨 CRITICAL ISSUE

User reports that R360 Inbound should NOT have 0 MQLs. The reports are showing suspicious data patterns that suggest query logic errors.

## 📋 WHAT WAS COMPLETED

### ✅ Fixed Queries (Syntax Working)
- **Fixed Files:**
  - `/Users/prestonharris/query_por_risk_analysis.sql` - Syntax validated ✓
  - `/Users/prestonharris/query_r360_risk_analysis.sql` - Syntax validated ✓
  - `/Users/prestonharris/generate_risk_reports.py` - Report generator script ✓

### ✅ Key Fixes Made:
1. Split aggregation CTEs to avoid "aggregations of aggregations" error
2. Changed filter from `OpportunityType` to `RecordType` (POR/R360)
3. Changed exclusion from `FunnelType != 'RENEWAL'` to `OpportunityType != 'RENEWAL'`
4. Added None handling in Python formatting functions

### ❌ SUSPICIOUS DATA PATTERNS FOUND:

**R360 AMER Risk #2:**
```
📍 R360 INBOUND | INBOUND | SMB
• MQL: 17 actual vs 77 target (-78%) ⚠️
```
- Only 17 MQLs when target is 77 - seems low

**Multiple Risks showing 0 MQLs:**
- R360 NEW LOGO | AE SOURCED | STRATEGIC (AMER)
- R360 NEW LOGO | TRADESHOW | SMB (AMER & EMEA)
- R360 INBOUND | INBOUND | SMB (APAC) - 0 actual vs 2 target

**Many risks showing 0% won pacing but various funnel stages have data**
- Suggests deals aren't closing despite funnel activity

## 🔍 ROOT CAUSE ANALYSIS NEEDED

### Hypothesis 1: Date Filtering Issue
**Current Logic:**
```sql
WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
  AND RecordType = params.product_filter
  AND OpportunityType != 'RENEWAL'
```

**Potential Issues:**
- `date_basis` field selection logic may be wrong
- MTD date range `DATE_TRUNC(DATE('2026-01-10'), MONTH)` = 2026-01-01 to 2026-01-10
- Are MQL dates/targets actually in this narrow window?
- Should we be looking at TargetDate fields vs Won_Date?

### Hypothesis 2: Field Mapping Confusion
**Schema shows these date fields:**
- `TargetDate` - target close date?
- `Won_Date` - actual won date?
- `MQL_Target_Date` - MQL target date?
- Plus individual stage target dates: `SQL_Target_Date`, `SAL_Target_Date`, `SQO_Target_Date`

**Current date_basis selection:**
```sql
CASE WHEN basis.chosen_date_basis = 'Won_Date' THEN sop.Won_Date ELSE sop.TargetDate END AS date_basis
```

**Problem:** We're filtering ALL stages (MQL, SQL, SAL, SQO, Won) by a SINGLE date field (Won_Date or TargetDate). But MQLs might have different date fields!

### Hypothesis 3: Aggregation Level Wrong
- Are we aggregating at the right grain?
- Should each funnel stage have its own date filter?
- Example: MQLs should filter by MQL_Target_Date, SQLs by SQL_Target_Date, etc.

## 📊 DATABASE SCHEMA (From Sample Row)

```
Table: data-analytics-306119.Staging.StrategicOperatingPlan

Key Fields:
- RecordType: 'POR', 'R360', etc.
- OpportunityType: 'NEW BUSINESS', 'EXISTING BUSINESS', 'MIGRATION', 'RENEWAL'
- FunnelType: 'EXPANSION', 'NEW LOGO', 'INBOUND', etc.
- Region: 'AMER', 'EMEA', 'APAC'
- Segment: 'SMB', 'STRATEGIC', 'N/A'
- Source: 'INBOUND', 'OUTBOUND', 'AM SOURCED', 'AE SOURCED', 'TRADESHOW', 'ALL'

Date Fields:
- TargetDate: DATE
- Won_Date: DATE
- MQL_Target_Date: DATE
- SQL_Target_Date: DATE
- SAL_Target_Date: DATE
- SQO_Target_Date: DATE

Metrics (FLOAT64):
- Target_MQL, Actual_MQL
- Target_SQL, Actual_SQL
- Target_SAL, Actual_SAL
- Target_SQO, Actual_SQO
- Target_Won, Actual_Won
- Target_ACV, Actual_ACV

Other Fields:
- Percentile: 'P50', etc.
- Status: 'Green', 'Yellow', 'Red'
- Strategic_Label: text
- Business_Action: text
```

## 🎯 REQUIRED TASKS FOR NEXT SESSION

### Task 1: Schema Deep Dive
```bash
# Get full schema
bq show --schema --format=prettyjson data-analytics-306119.Staging.StrategicOperatingPlan > schema.json

# Analyze date field distributions
bq query --use_legacy_sql=false --format=pretty '
SELECT
  RecordType,
  COUNT(*) as rows,
  COUNT(DISTINCT TargetDate) as distinct_target_dates,
  MIN(TargetDate) as min_target_date,
  MAX(TargetDate) as max_target_date,
  COUNT(DISTINCT Won_Date) as distinct_won_dates,
  MIN(Won_Date) as min_won_date,
  MAX(Won_Date) as max_won_date,
  COUNT(DISTINCT MQL_Target_Date) as distinct_mql_dates,
  MIN(MQL_Target_Date) as min_mql_date,
  MAX(MQL_Target_Date) as max_mql_date
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType IN ("POR", "R360")
GROUP BY RecordType
'
```

### Task 2: Validate R360 Inbound Data
```bash
# Check if R360 Inbound actually has MQL data
bq query --use_legacy_sql=false --format=pretty '
SELECT
  RecordType,
  FunnelType,
  Source,
  Region,
  COUNT(*) as row_count,
  SUM(Target_MQL) as total_target_mql,
  SUM(Actual_MQL) as total_actual_mql,
  MIN(MQL_Target_Date) as earliest_mql_date,
  MAX(MQL_Target_Date) as latest_mql_date
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType = "R360"
  AND Source = "INBOUND"
  AND OpportunityType != "RENEWAL"
GROUP BY RecordType, FunnelType, Source, Region
ORDER BY total_target_mql DESC
'
```

### Task 3: Test Date Filtering Impact
```bash
# Compare results with different date filters
bq query --use_legacy_sql=false --format=pretty '
WITH test_dates AS (
  SELECT
    DATE("2026-01-10") AS as_of_date,
    DATE_TRUNC(DATE("2026-01-10"), MONTH) AS mtd_start
)
SELECT
  "Using Won_Date" as filter_type,
  COUNT(*) as records,
  SUM(Target_MQL) as target_mql,
  SUM(Actual_MQL) as actual_mql
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, test_dates
WHERE RecordType = "R360"
  AND Source = "INBOUND"
  AND OpportunityType != "RENEWAL"
  AND Won_Date BETWEEN test_dates.mtd_start AND test_dates.as_of_date

UNION ALL

SELECT
  "Using TargetDate" as filter_type,
  COUNT(*) as records,
  SUM(Target_MQL) as target_mql,
  SUM(Actual_MQL) as actual_mql
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, test_dates
WHERE RecordType = "R360"
  AND Source = "INBOUND"
  AND OpportunityType != "RENEWAL"
  AND TargetDate BETWEEN test_dates.mtd_start AND test_dates.as_of_date

UNION ALL

SELECT
  "Using MQL_Target_Date" as filter_type,
  COUNT(*) as records,
  SUM(Target_MQL) as target_mql,
  SUM(Actual_MQL) as actual_mql
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`, test_dates
WHERE RecordType = "R360"
  AND Source = "INBOUND"
  AND OpportunityType != "RENEWAL"
  AND MQL_Target_Date BETWEEN test_dates.mtd_start AND test_dates.as_of_date

UNION ALL

SELECT
  "NO DATE FILTER" as filter_type,
  COUNT(*) as records,
  SUM(Target_MQL) as target_mql,
  SUM(Actual_MQL) as actual_mql
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType = "R360"
  AND Source = "INBOUND"
  AND OpportunityType != "RENEWAL"
'
```

### Task 4: Understand Data Grain
```bash
# What is each row?
bq query --use_legacy_sql=false --format=pretty '
SELECT *
FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
WHERE RecordType = "R360"
  AND Source = "INBOUND"
  AND Target_MQL > 0
LIMIT 5
'
```

### Task 5: Check Working Query Logic
Look at the working query from the main report:
- `/Users/prestonharris/query_1_improved.sql` - This query works and shows correct data
- Compare its date filtering logic to our risk queries
- Ensure we're using the same approach

## 🔧 LIKELY FIX NEEDED

Based on similar issues, the fix is probably:

**Option A: Use stage-specific date fields**
```sql
-- Instead of filtering all metrics by one date
WHERE date_basis BETWEEN mtd_start AND as_of_date

-- Use stage-specific dates
WHERE (
  MQL_Target_Date BETWEEN mtd_start AND as_of_date
  OR SQL_Target_Date BETWEEN mtd_start AND as_of_date
  OR SAL_Target_Date BETWEEN mtd_start AND as_of_date
  OR SQO_Target_Date BETWEEN mtd_start AND as_of_date
  OR TargetDate BETWEEN mtd_start AND as_of_date
)
```

**Option B: Match the working query's logic exactly**
```sql
-- Copy date filtering from query_1_improved.sql line-by-line
```

**Option C: Remove narrow date filter for funnel metrics**
```sql
-- Only filter Won_Date for actual closed deals
-- Don't filter pipeline metrics (MQL/SQL/SAL/SQO) by date at all
WHERE (
  -- For actuals: use Won_Date
  (Actual_Won > 0 AND Won_Date BETWEEN mtd_start AND as_of_date)
  OR
  -- For targets: use TargetDate
  (Target_Won > 0 AND TargetDate BETWEEN mtd_start AND as_of_date)
)
```

## 📁 KEY FILES

**Working Reference Files (DON'T CHANGE):**
- `/Users/prestonharris/query_1_improved.sql` - Main report query (WORKING - USE AS REFERENCE)
- `/Users/prestonharris/query_2_improved.sql` - Detail query (WORKING)
- `/Users/prestonharris/report_output_v2.json` - Latest working report with REAL data

**Files to Debug/Fix:**
- `/Users/prestonharris/query_por_risk_analysis.sql` - POR risk query (SUSPICIOUS DATA)
- `/Users/prestonharris/query_r360_risk_analysis.sql` - R360 risk query (SUSPICIOUS DATA)
- `/Users/prestonharris/generate_risk_reports.py` - Report generator (may need updates)

**Output Files (Review for suspicious patterns):**
- `/Users/prestonharris/report_por_risks.txt` - POR report
- `/Users/prestonharris/report_r360_risks.txt` - R360 report

## 🎯 SUCCESS CRITERIA

The fix is complete when:
1. ✅ R360 Inbound shows realistic MQL numbers (not 0 or suspiciously low)
2. ✅ Data patterns match user expectations
3. ✅ Date filtering logic is clearly documented and justified
4. ✅ Query logic matches the working main report query
5. ✅ All metrics (MQL, SQL, SAL, SQO, Won) show consistent, believable data
6. ✅ User validates the numbers look correct

## 💬 RESUME PROMPT FOR NEW CLAUDE SESSION

```
I need you to debug data quality issues in the POR/R360 risk analysis queries.

PROBLEM: The risk reports show 0 MQLs for R360 Inbound, which the user says is impossible. The date filtering logic is likely wrong.

CONTEXT: We have working queries (query_1_improved.sql) that show correct data, but the new risk analysis queries (query_por_risk_analysis.sql, query_r360_risk_analysis.sql) show suspicious patterns.

FILES TO READ:
1. /Users/prestonharris/RESUME_DATA_QUALITY_ISSUE.md (THIS FILE - full context)
2. /Users/prestonharris/query_1_improved.sql (WORKING query - reference this!)
3. /Users/prestonharris/query_por_risk_analysis.sql (broken - needs debugging)
4. /Users/prestonharris/query_r360_risk_analysis.sql (broken - needs debugging)

TASKS:
1. Run the diagnostic queries in "Task 2" and "Task 3" sections to understand the data
2. Compare date filtering logic between query_1_improved.sql (working) and the risk queries (broken)
3. Identify why MQLs are showing as 0 or suspiciously low
4. Fix the date filtering logic in both risk queries
5. Test with dry run and regenerate reports
6. Validate that R360 Inbound shows realistic MQL numbers

DATABASE: data-analytics-306119.Staging.StrategicOperatingPlan
- RecordType: 'POR' or 'R360'
- OpportunityType: 'NEW BUSINESS', 'EXISTING BUSINESS', 'MIGRATION', 'RENEWAL'
- Date fields: TargetDate, Won_Date, MQL_Target_Date, SQL_Target_Date, SAL_Target_Date, SQO_Target_Date

Start by running diagnostic queries to understand what's wrong with the data.
```
