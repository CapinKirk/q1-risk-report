#!/usr/bin/env python3
"""
Q1 2026 Bookings Risk Analysis HTML Report Generator
Version: 2.7.0

CONSOLIDATED EXECUTIVE REPORT

Structure:
1. Executive Summary - Key metrics at a glance
2. Attainment by Region & Product - Combined ACV view (sorted worst→best)
3. Source Attainment - ACV by channel + Full Funnel (Q1/QTD/Actual/%)
4. Hits & Misses Commentary - RCA on underperformers
5. Pipeline Risk Analysis - Coverage + Age + RCA by region
6. Lost Opportunities - By Product, Region, and Top Loss Reasons
7. Google Ads Performance - Metrics + insights

Usage:
    python generate_html_report.py
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_bigquery():
    """Execute the comprehensive risk analysis query and return JSON result."""
    query_path = Path(__file__).parent / "query_comprehensive_risk_analysis.sql"

    print(f"Running BigQuery query from: {query_path}")

    result = subprocess.run(
        ["bq", "query", "--use_legacy_sql=false", "--format=json"],
        stdin=open(query_path, "r"),
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"Error running BigQuery: {result.stderr}")
        sys.exit(1)

    # Parse the outer JSON array
    outer = json.loads(result.stdout)
    if not outer:
        print("No data returned from query")
        sys.exit(1)

    # Extract the inner JSON string and parse it
    inner_json = outer[0].get("comprehensive_risk_analysis_json", "{}")
    return json.loads(inner_json)


def format_currency(value):
    """Format a number as currency."""
    if value is None:
        return "$0"
    return f"${value:,.0f}"


def format_percent(value):
    """Format a number as percentage."""
    if value is None:
        return "0%"
    return f"{value:.0f}%"


def get_rag_class(rag):
    """Get CSS class for RAG status."""
    return rag.lower() if rag in ["GREEN", "YELLOW", "RED"] else "red"


def get_rag_color(rag):
    """Get color for RAG status."""
    if rag == "GREEN":
        return "#28a745"
    elif rag == "YELLOW":
        return "#ffc107"
    return "#dc3545"


def generate_funnel_narrative(product, region, category_data, source_data, loss_data):
    """Generate narrative commentary for funnel performance by region/product."""

    # Analyze category performance for this region
    cat_strengths = []
    cat_weaknesses = []
    for row in category_data:
        if row.get('region') != region:
            continue
        cat = row.get('category', '')
        stages = []
        if (row.get('qtd_target_mql') or 0) > 0:
            stages.append(('MQL', row.get('mql_pacing_pct') or 0, row.get('mql_gap') or 0))
        if (row.get('qtd_target_sql') or 0) > 0:
            stages.append(('SQL', row.get('sql_pacing_pct') or 0, row.get('sql_gap') or 0))
        if (row.get('qtd_target_sal') or 0) > 0:
            stages.append(('SAL', row.get('sal_pacing_pct') or 0, row.get('sal_gap') or 0))
        if (row.get('qtd_target_sqo') or 0) > 0:
            stages.append(('SQO', row.get('sqo_pacing_pct') or 0, row.get('sqo_gap') or 0))

        for stage, pct, gap in stages:
            if pct >= 100:
                cat_strengths.append(f"{cat} {stage} at {pct:.0f}% (+{gap:.0f})")
            elif pct < 70:
                cat_weaknesses.append(f"{cat} {stage} at {pct:.0f}% ({gap:+.0f})")

    # Analyze source performance for this region
    src_strengths = []
    src_weaknesses = []
    for row in source_data:
        if row.get('region') != region:
            continue
        src = row.get('source', '')
        # Focus on SQO as the key metric for sources
        sqo_pct = row.get('sqo_pacing_pct') or 0
        sqo_gap = row.get('sqo_gap') or 0
        sqo_tgt = row.get('qtd_target_sqo') or 0
        if sqo_tgt > 0:
            if sqo_pct >= 100:
                src_strengths.append(f"{src} SQO at {sqo_pct:.0f}%")
            elif sqo_pct < 70:
                src_weaknesses.append(f"{src} SQO at {sqo_pct:.0f}%")

    # Get top loss reasons for this region
    top_losses = []
    for row in loss_data:
        if row.get('region') == region:
            reason = row.get('loss_reason', 'Unknown')
            acv = row.get('lost_acv', 0) or 0
            if acv > 0:
                top_losses.append(f"{reason} (${acv:,.0f})")

    # Build narrative
    narrative_parts = []

    if cat_strengths:
        narrative_parts.append(f"<strong>Strengths:</strong> {'; '.join(cat_strengths[:3])}")

    if cat_weaknesses:
        narrative_parts.append(f"<strong>Weaknesses:</strong> {'; '.join(cat_weaknesses[:3])}")

    if src_strengths:
        narrative_parts.append(f"<strong>Top Sources:</strong> {'; '.join(src_strengths[:2])}")

    if src_weaknesses:
        narrative_parts.append(f"<strong>Underperforming Sources:</strong> {'; '.join(src_weaknesses[:2])}")

    if top_losses:
        narrative_parts.append(f"<strong>Top Loss Reasons:</strong> {'; '.join(top_losses[:2])}")

    if not narrative_parts:
        return "Insufficient data for analysis."

    return " | ".join(narrative_parts)


def generate_enhanced_rca(product, region, category, funnel_data, source_data, loss_data, pipeline_rca, funnel_rca):
    """Generate enhanced RCA incorporating funnel and loss analysis."""

    rca_parts = []
    action_parts = []

    # Get funnel insights for this region
    funnel_issues = []
    for row in funnel_data:
        if row.get('region') != region:
            continue
        cat = row.get('category', '')
        for stage, pct_key, gap_key in [
            ('MQL', 'mql_pacing_pct', 'mql_gap'),
            ('SQL', 'sql_pacing_pct', 'sql_gap'),
            ('SAL', 'sal_pacing_pct', 'sal_gap'),
            ('SQO', 'sqo_pacing_pct', 'sqo_gap')
        ]:
            pct = row.get(pct_key) or 0
            gap = row.get(gap_key) or 0
            if pct < 70 and gap < -5:
                funnel_issues.append(f"{cat} {stage} at {pct:.0f}%")

    if funnel_issues:
        rca_parts.append(f"Funnel gaps: {', '.join(funnel_issues[:2])}")

    # Get source issues
    source_issues = []
    for row in source_data:
        if row.get('region') != region:
            continue
        src = row.get('source', '')
        sqo_pct = row.get('sqo_pacing_pct') or 0
        if sqo_pct < 70:
            source_issues.append(f"{src} ({sqo_pct:.0f}%)")

    if source_issues:
        rca_parts.append(f"Weak sources: {', '.join(source_issues[:2])}")

    # Get loss analysis
    loss_reasons = []
    for row in loss_data:
        if row.get('region') == region:
            reason = row.get('loss_reason', '')
            count = row.get('deal_count', 0)
            if count >= 2:
                loss_reasons.append(reason)

    if loss_reasons:
        rca_parts.append(f"Top losses: {', '.join(loss_reasons[:2])}")

    # Get existing pipeline/funnel RCA
    for prca in pipeline_rca:
        if prca.get('region') == region:
            existing_rca = prca.get('rca_commentary', '')
            existing_action = prca.get('recommended_action', '')
            if existing_rca and existing_rca not in str(rca_parts):
                rca_parts.append(existing_rca)
            if existing_action:
                action_parts.append(existing_action)
            break

    for frca in funnel_rca:
        if frca.get('region') == region:
            existing_action = frca.get('recommended_action', '')
            if existing_action and existing_action not in str(action_parts):
                action_parts.append(existing_action)
            break

    # Build recommended actions based on issues
    if funnel_issues and 'MQL' in str(funnel_issues):
        action_parts.append("Increase top-of-funnel marketing")
    if funnel_issues and 'SQO' in str(funnel_issues):
        action_parts.append("Improve qualification process")
    if loss_reasons and 'Competitor' in str(loss_reasons):
        action_parts.append("Enhance competitive positioning")
    if loss_reasons and 'Price' in str(loss_reasons):
        action_parts.append("Review pricing strategy")

    rca_text = ". ".join(rca_parts[:3]) if rca_parts else "Analysis in progress"
    action_text = "; ".join(action_parts[:2]) if action_parts else "Review pipeline"

    return rca_text, action_text


def generate_html(data):
    """Generate the CONSOLIDATED HTML report from query data."""

    period = data["period"]
    grand_total = data["grand_total"]
    product_totals = data["product_totals"]
    attainment_detail = data["attainment_detail"]
    funnel_pacing = data["funnel_pacing"]
    funnel_health = data.get("funnel_health", {"POR": [], "R360": []})
    funnel_by_category = data.get("funnel_by_category", {"POR": [], "R360": []})
    funnel_by_source = data.get("funnel_by_source", {"POR": [], "R360": []})
    funnel_rca_insights = data.get("funnel_rca_insights", {"POR": [], "R360": []})
    loss_reason_rca = data.get("loss_reason_rca", {"POR": [], "R360": []})
    source_attainment = data.get("source_attainment", {"POR": [], "R360": []})
    google_ads = data["google_ads"]
    quarterly_targets = data["quarterly_targets"]
    pipeline_rca = data.get("pipeline_rca", {"POR": [], "R360": []})
    google_ads_rca = data.get("google_ads_rca", {"POR": {}, "R360": {}})
    wins_bright_spots = data.get("wins_bright_spots", {"POR": [], "R360": []})
    query_version = data.get("query_version", "2.6.1")

    # Calculate hits and misses
    all_attainment = attainment_detail.get("POR", []) + attainment_detail.get("R360", [])
    hits = [a for a in all_attainment if a.get("rag_status") == "GREEN"]
    misses = [a for a in all_attainment if a.get("rag_status") in ["RED", "YELLOW"]]

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Q1 2026 Risk Report - Consolidated</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            line-height: 1.3;
            color: #333;
            background: #f5f5f5;
            padding: 10px;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        h1 {{ font-size: 18px; color: #1a1a2e; margin-bottom: 4px; }}
        h2 {{ font-size: 14px; color: #16213e; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #0f3460; }}
        h3 {{ font-size: 12px; color: #333; margin: 12px 0 6px; }}
        h4 {{ font-size: 11px; color: #555; margin: 8px 0 4px; }}
        .meta {{ font-size: 10px; color: #666; margin-bottom: 10px; }}
        .meta span {{ margin-right: 12px; }}

        /* Metrics Grid - Compact with Word-friendly spacing */
        .metrics-grid {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 10px 0; }}
        .metric {{ background: #f8f9fa; padding: 8px 6px; border-radius: 4px; text-align: center; border: 1px solid #ccc; border-left: 4px solid #6c757d; margin: 2px; }}
        .metric.green {{ border-left-color: #28a745; background: #d4edda; border-color: #28a745; }}
        .metric.yellow {{ border-left-color: #ffc107; background: #fff3cd; border-color: #ffc107; }}
        .metric.red {{ border-left-color: #dc3545; background: #f8d7da; border-color: #dc3545; }}
        .metric-value {{ font-size: 16px; font-weight: 700; }}
        .metric-label {{ font-size: 9px; color: #666; margin-top: 2px; }}

        /* Tables - Compact & Word/Docs compatible */
        .table-wrap {{ overflow-x: auto; }}
        table {{ width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 10px; border: 1px solid #1a1a2e; table-layout: fixed; }}
        th {{ background-color: #1a1a2e; color: white; padding: 3px 2px; text-align: left; font-weight: 600; font-size: 9px; border: 1px solid #1a1a2e; word-wrap: break-word; }}
        th.right {{ text-align: right; }}
        th.center {{ text-align: center; }}
        td {{ padding: 2px 3px; border: 1px solid #dee2e6; word-wrap: break-word; }}
        tr:hover {{ background: #f8f9fa; }}
        .green {{ color: #28a745; font-weight: 600; }}
        .yellow {{ color: #b8860b; font-weight: 600; }}
        .red {{ color: #dc3545; font-weight: 600; }}
        .right {{ text-align: right; }}
        .center {{ text-align: center; }}
        .hit-row {{ background-color: #d4edda; }}
        .miss-row {{ background-color: #f8d7da; }}
        .miss-row.yellow {{ background-color: #fff3cd; }}

        /* Commentary - Word-friendly with clear separation */
        .commentary {{ background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 8px 0; border: 1px solid #ddd; }}
        .hit {{ border: 1px solid #28a745; border-left: 4px solid #28a745; padding: 8px 10px; margin: 8px 0; background: #d4edda; border-radius: 3px; font-size: 11px; }}
        .miss {{ border: 1px solid #dc3545; border-left: 4px solid #dc3545; padding: 8px 10px; margin: 8px 0; background: #f8d7da; border-radius: 3px; font-size: 11px; }}
        .miss.yellow {{ border-color: #ffc107; border-left-color: #ffc107; background: #fff3cd; }}
        .rca {{ font-size: 10px; color: #333; margin-top: 4px; }}
        .action {{ font-size: 10px; color: #0066cc; margin-top: 3px; font-style: italic; }}

        /* Ads - Word-friendly */
        .ads-card {{ background: #f8f9fa; padding: 8px; border-radius: 4px; margin: 8px 0; font-size: 11px; border: 1px solid #ccc; }}

        .footer {{ margin-top: 20px; padding-top: 10px; border-top: 1px solid #dee2e6; font-size: 9px; color: #666; text-align: center; }}

        /* Responsive - Narrow screens */
        @media (max-width: 900px) {{
            .metrics-grid {{ grid-template-columns: repeat(3, 1fr); }}
            .metric-value {{ font-size: 14px; }}
        }}
        @media (max-width: 600px) {{
            .metrics-grid {{ grid-template-columns: repeat(2, 1fr); }}
            body {{ padding: 5px; }}
            .container {{ padding: 10px; }}
            table {{ font-size: 10px; }}
            th, td {{ padding: 3px; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Q1 2026 Risk Analysis Report</h1>
        <div class="meta">
            <span>Report Date: {period.get('as_of_date', 'N/A')}</span>
            <span>Q1 Progress: {period.get('quarter_pct_complete', 0):.1f}% ({period.get('days_elapsed', 0)}/{period.get('total_days', 90)} days)</span>
            <span>Version: {query_version}</span>
        </div>

        <!-- SECTION 1: EXECUTIVE SUMMARY -->
        <h2>1. Executive Summary</h2>
"""

    # Extract totals for summary table
    qtd_att = grand_total.get('total_qtd_attainment_pct', 0) or 0
    att_color = '#28a745' if qtd_att >= 90 else '#ffc107' if qtd_att >= 70 else '#dc3545'
    cov = grand_total.get('total_pipeline_coverage_x', 0) or 0
    cov_color = '#28a745' if cov >= 3 else '#ffc107' if cov >= 2 else '#dc3545'

    por = product_totals.get('POR', {})
    por_att = por.get('total_qtd_attainment_pct', 0) or 0
    por_color = '#28a745' if por_att >= 90 else '#ffc107' if por_att >= 70 else '#dc3545'

    r360 = product_totals.get('R360', {})
    r360_att = r360.get('total_qtd_attainment_pct', 0) or 0
    r360_color = '#28a745' if r360_att >= 90 else '#ffc107' if r360_att >= 70 else '#dc3545'

    html += f"""
        <table>
            <tr>
                <th>Metric</th>
                <th class="right">Total</th>
                <th class="right">POR</th>
                <th class="right">R360</th>
            </tr>
            <tr>
                <td>Q1 Target</td>
                <td class="right">{format_currency(grand_total.get('total_q1_target'))}</td>
                <td class="right">{format_currency(por.get('total_q1_target'))}</td>
                <td class="right">{format_currency(r360.get('total_q1_target'))}</td>
            </tr>
            <tr>
                <td>QTD Target</td>
                <td class="right">{format_currency(grand_total.get('total_qtd_target'))}</td>
                <td class="right">{format_currency(por.get('total_qtd_target'))}</td>
                <td class="right">{format_currency(r360.get('total_qtd_target'))}</td>
            </tr>
            <tr>
                <td>QTD Actual</td>
                <td class="right"><strong>{format_currency(grand_total.get('total_qtd_acv'))}</strong></td>
                <td class="right"><strong>{format_currency(por.get('total_qtd_acv'))}</strong></td>
                <td class="right"><strong>{format_currency(r360.get('total_qtd_acv'))}</strong></td>
            </tr>
            <tr>
                <td>QTD Attainment</td>
                <td class="right" style="color: {att_color};"><strong>{qtd_att:.0f}%</strong></td>
                <td class="right" style="color: {por_color};"><strong>{por_att:.0f}%</strong></td>
                <td class="right" style="color: {r360_color};"><strong>{r360_att:.0f}%</strong></td>
            </tr>
            <tr>
                <td>Pipeline Coverage</td>
                <td class="right" style="color: {cov_color};"><strong>{cov:.1f}x</strong></td>
                <td class="right">{por.get('total_pipeline_coverage_x', 0) or 0:.1f}x</td>
                <td class="right">{r360.get('total_pipeline_coverage_x', 0) or 0:.1f}x</td>
            </tr>
            <tr>
                <td>Win Rate</td>
                <td class="right">{grand_total.get('total_win_rate_pct', 0) or 0:.0f}%</td>
                <td class="right">{por.get('total_win_rate_pct', 0) or 0:.0f}%</td>
                <td class="right">{r360.get('total_win_rate_pct', 0) or 0:.0f}%</td>
            </tr>
            <tr>
                <td>Hits / Misses</td>
                <td class="right" colspan="3"><strong>{len(hits)}</strong> on track / <strong>{len(misses)}</strong> need attention</td>
            </tr>
        </table>

        <!-- SECTION 2: ATTAINMENT BY REGION & PRODUCT -->
        <h2>2. Attainment by Region & Product</h2>
"""

    # POR Attainment Table - Sorted by attainment % (worst first)
    por_sorted = sorted(attainment_detail.get("POR", []), key=lambda x: x.get('qtd_attainment_pct') or 0)
    html += """
        <h3>POR - Point of Rental (sorted worst → best)</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>Cat</th>
                <th class="right">Q1 Tgt</th>
                <th class="right">QTD Act</th>
                <th class="right">Att%</th>
                <th class="right">Gap</th>
                <th class="right">Pipe</th>
                <th class="right">Cov</th>
                <th class="right">Win%</th>
                <th class="center">RAG</th>
            </tr>
"""
    for row in por_sorted:
        rag = row.get("rag_status", "RED")
        coverage = row.get('pipeline_coverage_x') or 0
        win_rate = row.get('win_rate_pct') or 0
        gap = row.get('qtd_gap') or 0
        html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('category', '')}</td>
                <td class="right">{format_currency(row.get('q1_target'))}</td>
                <td class="right">{format_currency(row.get('qtd_acv'))}</td>
                <td class="{get_rag_class(rag)} right">{format_percent(row.get('qtd_attainment_pct'))}</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{format_currency(gap)}</td>
                <td class="right">{format_currency(row.get('pipeline_acv'))}</td>
                <td class="right">{coverage:.1f}x</td>
                <td class="right">{win_rate:.0f}%</td>
                <td class="{get_rag_class(rag)} center">{rag}</td>
            </tr>
