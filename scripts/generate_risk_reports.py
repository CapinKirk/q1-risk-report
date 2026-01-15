#!/usr/bin/env python3
"""
Generate POR and R360 Risk Analysis Reports with Multi-Horizon Time Tracking
Shows top 3 risks per region with MTD, QTD, Rolling 7d, Rolling 30d attainment
"""

import json
import subprocess
from typing import Dict, List, Any, Optional


def run_bigquery(sql_file: str) -> Dict[str, Any]:
    """Execute BigQuery query and return JSON results"""
    cmd = f"bq query --use_legacy_sql=false --format=json < {sql_file}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode != 0:
        raise Exception(f"Query failed: {result.stderr}")

    # Parse the JSON result
    data = json.loads(result.stdout)
    if not data:
        raise Exception("No data returned from query")

    # Extract the JSON string from the first row
    risk_analysis_json = data[0]['risk_analysis_json']
    return json.loads(risk_analysis_json)


def format_currency(amount: Optional[float]) -> str:
    """Format amount as currency (e.g., $344K)"""
    if amount is None:
        return "$0"
    if amount >= 1_000_000:
        return f"${amount/1_000_000:.1f}M"
    elif amount >= 1_000:
        return f"${amount/1_000:.0f}K"
    else:
        return f"${amount:.0f}"


def format_percentage(value: Optional[float], decimals: int = 0) -> str:
    """Format value as percentage"""
    if value is None:
        return "N/A"
    return f"{value * 100:.{decimals}f}%"


def format_attainment(actual: float, target: float, attainment: Optional[float]) -> str:
    """Format attainment as 'actual/target (percent%)'"""
    actual_int = int(actual) if actual == int(actual) else actual
    target_int = int(target) if target == int(target) else target

    if target == 0:
        return f"{actual_int}/0"

    pct = format_percentage(attainment)
    return f"{actual_int}/{target_int} ({pct})"


def get_attainment_indicator(attainment: Optional[float]) -> str:
    """Return emoji indicator based on attainment level"""
    if attainment is None:
        return ""
    if attainment >= 1.0:  # At or above target
        return "✓"
    elif attainment >= 0.8:  # 80-99%
        return ""
    elif attainment >= 0.5:  # 50-79%
        return "⚠️"
    else:  # Below 50%
        return "🔴"


def get_trend_emoji(trend: Optional[str]) -> str:
    """Return emoji for trend direction"""
    if trend == 'improving':
        return "⬆️"
    elif trend == 'declining':
        return "⬇️"
    elif trend == 'stable':
        return "➡️"
    return ""


def format_horizon_section(horizon_name: str, date_range: str, data: Dict[str, Any]) -> List[str]:
    """Format a single time horizon section"""
    lines = []
    lines.append(f"\n📊 {horizon_name} ({date_range}):")

    # MQL
    mql_att = format_attainment(data.get('actual_mql', 0), data.get('target_mql', 0), data.get('mql_attainment'))
    mql_ind = get_attainment_indicator(data.get('mql_attainment'))
    lines.append(f"  • MQL: {mql_att} {mql_ind}")

    # SQL
    sql_att = format_attainment(data.get('actual_sql', 0), data.get('target_sql', 0), data.get('sql_attainment'))
    sql_ind = get_attainment_indicator(data.get('sql_attainment'))
    lines.append(f"  • SQL: {sql_att} {sql_ind}")

    # SAL removed due to data quality issues - funnel is now MQL/EQL → SQL → SQO → Won → ACV

    # SQO
    sqo_att = format_attainment(data.get('actual_sqo', 0), data.get('target_sqo', 0), data.get('sqo_attainment'))
    sqo_ind = get_attainment_indicator(data.get('sqo_attainment'))
    lines.append(f"  • SQO: {sqo_att} {sqo_ind}")

    # Won
    won_att = format_attainment(data.get('actual_won', 0), data.get('target_won', 0), data.get('won_attainment'))
    won_ind = get_attainment_indicator(data.get('won_attainment'))
    lines.append(f"  • Won: {won_att} {won_ind}")

    # ACV
    acv_att = format_attainment(data.get('actual_acv', 0), data.get('target_acv', 0), data.get('acv_attainment'))
    acv_ind = get_attainment_indicator(data.get('acv_attainment'))
    lines.append(f"  • ACV: {format_currency(data.get('actual_acv', 0))}/{format_currency(data.get('target_acv', 0))} ({format_percentage(data.get('acv_attainment'))}) {acv_ind}")

    return lines


