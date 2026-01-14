# RevOps Report V2 - Fixes Required

## Context
You are continuing work on a Daily Revenue Operations Report V2. The initial build is complete and working, but there are errors in the output that need to be fixed.

## What Was Built (V2 - Current State)

Located in `/Users/prestonharris/`:

1. **query_1_improved.sql** - Report payload query with trend analysis
2. **query_2_improved.sql** - Detail payload query with $ sums
3. **generate_report_v2.py** - Python script for message formatting
4. **report_output_v2.json** - Current output (has errors)
5. **README_V2.md** - Documentation

## BigQuery Connection
- **Project**: `data-analytics-306119`
- **Dataset**: `Staging`
- **Table**: `StrategicOperatingPlan`
- **CLI Access**: Already authenticated as kirk.bennett@pointofrental.com
- **Test**: `bq ls` confirms access

## 🐛 Errors Found in Current V2 Output

### Error 1: Duplicate MTD Biggest Gaps
**Current output shows:**
```
*📉 MTD Biggest Gaps* (ranked by $ impact)
  1. AMER|N/A|AM SOURCED: $20K gap (at 0.0%) - EXPANSION
  2. AMER|N/A|AM SOURCED: $20K gap (at 0.0%) - EXPANSION
  3. AMER|N/A|AM SOURCED: $20K gap (at 0.0%) - EXPANSION
  4. AMER|N/A|AM SOURCED: $20K gap (at 0.0%) - EXPANSION
  5. AMER|N/A|AM SOURCED: $20K gap (at 0.0%) - EXPANSION
  6. AMER|N/A|AM SOURCED: $20K gap (at 0.0%) - EXPANSION
```

**Problem:** All 6 entries are identical. This is wrong.

**Expected:** Should show 6 DIFFERENT pockets/dates with varying gap amounts.

**Root Cause:** The query is likely grouping by date (won_date) in `top_variance_mtd` CTE in `query_2_improved.sql`, but the Python script is not displaying the date or showing sufficient differentiation.

**Fix Required:**
- Review `top_variance_mtd` CTE in query_2_improved.sql
- Check if we need to include more dimensions to differentiate entries
- Verify the GROUP BY clause is correct
- Update Python formatting in `generate_thread_message()` to show the differentiating field (likely date)

### Error 2: Incomplete Snapshot Bullets
**Current output shows:**
```
*🎯 Today's Snapshot*
• MTD revenue at 58.9% - need $593K to hit target
WTD deal volume strong at 135.8% (153 wins)
```

**Problem:** Only 2 bullets, but missing the bullet point marker (•) on the second one. Should be 3-4 bullets.

**Expected:**
```
*🎯 Today's Snapshot*
• MTD revenue at 58.9% - need $593K to hit target
• WTD deal volume strong at 135.8% (153 wins)
• [Additional insight - e.g., trend comparison or conversion rate issue]
```

**Fix Required:**
- In `generate_report_v2.py`, function `generate_main_message()` around line 179
- Ensure all snapshot bullets have the bullet marker (•)
- Ensure we generate 3-4 bullets (currently only getting 2)

### Error 3: Action Items Should Be More Diverse
**Current output shows only 5 actions:**
```
*🎬 Actions Required - Next 48 Hours*
  1. *[MQL]* Marketing to launch...
  2. *[WON]* Account management...
  3. *[RISK]* Sales leadership...
  4. *[PROCESS]* Data team...
  5. *[OPPORTUNITY]* Replicate...
```

**Expected:** Should have up to 8 actions covering all stages (MQL, SQL, SAL, SQO, WON, RISK, PROCESS, OPPORTUNITY)

**Fix Required:**
- In `generate_report_v2.py`, function `generate_specific_actions()` around line 275
- Review the logic to ensure all 8 action types are generated when data supports it
- Add SQL, SAL, and SQO specific actions based on conversion rate issues

## 🎯 Your Mission

Fix the errors above and regenerate the V2 report with correct output.

## Step-by-Step Instructions

### Step 1: Fix Query 2 - Top Variance MTD

**File:** `query_2_improved.sql`

**Issue:** The `top_variance_mtd` CTE is grouping by date, causing identical pockets to appear 6 times (one per day).