"""
    html += "</table>"

    # R360 Attainment Table - Sorted by attainment % (worst first)
    r360_sorted = sorted(attainment_detail.get("R360", []), key=lambda x: x.get('qtd_attainment_pct') or 0)
    html += """
        <h3>R360 - Record360 (sorted worst → best)</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>Cat</th>
                <th class="right">Q1 Tgt</th>
                <th class="right">QTD Act</th>
                <th class="right">Att%</th>
                <th class="right">Gap</th>
                <th class="right">Pipe</th>
                <th class="right">Cov</th>
                <th class="right">Win%</th>
                <th class="center">RAG</th>
            </tr>
"""
    for row in r360_sorted:
        rag = row.get("rag_status", "RED")
        coverage = row.get('pipeline_coverage_x') or 0
        win_rate = row.get('win_rate_pct') or 0
        gap = row.get('qtd_gap') or 0
        html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('category', '')}</td>
                <td class="right">{format_currency(row.get('q1_target'))}</td>
                <td class="right">{format_currency(row.get('qtd_acv'))}</td>
                <td class="{get_rag_class(rag)} right">{format_percent(row.get('qtd_attainment_pct'))}</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{format_currency(gap)}</td>
                <td class="right">{format_currency(row.get('pipeline_acv'))}</td>
                <td class="right">{coverage:.1f}x</td>
                <td class="right">{win_rate:.0f}%</td>
                <td class="{get_rag_class(rag)} center">{rag}</td>
            </tr>
"""
    html += "</table>"

    # SECTION 3: SOURCE ATTAINMENT
    html += """
        <h2>3. Source Attainment by Channel</h2>
"""

    # Helper function for RAG class
    def pct_class(pct):
        if pct is None:
            return "red"
        if pct >= 90:
            return "green"
        elif pct >= 70:
            return "yellow"
        return "red"

    # Get date context from period
    as_of_date = period.get('as_of_date', 'N/A')
    quarter_pct = period.get('quarter_pct_complete', 0)
    days_elapsed = period.get('days_elapsed', 0)
    total_days = period.get('total_days', 90)

    # Source ACV Attainment Table (all sources) - Sorted by attainment % (worst first)
    for product in ["POR", "R360"]:
        source_sorted = sorted(source_attainment.get(product, []), key=lambda x: x.get('attainment_pct') or 0)
        html += f"""
        <h3>{product} ACV by Source (sorted worst → best)</h3>
        <p style="font-size: 10px; color: #666; margin: 3px 0;">As of {as_of_date} ({quarter_pct:.1f}% Q1 - Day {days_elapsed}/{total_days})</p>
        <table>
            <tr>
                <th>Region</th>
                <th>Source</th>
                <th class="right">Q1 Tgt</th>
                <th class="right">QTD Tgt</th>
                <th class="right">QTD Act</th>
                <th class="right">Att%</th>
                <th class="right">Gap</th>
                <th class="center">RAG</th>
            </tr>
"""
        for row in source_sorted:
            att_pct = row.get('attainment_pct') or 0
            gap = row.get('gap') or 0
            rag = row.get('rag_status', 'RED')
            qtd_target = row.get('qtd_target') or 0
            html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('source', '')}</td>
                <td class="right">{format_currency(row.get('q1_target'))}</td>
                <td class="right">{format_currency(qtd_target)}</td>
                <td class="right">{format_currency(row.get('qtd_acv'))}</td>
                <td class="{pct_class(att_pct)} right">{att_pct:.0f}%</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{format_currency(gap)}</td>
                <td class="{get_rag_class(rag)} center">{rag}</td>
            </tr>
