#!/usr/bin/env python3
"""
Enhanced Top of Funnel Report Generator
========================================
Executes BigQuery query and generates formatted outputs including:
- JSON structure for API/dashboard consumption
- Formatted table for CLI/terminal display
- Executive summary with key insights

Usage:
  python3 generate_tof_report.py [--output-dir DIR] [--format json|table|all]
"""

import json
import subprocess
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path


# =============================================================================
# FORMATTING UTILITIES
# =============================================================================

def format_currency(value: float, decimals: int = 0) -> str:
    """Format currency with $ prefix and K/M suffix."""
    if value is None:
        return "N/A"
    if abs(value) >= 1_000_000:
        return f"${value/1_000_000:.1f}M"
    elif abs(value) >= 1_000:
        return f"${value/1_000:.{decimals}f}K"
    else:
        return f"${value:,.{decimals}f}"


def format_number(value: float, decimals: int = 0) -> str:
    """Format number with commas."""
    if value is None:
        return "N/A"
    if decimals == 0:
        return f"{int(value):,}"
    return f"{value:,.{decimals}f}"


def format_pct(value: float) -> str:
    """Format percentage value."""
    if value is None:
        return "N/A"
    return f"{int(value)}%"


def get_rag_emoji(pacing: Optional[float]) -> str:
    """Return RAG emoji based on pacing percentage."""
    if pacing is None:
        return "N/A"
    if pacing >= 90:
        return "\u2705"  # Green check
    elif pacing >= 70:
        return "\u26A0\uFE0F"  # Warning
    else:
        return "\uD83D\uDD34"  # Red circle


def get_trend_arrow(trend: str) -> str:
    """Convert trend string to arrow."""
    if trend == 'IMPROVING':
        return "\u2191"  # Up arrow
    elif trend == 'DECLINING':
        return "\u2193"  # Down arrow
    return "\u2192"  # Right arrow


# =============================================================================
# BIGQUERY EXECUTION
# =============================================================================

def run_bigquery_query(query_file: str) -> Dict[str, Any]:
    """Execute BigQuery query and return parsed JSON result."""
    print(f"Executing query: {query_file}")

    try:
        with open(query_file, 'r') as f:
            query = f.read()

        result = subprocess.run(
            ['bq', 'query', '--use_legacy_sql=false', '--format=json'],
            input=query,
            text=True,
            capture_output=True,
            check=True
        )

        rows = json.loads(result.stdout)
        if not rows:
            raise ValueError(f"No results returned from {query_file}")

        first_column_name = list(rows[0].keys())[0]
        payload_json = rows[0][first_column_name]

        return json.loads(payload_json)

    except subprocess.CalledProcessError as e:
        print(f"BigQuery error: {e.stderr}", file=sys.stderr)
        raise
    except Exception as e:
        print(f"Error running query {query_file}: {e}", file=sys.stderr)
        raise


# =============================================================================
# REPORT FORMATTERS
# =============================================================================