def format_global_target_summary(data: Dict[str, Any]) -> List[str]:
    """Format the global target validation summary section"""
    lines = []
    summary = data.get('global_target_summary', {})

    if not summary:
        return lines

    lines.append("")
    lines.append("="*60)
    lines.append("🎯 GLOBAL NEW LOGO SMB TARGET VALIDATION")
    lines.append("="*60)

    # Annual target comparison
    expected_annual = summary.get('expected_annual_target', 0)
    sop_annual = summary.get('sop_annual_target', 0)
    annual_variance = summary.get('annual_target_variance', 0)
    annual_status = summary.get('annual_validation_status', 'N/A')

    lines.append(f"\n📊 Annual Target Check:")
    lines.append(f"  • Expected (2026 Plan): {format_currency(expected_annual)}")
    lines.append(f"  • SOP Regional Sum:     {format_currency(sop_annual)}")
    lines.append(f"  • Variance:             {format_currency(annual_variance)} {'✓' if annual_status == 'OK' else '⚠️ MISMATCH'}")

    # Q1 target comparison
    expected_q1 = summary.get('expected_q1_target', 0)
    sop_q1 = summary.get('sop_q1_target', 0)
    q1_variance = summary.get('q1_target_variance', 0)

    lines.append(f"\n📊 Q1 Target Check:")
    lines.append(f"  • Expected (Q1 Plan):   {format_currency(expected_q1)}")
    lines.append(f"  • SOP Regional Sum:     {format_currency(sop_q1)}")
    lines.append(f"  • Variance:             {format_currency(q1_variance)}")

    # Per-source validation details
    source_validation = summary.get('source_validation', [])
    if source_validation:
        lines.append(f"\n📋 Per-Source Validation:")
        for sv in source_validation:
            source = sv.get('source', 'N/A')
            expected = sv.get('expected_annual_acv', 0)
            sop = sv.get('sop_annual_acv', 0)
            variance = sv.get('annual_variance', 0)
            status = sv.get('validation_status', 'N/A')
            status_icon = '✓' if status == 'OK' else '⚠️'
            lines.append(f"  • {source:15s}: Expected {format_currency(expected):>8s} | SOP {format_currency(sop):>8s} | Var {format_currency(variance):>8s} {status_icon}")

    return lines


def format_expansion_rollup_status(data: Dict[str, Any]) -> List[str]:
    """Format the expansion rollup status section showing which regions have EXPANSION filtered"""
    lines = []
    expansion_status = data.get('expansion_rollup_status', [])

    if not expansion_status:
        return lines

    lines.append("")
    lines.append("="*60)
    lines.append("📈 EXPANSION ROLLUP STATUS BY REGION")
    lines.append("="*60)
    lines.append("(EXPANSION detail rows excluded from top risks when rollup >= 100%)")
    lines.append("")

    for exp in expansion_status:
        region = exp.get('region', 'N/A')
        target = exp.get('expansion_target_acv', 0)
        actual = exp.get('expansion_actual_acv', 0)
        attainment = exp.get('expansion_attainment', 0)
        at_target = exp.get('expansion_at_target', False)
        filter_status = exp.get('filter_status', 'N/A')

        attainment_pct = format_percentage(attainment)
        status_icon = '✓' if at_target else '⚠️'

        lines.append(f"  {region}: {format_currency(actual)}/{format_currency(target)} ({attainment_pct}) {status_icon}")
        lines.append(f"      → {filter_status}")

    return lines


