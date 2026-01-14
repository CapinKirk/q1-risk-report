# Resume: POR & R360 Risk Analysis Reports

## ✅ What Was Completed

### 1. Fixed Original RevOps V2 Report (DONE ✅)
- **Error 1 Fixed**: MTD Biggest Gaps now shows 6 DIFFERENT pockets (was duplicates)
- **Error 2 Fixed**: Snapshot bullets now have 2-4 bullets with proper • markers
- **Error 3 Fixed**: Actions Required now shows 8 actions across all stages (MQL, SQL, SAL, SQO, WON, RISK, PROCESS, OPPORTUNITY)
- **Enhancement 1 Added**: Region Summary (AMER, EMEA, APAC) with MTD performance
- **Enhancement 2 Added**: Product Performance (OpportunityType) showing NEW BUSINESS, EXISTING BUSINESS, RENEWAL, MIGRATION

**Files Modified:**
- `/Users/prestonharris/query_1_improved.sql` - Added region and opp type summaries
- `/Users/prestonharris/query_2_improved.sql` - Removed date_basis from GROUP BY
- `/Users/prestonharris/generate_report_v2.py` - Fixed bullets, actions, added new sections
- `/Users/prestonharris/report_output_v2.json` - Contains latest working report with REAL BigQuery data

## 🚧 What's In Progress (NEEDS COMPLETION)

### New Requirement: Separate POR & R360 Risk Reports

**User Requirements:**
1. **Two separate reports**: one for POR, one for R360 (OpportunityType field)
2. **Exclude RENEWAL bookings** completely (FunnelType != 'RENEWAL')
3. **For each region** (AMER, EMEA, APAC), show **top 3 risks**:
   - Each risk needs: Region, Booking Type (FunnelType), Source, Segment
   - For each risk, provide **full funnel analysis explaining WHY the miss**:
     - MQL: actual vs target, variance %, attainment %
     - SQL: actual vs target, variance %, attainment %
     - SAL: actual vs target, variance %, attainment %
     - SQO: actual vs target, variance %, attainment %
     - Won: actual vs target, ACV gap, pacing %
     - **Conversion rate diagnostics:**
       - MQL→SQL conversion: actual % vs target %, delta
       - SQL→SAL conversion: actual % vs target %, delta
       - SAL→SQO conversion: actual % vs target %, delta
       - SQO→Won conversion: actual % vs target %, delta

**Example Output Format:**
```
*POR REPORT - Top Risks by Region*

🔴 *AMER - Risk #1*
📍 NEW BUSINESS | INBOUND | SMB
💰 $344K gap (36.2% to target)

📊 Funnel Diagnostics:
  • MQL: 43 actual vs 129 target (-67%) ⬇️
  • SQL: 28 actual vs 85 target (-67%) ⬇️
  • SAL: 15 actual vs 50 target (-70%) ⬇️
  • SQO: 8 actual vs 25 target (-68%) ⬇️
  • WON: 21 actual vs 57 target (-63%) ⬇️

🔍 Conversion Rate Analysis:
  • MQL→SQL: 65% actual vs 66% target (-1pp)
  • SQL→SAL: 54% actual vs 59% target (-5pp) ⚠️
  • SAL→SQO: 53% actual vs 50% target (+3pp) ✓
  • SQO→WON: 262% actual vs 228% target (+34pp) ✓

💡 Root Cause: MQL volume down 67% - marketing pipeline issue
```

## 🐛 Current Blocker

**Issue**: BigQuery query syntax error: "Aggregations of aggregations are not allowed at [60:16]"

**What Was Attempted:**
1. Created `query_por_risk_analysis.sql` and `query_r360_risk_analysis.sql`
2. Query structure:
   - Filters by OpportunityType ('POR' or 'R360')
   - Excludes FunnelType = 'RENEWAL'
   - Groups by Region, FunnelType, Source, Segment
   - Calculates all funnel metrics and conversion rates
   - Ranks by acv_gap DESC, top 3 per region
3. **Error occurs** when trying to calculate derived metrics like `(SUM(Target_ACV) - SUM(Actual_ACV)) AS acv_gap` in the same CTE that does the grouping

**Root Cause**: BigQuery doesn't allow using aggregate functions in expressions within the same SELECT that has GROUP BY. Need to split into two CTEs:
- CTE 1: Do all SUM() aggregations
- CTE 2: Calculate derived metrics from CTE 1 results

## 📋 Next Steps to Complete