def generate_executive_summary(data: Dict) -> str:
    """Generate executive summary with key insights."""
    lines = []
    lines.append("=" * 80)
    lines.append("TOP OF FUNNEL PACING REPORT - EXECUTIVE SUMMARY")
    lines.append(f"Generated: {data['generated_at']}")
    lines.append(f"Period: {data['period']['start']} to {data['period']['end']} ({data['period']['days_elapsed']} days)")
    lines.append("=" * 80)
    lines.append("")

    # Google Ads Summary
    lines.append("GOOGLE ADS PERFORMANCE (MTD)")
    lines.append("-" * 40)

    for product in ['POR', 'R360']:
        ga = data['google_ads'].get(product, {})
        if ga:
            lines.append(f"{product}:")
            lines.append(f"  Impressions: {format_number(ga.get('impressions', 0))}")
            lines.append(f"  Clicks: {format_number(ga.get('clicks', 0))} (CTR: {ga.get('ctr_pct', 0):.2f}%)")
            lines.append(f"  Spend: {format_currency(ga.get('ad_spend_usd', 0), 2)}")
            lines.append(f"  Conversions: {format_number(ga.get('conversions', 0))}")
            lines.append(f"  CPC: {format_currency(ga.get('cpc_usd', 0), 2)} | CPA: {format_currency(ga.get('cpa_usd', 0), 2)}")
            lines.append("")

    # Funnel Pacing Summary
    lines.append("INBOUND FUNNEL PACING (MTD)")
    lines.append("-" * 40)

    for product in ['POR', 'R360']:
        fm = data['funnel_metrics'].get(product, {})
        summary = fm.get('summary', {})
        if summary:
            lines.append(f"{product} Total:")
            lines.append(f"  MQL: {format_number(summary.get('actual_mql', 0))}/{format_number(summary.get('target_mql', 0))} ({format_pct(summary.get('mql_pacing_pct'))})")
            lines.append(f"  SQL: {format_number(summary.get('actual_sql', 0))}/{format_number(summary.get('target_sql', 0))} ({format_pct(summary.get('sql_pacing_pct'))})")
            lines.append(f"  SQO: {format_number(summary.get('actual_sqo', 0))}/{format_number(summary.get('target_sqo', 0))} ({format_pct(summary.get('sqo_pacing_pct'))})")
            lines.append(f"  Won: {format_number(summary.get('actual_won', 0))}/{format_number(summary.get('target_won', 0))} ({format_pct(summary.get('won_pacing_pct'))})")
            lines.append(f"  ACV: {format_currency(summary.get('actual_acv', 0))}/{format_currency(summary.get('target_acv', 0))} ({format_pct(summary.get('acv_pacing_pct'))})")
            lines.append("")

    # Attribution Metrics
    lines.append("MARKETING ATTRIBUTION (MTD)")
    lines.append("-" * 40)

    for product in ['POR', 'R360']:
        attr = data['attribution'].get(product, {})
        if attr:
            lines.append(f"{product}:")
            lines.append(f"  Cost per MQL: {format_currency(attr.get('cost_per_mql', 0), 2)}")
            lines.append(f"  Cost per SQL: {format_currency(attr.get('cost_per_sql', 0), 2)}")
            lines.append(f"  Cost per Won: {format_currency(attr.get('cost_per_won', 0), 2)}")
            lines.append(f"  Marketing ROI: {attr.get('marketing_roi', 0):.2f}x")
            lines.append("")

    # Alerts
    insights = data.get('insights', {})
    alerts = insights.get('alerts', {})

    critical_count = len(alerts.get('critical_mql_zero', [])) + len(alerts.get('critical_won_zero', []))
    warning_count = len(alerts.get('warning_mql_low', [])) + len(alerts.get('warning_won_low', [])) + len(alerts.get('warning_cpa_high', []))

    lines.append("ALERTS & INSIGHTS")
    lines.append("-" * 40)

    if critical_count > 0:
        lines.append(f"CRITICAL ({critical_count}):")
        for alert in alerts.get('critical_mql_zero', []):
            lines.append(f"  - {alert['product']} {alert['region']}: MQL at 0% pacing")
        for alert in alerts.get('critical_won_zero', []):
            lines.append(f"  - {alert['product']} {alert['region']}: Won at 0% pacing")

    if warning_count > 0:
        lines.append(f"WARNINGS ({warning_count}):")
        for alert in alerts.get('warning_mql_low', []):
            lines.append(f"  - {alert['product']} {alert['region']}: MQL at {format_pct(alert['pacing'])} (gap: {format_number(alert['gap'])})")
        for alert in alerts.get('warning_won_low', []):
            lines.append(f"  - {alert['product']} {alert['region']}: Won at {format_pct(alert['pacing'])} (gap: {format_number(alert['gap'])})")
        for alert in alerts.get('warning_cpa_high', []):
            lines.append(f"  - {alert['product']}: CPA at {format_currency(alert['cpa_usd'], 2)} (>$500)")

    # Wins
    wins_mql = alerts.get('wins_mql_exceeding', [])
    wins_sql = alerts.get('wins_sql_exceeding', [])
    if wins_mql or wins_sql:
        lines.append(f"WINS:")
        for win in wins_mql:
            lines.append(f"  - {win['product']} {win['region']}: MQL at {format_pct(win['pacing'])} (exceeding target)")
        for win in wins_sql:
            lines.append(f"  - {win['product']} {win['region']}: SQL at {format_pct(win['pacing'])} (exceeding target)")

    # Recommendations
    recommendations = [r for r in insights.get('recommendations', []) if r]
    if recommendations:
        lines.append("")
        lines.append("RECOMMENDATIONS:")
        for rec in recommendations:
            lines.append(f"  - {rec}")

    lines.append("")
    lines.append("=" * 80)

    return "\n".join(lines)