**Current code (around line 67):**
```sql
top_variance_mtd AS (
  SELECT
    RecordType AS rt,
    OpportunityType AS ot,
    FunnelType AS ft,
    Region AS r,
    Segment AS seg,
    Source AS src,
    date_basis AS won_date,
    SUM(Target_Won) AS t_won,
    SUM(Actual_Won) AS a_won,
    SUM(Target_ACV) AS t_acv,
    SUM(Actual_ACV) AS a_acv,
    SUM(ACV_Variance) AS acv_var,
    SUM(COALESCE(Won_Count_Revenue_Slippage, 0)) AS won_slip
  FROM base_with_basis, dates
  WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
  GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source, date_basis
  QUALIFY ROW_NUMBER() OVER (ORDER BY SUM(ACV_Variance) ASC) <= 6
),
```

**Fix Option A - Remove date from grouping:**
```sql
top_variance_mtd AS (
  SELECT
    RecordType AS rt,
    OpportunityType AS ot,
    FunnelType AS ft,
    Region AS r,
    Segment AS seg,
    Source AS src,
    SUM(Target_Won) AS t_won,
    SUM(Actual_Won) AS a_won,
    SUM(Target_ACV) AS t_acv,
    SUM(Actual_ACV) AS a_acv,
    SUM(ACV_Variance) AS acv_var,
    SUM(COALESCE(Won_Count_Revenue_Slippage, 0)) AS won_slip
  FROM base_with_basis, dates
  WHERE date_basis BETWEEN dates.mtd_start AND dates.as_of_date
  GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source
  QUALIFY ROW_NUMBER() OVER (ORDER BY SUM(ACV_Variance) ASC) <= 6
),
```

**Fix Option B - If you want to keep date, update Python to show it:**
Keep SQL as is, but update Python formatting to include the date field.

**Recommendation:** Use Option A - aggregate by pocket only (no date), which gives cleaner insights.

### Step 2: Fix Python - Snapshot Bullets

**File:** `generate_report_v2.py`

**Function:** `generate_main_message()` around line 105-133

**Issue:** Missing bullet marker and not generating enough bullets.

**Current code:**
```python
# Build executive snapshot bullets
snapshot_bullets = []

# Revenue pacing insight
mtd_pacing = mtd.get('Revenue_Pacing_Score', 0) or 0
if mtd_pacing < 0.7:
    snapshot_bullets.append(
        f"MTD revenue at {format_percent(mtd_pacing)} - need {format_currency(mtd_gap)} to hit target"
    )
else:
    snapshot_bullets.append(
        f"MTD tracking {format_percent(mtd_pacing)} to target ({format_currency(mtd['Actual_ACV'])} booked)"
    )

# Volume pacing insight
wtd_vol_pacing = wtd.get('Volume_Pacing_Score', 0) or 0
if wtd_vol_pacing > 1.2:
    snapshot_bullets.append(
        f"WTD deal volume strong at {format_percent(wtd_vol_pacing)} ({int(wtd.get('Actual_Won', 0))} wins)"
    )
elif wtd_vol_pacing < 0.8:
    target_won = wtd.get('Target_Won', 0) or 0
    actual_won = wtd.get('Actual_Won', 0) or 0
    snapshot_bullets.append(
        f"WTD deal volume lagging at {format_percent(wtd_vol_pacing)} (need {int(target_won - actual_won)} more wins)"
    )

# Trend comparison
if mtd.get('Prior_Revenue_Pacing'):
    prior_pacing = mtd['Prior_Revenue_Pacing']
    current_pacing = mtd.get('Revenue_Pacing_Score', 0) or 0
    pacing_change = current_pacing - prior_pacing
    if abs(pacing_change) > 0.05:
        direction = "up" if pacing_change > 0 else "down"
        snapshot_bullets.append(
            f"Pacing {direction} {format_percent(abs(pacing_change))} vs last month"
        )
```

**Problem:** The `elif` for volume pacing means we only get 1 volume bullet. We should always get both revenue and volume bullets.