"""
        html += "</table>"

    # Full Funnel Attainment by Category (NEW BUSINESS, EXPANSION, MIGRATION)
    # Using funnel_by_category data which has complete targets for all categories
    html += """
        <h3>Full Funnel Attainment by Category (EQL/MQL → SQO)</h3>
        <p style="font-size: 10px; color: #666; margin: 3px 0;">EQL for EXPANSION/MIGRATION, MQL for NEW BUSINESS | TOF Score: Weighted attainment (EQL/MQL=10%, SQL=20%, SAL=30%, SQO=40%)</p>
"""
    for product in ["POR", "R360"]:
        # Sort by average pacing % (worst first)
        funnel_rows = funnel_by_category.get(product, [])
        sorted_funnel = sorted(funnel_rows, key=lambda x: (
            (x.get('mql_pacing_pct') or 0) + (x.get('sql_pacing_pct') or 0) +
            (x.get('sal_pacing_pct') or 0) + (x.get('sqo_pacing_pct') or 0)
        ) / 4)

        html += f"""
        <h4>{product}</h4>
        <table>
            <tr>
                <th>Cat</th>
                <th>Region</th>
                <th class="right">TOF Score</th>
                <th>Stage</th>
                <th class="right">Q1 Tgt</th>
                <th class="right">QTD Tgt</th>
                <th class="right">Actual</th>
                <th class="right">Att%</th>
                <th class="right">Gap</th>
            </tr>