def generate_detailed_table(data: Dict) -> str:
    """Generate detailed table format for terminal display."""
    lines = []
    lines.append("")
    lines.append("=" * 100)
    lines.append("DETAILED PACING BY REGION (MTD)")
    lines.append("=" * 100)
    lines.append("")

    # Header
    header = f"{'Product':<8} {'Region':<8} {'MQL':>12} {'SQL':>12} {'SAL':>12} {'SQO':>12} {'Won':>12} {'ACV':>15}"
    lines.append(header)
    lines.append("-" * 100)

    for product in ['POR', 'R360']:
        regions = data['funnel_metrics'].get(product, {}).get('by_region', [])
        for r in regions:
            mql_str = f"{int(r.get('actual_mql', 0))}/{int(r.get('target_mql', 0))} ({format_pct(r.get('mql_pacing_pct'))})"
            sql_str = f"{int(r.get('actual_sql', 0))}/{int(r.get('target_sql', 0))} ({format_pct(r.get('sql_pacing_pct'))})"
            sal_str = f"{int(r.get('actual_sal', 0))}/{int(r.get('target_sal', 0))} ({format_pct(r.get('sal_pacing_pct'))})"
            sqo_str = f"{int(r.get('actual_sqo', 0))}/{int(r.get('target_sqo', 0))} ({format_pct(r.get('sqo_pacing_pct'))})"
            won_str = f"{int(r.get('actual_won', 0))}/{int(r.get('target_won', 0))} ({format_pct(r.get('won_pacing_pct'))})"
            acv_str = format_currency(r.get('actual_acv', 0))

            rag = get_rag_emoji(r.get('mql_pacing_pct'))
            lines.append(f"{rag} {product:<6} {r.get('region', 'N/A'):<8} {mql_str:>12} {sql_str:>12} {sal_str:>12} {sqo_str:>12} {won_str:>12} {acv_str:>15}")
        lines.append("")

    lines.append("")
    lines.append("=" * 100)
    lines.append("CONVERSION RATES (MTD)")
    lines.append("=" * 100)
    lines.append("")

    benchmarks = data.get('benchmarks', {})
    header = f"{'Product':<8} {'Region':<8} {'MQL>SQL':>12} {'SQL>SAL':>12} {'SAL>SQO':>12} {'SQO>Won':>12} {'MQL>Won':>12}"
    lines.append(header)
    lines.append(f"{'':8} {'Benchmark':<8} {format_pct(benchmarks.get('mql_to_sql', 0)*100):>12} {format_pct(benchmarks.get('sql_to_sal', 0)*100):>12} {format_pct(benchmarks.get('sal_to_sqo', 0)*100):>12} {format_pct(benchmarks.get('sqo_to_won', 0)*100):>12} {'N/A':>12}")
    lines.append("-" * 100)

    for product in ['POR', 'R360']:
        regions = data['funnel_metrics'].get(product, {}).get('by_region', [])
        for r in regions:
            mql_sql = f"{r.get('mql_to_sql_rate', 0) or 0:.1f}%"
            sql_sal = f"{r.get('sql_to_sal_rate', 0) or 0:.1f}%"
            sal_sqo = f"{r.get('sal_to_sqo_rate', 0) or 0:.1f}%"
            sqo_won = f"{r.get('sqo_to_won_rate', 0) or 0:.1f}%"
            mql_won = f"{r.get('mql_to_won_rate', 0) or 0:.1f}%"

            # Flag if below benchmark
            mql_sql_flag = "*" if r.get('mql_to_sql_below_benchmark') else ""
            sql_sal_flag = "*" if r.get('sql_to_sal_below_benchmark') else ""
            sal_sqo_flag = "*" if r.get('sal_to_sqo_below_benchmark') else ""
            sqo_won_flag = "*" if r.get('sqo_to_won_below_benchmark') else ""

            lines.append(f"{product:<8} {r.get('region', 'N/A'):<8} {mql_sql + mql_sql_flag:>12} {sql_sal + sql_sal_flag:>12} {sal_sqo + sal_sqo_flag:>12} {sqo_won + sqo_won_flag:>12} {mql_won:>12}")
        lines.append("")

    lines.append("* = Below benchmark")
    lines.append("")

    # Full Funnel Visualization
    lines.append("=" * 100)
    lines.append("FULL FUNNEL VISUALIZATION (MTD)")
    lines.append("=" * 100)
    lines.append("")

    for product in ['POR', 'R360']:
        ff = data['full_funnel'].get(product, {})
        if ff:
            lines.append(f"{product} Full Funnel:")
            lines.append(f"  Impressions: {format_number(ff.get('impressions', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('impressions_to_clicks_rate', 0):.2f}% CTR)")
            lines.append(f"  Clicks:      {format_number(ff.get('clicks', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('clicks_to_conversions_rate', 0):.2f}%)")
            lines.append(f"  Conversions: {format_number(ff.get('conversions', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('conversions_to_mql_rate', 0):.2f}%)")
            lines.append(f"  MQL:         {format_number(ff.get('actual_mql', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('mql_to_sql_rate', 0):.1f}%)")
            lines.append(f"  SQL:         {format_number(ff.get('actual_sql', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('sql_to_sal_rate', 0):.1f}%)")
            lines.append(f"  SAL:         {format_number(ff.get('actual_sal', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('sal_to_sqo_rate', 0):.1f}%)")
            lines.append(f"  SQO:         {format_number(ff.get('actual_sqo', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v  ({ff.get('sqo_to_won_rate', 0):.1f}%)")
            lines.append(f"  Won:         {format_number(ff.get('actual_won', 0)):>12}")
            lines.append(f"      |")
            lines.append(f"      v")
            lines.append(f"  ACV:         {format_currency(ff.get('actual_acv', 0)):>12}")
            lines.append(f"")
            lines.append(f"  Funnel Efficiency (MQL to Won): {ff.get('funnel_efficiency', 0):.1f}%")
            lines.append("")

    # Forecasting
    lines.append("=" * 100)
    lines.append("MONTH-END FORECAST")
    lines.append("=" * 100)
    lines.append("")

    header = f"{'Product':<8} {'Region':<8} {'Proj MQL':>12} {'Proj SQL':>12} {'Proj SQO':>12} {'Proj Won':>12} {'Proj ACV':>15}"
    lines.append(header)
    lines.append("-" * 100)

    for product in ['POR', 'R360']:
        forecasts = data['forecasting'].get(product, [])
        for f in forecasts:
            lines.append(f"{f.get('product', 'N/A'):<8} {f.get('region', 'N/A'):<8} {format_number(f.get('projected_mql', 0)):>12} {format_number(f.get('projected_sql', 0)):>12} {format_number(f.get('projected_sqo', 0)):>12} {format_number(f.get('projected_won', 0)):>12} {format_currency(f.get('projected_acv', 0)):>15}")
        lines.append("")

    # Trend Analysis
    lines.append("=" * 100)
    lines.append("MONTH-OVER-MONTH TRENDS")
    lines.append("=" * 100)
    lines.append("")

    header = f"{'Product':<8} {'Region':<8} {'MQL Trend':>15} {'SQL Trend':>15} {'SQO Trend':>15} {'Won Trend':>15}"
    lines.append(header)
    lines.append("-" * 100)

    for product in ['POR', 'R360']:
        trends = data['trends'].get(product, [])
        for t in trends:
            mql_arrow = get_trend_arrow(t.get('mql_trend', 'STABLE'))
            sql_arrow = get_trend_arrow(t.get('sql_trend', 'STABLE'))
            sqo_arrow = get_trend_arrow(t.get('sqo_trend', 'STABLE'))
            won_arrow = get_trend_arrow(t.get('won_trend', 'STABLE'))

            mql_chg = t.get('mql_change_pct', 0) or 0
            sql_chg = t.get('sql_change_pct', 0) or 0
            sqo_chg = t.get('sqo_change_pct', 0) or 0
            won_chg = t.get('won_change_pct', 0) or 0

            lines.append(f"{t.get('product', 'N/A'):<8} {t.get('region', 'N/A'):<8} {mql_arrow} {mql_chg:+.1f}%{'':>6} {sql_arrow} {sql_chg:+.1f}%{'':>6} {sqo_arrow} {sqo_chg:+.1f}%{'':>6} {won_arrow} {won_chg:+.1f}%")
        lines.append("")

    lines.append("")

    return "\n".join(lines)


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Generate Enhanced Top of Funnel Report')
    parser.add_argument('--output-dir', '-o', default='.', help='Output directory for report files')
    parser.add_argument('--format', '-f', choices=['json', 'table', 'all'], default='all', help='Output format')
    parser.add_argument('--query-file', '-q', default='query_top_of_funnel_enhanced.sql', help='SQL query file')
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("ENHANCED TOP OF FUNNEL REPORT GENERATOR")
    print("=" * 80)
    print()

    try:
        # Execute query
        print("Step 1: Executing BigQuery query...")
        data = run_bigquery_query(args.query_file)
        print("Query executed successfully")
        print()

        # Generate outputs based on format
        timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')

        if args.format in ['json', 'all']:
            # Save raw JSON
            json_file = output_dir / f"tof_report_{timestamp}.json"
            with open(json_file, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"JSON output saved to: {json_file}")

        if args.format in ['table', 'all']:
            # Generate and save executive summary
            summary = generate_executive_summary(data)
            print()
            print(summary)

            summary_file = output_dir / f"tof_summary_{timestamp}.txt"
            with open(summary_file, 'w') as f:
                f.write(summary)
            print(f"Executive summary saved to: {summary_file}")

            # Generate and save detailed table
            table = generate_detailed_table(data)
            print(table)

            table_file = output_dir / f"tof_detail_{timestamp}.txt"
            with open(table_file, 'w') as f:
                f.write(table)
            print(f"Detailed table saved to: {table_file}")

        print()
        print("=" * 80)
        print("Report generation complete!")
        print("=" * 80)
        return 0

    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
