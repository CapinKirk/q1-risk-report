# Generate Risk Reports - Claude Code Session Prompt

## Overview
Generate POR and R360 Q1 2026 Risk Analysis Reports using BigQuery queries with all data quality adjustments applied.

**Last Updated:** 2026-01-12
**Report Period:** Q1 2026 QTD (as of January 12, 2026 = 13.33% of quarter)

## CRITICAL: Target Source of Truth

**USE EXCEL, NOT BigQuery SOP for targets!**

- **Excel File:** `2026 Bookings Plan Draft.xlsx`
- **Sheet:** "Plan by Month" (NOT "Copy of Plan by Month QA" - that's outdated)
- **Reason:** BigQuery SOP has a $3,699 discrepancy for AMER R360 SMB

## Key Data Quality Adjustments (2026-01-12)

### 1. FunnelType vs Source Clarification
**FunnelTypes (derived from Opportunity Type ONLY):**
- NEW LOGO (from Type = 'New Business')
- EXPANSION (from Type = 'Existing Business')
- MIGRATION (from Type = 'Migration')
- RENEWAL (from Type = 'Renewal')

**Source (separate dimension from SDRSource):**
- INBOUND, OUTBOUND, AE SOURCED, AM SOURCED, TRADESHOW, PARTNERSHIPS

**⚠️ "INBOUND" is NOT a FunnelType!** BigQuery SOP incorrectly has "R360 INBOUND" as a FunnelType. Combine it with "R360 NEW LOGO" when querying.

### 2. Hardcoded Excel Targets
Both SQL files now have `excel_q1_targets` CTE with exact values from Excel to ensure accuracy.

### R360 Adjustments (`query_r360_risk_analysis.sql`)
1. **Excel Targets**: Hardcoded from "Plan by Month" sheet (total $868,610)
2. **PARTNERSHIPS**: All target metrics zeroed out
3. **FunnelType Combination**: "R360 INBOUND" + "R360 NEW LOGO" → "NEW LOGO"

### POR Adjustments (`query_por_risk_analysis.sql`)
1. **Excel Targets**: Hardcoded from "Plan by Month" sheet (total $2,659,310)
2. **Percentile Filter**: Uses `P50` percentile only
3. **Source Mapping**: Uses `SDRSource` field (with `POR_SDRSource` fallback)

## Files to Use

| File | Purpose |
|------|---------|
| `/Users/prestonharris/query_por_risk_analysis.sql` | POR Q1 2026 risk analysis query |
| `/Users/prestonharris/query_r360_risk_analysis.sql` | R360 Q1 2026 risk analysis query |
| `/Users/prestonharris/generate_risk_reports.py` | Python script to execute queries and format output |
| `/Users/prestonharris/sop_data_quality_fix_q1_2026.sql` | Documentation of all data quality issues and fixes |

## Expected Q1 2026 Targets (FROM EXCEL - Source of Truth)

### R360 Q1 2026 Targets (by Region & Category)
| Region | Category   | Q1 Target   | Notes |
|--------|------------|-------------|-------|
| AMER   | NEW LOGO   | $525,160    | SMB $403,560 + Strat $121,600 |
| AMER   | EXPANSION  | $210,000    | |
| APAC   | NEW LOGO   | $20,400     | |
| APAC   | EXPANSION  | $850        | |
| EMEA   | NEW LOGO   | $112,200    | UK $112,200 + EU $0 |
| EMEA   | EXPANSION  | $0          | |
| **TOTAL** | | **$868,610** | Excludes Renewals |

### POR Q1 2026 Targets (by Region & Category)
| Region | Category   | Q1 Target   | Notes |
|--------|------------|-------------|-------|
| AMER   | NEW LOGO   | $524,260    | SMB $358,160 + Strat $166,100 |
| AMER   | MIGRATION  | $264,000    | |
| AMER   | EXPANSION  | $832,000    | |
| APAC   | NEW LOGO   | $94,000     | |
| APAC   | MIGRATION  | $58,650     | |
| APAC   | EXPANSION  | $46,200     | |
| EMEA   | NEW LOGO   | $261,800    | SMB $178,200 + Strat $83,600 |
| EMEA   | MIGRATION  | $273,600    | |
| EMEA   | EXPANSION  | $304,800    | |
| **TOTAL** | | **$2,659,310** | Excludes Renewals |

### QTD Target Calculation
```
QTD Target = Q1 Target × (Days Elapsed / 90)
As of Jan 12: 12/90 = 13.33%

Example: AMER R360 NEW LOGO
  Q1 Target: $525,160
  QTD Target: $525,160 × 0.1333 = $70,021
```

## Execution Steps

### Step 1: Validate Data Quality Fixes
Run validation queries to confirm adjustments are working:

```bash
# Validate R360 PARTNERSHIPS is zeroed
bq query --use_legacy_sql=false '
SELECT source,
  SUM(Target_Won) as target_won,
  SUM(Target_ACV) as target_acv
FROM (
  SELECT
    sop.Source as source,
    CASE WHEN sop.Source = "PARTNERSHIPS" THEN 0.0 ELSE sop.Target_Won END AS Target_Won,
    CASE WHEN sop.Source = "PARTNERSHIPS" THEN 0.0
         WHEN sop.Source = "AE SOURCED" THEN sop.Target_ACV / 100.0
         ELSE sop.Target_ACV END AS Target_ACV
  FROM `data-analytics-306119.Staging.StrategicOperatingPlan` sop
  WHERE sop.RecordType = "R360"
    AND sop.Percentile = "P50"
    AND sop.Won_Date >= "2026-01-01"
    AND sop.Won_Date <= "2026-03-31"
    AND COALESCE(sop.OpportunityType, "") != "RENEWAL"
)
GROUP BY source
ORDER BY source;
'
```

### Step 2: Generate R360 Risk Report
```bash
# Execute R360 risk analysis query
bq query --use_legacy_sql=false --format=prettyjson < /Users/prestonharris/query_r360_risk_analysis.sql
```

### Step 3: Generate POR Risk Report
```bash
# Execute POR risk analysis query
bq query --use_legacy_sql=false --format=prettyjson < /Users/prestonharris/query_por_risk_analysis.sql
```

### Step 4: Run Python Report Generator (Alternative)
```bash
cd /Users/prestonharris
python generate_risk_reports.py
```

## Validation Checklist

After generating reports, verify:

### Target Validation (Must Match Excel)
- [ ] R360 AMER NEW LOGO = $525,160
- [ ] R360 AMER EXPANSION = $210,000
- [ ] R360 TOTAL = $868,610 (excl. Renewals)
- [ ] POR AMER NEW LOGO = $524,260
- [ ] POR AMER EXPANSION = $832,000
- [ ] POR AMER MIGRATION = $264,000
- [ ] POR TOTAL = $2,659,310 (excl. Renewals)

### Data Quality Checks
- [ ] R360 PARTNERSHIPS shows $0 target (not $3,740)
- [ ] No "INBOUND" appearing as a FunnelType in output
- [ ] FunnelTypes are ONLY: NEW LOGO, EXPANSION, MIGRATION, RENEWAL
- [ ] Percentile filter is P50 only
- [ ] Division filter includes only US/UK/AU

## Troubleshooting

### If PARTNERSHIPS shows non-zero:
Check that `targets_base` CTE has CASE statements for all metrics:
```sql
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_Won END AS Target_Won,
CASE WHEN sop.Source = 'PARTNERSHIPS' THEN 0.0 ELSE sop.Target_ACV END AS Target_ACV,
-- etc for Target_MQL, Target_SQL, Target_SAL, Target_SQO
```

### If totals are doubled:
Check FunnelType-to-Source mapping filter:
```sql
AND (
  (t.source = 'INBOUND' AND t.funnel_type = 'R360 INBOUND')
  OR (t.source != 'INBOUND' AND t.funnel_type = 'R360 NEW LOGO')
)
```

### If AE SOURCED looks wrong:
AE SOURCED raw value ($128K) is correct - do NOT apply /100 correction.

## Data Sources

| Table | Purpose |
|-------|---------|
| `data-analytics-306119.Staging.StrategicOperatingPlan` | SOP targets (with data quality issues) |
| `data-analytics-306119.sfdc.OpportunityViewTable` | Actuals from Salesforce |
| `data-analytics-306119.R360.r360_eql_funnel` | R360 EQL funnel data |

## Recent Changes

### 2026-01-12
1. **FunnelType Clarification**: INBOUND is a Source, NOT a FunnelType. Valid FunnelTypes: NEW LOGO, EXPANSION, MIGRATION, RENEWAL only.

2. **Hardcoded Excel Targets**: Added `excel_q1_targets` CTE to both SQL files with exact values from Excel "Plan by Month" sheet.

3. **Excel vs SOP Discrepancy Documented**: BigQuery SOP has AMER R360 SMB = $407,259 but Excel = $403,560 (diff $3,699). Excel is source of truth.

4. **Updated Target Documentation**: All targets now shown by Region × Category (not by Source).

### 2026-01-11
1. **Fixed PARTNERSHIPS funnel metrics**: Added CASE statements to zero out Target_Won, Target_MQL, Target_SQL, Target_SAL, Target_SQO (not just Target_ACV)

2. **Updated documentation**: `sop_data_quality_fix_q1_2026.sql` now reflects that PARTNERSHIPS has $3,740 in SOP table but should be $0

3. **Source mapping fix** (commit cc3d53a): Uses `SDRSource` as primary field instead of `POR_SDRSource`