"""
        for row in sorted_funnel:
            category = row.get('category', '')
            region = row.get('region', '')
            weighted_tof_score = row.get('weighted_tof_score', 0) or 0

            # Build list of stages with targets > 0
            # MQL is called EQL (Expansion/Migration Qualified Lead) for EXPANSION and MIGRATION categories
            mql_label = 'EQL' if category.upper() in ('EXPANSION', 'MIGRATION') else 'MQL'
            stages_to_show = []
            if (row.get('q1_target_mql') or 0) > 0:
                stages_to_show.append((mql_label, row.get('q1_target_mql', 0) or 0, row.get('qtd_target_mql', 0) or 0,
                                       row.get('actual_mql', 0) or 0, row.get('mql_pacing_pct', 0) or 0, row.get('mql_gap', 0) or 0))
            if (row.get('q1_target_sql') or 0) > 0:
                stages_to_show.append(('SQL', row.get('q1_target_sql', 0) or 0, row.get('qtd_target_sql', 0) or 0,
                                       row.get('actual_sql', 0) or 0, row.get('sql_pacing_pct', 0) or 0, row.get('sql_gap', 0) or 0))
            if (row.get('q1_target_sal') or 0) > 0:
                stages_to_show.append(('SAL', row.get('q1_target_sal', 0) or 0, row.get('qtd_target_sal', 0) or 0,
                                       row.get('actual_sal', 0) or 0, row.get('sal_pacing_pct', 0) or 0, row.get('sal_gap', 0) or 0))
            if (row.get('q1_target_sqo') or 0) > 0:
                stages_to_show.append(('SQO', row.get('q1_target_sqo', 0) or 0, row.get('qtd_target_sqo', 0) or 0,
                                       row.get('actual_sqo', 0) or 0, row.get('sqo_pacing_pct', 0) or 0, row.get('sqo_gap', 0) or 0))

            if not stages_to_show:
                continue

            rowspan = len(stages_to_show)
            for i, (stage, q1_tgt, qtd_tgt, actual, pct, gap) in enumerate(stages_to_show):
                if i == 0:
                    html += f"""
            <tr>
                <td rowspan="{rowspan}"><strong>{category}</strong></td>
                <td rowspan="{rowspan}">{region}</td>
                <td rowspan="{rowspan}" class="{pct_class(weighted_tof_score)} right"><strong>{weighted_tof_score:.0f}%</strong></td>
                <td>{stage}</td>
                <td class="right">{q1_tgt:.0f}</td>
                <td class="right">{qtd_tgt:.0f}</td>
                <td class="right">{actual:.0f}</td>
                <td class="{pct_class(pct)} right">{pct:.0f}%</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{gap:+.0f}</td>
            </tr>