def format_trend_summary(trends: Dict[str, Any], mtd: Dict[str, Any], r7d: Dict[str, Any]) -> List[str]:
    """Format trend analysis summary comparing rolling 7d to MTD"""
    lines = []
    lines.append("\n📈 Trend Analysis (Rolling 7d vs MTD):")

    # MQL trend
    mql_trend = trends.get('mql_trend', 'stable')
    mql_emoji = get_trend_emoji(mql_trend)
    mtd_mql_att = mtd.get('mql_attainment')
    r7d_mql_att = r7d.get('mql_attainment')
    if mtd_mql_att is not None and r7d_mql_att is not None:
        lines.append(f"  • MQL: {mql_emoji} {mql_trend.title()} (7d: {format_percentage(r7d_mql_att)} vs MTD: {format_percentage(mtd_mql_att)})")

    # Won trend
    won_trend = trends.get('won_trend', 'stable')
    won_emoji = get_trend_emoji(won_trend)
    mtd_won_att = mtd.get('won_attainment')
    r7d_won_att = r7d.get('won_attainment')
    if mtd_won_att is not None and r7d_won_att is not None:
        lines.append(f"  • Won: {won_emoji} {won_trend.title()} (7d: {format_percentage(r7d_won_att)} vs MTD: {format_percentage(mtd_won_att)})")
    elif mtd.get('target_won', 0) == 0 and r7d.get('target_won', 0) == 0:
        lines.append(f"  • Won: No targets in period")

    # ACV trend
    acv_trend = trends.get('acv_trend', 'stable')
    acv_emoji = get_trend_emoji(acv_trend)
    mtd_acv_att = mtd.get('acv_attainment')
    r7d_acv_att = r7d.get('acv_attainment')
    if mtd_acv_att is not None and r7d_acv_att is not None:
        lines.append(f"  • ACV: {acv_emoji} {acv_trend.title()} (7d: {format_percentage(r7d_acv_att)} vs MTD: {format_percentage(mtd_acv_att)})")

    return lines


def format_risk(risk: Dict[str, Any], rank: int, date_windows: Dict[str, Any]) -> str:
    """Format a single risk with all 4 time horizons"""
    funnel_type = risk.get('funnel_type', 'N/A')
    source = risk.get('source', 'N/A')
    segment = risk.get('segment', 'N/A')
    annual_acv_gap = risk.get('annual_acv_gap', 0) or 0

    output = []
    output.append(f"\n{'─'*60}")
    output.append(f"🔴 *Risk #{rank}*")
    output.append(f"📍 {funnel_type} | {source} | {segment}")
    output.append(f"💰 {format_currency(annual_acv_gap)} annual target gap")

    # Get time horizon data
    mtd = risk.get('mtd', {})
    qtd = risk.get('qtd', {})
    r7d = risk.get('rolling_7d', {})
    r30d = risk.get('rolling_30d', {})
    trends = risk.get('trends', {})

    # Format date ranges for display
    as_of = date_windows.get('as_of_date', '2026-01-10')
    mtd_start = date_windows.get('mtd_start', '2026-01-01')
    qtd_start = date_windows.get('qtd_start', '2026-01-01')
    r7d_start = date_windows.get('rolling_7d_start', '2026-01-03')
    r30d_start = date_windows.get('rolling_30d_start', '2025-12-11')

    # MTD Section
    mtd_range = f"{mtd_start} to {as_of}"
    output.extend(format_horizon_section("MTD Attainment", mtd_range, mtd))

    # QTD Section
    qtd_range = f"{qtd_start} to {as_of}"
    output.extend(format_horizon_section("QTD Attainment", qtd_range, qtd))

    # Rolling 7d Section
    r7d_range = f"{r7d_start} to {as_of}"
    output.extend(format_horizon_section("Rolling 7d Attainment", r7d_range, r7d))

    # Rolling 30d Section
    r30d_range = f"{r30d_start} to {as_of}"
    output.extend(format_horizon_section("Rolling 30d Attainment", r30d_range, r30d))

    # Trend Summary
    output.extend(format_trend_summary(trends, mtd, r7d))

    return "\n".join(output)