**Fix:**
```python
# Build executive snapshot bullets
snapshot_bullets = []

# Revenue pacing insight (always add)
mtd_pacing = mtd.get('Revenue_Pacing_Score', 0) or 0
if mtd_pacing < 0.7:
    snapshot_bullets.append(
        f"MTD revenue at {format_percent(mtd_pacing)} - need {format_currency(mtd_gap)} to hit target"
    )
else:
    snapshot_bullets.append(
        f"MTD tracking {format_percent(mtd_pacing)} to target ({format_currency(mtd['Actual_ACV'])} booked)"
    )

# Volume pacing insight (always add)
wtd_vol_pacing = wtd.get('Volume_Pacing_Score', 0) or 0
wtd_actual = int(wtd.get('Actual_Won', 0))
if wtd_vol_pacing > 1.2:
    snapshot_bullets.append(
        f"WTD deal volume strong at {format_percent(wtd_vol_pacing)} ({wtd_actual} wins)"
    )
elif wtd_vol_pacing < 0.8:
    target_won = wtd.get('Target_Won', 0) or 0
    snapshot_bullets.append(
        f"WTD deal volume lagging at {format_percent(wtd_vol_pacing)} (need {int(target_won - wtd_actual)} more wins)"
    )
else:
    # Add neutral volume bullet even when in normal range
    snapshot_bullets.append(
        f"WTD deal volume on track at {format_percent(wtd_vol_pacing)} ({wtd_actual} wins)"
    )

# Trend comparison or conversion issue (add 3rd bullet)
if mtd.get('Prior_Revenue_Pacing'):
    prior_pacing = mtd['Prior_Revenue_Pacing']
    current_pacing = mtd_pacing
    pacing_change = current_pacing - prior_pacing
    if abs(pacing_change) > 0.05:
        direction = "up" if pacing_change > 0 else "down"
        snapshot_bullets.append(
            f"Pacing {direction} {format_percent(abs(pacing_change))} vs last month"
        )

# Add 4th bullet if we don't have 3 yet - use conversion insight
if len(snapshot_bullets) < 3:
    sql_to_sal = mtd.get('SQL_to_SAL', 0)
    if sql_to_sal and sql_to_sal < -0.05:
        snapshot_bullets.append(
            f"SQL→SAL conversion down {format_percent(abs(sql_to_sal))} from target"
        )
```

### Step 3: Fix Python - More Action Items

**File:** `generate_report_v2.py`

**Function:** `generate_specific_actions()` around line 275

**Issue:** Not generating all 8 action types.

**Current logic:** Has conditions that prevent some actions from being added.

**Fix:** Ensure we always try to generate SQL, SAL, and SQO actions:

```python
def generate_specific_actions(report_data: Dict, detail_data: Dict) -> List[str]:
    """Generate specific, actionable items with owners and expected outcomes."""

    actions = []
    mtd = next(s for s in report_data['scorecard_all_sources'] if s['horizon'] == 'MTD')
    alerts = detail_data['alerts']

    # MQL Stage Action (always check inbound gaps)
    mql_gaps = detail_data.get('inbound_mql_wtd', [])
    if mql_gaps and len(mql_gaps) > 0:
        biggest_mql_gap = mql_gaps[0]
        pocket = f"{biggest_mql_gap['r']}|{biggest_mql_gap['seg']}"
        gap = int(biggest_mql_gap.get('mql_gap', 0))
        if gap > 0:
            actions.append(
                f"*[MQL]* Marketing to launch targeted campaign for {pocket} (need {gap} MQLs) - target 50% gap closure by Friday"
            )

    # SQL Stage Action (check conversion rate)
    sql_to_sal = mtd.get('SQL_to_SAL', 0)
    if sql_to_sal and sql_to_sal < -0.05:
        actions.append(
            f"*[SQL]* Sales leadership to audit SQL qualification criteria - conversion rate down {format_percent(abs(sql_to_sal))} vs target"
        )
    else:
        # Always provide a SQL action even if conversion is okay
        actions.append(
            "*[SQL]* Sales ops to review SQL pipeline velocity - ensure timely follow-up on qualified leads"
        )

    # SAL Stage Action (check conversion rate)
    sal_to_sqo = mtd.get('SAL_to_SQO', 0)
    if sal_to_sqo and sal_to_sqo < 0.2:
        actions.append(
            "*[SAL]* AE team to accelerate SAL→SQO progression with discovery call blitz this week"
        )
    else:
        actions.append(
            "*[SAL]* AE team to maintain SAL→SQO momentum - schedule technical demos for pending SALs"
        )

    # SQO Stage Action (check conversion rate)
    sqo_to_won = mtd.get('SQO_to_Won', 0)
    if sqo_to_won and sqo_to_won < -0.1:
        actions.append(
            f"*[SQO]* Sales ops to identify stuck SQO deals (review conversion funnel) - targeting {format_percent(abs(sqo_to_won))} improvement"
        )
    else:
        actions.append(
            "*[SQO]* Sales leadership to review SQO pipeline health - identify deals needing executive engagement"
        )

    # Won Stage Action (from top gaps)
    top_gaps = detail_data.get('top_variance_mtd', [])
    if top_gaps and len(top_gaps) > 0:
        worst = top_gaps[0]
        pocket = f"{worst['r']}|{worst['seg']}|{worst['src']}"
        gap = abs(worst.get('acv_var', 0))
        if gap > 0:
            actions.append(
                f"*[WON]* Account management to accelerate {pocket} deals - {format_currency(gap)} at risk"
            )

    # Risk Mitigation (from upcoming risk)
    if alerts.get('upcoming_won_risk_next_14_days_count', 0) > 10:
        count = alerts['upcoming_won_risk_next_14_days_count']
        total = alerts.get('upcoming_won_risk_next_14_days_sum', 0)
        actions.append(
            f"*[RISK]* Sales leadership to review {count} at-risk deals (worth {format_currency(total)}) - weekly checkpoints required"
        )

    # Process Fix (from anomalies)
    anomalies = detail_data.get('anomaly_counts', {})
    sal_gt_sql = anomalies.get('rows_sal_gt_sql', 0)
    if sal_gt_sql > 50:
        actions.append(
            f"*[PROCESS]* Data team to investigate {sal_gt_sql} rows where SAL>SQL - likely data entry issue"
        )

    # Opportunity (from bright spots)
    winners = detail_data.get('top_positive_mtd', [])
    if winners and len(winners) > 0:
        best = winners[0]
        pocket = f"{best['r']}|{best['src']}"
        overperf = best.get('acv_var', 0)
        if overperf > 0:
            actions.append(
                f"*[OPPORTUNITY]* Replicate {pocket} success playbook to other regions - generated +{format_currency(overperf)} this month"
            )

    return actions[:8]  # Return top 8 actions
```