"""
                else:
                    html += f"""
            <tr>
                <td>{stage}</td>
                <td class="right">{q1_tgt:.0f}</td>
                <td class="right">{qtd_tgt:.0f}</td>
                <td class="right">{actual:.0f}</td>
                <td class="{pct_class(pct)} right">{pct:.0f}%</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{gap:+.0f}</td>
            </tr>
"""
        html += "</table>"

    # Full Funnel Attainment by Category + Source (Category × Source × Region breakdown)
    html += """
        <h3>Full Funnel Attainment by Category & Source (EQL/MQL → SQO)</h3>
        <p style="font-size: 10px; color: #666; margin: 3px 0;">EQL for EXPANSION/MIGRATION, MQL for NEW BUSINESS | Only INBOUND has EQL/MQL targets | TOF Score: Weighted attainment (EQL/MQL=10%, SQL=20%, SAL=30%, SQO=40%)</p>
"""
    for product in ["POR", "R360"]:
        # Sort by category, then source, then by average pacing % (worst first)
        funnel_rows = funnel_by_source.get(product, [])
        sorted_funnel = sorted(funnel_rows, key=lambda x: (
            x.get('category', '') or '',
            x.get('source', '') or '',
            (x.get('mql_pacing_pct') or 0) + (x.get('sql_pacing_pct') or 0) +
            (x.get('sal_pacing_pct') or 0) + (x.get('sqo_pacing_pct') or 0)
        ))

        html += f"""
        <h4>{product}</h4>
        <table>
            <tr>
                <th>Category</th>
                <th>Source</th>
                <th>Region</th>
                <th class="right">TOF Score</th>
                <th>Stage</th>
                <th class="right">Q1 Tgt</th>
                <th class="right">QTD Tgt</th>
                <th class="right">Actual</th>
                <th class="right">Att%</th>
                <th class="right">Gap</th>
            </tr>