### Step 1: Fix BigQuery Query Syntax
```sql
-- Split into two CTEs:
risk_pockets_aggregated AS (
  SELECT
    Region, FunnelType, Source, Segment,
    SUM(Target_Won) AS target_won,
    SUM(Actual_Won) AS actual_won,
    -- ... all other SUM() aggregations
  FROM base_with_basis
  WHERE ... AND FunnelType != 'RENEWAL'
  GROUP BY Region, FunnelType, Source, Segment
),
risk_pockets_calculated AS (
  SELECT
    *,
    (target_acv - actual_acv) AS acv_gap,
    SAFE_DIVIDE(actual_acv, target_acv) AS won_pacing,
    -- ... all derived calculations without SUM()
  FROM risk_pockets_aggregated
)
```

### Step 2: Test Queries
```bash
bq query --use_legacy_sql=false --format=json --dry_run < query_por_risk_analysis.sql
bq query --use_legacy_sql=false --format=json --dry_run < query_r360_risk_analysis.sql
```

### Step 3: Create Python Report Generator
Create `/Users/prestonharris/generate_risk_reports.py`:
- Run both POR and R360 queries
- Format output showing top 3 risks per region
- Display full funnel diagnostics for each risk
- Show conversion rate analysis with deltas
- Highlight root causes (biggest misses in funnel)

### Step 4: Execute and Generate Reports
```bash
python3 generate_risk_reports.py
```

Output files:
- `report_por_risks.txt` - POR report
- `report_r360_risks.txt` - R360 report

## 📁 Key Files

**Working Files (Don't Change):**
- `query_1_improved.sql` - Main report query (working)
- `query_2_improved.sql` - Detail query (working)
- `generate_report_v2.py` - Main report generator (working)
- `report_output_v2.json` - Latest successful report output

**In Progress Files:**
- `query_por_risk_analysis.sql` - POR risk query (HAS SYNTAX ERROR)
- `query_r360_risk_analysis.sql` - R360 risk query (HAS SYNTAX ERROR)
- `generate_risk_reports.py` - NOT YET CREATED

## 🎯 Success Criteria

Report is complete when:
1. ✅ Both queries execute without errors
2. ✅ POR report shows top 3 risks per region (AMER, EMEA, APAC) with full funnel analysis
3. ✅ R360 report shows top 3 risks per region (AMER, EMEA, APAC) with full funnel analysis
4. ✅ Each risk shows: Booking Type, Source, Segment, ACV gap, full funnel metrics, conversion rate deltas
5. ✅ User can see WHY each risk is missing (e.g., "MQLs down 67%, SQL→SAL conversion down 5pp")

## 🔑 Database Schema Reference

- **Table**: `data-analytics-306119.Staging.StrategicOperatingPlan`
- **Key Fields**:
  - `OpportunityType`: 'POR', 'R360', etc.
  - `FunnelType`: 'NEW BUSINESS', 'EXISTING BUSINESS', 'RENEWAL', 'MIGRATION', etc.
  - `Region`: 'AMER', 'EMEA', 'APAC'
  - `Segment`: 'SMB', 'STRATEGIC', 'N/A'
  - `Source`: 'INBOUND', 'OUTBOUND', 'AM SOURCED', 'AE SOURCED', 'ALL'
  - Metrics: Target_MQL, Actual_MQL, Target_SQL, Actual_SQL, Target_SAL, Actual_SAL, Target_SQO, Actual_SQO, Target_Won, Actual_Won, Target_ACV, Actual_ACV

## 💬 Resume Prompt for New Claude Session

```
I'm continuing work on POR and R360 risk analysis reports.

CONTEXT: I've already fixed the original RevOps V2 report (all 3 errors resolved, region and product summaries added). Now working on NEW requirement: separate reports for POR and R360 showing top 3 risks per region with full funnel analysis.

CURRENT BLOCKER: BigQuery syntax error "Aggregations of aggregations not allowed" in query_por_risk_analysis.sql and query_r360_risk_analysis.sql. Need to split into 2 CTEs - one for aggregations, one for calculations.

FILES TO READ:
- /Users/prestonharris/RESUME_PROMPT_RISK_REPORTS.md (this file - full context)
- /Users/prestonharris/query_por_risk_analysis.sql (has syntax error to fix)

TASK: Fix the BigQuery queries, test with dry run, then create Python script to generate both POR and R360 risk reports with full funnel diagnostics.

REQUIREMENTS:
- Exclude RENEWAL bookings
- Top 3 risks per region (AMER, EMEA, APAC)
- Each risk shows: Booking Type, Source, Segment, full funnel metrics (MQL→SQL→SAL→SQO→WON), conversion rate deltas
- Output format shows WHY each risk is missing target (e.g., "MQLs down 67%, SQL→SAL conversion down 5pp")

Ready to proceed?
```