def format_region_risks(region: str, risks: List[Dict[str, Any]], date_windows: Dict[str, Any]) -> str:
    """Format all risks for a region"""
    if not risks:
        return f"\n{'='*60}\n{region}: No risks identified\n{'='*60}"

    output = []
    output.append(f"\n{'='*60}")
    output.append(f"📌 {region} - Top {len(risks)} Risks by Annual ACV Gap")
    output.append(f"{'='*60}")

    for i, risk in enumerate(risks, 1):
        output.append(format_risk(risk, i, date_windows))

    return "\n".join(output)


def generate_report(data: Dict[str, Any], product: str) -> str:
    """Generate formatted risk report with multiple time horizons"""
    output = []

    # Header
    output.append("="*60)
    output.append(f"📊 {product} Risk Analysis Report")
    output.append("   Multi-Horizon Attainment Tracking")
    output.append("="*60)
    output.append(f"Generated: {data.get('generated_at_utc', 'N/A')}")
    output.append(f"As of Date: {data.get('as_of_date', 'N/A')}")
    output.append(f"Actuals Source: {data.get('actuals_source', data.get('actuals_date_basis', 'N/A'))}")

    # Date windows info
    date_windows = data.get('date_windows', {})
    output.append("")
    output.append("📅 Time Windows:")
    output.append(f"  • MTD: {date_windows.get('mtd_start', 'N/A')} to {date_windows.get('as_of_date', 'N/A')}")
    output.append(f"  • QTD: {date_windows.get('qtd_start', 'N/A')} to {date_windows.get('as_of_date', 'N/A')}")
    output.append(f"  • Rolling 7d: {date_windows.get('rolling_7d_start', 'N/A')} to {date_windows.get('as_of_date', 'N/A')}")
    output.append(f"  • Rolling 30d: {date_windows.get('rolling_30d_start', 'N/A')} to {date_windows.get('as_of_date', 'N/A')}")
    output.append("="*60)

    output.append("")
    output.append("🎯 Legend:")
    output.append("  ✓ = At or above target | ⚠️ = 50-79% | 🔴 = Below 50%")
    output.append("  ⬆️ = Improving | ⬇️ = Declining | ➡️ = Stable")
    output.append("")
    output.append("📋 Funnel Stages: MQL/EQL → SQL → SQO → Won → ACV")
    output.append("   (SAL removed due to data quality issues)")

    # Global Target Validation Summary (R360 only)
    if product == 'R360':
        output.extend(format_global_target_summary(data))
        output.extend(format_expansion_rollup_status(data))

    # Process each region
    top_risks = data.get('top_risks_by_region', {})
    for region in ['AMER', 'EMEA', 'APAC']:
        risks = top_risks.get(region, [])
        output.append(format_region_risks(region, risks, date_windows))

    return "\n".join(output)


def main():
    """Main execution"""
    print("Generating POR and R360 Risk Analysis Reports...")
    print("With Multi-Horizon Attainment Tracking (MTD/QTD/7d/30d)")
    print("=" * 60)

    # Generate POR report
    print("\n1. Running POR Risk Analysis Query...")
    try:
        por_data = run_bigquery("query_por_risk_analysis.sql")
        por_report = generate_report(por_data, "POR")

        # Save to file
        with open("report_por_risks.txt", "w") as f:
            f.write(por_report)
        print("   ✓ POR report saved to: report_por_risks.txt")
    except Exception as e:
        print(f"   ✗ POR report failed: {e}")

    # Generate R360 report
    print("\n2. Running R360 Risk Analysis Query...")
    try:
        r360_data = run_bigquery("query_r360_risk_analysis.sql")
        r360_report = generate_report(r360_data, "R360")

        # Save to file
        with open("report_r360_risks.txt", "w") as f:
            f.write(r360_report)
        print("   ✓ R360 report saved to: report_r360_risks.txt")
    except Exception as e:
        print(f"   ✗ R360 report failed: {e}")

    print("\n" + "=" * 60)
    print("Risk Analysis Reports Complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