"""
        for row in sorted_funnel:
            category = row.get('category', '')
            source = row.get('source', '')
            region = row.get('region', '')
            weighted_tof_score = row.get('weighted_tof_score', 0) or 0

            # Build list of stages with targets > 0
            # MQL is called EQL (Expansion/Migration Qualified Lead) for EXPANSION and MIGRATION categories
            mql_label = 'EQL' if category.upper() in ('EXPANSION', 'MIGRATION') else 'MQL'
            stages_to_show = []
            if (row.get('q1_target_mql') or 0) > 0:
                stages_to_show.append((mql_label, row.get('q1_target_mql', 0) or 0, row.get('qtd_target_mql', 0) or 0,
                                       row.get('actual_mql', 0) or 0, row.get('mql_pacing_pct', 0) or 0, row.get('mql_gap', 0) or 0))
            if (row.get('q1_target_sql') or 0) > 0:
                stages_to_show.append(('SQL', row.get('q1_target_sql', 0) or 0, row.get('qtd_target_sql', 0) or 0,
                                       row.get('actual_sql', 0) or 0, row.get('sql_pacing_pct', 0) or 0, row.get('sql_gap', 0) or 0))
            if (row.get('q1_target_sal') or 0) > 0:
                stages_to_show.append(('SAL', row.get('q1_target_sal', 0) or 0, row.get('qtd_target_sal', 0) or 0,
                                       row.get('actual_sal', 0) or 0, row.get('sal_pacing_pct', 0) or 0, row.get('sal_gap', 0) or 0))
            if (row.get('q1_target_sqo') or 0) > 0:
                stages_to_show.append(('SQO', row.get('q1_target_sqo', 0) or 0, row.get('qtd_target_sqo', 0) or 0,
                                       row.get('actual_sqo', 0) or 0, row.get('sqo_pacing_pct', 0) or 0, row.get('sqo_gap', 0) or 0))

            if not stages_to_show:
                continue

            rowspan = len(stages_to_show)
            for i, (stage, q1_tgt, qtd_tgt, actual, pct, gap) in enumerate(stages_to_show):
                if i == 0:
                    html += f"""
            <tr>
                <td rowspan="{rowspan}"><strong>{category}</strong></td>
                <td rowspan="{rowspan}"><strong>{source}</strong></td>
                <td rowspan="{rowspan}">{region}</td>
                <td rowspan="{rowspan}" class="{pct_class(weighted_tof_score)} right"><strong>{weighted_tof_score:.0f}%</strong></td>
                <td>{stage}</td>
                <td class="right">{q1_tgt:.0f}</td>
                <td class="right">{qtd_tgt:.0f}</td>
                <td class="right">{actual:.0f}</td>
                <td class="{pct_class(pct)} right">{pct:.0f}%</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{gap:+.0f}</td>
            </tr>
"""
                else:
                    html += f"""
            <tr>
                <td>{stage}</td>
                <td class="right">{q1_tgt:.0f}</td>
                <td class="right">{qtd_tgt:.0f}</td>
                <td class="right">{actual:.0f}</td>
                <td class="{pct_class(pct)} right">{pct:.0f}%</td>
                <td class="right" style="color: {'#dc3545' if gap < 0 else '#28a745'}">{gap:+.0f}</td>
            </tr>
"""
        html += "</table>"

    # FUNNEL NARRATIVE SECTION - One per Region/Product (6 total)
    html += """
        <h3>Funnel Analysis by Region</h3>
        <p style="font-size: 10px; color: #666; margin: 3px 0;">Strengths, weaknesses, and loss analysis by region/product</p>
"""
    for product in ["POR", "R360"]:
        cat_data = funnel_by_category.get(product, [])
        src_data = funnel_by_source.get(product, [])
        loss_data = loss_reason_rca.get(product, [])

        html += f"""
        <h4>{product}</h4>
        <table>
            <tr>
                <th style="width: 12%;">Region</th>
                <th>Analysis</th>
            </tr>
"""
        for region in ["AMER", "EMEA", "APAC"]:
            narrative = generate_funnel_narrative(product, region, cat_data, src_data, loss_data)
            html += f"""
            <tr>
                <td><strong>{region}</strong></td>
                <td style="font-size: 10px;">{narrative}</td>
            </tr>
"""
        html += "</table>"

    # SECTION 4: HITS & MISSES AS TABLES
    html += """
        <h2>4. Hits & Misses with RCA</h2>
"""

    # HITS TABLE
    if hits:
        html += """
        <h3 style="color: #28a745;">HITS - On Track</h3>
        <table>
            <tr>
                <th>Prod</th>
                <th>Region</th>
                <th>Cat</th>
                <th class="right">Att%</th>
                <th class="right">QTD Act</th>
                <th class="right">Cov</th>
                <th class="right">Win%</th>
            </tr>
"""
        for h in sorted(hits, key=lambda x: x.get('qtd_attainment_pct') or 0, reverse=True)[:5]:
            h_coverage = h.get('pipeline_coverage_x') or 0
            h_win_rate = h.get('win_rate_pct') or 0
            html += f"""
            <tr class="hit-row">
                <td>{h.get('product', '')}</td>
                <td>{h.get('region', '')}</td>
                <td>{h.get('category', '')}</td>
                <td class="right green"><strong>{format_percent(h.get('qtd_attainment_pct'))}</strong></td>
                <td class="right">{format_currency(h.get('qtd_acv'))}</td>
                <td class="right">{h_coverage:.1f}x</td>
                <td class="right">{h_win_rate:.0f}%</td>
            </tr>
"""
        html += "</table>"

    # MISSES TABLE - Enhanced with funnel and loss analysis
    if misses:
        html += """
        <h3 style="color: #dc3545; margin-top: 15px;">MISSES - Needs Attention</h3>
        <table>
            <colgroup>
                <col style="width: 7%;">
                <col style="width: 7%;">
                <col style="width: 9%;">
                <col style="width: 7%;">
                <col style="width: 9%;">
                <col style="width: 7%;">
                <col style="width: 54%;">
            </colgroup>
            <tr>
                <th>Prod</th>
                <th>Region</th>
                <th>Cat</th>
                <th class="right">Att%</th>
                <th class="right">Gap</th>
                <th class="right">Cov</th>
                <th>RCA / Action (incl. funnel & loss analysis)</th>
            </tr>
