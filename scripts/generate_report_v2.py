#!/usr/bin/env python3
"""
Enhanced Daily Revenue Operations Report Generator V2
=====================================================
Generates executive-friendly Slack messages with actionable insights,
trend analysis, and specific recommendations.

Key Improvements from V1:
- Executive summary with key takeaways
- Trend indicators (↑↓→) throughout
- Specific action items with owners and outcomes
- $ sums for all alerts
- Better context around every number
- Improved Slack formatting
"""

import json
import subprocess
import sys
from datetime import datetime
from typing import Dict, List, Any


def format_currency(value: float) -> str:
    """Format currency as whole dollars with K/M suffix."""
    if abs(value) >= 1_000_000:
        return f"${value/1_000_000:.1f}M"
    elif abs(value) >= 1_000:
        return f"${value/1_000:.0f}K"
    else:
        return f"${value:,.0f}"


def format_percent(value: float, decimals: int = 1) -> str:
    """Format percentage with specified decimals."""
    if value is None:
        return "N/A"
    return f"{value*100:.{decimals}f}%"


def get_trend_arrow(trend: str) -> str:
    """Convert trend indicator to arrow emoji."""
    if trend == 'improving':
        return '↑'
    elif trend == 'worsening':
        return '↓'
    else:
        return '→'


