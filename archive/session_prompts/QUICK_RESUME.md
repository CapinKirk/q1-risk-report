# 🔥 Quick Resume: Fix Data Quality Issues in Risk Reports

## Problem
R360 Inbound reports showing 0 or very low MQLs - user says this is impossible.

## Root Cause (Suspected)
The risk queries filter ALL funnel stages (MQL, SQL, SAL, SQO, Won) by a SINGLE date field. But:
- The working main report (`query_1_improved.sql`) uses `effective_date` = Won_Date OR TargetDate
- Our risk queries use `date_basis` from the SAME logic
- BUT we're filtering by MTD range (2026-01-01 to 2026-01-10) which is VERY NARROW
- MQL metrics might not fall in this narrow Won_Date range

## Key Insight from Working Query
```sql
-- query_1_improved.sql (WORKING)
effective_date = CASE WHEN Won_Date has data THEN Won_Date ELSE TargetDate END
WHERE effective_date BETWEEN dates.mtd_start AND dates.as_of_date
```

This works because it aggregates ALL products together, not filtering by RecordType.

## Our Broken Queries
```sql
-- query_por_risk_analysis.sql and query_r360_risk_analysis.sql (BROKEN)
date_basis = CASE WHEN Won_Date has data THEN Won_Date ELSE TargetDate END
WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
  AND RecordType = 'POR' or 'R360'  -- Additional filter!
  AND OpportunityType != 'RENEWAL'
```

## Files
- **Read First:** `/Users/prestonharris/RESUME_DATA_QUALITY_ISSUE.md` - Full analysis
- **Working Reference:** `/Users/prestonharris/query_1_improved.sql` - Copy this logic!
- **Broken Query 1:** `/Users/prestonharris/query_por_risk_analysis.sql`
- **Broken Query 2:** `/Users/prestonharris/query_r360_risk_analysis.sql`
- **Debug Script:** `/Users/prestonharris/debug_data_quality.sh` - Run this first!

## Next Steps
1. Run `./debug_data_quality.sh` to see the data
2. Compare working vs broken query date logic
3. Fix the date filtering (probably need to remove or broaden date filter for pipeline metrics)
4. Test and regenerate reports