"""
        for m in sorted(misses, key=lambda x: x.get('qtd_gap', 0))[:10]:
            rag = m.get('rag_status', 'RED')
            row_class = "miss-row yellow" if rag == "YELLOW" else "miss-row"
            att_class = "yellow" if rag == "YELLOW" else "red"

            product = m.get('product', '')
            region = m.get('region', '')
            category = m.get('category', '')

            # Generate enhanced RCA incorporating funnel and loss data
            rca_text, action_text = generate_enhanced_rca(
                product, region, category,
                funnel_by_category.get(product, []),
                funnel_by_source.get(product, []),
                loss_reason_rca.get(product, []),
                pipeline_rca.get(product, []),
                funnel_rca_insights.get(product, [])
            )

            m_coverage = m.get('pipeline_coverage_x') or 0
            rca_cell = rca_text
            if action_text:
                rca_cell += f" → {action_text}"

            html += f"""
            <tr class="{row_class}">
                <td>{product}</td>
                <td>{region}</td>
                <td>{category}</td>
                <td class="right {att_class}"><strong>{format_percent(m.get('qtd_attainment_pct'))}</strong></td>
                <td class="right" style="color: #dc3545;">{format_currency(m.get('qtd_gap'))}</td>
                <td class="right">{m_coverage:.1f}x</td>
                <td style="font-size: 10px;">{rca_cell}</td>
            </tr>
"""
        html += "</table>"


    # SECTION 5: PIPELINE COVERAGE TABLE
    html += """
        <h2>5. Pipeline Coverage by Region & Product</h2>
        <table>
            <tr>
                <th>Region</th>
                <th>Prod</th>
                <th>Cat</th>
                <th class="right">Pipe</th>
                <th class="right">Cov</th>
                <th class="right">Age</th>
                <th class="center">Health</th>
            </tr>
"""
    # Combine POR and R360 pipeline data into single table
    all_pipeline = []
    for product in ["POR", "R360"]:
        prca_list = pipeline_rca.get(product, [])
        for p in prca_list:
            p['product'] = product
            all_pipeline.append(p)

    # Sort by region, then product
    all_pipeline.sort(key=lambda x: (x.get('region', ''), x.get('product', ''), x.get('category', '')))

    for p in all_pipeline:
        p_coverage = p.get('pipeline_coverage_x') or 0
        p_age = p.get('pipeline_avg_age_days') or 0
        health = p.get('pipeline_health') or 'UNKNOWN'

        # Color code coverage
        if p_coverage >= 3:
            cov_class = "green"
        elif p_coverage >= 2:
            cov_class = "yellow"
        else:
            cov_class = "red"

        # Color code health
        if health == "HEALTHY":
            health_class = "green"
        elif health == "ADEQUATE":
            health_class = "yellow"
        else:
            health_class = "red"

        html += f"""
            <tr>
                <td>{p.get('region', '')}</td>
                <td>{p.get('product', '')}</td>
                <td>{p.get('category', '')}</td>
                <td class="right">{format_currency(p.get('pipeline_acv'))}</td>
                <td class="{cov_class} right">{p_coverage:.1f}x</td>
                <td class="right">{p_age:.0f} days</td>
                <td class="{health_class} center">{health}</td>
            </tr>
"""

    html += "        </table>"

    # SECTION 6: LOST OPPORTUNITIES
    html += """
        <h2>6. Lost Opportunities Analysis</h2>
"""
    # Lost by Product (from product_totals)
    html += """
        <h3>Lost Deals by Product</h3>
        <table>
            <tr>
                <th>Product</th>
                <th class="right">Deals Lost</th>
                <th class="right">ACV Lost</th>
                <th class="right">Avg Deal Size</th>
            </tr>
"""
    total_lost_deals = 0
    total_lost_acv = 0
    for prod_name in ["POR", "R360"]:
        prod_data = product_totals.get(prod_name, {})
        lost_deals = prod_data.get('total_lost_deals', 0) or 0
        lost_acv = prod_data.get('total_lost_acv', 0) or 0
        avg_deal = lost_acv / lost_deals if lost_deals > 0 else 0
        total_lost_deals += lost_deals
        total_lost_acv += lost_acv
        html += f"""
            <tr>
                <td>{prod_name}</td>
                <td class="right">{lost_deals:.0f}</td>
                <td class="right red">{format_currency(lost_acv)}</td>
                <td class="right">{format_currency(avg_deal)}</td>
            </tr>
"""
    # Total row
    total_avg = total_lost_acv / total_lost_deals if total_lost_deals > 0 else 0
    html += f"""
            <tr style="font-weight: bold; background: #f8f9fa;">
                <td>TOTAL</td>
                <td class="right">{total_lost_deals:.0f}</td>
                <td class="right red">{format_currency(total_lost_acv)}</td>
                <td class="right">{format_currency(total_avg)}</td>
            </tr>
        </table>
"""

    # Lost by Region (aggregate from attainment_detail)
    html += """
        <h3>Lost Deals by Region (sorted by ACV lost)</h3>
        <table>
            <tr>
                <th>Region</th>
                <th class="right">POR Deals</th>
                <th class="right">POR ACV</th>
                <th class="right">R360 Deals</th>
                <th class="right">R360 ACV</th>
                <th class="right">Total ACV</th>
            </tr>
"""
    # Aggregate by region
    region_lost = {}
    for prod_name in ["POR", "R360"]:
        for row in attainment_detail.get(prod_name, []):
            region = row.get('region', 'Unknown')
            if region not in region_lost:
                region_lost[region] = {'POR_deals': 0, 'POR_acv': 0, 'R360_deals': 0, 'R360_acv': 0}
            lost_deals = row.get('qtd_lost_deals', 0) or 0
            lost_acv = row.get('qtd_lost_acv', 0) or 0
            if prod_name == 'POR':
                region_lost[region]['POR_deals'] += lost_deals
                region_lost[region]['POR_acv'] += lost_acv
            else:
                region_lost[region]['R360_deals'] += lost_deals
                region_lost[region]['R360_acv'] += lost_acv

    # Sort by total ACV lost (worst first)
    sorted_regions = sorted(region_lost.items(), key=lambda x: x[1]['POR_acv'] + x[1]['R360_acv'], reverse=True)
    for region, data in sorted_regions:
        total_region_acv = data['POR_acv'] + data['R360_acv']
        html += f"""
            <tr>
                <td>{region}</td>
                <td class="right">{data['POR_deals']:.0f}</td>
                <td class="right">{format_currency(data['POR_acv'])}</td>
                <td class="right">{data['R360_deals']:.0f}</td>
                <td class="right">{format_currency(data['R360_acv'])}</td>
                <td class="right red"><strong>{format_currency(total_region_acv)}</strong></td>
            </tr>