### Step 4: Apply Same Fixes to Other CTEs

**Apply the same "remove date from GROUP BY" fix to:**

1. `top_positive_mtd` CTE (around line 95)
2. `top_booked_mtd` CTE (around line 117)

**Before:**
```sql
GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source, date_basis
```

**After:**
```sql
GROUP BY RecordType, OpportunityType, FunnelType, Region, Segment, Source
```

And remove `date_basis AS won_date` from the SELECT (or keep it as a sample date if needed).

### Step 5: Regenerate and Test

1. **Test queries:**
```bash
bq query --use_legacy_sql=false --format=json --dry_run < query_1_improved.sql
bq query --use_legacy_sql=false --format=json --dry_run < query_2_improved.sql
```

2. **Run report:**
```bash
python3 generate_report_v2.py
```

3. **Verify output:**
```bash
cat report_output_v2.json | jq -r '.main_message'
cat report_output_v2.json | jq -r '.thread_message'
```

4. **Check for fixes:**
   - ✅ MTD Biggest Gaps shows 6 DIFFERENT pockets
   - ✅ Snapshot has 3-4 bullets all with • marker
   - ✅ Actions has 8 items covering all stages

## Expected Fixed Output

### Main Message Should Show:
```
*🎯 Today's Snapshot*
• MTD revenue at 58.9% - need $593K to hit target
• WTD deal volume strong at 135.8% (153 wins)
• Pacing up 5.2% vs last month  [or conversion insight]
```

### Thread Should Show:
```
*📉 MTD Biggest Gaps* (ranked by $ impact)
  1. AMER|N/A|AM SOURCED: $120K gap (at 15.0%) - EXPANSION
  2. EMEA|SMB|INBOUND: $85K gap (at 22.0%) - NEW BUSINESS
  3. AMER|STRATEGIC|AE SOURCED: $67K gap (at 35.0%) - R360 NEW LOGO
  ... (6 different pockets, not duplicates)
```

### Actions Should Show 8 Items:
```
*🎬 Actions Required - Next 48 Hours*
  1. *[MQL]* Marketing to launch...
  2. *[SQL]* Sales leadership to audit...
  3. *[SAL]* AE team to accelerate...
  4. *[SQO]* Sales ops to identify...
  5. *[WON]* Account management to accelerate...
  6. *[RISK]* Sales leadership to review...
  7. *[PROCESS]* Data team to investigate...
  8. *[OPPORTUNITY]* Replicate...
```

## Success Criteria

Your fixes are complete when:

1. ✅ MTD Biggest Gaps shows 6 DIFFERENT pockets (not duplicates)
2. ✅ Today's Snapshot has 3-4 bullets with proper • markers
3. ✅ Actions Required has 6-8 items covering MQL, SQL, SAL, SQO, WON stages
4. ✅ All queries execute without errors
5. ✅ Python script runs without errors
6. ✅ Output JSON is properly formatted

## Files to Modify

1. `query_2_improved.sql` - Remove `date_basis` from GROUP BY in variance CTEs
2. `generate_report_v2.py` - Fix snapshot bullets and action generation

## Files to Keep As-Is

- `query_1_improved.sql` (working correctly)
- `README_V2.md` (documentation is fine)

## After Fixes

Once complete:
1. Show me the fixed main message
2. Show me the fixed thread message
3. Confirm all 3 error types are resolved

Good luck! 🚀