def run_bigquery_query(query_file: str) -> Dict[str, Any]:
    """Execute BigQuery query and return parsed JSON result."""
    print(f"Running BigQuery query: {query_file}")

    try:
        # Read query file
        with open(query_file, 'r') as f:
            query = f.read()

        # Execute via bq CLI
        result = subprocess.run(
            ['bq', 'query', '--use_legacy_sql=false', '--format=json'],
            input=query,
            text=True,
            capture_output=True,
            check=True
        )

        # Parse JSON output
        rows = json.loads(result.stdout)
        if not rows:
            raise ValueError(f"No results returned from {query_file}")

        # Extract the JSON payload column (first column in first row)
        first_column_name = list(rows[0].keys())[0]
        payload_json = rows[0][first_column_name]

        return json.loads(payload_json)

    except subprocess.CalledProcessError as e:
        print(f"BigQuery error: {e.stderr}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"Error running query {query_file}: {e}", file=sys.stderr)
        raise


def generate_main_message(report_data: Dict, detail_data: Dict) -> str:
    """Generate executive-friendly main Slack message (<1800 chars)."""

    # Extract key metrics
    wtd = next(s for s in report_data['scorecard_all_sources'] if s['horizon'] == 'WTD')
    mtd = next(s for s in report_data['scorecard_all_sources'] if s['horizon'] == 'MTD')

    # Calculate gaps
    wtd_gap = wtd['Target_ACV'] - wtd['Actual_ACV']
    mtd_gap = mtd['Target_ACV'] - mtd['Actual_ACV']

    # Get trend arrows
    wtd_trend = get_trend_arrow(wtd.get('Revenue_Trend', 'stable'))
    mtd_trend = get_trend_arrow(mtd.get('Revenue_Trend', 'stable'))

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

    # Top constraint
    worst_stage = mtd['Worst_Slippage']['stage']
    worst_value = mtd['Worst_Slippage']['value']
    top_constraint = f"{worst_stage} stage slipping {format_currency(abs(worst_value))}"

    # Critical alerts (top 3 most urgent)
    alerts = detail_data['alerts']
    alert_bullets = []

    # Past due deals
    if alerts['past_due_under_pacing_count'] > 0:
        alert_bullets.append(
            f"*{alerts['past_due_under_pacing_count']} past due deals* worth {format_currency(alerts['past_due_under_pacing_sum'])} need immediate attention"
        )

    # Upcoming risk
    if alerts['upcoming_won_risk_next_14_days_count'] > 0:
        alert_bullets.append(
            f"*{alerts['upcoming_won_risk_next_14_days_count']} at-risk deals* (next 14d) totaling {format_currency(alerts['upcoming_won_risk_next_14_days_sum'])}"
        )

    # Missed lead windows
    if alerts['missed_lead_window_count'] > 50:  # Only show if significant
        alert_bullets.append(
            f"*{alerts['missed_lead_window_count']} missed lead windows* ({format_currency(alerts['missed_lead_window_sum'])} revenue impact)"
        )

    # Key insight (data-driven observation)
    key_insight = generate_key_insight(report_data, detail_data)

    # Build message
    wtd_rev_pacing = wtd.get('Revenue_Pacing_Score', 0) or 0
    mtd_rev_pacing = mtd.get('Revenue_Pacing_Score', 0) or 0

    message = f"""*Daily Revenue Performance Report*
{report_data['as_of_date']} | {report_data['percentile']} targets | Week starts {report_data['week_starts_on']}

*🎯 Today's Snapshot*
{'• ' + f'{chr(10)}• '.join(snapshot_bullets[:4])}

*📊 Pacing vs Target*
• WTD: {format_currency(wtd.get('Actual_ACV', 0))} of {format_currency(wtd.get('Target_ACV', 0))} ({format_percent(wtd_rev_pacing)} {wtd_trend}) | {int(wtd.get('Actual_Won', 0))}/{int(wtd.get('Target_Won', 0))} wins
• MTD: {format_currency(mtd.get('Actual_ACV', 0))} of {format_currency(mtd.get('Target_ACV', 0))} ({format_percent(mtd_rev_pacing)} {mtd_trend}) | {int(mtd.get('Actual_Won', 0))}/{int(mtd.get('Target_Won', 0))} wins

*🚨 Top Constraint*
• {top_constraint}

*⚠️ Critical Alerts*
{chr(10).join(f'• {bullet}' for bullet in alert_bullets[:3])}

*💡 Key Insight*
• {key_insight}

→ Thread below for detailed breakdowns and actions"""

    return message


def generate_key_insight(report_data: Dict, detail_data: Dict) -> str:
    """Generate a data-driven insight that explains the 'why'."""

    mtd = next(s for s in report_data['scorecard_all_sources'] if s['horizon'] == 'MTD')

    # Check for conversion rate issues
    if mtd.get('SQL_to_SAL', 0) < -0.1:
        return f"SQL→SAL conversion down {format_percent(abs(mtd['SQL_to_SAL']))} - sales team may need more qualified leads"

    # Check for top performers driving results
    top_deals = detail_data.get('top_positive_mtd', [])
    if top_deals:
        top_source = top_deals[0]['src']
        top_region = top_deals[0]['r']
        return f"{top_region}|{top_source} driving wins this month - replicate success in other regions"

    # Check for geographic concentration
    worst_pockets = report_data.get('worst_revenue_pacing_by_horizon', {}).get('MTD', [])
    if worst_pockets:
        worst_region = worst_pockets[0]['r']
        worst_gap = worst_pockets[0].get('ACV_Gap', 0)
        return f"{worst_region} struggling with {format_currency(worst_gap)} gap - may need pipeline acceleration"

    # Default insight
    return f"MTD pacing at {format_percent(mtd['Revenue_Pacing_Score'])} requires focused execution to close gap"


def generate_thread_message(report_data: Dict, detail_data: Dict) -> str:
    """Generate comprehensive thread message with detailed breakdowns."""

    sections = []

    # === MTD Biggest Gaps (ranked by $ impact) ===
    sections.append("*📉 MTD Biggest Gaps* (ranked by $ impact)")
    for i, item in enumerate(detail_data.get('top_variance_mtd', [])[:6], 1):
        pocket = f"{item['r']}|{item['seg']}|{item['src']}"
        gap = abs(item['acv_var'])
        pacing = format_percent(item['a_acv'] / item['t_acv'] if item['t_acv'] > 0 else 0)
        sections.append(
            f"  {i}. {pocket}: {format_currency(gap)} gap (at {pacing}) - {item['ft']}"
        )
    sections.append("")

    # === MTD Wins (learn from success) ===
    sections.append("*📈 MTD Wins* (learn from success)")
    for i, item in enumerate(detail_data.get('top_positive_mtd', [])[:3], 1):
        pocket = f"{item['r']}|{item['seg']}|{item['src']}"
        overperformance = item['acv_var']
        pacing = format_percent(item['a_acv'] / item['t_acv'] if item['t_acv'] > 0 else 0)
        sections.append(
            f"  {i}. {pocket}: +{format_currency(overperformance)} ({pacing} to target) - {item['ft']}"
        )
    sections.append("")

    # === MTD Top Performers (celebrate) ===
    sections.append("*🏆 MTD Top Performers* (celebrate)")
    for i, item in enumerate(detail_data.get('top_booked_mtd', [])[:6], 1):
        pocket = f"{item['r']}|{item['seg']}|{item['src']}"
        booked = item['a_acv']
        sections.append(
            f"  {i}. {pocket}: {format_currency(booked)} booked - {item['ft']}"
        )
    sections.append("")

    # === Inbound MQL WTD Status ===
    sections.append("*🎣 Inbound MQL WTD Status*")
    for i, item in enumerate(detail_data.get('inbound_mql_wtd', [])[:6], 1):
        pocket = f"{item['r']}|{item['seg']}"
        attainment = format_percent(item.get('mql_attainment', 0))
        gap = int(item.get('mql_gap', 0))
        sections.append(
            f"  {i}. {pocket}: {int(item['a_mql'])}/{int(item['t_mql'])} ({attainment}) - {gap} gap"
        )
    sections.append("")

    # === Region Summary (MTD) ===
    sections.append("*🌍 Region Summary - MTD*")
    region_summary = report_data.get('region_summary_mtd', [])
    if region_summary:
        for item in region_summary:
            region = item.get('region', 'N/A')
            actual = format_currency(item.get('Actual_ACV', 0))
            target = format_currency(item.get('Target_ACV', 0))
            pacing = format_percent(item.get('Revenue_Pacing', 0))
            gap = format_currency(item.get('ACV_Gap', 0))
            wins = f"{int(item.get('Actual_Won', 0))}/{int(item.get('Target_Won', 0))}"
            trend = "✓" if item.get('Revenue_Pacing', 0) >= 0.9 else "⚠️" if item.get('Revenue_Pacing', 0) >= 0.7 else "🔴"
            sections.append(
                f"  {trend} *{region}*: {actual} of {target} ({pacing}) | {wins} wins | {gap} gap"
            )
    else:
        sections.append("  No region data available")
    sections.append("")

    # === OpportunityType Summary (MTD) ===
    sections.append("*🎯 Product Performance - MTD*")
    opp_type_summary = report_data.get('opportunity_type_summary_mtd', [])
    if opp_type_summary:
        for item in opp_type_summary:
            opp_type = item.get('opp_type', 'N/A')
            actual = format_currency(item.get('Actual_ACV', 0))
            target = format_currency(item.get('Target_ACV', 0))
            pacing = format_percent(item.get('Revenue_Pacing', 0))
            gap = format_currency(item.get('ACV_Gap', 0))
            wins = f"{int(item.get('Actual_Won', 0))}/{int(item.get('Target_Won', 0))}"
            trend = "✓" if item.get('Revenue_Pacing', 0) >= 0.9 else "⚠️" if item.get('Revenue_Pacing', 0) >= 0.7 else "🔴"
            sections.append(
                f"  {trend} *{opp_type}*: {actual} of {target} ({pacing}) | {wins} wins | {gap} gap"
            )
    else:
        sections.append("  No opportunity type data available")
    sections.append("")

    # === Actions Required - Next 48 Hours ===
    sections.append("*🎬 Actions Required - Next 48 Hours*")
    actions = generate_specific_actions(report_data, detail_data)
    for i, action in enumerate(actions, 1):
        sections.append(f"  {i}. {action}")
    sections.append("")

    # === Alert Details ===
    alerts = detail_data['alerts']
    sections.append("*📋 Alert Details*")
    sections.append(f"• Past due under pacing: {alerts['past_due_under_pacing_count']} deals totaling {format_currency(alerts['past_due_under_pacing_sum'])}")
    sections.append(f"• Missed lead windows: {alerts['missed_lead_window_count']} opportunities ({format_currency(alerts['missed_lead_window_sum'])} impact)")
    sections.append(f"• At-risk (next 14d): {alerts['upcoming_won_risk_next_14_days_count']} deals worth {format_currency(alerts['upcoming_won_risk_next_14_days_sum'])}")
    sections.append("")

    # === Data Quality Notes ===
    sections.append("*🔍 Data Quality Notes*")
    anomalies = detail_data['anomaly_counts']
    total_anomalies = (anomalies['rows_sal_gt_sql'] +
                      anomalies['rows_sqo_gt_sal'] +
                      anomalies['rows_won_gt_sqo'])

    if total_anomalies > 0:
        sections.append(f"• Anomalies (MTD): SAL>SQL {anomalies['rows_sal_gt_sql']}, SQO>SAL {anomalies['rows_sqo_gt_sal']}, WON>SQO {anomalies['rows_won_gt_sqo']}")
    else:
        sections.append("• All clear - no data anomalies detected")

    sections.append(f"• Actual ACV basis: {detail_data['actuals_date_basis']}")
    sections.append(f"• Generated: {detail_data['generated_at_utc']}")

    return "\n".join(sections)


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


def main():
    """Main execution flow."""
    print("=" * 80)
    print("Enhanced Daily Revenue Operations Report Generator V2")
    print("=" * 80)
    print()

    try:
        # Run queries
        print("Step 1: Running BigQuery queries...")
        report_data = run_bigquery_query('query_1_improved.sql')
        detail_data = run_bigquery_query('query_2_improved.sql')
        print("✓ Queries executed successfully\n")

        # Generate messages
        print("Step 2: Generating Slack messages...")
        main_message = generate_main_message(report_data, detail_data)
        thread_message = generate_thread_message(report_data, detail_data)
        print("✓ Messages generated successfully\n")

        # Read query files for output
        with open('query_1_improved.sql', 'r') as f:
            query_1_sql = f.read()
        with open('query_2_improved.sql', 'r') as f:
            query_2_sql = f.read()

        # Build output
        output = {
            "main_message": main_message,
            "thread_message": thread_message,
            "report_payload_json": json.dumps(report_data),
            "detail_payload_json": json.dumps(detail_data),
            "query_1_sql": query_1_sql,
            "query_2_sql": query_2_sql,
            "errors": []
        }

        # Write to file
        output_file = 'report_output_v2.json'
        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)

        print(f"Step 3: Output written to {output_file}")
        print()
        print("=" * 80)
        print("MAIN MESSAGE PREVIEW:")
        print("=" * 80)
        print(main_message)
        print()
        print("=" * 80)
        print("THREAD MESSAGE PREVIEW:")
        print("=" * 80)
        print(thread_message)
        print()
        print("=" * 80)
        print(f"✓ Report generation complete!")
        print(f"✓ Full output saved to: {output_file}")
        print("=" * 80)

        return 0

    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