"""
    html += "        </table>"

    # Top Loss Reasons (from loss_reason_rca)
    html += """
        <h3>Top Loss Reasons (sorted by ACV impact)</h3>
        <table>
            <tr>
                <th>Prod</th>
                <th>Region</th>
                <th>Reason</th>
                <th class="right">Deals</th>
                <th class="right">ACV Lost</th>
                <th class="center">Severity</th>
            </tr>
"""
    # Combine and sort by ACV
    all_losses = []
    for prod_name in ["POR", "R360"]:
        for row in loss_reason_rca.get(prod_name, []):
            row['product'] = prod_name
            all_losses.append(row)
    sorted_losses = sorted(all_losses, key=lambda x: x.get('lost_acv', 0) or 0, reverse=True)[:15]

    for row in sorted_losses:
        severity = row.get('severity', 'LOW')
        sev_class = 'red' if severity == 'CRITICAL' else 'yellow' if severity == 'HIGH' else ''
        reason = row.get('loss_reason', 'Unknown')
        # Truncate long reasons
        if len(reason) > 25:
            reason = reason[:22] + '...'
        html += f"""
            <tr>
                <td>{row.get('product', '')}</td>
                <td>{row.get('region', '')}</td>
                <td>{reason}</td>
                <td class="right">{row.get('deal_count', 0):.0f}</td>
                <td class="right red">{format_currency(row.get('lost_acv'))}</td>
                <td class="{sev_class} center">{severity}</td>
            </tr>
"""
    html += "        </table>"

    # SECTION 7: GOOGLE ADS PERFORMANCE
    html += """
        <h2>7. Google Ads Performance</h2>
        <table>
            <tr>
                <th>Prod</th>
                <th class="right">Impr</th>
                <th class="right">Clicks</th>
                <th class="right">CTR</th>
                <th class="right">Spend</th>
                <th class="right">CPC</th>
                <th class="right">Conv</th>
                <th class="right">CPA</th>
            </tr>
"""
    por_ads = google_ads.get("POR", {})
    r360_ads = google_ads.get("R360", {})

    html += f"""
            <tr>
                <td>POR</td>
                <td class="right">{por_ads.get('impressions', 0):,}</td>
                <td class="right">{por_ads.get('clicks', 0):,}</td>
                <td class="right">{por_ads.get('ctr_pct', 0):.2f}%</td>
                <td class="right">{format_currency(por_ads.get('ad_spend_usd'))}</td>
                <td class="right">${por_ads.get('cpc_usd', 0):.2f}</td>
                <td class="right">{por_ads.get('conversions', 0):.0f}</td>
                <td class="right">${por_ads.get('cpa_usd', 0):.0f}</td>
            </tr>
            <tr>
                <td>R360</td>
                <td class="right">{r360_ads.get('impressions', 0):,}</td>
                <td class="right">{r360_ads.get('clicks', 0):,}</td>
                <td class="right">{r360_ads.get('ctr_pct', 0):.2f}%</td>
                <td class="right">{format_currency(r360_ads.get('ad_spend_usd'))}</td>
                <td class="right">${r360_ads.get('cpc_usd', 0):.2f}</td>
                <td class="right">{r360_ads.get('conversions', 0):.0f}</td>
                <td class="right">${r360_ads.get('cpa_usd', 0):.0f}</td>
            </tr>
        </table>
"""

    # Google Ads RCA
    for product in ["POR", "R360"]:
        ads_rca = google_ads_rca.get(product, {})
        if ads_rca:
            ctr_perf = ads_rca.get("ctr_performance", "")
            cpa_perf = ads_rca.get("cpa_performance", "")
            html += f"""
        <div class="ads-card">
            <strong>{product}:</strong>
            CTR {ads_rca.get('ctr_pct', 0):.2f}% ({ctr_perf}) |
            CPA ${ads_rca.get('cpa_usd', 0):.0f} ({cpa_perf})
            <div class="rca" style="margin-top: 5px;">{ads_rca.get('rca_commentary', '')}</div>
            <div class="action">→ {ads_rca.get('recommended_action', '')}</div>
        </div>
"""

    # Footer
    html += f"""
        <div class="footer">
            <p>Generated {datetime.now().strftime('%Y-%m-%d %H:%M')} | Version {query_version} | Data as of {period.get('as_of_date', 'N/A')}</p>
        </div>
    </div>
</body>
</html>
"""

    return html


def main():
    print("=" * 60)
    print("Q1 2026 Risk Report - CONSOLIDATED (v2.7.0)")
    print("=" * 60)

    # Run BigQuery
    print("\n[1/3] Running BigQuery query...")
    data = run_bigquery()
    print(f"      Data for: {data.get('report_date')}")

    # Generate HTML
    print("\n[2/3] Generating consolidated HTML report...")
    html = generate_html(data)

    # Save to file
    today = datetime.now().strftime("%Y-%m-%d")
    output_dir = Path(__file__).parent / "reports"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"Q1_2026_Risk_Report_{today}.html"

    print(f"\n[3/3] Saving to: {output_path}")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    # Summary
    print("\n" + "=" * 60)
    print("REPORT COMPLETE")
    print("=" * 60)
    print(f"QTD Attainment: {data['grand_total']['total_qtd_attainment_pct']:.1f}%")
    print(f"Output: {output_path}")
    print("=" * 60)

    return output_path


if __name__ == "__main__":
    main()
