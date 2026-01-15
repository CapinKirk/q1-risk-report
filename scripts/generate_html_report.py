#!/usr/bin/env python3
"""
Q1 2026 Bookings Risk Analysis HTML Report Generator
Version: 2.6.0

CONSOLIDATED EXECUTIVE REPORT

Structure:
1. Executive Summary - Key metrics at a glance
2. Attainment by Region & Product - Combined ACV + Funnel view
3. Source Attainment - Top of Funnel (MQL→SQL→SAL→SQO)
4. Hits & Misses Commentary - RCA on underperformers
5. Pipeline Risk Analysis - Coverage + Age + RCA by region
6. Google Ads Performance - Metrics + insights

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
    rows = json.loads(result.stdout)
    if not rows:
        print("Error: No data returned from BigQuery")
        sys.exit(1)

    # Parse the inner JSON string
    data = json.loads(rows[0]["comprehensive_risk_analysis_json"])
    return data


def format_currency(value):
    """Format number as currency with $ and commas."""
    if value is None:
        return "$0"
    return f"${value:,.0f}" if isinstance(value, (int, float)) else f"${value}"


def format_percent(value):
    """Format number as percentage."""
    if value is None:
        return "N/A"
    return f"{value:.1f}%"


def get_rag_class(status):
    """Return CSS class for RAG status."""
    if status == "GREEN":
        return "rag-green"
    elif status == "YELLOW":
        return "rag-yellow"
    elif status == "RED":
        return "rag-red"
    return ""


def get_rag_from_pct(pct):
    """Determine RAG status from percentage."""
    if pct is None:
        return "RED"
    if pct >= 90:
        return "GREEN"
    elif pct >= 70:
        return "YELLOW"
    return "RED"


def generate_html(data):
    """Generate the HTML report from query data."""

    period = data["period"]
    grand_total = data["grand_total"]
    product_totals = data["product_totals"]
    attainment_detail = data["attainment_detail"]
    top_risk_pockets = data["top_risk_pockets"]
    funnel_pacing = data["funnel_pacing"]
    funnel_health = data.get("funnel_health", {"POR": [], "R360": []})
    funnel_rca_insights = data.get("funnel_rca_insights", {"POR": [], "R360": []})
    funnel_trends = data.get("funnel_trends", {"POR": [], "R360": []})
    loss_reason_rca = data.get("loss_reason_rca", {"POR": [], "R360": []})
    loss_reasons = data["loss_reasons"]
    google_ads = data["google_ads"]
    quarterly_targets = data["quarterly_targets"]

    # NEW in v2.5.0
    executive_counts = data.get("executive_counts", {})
    wins_bright_spots = data.get("wins_bright_spots", {"POR": [], "R360": []})
    momentum_indicators = data.get("momentum_indicators", {"POR": [], "R360": []})
    pipeline_rca = data.get("pipeline_rca", {"POR": [], "R360": []})
    trend_rca = data.get("trend_rca", {"POR": [], "R360": []})
    google_ads_rca = data.get("google_ads_rca", {"POR": {}, "R360": {}})
    action_items = data.get("action_items", {"immediate": [], "short_term": [], "strategic": []})
    query_version = data.get("query_version", "2.5.0")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Q1 2026 Bookings Risk Analysis Report</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}

        h1 {{
            font-size: 24px;
            color: #1a1a2e;
            margin-bottom: 10px;
            border-bottom: 3px solid #4361ee;
            padding-bottom: 10px;
        }}

        h2 {{
            font-size: 18px;
            color: #1a1a2e;
            margin: 25px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
        }}

        h3 {{
            font-size: 16px;
            color: #495057;
            margin: 20px 0 10px 0;
        }}

        .metadata {{
            color: #6c757d;
            font-size: 13px;
            margin-bottom: 20px;
        }}

        .metadata span {{
            display: inline-block;
            margin-right: 20px;
            padding: 4px 8px;
            background: #e9ecef;
            border-radius: 4px;
        }}

        .note {{
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 10px 15px;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 13px;
        }}

        .filter-note {{
            background: #e7f5ff;
            border: 1px solid #74c0fc;
            color: #1c7ed6;
            padding: 8px 12px;
            border-radius: 4px;
            margin: 8px 0;
            font-size: 12px;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 13px;
        }}

        th, td {{
            padding: 10px 12px;
            text-align: right;
            border: 1px solid #dee2e6;
        }}

        th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }}

        td:first-child, th:first-child {{
            text-align: left;
        }}

        tr:nth-child(even) {{
            background: #f8f9fa;
        }}

        tr:hover {{
            background: #e9ecef;
        }}

        .rag-green {{
            background-color: #d4edda !important;
            color: #155724;
            font-weight: 600;
        }}

        .rag-yellow {{
            background-color: #fff3cd !important;
            color: #856404;
            font-weight: 600;
        }}

        .rag-red {{
            background-color: #f8d7da !important;
            color: #721c24;
            font-weight: 600;
        }}

        .summary-cards {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}

        .summary-card {{
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
        }}

        .summary-card.green {{
            border-left: 4px solid #28a745;
        }}

        .summary-card.yellow {{
            border-left: 4px solid #ffc107;
        }}

        .summary-card.red {{
            border-left: 4px solid #dc3545;
        }}

        .summary-card h4 {{
            font-size: 12px;
            color: #6c757d;
            text-transform: uppercase;
            margin-bottom: 5px;
        }}

        .summary-card .value {{
            font-size: 24px;
            font-weight: 700;
            color: #1a1a2e;
        }}

        .summary-card .detail {{
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
        }}

        .product-section {{
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }}

        .product-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}

        .product-title {{
            font-size: 16px;
            font-weight: 600;
            color: #1a1a2e;
        }}

        .product-badge {{
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }}

        .badge-por {{
            background: #4361ee;
            color: white;
        }}

        .badge-r360 {{
            background: #7209b7;
            color: white;
        }}

        .two-col {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }}

        @media (max-width: 900px) {{
            .two-col {{
                grid-template-columns: 1fr;
            }}
        }}

        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 12px;
            text-align: center;
        }}

        /* Copy-paste friendly styles */
        table {{
            border-spacing: 0;
        }}

        .copy-friendly {{
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        }}

        /* Severity badges */
        .severity-critical {{
            background: #dc3545;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }}

        .severity-high {{
            background: #fd7e14;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }}

        .severity-medium {{
            background: #ffc107;
            color: #333;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }}

        .severity-low {{
            background: #28a745;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }}

        /* RCA insights */
        .rca-section {{
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }}

        .rca-item {{
            padding: 12px;
            margin: 8px 0;
            border-left: 4px solid #6c757d;
            background: white;
            border-radius: 0 4px 4px 0;
        }}

        .rca-item.critical {{
            border-left-color: #dc3545;
        }}

        .rca-item.high {{
            border-left-color: #fd7e14;
        }}

        .rca-item.medium {{
            border-left-color: #ffc107;
        }}

        .rca-item.low {{
            border-left-color: #28a745;
        }}

        .rca-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}

        .rca-region {{
            font-weight: 600;
            font-size: 14px;
        }}

        .rca-bottleneck {{
            font-size: 12px;
            color: #6c757d;
        }}

        .rca-commentary {{
            font-size: 13px;
            color: #333;
            margin-bottom: 8px;
        }}

        .rca-action {{
            font-size: 12px;
            color: #0066cc;
            font-style: italic;
        }}

        /* Funnel health visual */
        .funnel-stage {{
            display: inline-block;
            padding: 4px 12px;
            margin: 2px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }}

        .stage-green {{
            background: #d4edda;
            color: #155724;
        }}

        .stage-yellow {{
            background: #fff3cd;
            color: #856404;
        }}

        .stage-red {{
            background: #f8d7da;
            color: #721c24;
        }}

        .funnel-visual {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            margin: 5px 0;
        }}

        .funnel-arrow {{
            color: #6c757d;
            font-size: 16px;
        }}

        /* NEW in v2.5.0 - Success/Wins styles */
        .wins-section {{
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 5px solid #28a745;
        }}

        .wins-section h2 {{
            color: #155724;
            margin-bottom: 15px;
            border-bottom: 2px solid #28a745;
            padding-bottom: 8px;
        }}

        .win-card {{
            background: white;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #28a745;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }}

        .win-card.exceptional {{
            border-left-color: #0d6efd;
            background: linear-gradient(90deg, #e7f1ff 0%, white 100%);
        }}

        .win-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }}

        .win-title {{
            font-weight: 600;
            font-size: 14px;
            color: #155724;
        }}

        .win-pct {{
            font-size: 20px;
            font-weight: 700;
            color: #28a745;
        }}

        .win-commentary {{
            font-size: 13px;
            color: #333;
            margin-top: 8px;
        }}

        .momentum-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
        }}

        .momentum-strong {{
            background: #28a745;
            color: white;
        }}

        .momentum-moderate {{
            background: #20c997;
            color: white;
        }}

        .momentum-some {{
            background: #6c757d;
            color: white;
        }}

        /* Action Items styles */
        .action-section {{
            margin: 20px 0;
        }}

        .action-group {{
            margin: 15px 0;
        }}

        .action-group h4 {{
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 4px;
        }}

        .action-group.immediate h4 {{
            background: #f8d7da;
            color: #721c24;
        }}

        .action-group.short-term h4 {{
            background: #fff3cd;
            color: #856404;
        }}

        .action-group.strategic h4 {{
            background: #cce5ff;
            color: #004085;
        }}

        .action-item {{
            padding: 12px;
            margin: 8px 0;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #6c757d;
        }}

        .action-item.critical {{
            border-left-color: #dc3545;
        }}

        .action-item.high {{
            border-left-color: #fd7e14;
        }}

        .action-item.medium {{
            border-left-color: #ffc107;
        }}

        .action-meta {{
            display: flex;
            gap: 10px;
            margin-bottom: 6px;
            font-size: 11px;
            color: #6c757d;
        }}

        .action-meta span {{
            padding: 2px 6px;
            background: #e9ecef;
            border-radius: 3px;
        }}

        .action-issue {{
            font-size: 13px;
            color: #333;
            margin-bottom: 6px;
        }}

        .action-text {{
            font-size: 12px;
            color: #0066cc;
            font-style: italic;
        }}

        /* Executive summary enhancements */
        .exec-summary-row {{
            display: flex;
            gap: 15px;
            margin: 15px 0;
        }}

        .exec-stat {{
            flex: 1;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}

        .exec-stat.wins {{
            background: #d4edda;
            border: 1px solid #28a745;
        }}

        .exec-stat.risks {{
            background: #f8d7da;
            border: 1px solid #dc3545;
        }}

        .exec-stat.attention {{
            background: #fff3cd;
            border: 1px solid #ffc107;
        }}

        .exec-stat.momentum {{
            background: #cce5ff;
            border: 1px solid #0d6efd;
        }}

        .exec-stat-value {{
            font-size: 28px;
            font-weight: 700;
        }}

        .exec-stat-label {{
            font-size: 12px;
            color: #6c757d;
            margin-top: 4px;
        }}

        .trend-arrow-up {{
            color: #28a745;
        }}

        .trend-arrow-down {{
            color: #dc3545;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Q1 2026 Bookings Risk Analysis Report</h1>

        <div class="metadata">
            <span>Generated: {data.get('generated_at_utc', 'N/A')[:19]} UTC</span>
            <span>Report Date: {data.get('report_date', 'N/A')}</span>
            <span>Quarter Progress: {period.get('quarter_pct_complete', 0):.1f}% ({period.get('days_elapsed', 0)}/{period.get('total_days', 90)} days)</span>
            <span>Percentile: {data.get('percentile', 'P50')}</span>
        </div>

        <!-- Executive Summary (Enhanced in v2.5.0) -->
        <h2>Executive Summary</h2>

        <!-- NEW: Quick Status Indicators -->
        <div class="exec-summary-row">
            <div class="exec-stat wins">
                <div class="exec-stat-value" style="color: #28a745;">{executive_counts.get('areas_exceeding_target', 0)}</div>
                <div class="exec-stat-label">Areas Exceeding Target</div>
            </div>
            <div class="exec-stat risks">
                <div class="exec-stat-value" style="color: #dc3545;">{executive_counts.get('areas_at_risk', 0)}</div>
                <div class="exec-stat-label">Areas At Risk (RED)</div>
            </div>
            <div class="exec-stat attention">
                <div class="exec-stat-value" style="color: #856404;">{executive_counts.get('areas_needing_attention', 0)}</div>
                <div class="exec-stat-label">Needs Attention (YELLOW)</div>
            </div>
            <div class="exec-stat momentum">
                <div class="exec-stat-value" style="color: #0d6efd;">{executive_counts.get('areas_with_momentum', 0)}</div>
                <div class="exec-stat-label">Areas With Momentum</div>
            </div>
        </div>

        <div class="summary-cards">
            <div class="summary-card {'green' if grand_total.get('total_qtd_attainment_pct', 0) >= 90 else 'yellow' if grand_total.get('total_qtd_attainment_pct', 0) >= 70 else 'red'}">
                <h4>Combined QTD Attainment</h4>
                <div class="value">{format_percent(grand_total.get('total_qtd_attainment_pct'))}</div>
                <div class="detail">{format_currency(grand_total.get('total_qtd_acv'))} of {format_currency(grand_total.get('total_qtd_target'))} QTD Target</div>
            </div>

            <div class="summary-card">
                <h4>Q1 Target</h4>
                <div class="value">{format_currency(grand_total.get('total_q1_target'))}</div>
                <div class="detail">POR: {format_currency(quarterly_targets.get('POR_Q1_target'))} | R360: {format_currency(quarterly_targets.get('R360_Q1_target'))}</div>
            </div>

            <div class="summary-card">
                <h4>QTD Gap</h4>
                <div class="value" style="color: {'#dc3545' if grand_total.get('total_qtd_gap', 0) < 0 else '#28a745'}">{format_currency(grand_total.get('total_qtd_gap'))}</div>
                <div class="detail">{'Behind pace' if grand_total.get('total_qtd_gap', 0) < 0 else 'Ahead of pace'}</div>
            </div>

            <div class="summary-card">
                <h4>Pipeline Coverage</h4>
                <div class="value">{grand_total.get('total_pipeline_coverage_x', 0):.1f}x</div>
                <div class="detail">{format_currency(grand_total.get('total_pipeline_acv'))} open pipeline</div>
            </div>

            <div class="summary-card">
                <h4>Win Rate</h4>
                <div class="value">{format_percent(grand_total.get('total_win_rate_pct'))}</div>
                <div class="detail">{grand_total.get('total_qtd_deals', 0)} won / {grand_total.get('total_lost_deals', 0)} lost</div>
            </div>

            <div class="summary-card">
                <h4>Lost ACV (QTD)</h4>
                <div class="value" style="color: #dc3545">{format_currency(grand_total.get('total_lost_acv'))}</div>
                <div class="detail">{grand_total.get('total_lost_deals', 0)} deals lost this quarter</div>
            </div>
        </div>

        <!-- Product Performance -->
        <h2>Product Performance</h2>

        <div class="two-col">
"""

    # POR Performance Card
    por = product_totals.get("POR", {})
    por_rag = get_rag_from_pct(por.get("total_qtd_attainment_pct"))

    html += f"""
            <div class="product-section">
                <div class="product-header">
                    <span class="product-title">Point of Rental (POR)</span>
                    <span class="product-badge badge-por">POR</span>
                </div>
                <table>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>Q1 Target</td>
                        <td>{format_currency(por.get('total_q1_target'))}</td>
                    </tr>
                    <tr>
                        <td>QTD Target</td>
                        <td>{format_currency(por.get('total_qtd_target'))}</td>
                    </tr>
                    <tr>
                        <td>QTD Actual</td>
                        <td>{format_currency(por.get('total_qtd_acv'))}</td>
                    </tr>
                    <tr class="{get_rag_class(por_rag)}">
                        <td>QTD Attainment</td>
                        <td>{format_percent(por.get('total_qtd_attainment_pct'))}</td>
                    </tr>
                    <tr>
                        <td>Q1 Progress</td>
                        <td>{format_percent(por.get('total_q1_progress_pct'))}</td>
                    </tr>
                    <tr>
                        <td>QTD Gap</td>
                        <td style="color: {'#dc3545' if por.get('total_qtd_gap', 0) < 0 else '#28a745'}">{format_currency(por.get('total_qtd_gap'))}</td>
                    </tr>
                    <tr>
                        <td>Win Rate</td>
                        <td>{format_percent(por.get('total_win_rate_pct'))}</td>
                    </tr>
                    <tr>
                        <td>Pipeline Coverage</td>
                        <td>{por.get('total_pipeline_coverage_x', 0):.1f}x</td>
                    </tr>
                </table>
            </div>
"""

    # R360 Performance Card
    r360 = product_totals.get("R360", {})
    r360_rag = get_rag_from_pct(r360.get("total_qtd_attainment_pct"))

    html += f"""
            <div class="product-section">
                <div class="product-header">
                    <span class="product-title">Record360 (R360)</span>
                    <span class="product-badge badge-r360">R360</span>
                </div>
                <table>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>Q1 Target</td>
                        <td>{format_currency(r360.get('total_q1_target'))}</td>
                    </tr>
                    <tr>
                        <td>QTD Target</td>
                        <td>{format_currency(r360.get('total_qtd_target'))}</td>
                    </tr>
                    <tr>
                        <td>QTD Actual</td>
                        <td>{format_currency(r360.get('total_qtd_acv'))}</td>
                    </tr>
                    <tr class="{get_rag_class(r360_rag)}">
                        <td>QTD Attainment</td>
                        <td>{format_percent(r360.get('total_qtd_attainment_pct'))}</td>
                    </tr>
                    <tr>
                        <td>Q1 Progress</td>
                        <td>{format_percent(r360.get('total_q1_progress_pct'))}</td>
                    </tr>
                    <tr>
                        <td>QTD Gap</td>
                        <td style="color: {'#dc3545' if r360.get('total_qtd_gap', 0) < 0 else '#28a745'}">{format_currency(r360.get('total_qtd_gap'))}</td>
                    </tr>
                    <tr>
                        <td>Win Rate</td>
                        <td>{format_percent(r360.get('total_win_rate_pct'))}</td>
                    </tr>
                    <tr>
                        <td>Pipeline Coverage</td>
                        <td>{r360.get('total_pipeline_coverage_x', 0):.1f}x</td>
                    </tr>
                </table>
            </div>
        </div>
"""

    # ==========================================================================
    # WINS & BRIGHT SPOTS SECTION (NEW in v2.5.0)
    # ==========================================================================
    all_wins = wins_bright_spots.get("POR", []) + wins_bright_spots.get("R360", [])
    if all_wins:
        html += """
        <div class="wins-section">
            <h2>Wins & Bright Spots</h2>
            <p style="color: #155724; margin-bottom: 15px;">Areas pacing at or above 100% of target - celebrating strong performance!</p>
"""
        for win in all_wins:
            tier_class = "exceptional" if win.get("performance_tier") == "EXCEPTIONAL" else ""
            commentary = win.get("success_commentary", "")
            html += f"""
            <div class="win-card {tier_class}">
                <div class="win-header">
                    <span class="win-title">{win.get('product', '')} - {win.get('region', '')} {win.get('category', '')}</span>
                    <span class="win-pct">{win.get('qtd_attainment_pct', 0):.0f}%</span>
                </div>
                <div style="font-size: 12px; color: #6c757d;">
                    {format_currency(win.get('qtd_acv'))} of {format_currency(win.get('qtd_target'))} target |
                    Win Rate: {win.get('win_rate_pct', 0):.0f}% |
                    Pipeline: {win.get('pipeline_coverage_x', 0):.1f}x
                    {f" | {win.get('contributing_factor')}" if win.get('contributing_factor') else ""}
                </div>
                {f'<div class="win-commentary">{commentary}</div>' if commentary else ''}
            </div>
"""
        html += """
        </div>
"""

    # ==========================================================================
    # MOMENTUM INDICATORS SECTION (NEW in v2.5.0)
    # ==========================================================================
    all_momentum = momentum_indicators.get("POR", []) + momentum_indicators.get("R360", [])
    strong_momentum = [m for m in all_momentum if m.get("momentum_tier") in ["STRONG_MOMENTUM", "MODERATE_MOMENTUM"]]
    if strong_momentum:
        html += """
        <h2>Momentum Indicators</h2>
        <div class="note" style="background: #cce5ff; border-color: #0d6efd; color: #004085;">
            <strong>Positive Trends:</strong> Areas showing improving week-over-week performance even if not yet at target.
        </div>
        <table>
            <tr>
                <th>Product</th>
                <th>Region</th>
                <th>Momentum</th>
                <th>MQL Trend</th>
                <th>SQL Trend</th>
                <th>Commentary</th>
            </tr>
"""
        for m in strong_momentum:
            tier = m.get("momentum_tier", "").replace("_", " ").title()
            tier_class = "momentum-strong" if m.get("momentum_tier") == "STRONG_MOMENTUM" else "momentum-moderate"
            mql_arrow = "↑" if m.get("mql_trend") == "UP" else "↓" if m.get("mql_trend") == "DOWN" else "→"
            mql_color = "#28a745" if m.get("mql_trend") == "UP" else "#dc3545" if m.get("mql_trend") == "DOWN" else "#6c757d"
            sql_arrow = "↑" if m.get("sql_trend") == "UP" else "↓" if m.get("sql_trend") == "DOWN" else "→"
            sql_color = "#28a745" if m.get("sql_trend") == "UP" else "#dc3545" if m.get("sql_trend") == "DOWN" else "#6c757d"

            html += f"""
            <tr>
                <td>{m.get('product', '')}</td>
                <td>{m.get('region', '')}</td>
                <td><span class="momentum-badge {tier_class}">{tier}</span></td>
                <td style="color: {mql_color}; font-weight: bold;">{mql_arrow} {m.get('mql_wow_pct', 0) or 0}%</td>
                <td style="color: {sql_color}; font-weight: bold;">{sql_arrow} {m.get('sql_wow_pct', 0) or 0}%</td>
                <td style="font-size: 12px;">{m.get('momentum_commentary', '') or ''}</td>
            </tr>
"""
        html += """
        </table>
"""

    # Top Risk Pockets
    html += """
        <h2>Top Risk Pockets</h2>
        <p class="note">Areas requiring immediate attention, sorted by gap to QTD target.</p>

        <table>
            <tr>
                <th>Product</th>
                <th>Region</th>
                <th>Category</th>
                <th>QTD Target</th>
                <th>QTD Actual</th>
                <th>Gap</th>
                <th>Attainment</th>
                <th>Win Rate</th>
                <th>Pipeline</th>
                <th>Coverage</th>
                <th>Status</th>
            </tr>
"""

    for pocket in top_risk_pockets:
        rag = pocket.get("rag_status", "RED")
        html += f"""
            <tr>
                <td>{pocket.get('product', '')}</td>
                <td>{pocket.get('region', '')}</td>
                <td>{pocket.get('category', '')}</td>
                <td>{format_currency(pocket.get('qtd_target'))}</td>
                <td>{format_currency(pocket.get('qtd_acv'))}</td>
                <td style="color: #dc3545">{format_currency(pocket.get('qtd_gap'))}</td>
                <td>{format_percent(pocket.get('qtd_attainment_pct'))}</td>
                <td>{format_percent(pocket.get('win_rate_pct'))}</td>
                <td>{format_currency(pocket.get('pipeline_acv'))}</td>
                <td>{pocket.get('pipeline_coverage_x', 0):.1f}x</td>
                <td class="{get_rag_class(rag)}">{rag}</td>
            </tr>
"""

    html += """
        </table>
"""

    # Funnel Pacing Section
    html += """
        <h2>Inbound Funnel Pacing</h2>
        <div class="note">
            <strong>Important:</strong> MQL targets are INBOUND channel only.
            <ul style="margin-top: 8px; margin-left: 20px;">
                <li>EMEA is OUTBOUND-heavy: only 22% of NEW LOGO ACV from INBOUND</li>
                <li>APAC is INBOUND-heavy: 63% of NEW LOGO ACV from INBOUND</li>
            </ul>
        </div>
"""

    # POR Funnel
    html += """
        <h3>POR Funnel Pacing</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>MQL Actual</th>
                <th>MQL Target</th>
                <th>MQL %</th>
                <th>SQL Actual</th>
                <th>SQL Target</th>
                <th>SQL %</th>
                <th>SAL Actual</th>
                <th>SAL Target</th>
                <th>SAL %</th>
                <th>SQO Actual</th>
                <th>SQO Target</th>
                <th>SQO %</th>
            </tr>
"""

    for row in funnel_pacing.get("POR", []):
        mql_rag = row.get("mql_rag", "RED")
        sql_rag = row.get("sql_rag", "RED")
        sal_rag = row.get("sal_rag", "RED")
        sqo_rag = row.get("sqo_rag", "RED")

        html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('actual_mql', 0)}</td>
                <td>{row.get('target_mql', 0)}</td>
                <td class="{get_rag_class(mql_rag)}">{row.get('mql_pacing_pct', 0) or 0}%</td>
                <td>{row.get('actual_sql', 0)}</td>
                <td>{row.get('target_sql', 0)}</td>
                <td class="{get_rag_class(sql_rag)}">{row.get('sql_pacing_pct', 0) or 0}%</td>
                <td>{row.get('actual_sal', 0)}</td>
                <td>{row.get('target_sal', 0)}</td>
                <td class="{get_rag_class(sal_rag)}">{row.get('sal_pacing_pct', 0) or 0}%</td>
                <td>{row.get('actual_sqo', 0)}</td>
                <td>{row.get('target_sqo', 0)}</td>
                <td class="{get_rag_class(sqo_rag)}">{row.get('sqo_pacing_pct', 0) or 0}%</td>
            </tr>
"""

    html += """
        </table>
"""

    # R360 Funnel
    html += """
        <h3>R360 Funnel Pacing</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>MQL Actual</th>
                <th>MQL Target</th>
                <th>MQL %</th>
                <th>SQL Actual</th>
                <th>SQL Target</th>
                <th>SQL %</th>
                <th>SAL Actual</th>
                <th>SAL Target</th>
                <th>SAL %</th>
                <th>SQO Actual</th>
                <th>SQO Target</th>
                <th>SQO %</th>
            </tr>
"""

    for row in funnel_pacing.get("R360", []):
        mql_rag = row.get("mql_rag", "RED")
        sql_rag = row.get("sql_rag", "RED")
        sal_rag = row.get("sal_rag", "RED")
        sqo_rag = row.get("sqo_rag", "RED")

        html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('actual_mql', 0)}</td>
                <td>{row.get('target_mql', 0)}</td>
                <td class="{get_rag_class(mql_rag)}">{row.get('mql_pacing_pct', 0) or 0}%</td>
                <td>{row.get('actual_sql', 0)}</td>
                <td>{row.get('target_sql', 0)}</td>
                <td class="{get_rag_class(sql_rag)}">{row.get('sql_pacing_pct', 0) or 0}%</td>
                <td>{row.get('actual_sal', 0)}</td>
                <td>{row.get('target_sal', 0)}</td>
                <td class="{get_rag_class(sal_rag)}">{row.get('sal_pacing_pct', 0) or 0}%</td>
                <td>{row.get('actual_sqo', 0)}</td>
                <td>{row.get('target_sqo', 0)}</td>
                <td class="{get_rag_class(sqo_rag)}">{row.get('sqo_pacing_pct', 0) or 0}%</td>
            </tr>
"""

    html += """
        </table>
"""

    # Funnel Health Analysis Section (NEW in v2.4.0)
    html += """
        <h2>Funnel Health Analysis</h2>
        <div class="note">
            <strong>NEW:</strong> Stage-by-stage gap analysis with target conversion rates. Identifies bottleneck at each funnel stage.
        </div>
"""

    # Generate Funnel Health Visual for each product
    for product_name, badge_class in [("POR", "badge-por"), ("R360", "badge-r360")]:
        health_data = funnel_health.get(product_name, [])
        if health_data:
            html += f"""
        <h3>{product_name} Funnel Health by Region</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>MQL</th>
                <th>MQL Gap</th>
                <th>SQL</th>
                <th>SQL Gap</th>
                <th>SAL</th>
                <th>SAL Gap</th>
                <th>SQO</th>
                <th>SQO Gap</th>
                <th>Bottleneck</th>
            </tr>
"""
            for row in health_data:
                mql_rag = row.get("mql_rag", "RED")
                sql_rag = row.get("sql_rag", "RED")
                sal_rag = row.get("sal_rag", "RED")
                sqo_rag = row.get("sqo_rag", "RED")

                html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td class="{get_rag_class(mql_rag)}">{row.get('actual_mql', 0)} / {row.get('qtd_target_mql', 0)} ({row.get('mql_pacing_pct', 0) or 0}%)</td>
                <td style="color: {'#dc3545' if row.get('mql_gap', 0) < 0 else '#28a745'}">{row.get('mql_gap', 0):+d}</td>
                <td class="{get_rag_class(sql_rag)}">{row.get('actual_sql', 0)} / {row.get('qtd_target_sql', 0)} ({row.get('sql_pacing_pct', 0) or 0}%)</td>
                <td style="color: {'#dc3545' if row.get('sql_gap', 0) < 0 else '#28a745'}">{row.get('sql_gap', 0):+d}</td>
                <td class="{get_rag_class(sal_rag)}">{row.get('actual_sal', 0)} / {row.get('qtd_target_sal', 0)} ({row.get('sal_pacing_pct', 0) or 0}%)</td>
                <td style="color: {'#dc3545' if row.get('sal_gap', 0) < 0 else '#28a745'}">{row.get('sal_gap', 0):+d}</td>
                <td class="{get_rag_class(sqo_rag)}">{row.get('actual_sqo', 0)} / {row.get('qtd_target_sqo', 0)} ({row.get('sqo_pacing_pct', 0) or 0}%)</td>
                <td style="color: {'#dc3545' if row.get('sqo_gap', 0) < 0 else '#28a745'}">{row.get('sqo_gap', 0):+d}</td>
                <td><strong>{row.get('primary_bottleneck', 'N/A')}</strong></td>
            </tr>
"""
            html += """
        </table>
"""

    # Conversion Rate Comparison
    html += """
        <h3>Conversion Rate Analysis: Actual vs Target</h3>
        <table>
            <tr>
                <th>Product</th>
                <th>Region</th>
                <th>MQL→SQL Actual</th>
                <th>MQL→SQL Target</th>
                <th>Gap</th>
                <th>SQL→SAL Actual</th>
                <th>SQL→SAL Target</th>
                <th>Gap</th>
                <th>SAL→SQO Actual</th>
                <th>SAL→SQO Target</th>
                <th>Gap</th>
            </tr>
"""
    for product_name in ["POR", "R360"]:
        health_data = funnel_health.get(product_name, [])
        for row in health_data:
            mql_sql_gap = row.get('actual_mql_to_sql_rate', 0) - row.get('target_mql_to_sql_rate', 0)
            sql_sal_gap = row.get('actual_sql_to_sal_rate', 0) - row.get('target_sql_to_sal_rate', 0)
            sal_sqo_gap = row.get('actual_sal_to_sqo_rate', 0) - row.get('target_sal_to_sqo_rate', 0)

            html += f"""
            <tr>
                <td>{product_name}</td>
                <td>{row.get('region', '')}</td>
                <td>{row.get('actual_mql_to_sql_rate', 0):.1f}%</td>
                <td>{row.get('target_mql_to_sql_rate', 0):.1f}%</td>
                <td style="color: {'#dc3545' if mql_sql_gap < -5 else '#28a745' if mql_sql_gap > 0 else '#333'}">{mql_sql_gap:+.1f}%</td>
                <td>{row.get('actual_sql_to_sal_rate', 0):.1f}%</td>
                <td>{row.get('target_sql_to_sal_rate', 0):.1f}%</td>
                <td style="color: {'#dc3545' if sql_sal_gap < -5 else '#28a745' if sql_sal_gap > 0 else '#333'}">{sql_sal_gap:+.1f}%</td>
                <td>{row.get('actual_sal_to_sqo_rate', 0):.1f}%</td>
                <td>{row.get('target_sal_to_sqo_rate', 0):.1f}%</td>
                <td style="color: {'#dc3545' if sal_sqo_gap < -5 else '#28a745' if sal_sqo_gap > 0 else '#333'}">{sal_sqo_gap:+.1f}%</td>
            </tr>
"""
    html += """
        </table>
"""

    # RCA Commentary Section (NEW in v2.4.0)
    html += """
        <h2>Root Cause Analysis Commentary</h2>
        <div class="note">
            <strong>Auto-generated insights</strong> based on funnel gaps and conversion rate analysis. Sorted by severity.
        </div>
"""

    # POR RCA
    por_rca = funnel_rca_insights.get("POR", [])
    if por_rca:
        html += """
        <h3>POR Funnel RCA</h3>
        <div class="rca-section">
"""
        for insight in por_rca:
            severity = insight.get("severity", "MEDIUM").lower()
            severity_class = f"severity-{severity}"

            html += f"""
            <div class="rca-item {severity}">
                <div class="rca-header">
                    <span class="rca-region">{insight.get('region', '')} - Bottleneck: {insight.get('primary_bottleneck', 'N/A')}</span>
                    <span class="{severity_class}">{insight.get('severity', 'MEDIUM')}</span>
                </div>
                <div class="rca-commentary">{insight.get('rca_commentary', '')}</div>
                <div class="rca-action">→ {insight.get('recommended_action', '')}</div>
                <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
                    Pacing: MQL {insight.get('mql_pacing_pct', 0) or 0}% | SQL {insight.get('sql_pacing_pct', 0) or 0}% | SAL {insight.get('sal_pacing_pct', 0) or 0}% | SQO {insight.get('sqo_pacing_pct', 0) or 0}%
                </div>
            </div>
"""
        html += """
        </div>
"""

    # R360 RCA
    r360_rca = funnel_rca_insights.get("R360", [])
    if r360_rca:
        html += """
        <h3>R360 Funnel RCA</h3>
        <div class="rca-section">
"""
        for insight in r360_rca:
            severity = insight.get("severity", "MEDIUM").lower()
            severity_class = f"severity-{severity}"

            html += f"""
            <div class="rca-item {severity}">
                <div class="rca-header">
                    <span class="rca-region">{insight.get('region', '')} - Bottleneck: {insight.get('primary_bottleneck', 'N/A')}</span>
                    <span class="{severity_class}">{insight.get('severity', 'MEDIUM')}</span>
                </div>
                <div class="rca-commentary">{insight.get('rca_commentary', '')}</div>
                <div class="rca-action">→ {insight.get('recommended_action', '')}</div>
                <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
                    Pacing: MQL {insight.get('mql_pacing_pct', 0) or 0}% | SQL {insight.get('sql_pacing_pct', 0) or 0}% | SAL {insight.get('sal_pacing_pct', 0) or 0}% | SQO {insight.get('sqo_pacing_pct', 0) or 0}%
                </div>
            </div>
"""
        html += """
        </div>
"""

    # Funnel Trend Analysis (WoW) Section
    html += """
        <h2>Funnel Trend Analysis (Week-over-Week)</h2>
        <div class="note">
            <strong>Historical comparison:</strong> Current 7-day period vs prior 7-day period to identify momentum shifts.
        </div>
        <table>
            <tr>
                <th>Product</th>
                <th>Region</th>
                <th>MQL (7d)</th>
                <th>MQL Prior</th>
                <th>MQL WoW</th>
                <th>SQL (7d)</th>
                <th>SQL Prior</th>
                <th>SQL WoW</th>
                <th>SAL (7d)</th>
                <th>SAL Prior</th>
                <th>SAL WoW</th>
                <th>SQO (7d)</th>
                <th>SQO Prior</th>
                <th>SQO WoW</th>
            </tr>
"""
    for product_name in ["POR", "R360"]:
        trend_data = funnel_trends.get(product_name, [])
        for row in trend_data:
            mql_color = '#28a745' if row.get('mql_trend') == 'UP' else '#dc3545' if row.get('mql_trend') == 'DOWN' else '#6c757d'
            sql_color = '#28a745' if row.get('sql_trend') == 'UP' else '#dc3545' if row.get('sql_trend') == 'DOWN' else '#6c757d'
            sal_color = '#28a745' if row.get('sal_trend') == 'UP' else '#dc3545' if row.get('sal_trend') == 'DOWN' else '#6c757d'
            sqo_color = '#28a745' if row.get('sqo_trend') == 'UP' else '#dc3545' if row.get('sqo_trend') == 'DOWN' else '#6c757d'

            mql_arrow = '↑' if row.get('mql_trend') == 'UP' else '↓' if row.get('mql_trend') == 'DOWN' else '→'
            sql_arrow = '↑' if row.get('sql_trend') == 'UP' else '↓' if row.get('sql_trend') == 'DOWN' else '→'
            sal_arrow = '↑' if row.get('sal_trend') == 'UP' else '↓' if row.get('sal_trend') == 'DOWN' else '→'
            sqo_arrow = '↑' if row.get('sqo_trend') == 'UP' else '↓' if row.get('sqo_trend') == 'DOWN' else '→'

            html += f"""
            <tr>
                <td>{product_name}</td>
                <td>{row.get('region', '')}</td>
                <td>{row.get('mql_current_7d', 0)}</td>
                <td>{row.get('mql_prior_7d', 0)}</td>
                <td style="color: {mql_color}; font-weight: bold;">{mql_arrow} {row.get('mql_wow_change', 0):+d} ({row.get('mql_wow_pct', 0) or 0}%)</td>
                <td>{row.get('sql_current_7d', 0)}</td>
                <td>{row.get('sql_prior_7d', 0)}</td>
                <td style="color: {sql_color}; font-weight: bold;">{sql_arrow} {row.get('sql_wow_change', 0):+d} ({row.get('sql_wow_pct', 0) or 0}%)</td>
                <td>{row.get('sal_current_7d', 0)}</td>
                <td>{row.get('sal_prior_7d', 0)}</td>
                <td style="color: {sal_color}; font-weight: bold;">{sal_arrow} {row.get('sal_wow_change', 0):+d} ({row.get('sal_wow_pct', 0) or 0}%)</td>
                <td>{row.get('sqo_current_7d', 0)}</td>
                <td>{row.get('sqo_prior_7d', 0)}</td>
                <td style="color: {sqo_color}; font-weight: bold;">{sqo_arrow} {row.get('sqo_wow_change', 0):+d} ({row.get('sqo_wow_pct', 0) or 0}%)</td>
            </tr>
"""
    html += """
        </table>
"""

    # Loss Reason RCA Section
    html += """
        <h2>Loss Reason Root Cause Analysis</h2>
        <div class="note">
            <strong>Auto-generated insights</strong> based on top close-lost reasons by ACV. Sorted by severity.
        </div>
"""

    # POR Loss Reason RCA
    por_loss_rca = loss_reason_rca.get("POR", [])
    if por_loss_rca:
        html += """
        <h3>POR Loss Reason RCA</h3>
        <div class="rca-section">
"""
        for insight in por_loss_rca:
            severity = insight.get("severity", "MEDIUM").lower()
            severity_class = f"severity-{severity}"
            action_cat = insight.get("action_category", "PROCESS_REVIEW")

            html += f"""
            <div class="rca-item {severity}">
                <div class="rca-header">
                    <span class="rca-region">{insight.get('region', '')} - {insight.get('loss_reason', 'Unknown')}</span>
                    <span class="{severity_class}">{insight.get('severity', 'MEDIUM')}</span>
                </div>
                <div class="rca-commentary">{insight.get('rca_commentary', '')}</div>
                <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
                    {insight.get('deal_count', 0)} deals | {format_currency(insight.get('lost_acv'))} lost | {insight.get('pct_of_regional_loss', 0):.1f}% of regional losses | Action: {action_cat}
                </div>
            </div>
"""
        html += """
        </div>
"""
    else:
        html += """
        <h3>POR Loss Reason RCA</h3>
        <p>No significant loss reasons to analyze this quarter.</p>
"""

    # R360 Loss Reason RCA
    r360_loss_rca = loss_reason_rca.get("R360", [])
    if r360_loss_rca:
        html += """
        <h3>R360 Loss Reason RCA</h3>
        <div class="rca-section">
"""
        for insight in r360_loss_rca:
            severity = insight.get("severity", "MEDIUM").lower()
            severity_class = f"severity-{severity}"
            action_cat = insight.get("action_category", "PROCESS_REVIEW")

            html += f"""
            <div class="rca-item {severity}">
                <div class="rca-header">
                    <span class="rca-region">{insight.get('region', '')} - {insight.get('loss_reason', 'Unknown')}</span>
                    <span class="{severity_class}">{insight.get('severity', 'MEDIUM')}</span>
                </div>
                <div class="rca-commentary">{insight.get('rca_commentary', '')}</div>
                <div style="margin-top: 8px; font-size: 11px; color: #6c757d;">
                    {insight.get('deal_count', 0)} deals | {format_currency(insight.get('lost_acv'))} lost | {insight.get('pct_of_regional_loss', 0):.1f}% of regional losses | Action: {action_cat}
                </div>
            </div>
"""
        html += """
        </div>
"""
    else:
        html += """
        <h3>R360 Loss Reason RCA</h3>
        <p>No significant loss reasons to analyze this quarter.</p>
"""

    # Pipeline Analysis
    html += """
        <h2>Pipeline Analysis</h2>
        <div class="filter-note">
            <strong>Filters Applied:</strong> Pipeline includes only opportunities created in last 6 months, owned by AE/AM roles (Account Executive, Account Manager, R360 Sales User).
        </div>
"""

    # Detailed Attainment Tables
    html += """
        <h3>POR Detailed Attainment by Region/Category</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>Category</th>
                <th>Q1 Target</th>
                <th>QTD Target</th>
                <th>QTD Actual</th>
                <th>Attainment</th>
                <th>Gap</th>
                <th>Pipeline</th>
                <th>Opps</th>
                <th>Avg Age</th>
                <th>Coverage</th>
                <th>Status</th>
            </tr>
"""

    for row in attainment_detail.get("POR", []):
        rag = row.get("rag_status", "RED")
        html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('category', '')}</td>
                <td>{format_currency(row.get('q1_target'))}</td>
                <td>{format_currency(row.get('qtd_target'))}</td>
                <td>{format_currency(row.get('qtd_acv'))}</td>
                <td class="{get_rag_class(rag)}">{format_percent(row.get('qtd_attainment_pct'))}</td>
                <td style="color: {'#dc3545' if row.get('qtd_gap', 0) < 0 else '#28a745'}">{format_currency(row.get('qtd_gap'))}</td>
                <td>{format_currency(row.get('pipeline_acv'))}</td>
                <td>{row.get('pipeline_opps', 0)}</td>
                <td>{row.get('pipeline_avg_age_days', 0)} days</td>
                <td>{row.get('pipeline_coverage_x', 0):.1f}x</td>
                <td class="{get_rag_class(rag)}">{rag}</td>
            </tr>
"""

    html += """
        </table>

        <h3>R360 Detailed Attainment by Region/Category</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>Category</th>
                <th>Q1 Target</th>
                <th>QTD Target</th>
                <th>QTD Actual</th>
                <th>Attainment</th>
                <th>Gap</th>
                <th>Pipeline</th>
                <th>Opps</th>
                <th>Avg Age</th>
                <th>Coverage</th>
                <th>Status</th>
            </tr>
"""

    for row in attainment_detail.get("R360", []):
        rag = row.get("rag_status", "RED")
        html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('category', '')}</td>
                <td>{format_currency(row.get('q1_target'))}</td>
                <td>{format_currency(row.get('qtd_target'))}</td>
                <td>{format_currency(row.get('qtd_acv'))}</td>
                <td class="{get_rag_class(rag)}">{format_percent(row.get('qtd_attainment_pct'))}</td>
                <td style="color: {'#dc3545' if row.get('qtd_gap', 0) < 0 else '#28a745'}">{format_currency(row.get('qtd_gap'))}</td>
                <td>{format_currency(row.get('pipeline_acv'))}</td>
                <td>{row.get('pipeline_opps', 0)}</td>
                <td>{row.get('pipeline_avg_age_days', 0)} days</td>
                <td>{row.get('pipeline_coverage_x', 0):.1f}x</td>
                <td class="{get_rag_class(rag)}">{rag}</td>
            </tr>
"""

    html += """
        </table>
"""

    # Loss Analysis
    html += """
        <h2>Close Lost Analysis</h2>
"""

    # R360 Loss Reasons (POR has none in data)
    r360_losses = loss_reasons.get("R360", [])
    if r360_losses:
        html += """
        <h3>R360 Loss Reasons (Top 5 by Region)</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>Loss Reason</th>
                <th>Deal Count</th>
                <th>Lost ACV</th>
            </tr>
"""
        for row in r360_losses:
            html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('loss_reason', '')}</td>
                <td>{row.get('deal_count', 0)}</td>
                <td>{format_currency(row.get('lost_acv'))}</td>
            </tr>
"""
        html += """
        </table>
"""
    else:
        html += """
        <p>No lost deals recorded for R360 this quarter.</p>
"""

    por_losses = loss_reasons.get("POR", [])
    if por_losses:
        html += """
        <h3>POR Loss Reasons (Top 5 by Region)</h3>
        <table>
            <tr>
                <th>Region</th>
                <th>Loss Reason</th>
                <th>Deal Count</th>
                <th>Lost ACV</th>
            </tr>
"""
        for row in por_losses:
            html += f"""
            <tr>
                <td>{row.get('region', '')}</td>
                <td>{row.get('loss_reason', '')}</td>
                <td>{row.get('deal_count', 0)}</td>
                <td>{format_currency(row.get('lost_acv'))}</td>
            </tr>
"""
        html += """
        </table>
"""
    else:
        html += """
        <h3>POR Loss Reasons</h3>
        <p>No lost deals recorded for POR this quarter.</p>
"""

    # Google Ads Summary
    html += """
        <h2>Google Ads Performance (QTD)</h2>
        <table>
            <tr>
                <th>Product</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Ad Spend</th>
                <th>CPC</th>
                <th>Conversions</th>
                <th>CPA</th>
            </tr>
"""

    por_ads = google_ads.get("POR", {})
    r360_ads = google_ads.get("R360", {})

    html += f"""
            <tr>
                <td>POR</td>
                <td>{por_ads.get('impressions', 0):,}</td>
                <td>{por_ads.get('clicks', 0):,}</td>
                <td>{por_ads.get('ctr_pct', 0):.2f}%</td>
                <td>{format_currency(por_ads.get('ad_spend_usd'))}</td>
                <td>{format_currency(por_ads.get('cpc_usd'))}</td>
                <td>{por_ads.get('conversions', 0):.1f}</td>
                <td>{format_currency(por_ads.get('cpa_usd'))}</td>
            </tr>
            <tr>
                <td>R360</td>
                <td>{r360_ads.get('impressions', 0):,}</td>
                <td>{r360_ads.get('clicks', 0):,}</td>
                <td>{r360_ads.get('ctr_pct', 0):.2f}%</td>
                <td>{format_currency(r360_ads.get('ad_spend_usd'))}</td>
                <td>{format_currency(r360_ads.get('cpc_usd'))}</td>
                <td>{r360_ads.get('conversions', 0):.1f}</td>
                <td>{format_currency(r360_ads.get('cpa_usd'))}</td>
            </tr>
        </table>
"""

    # ==========================================================================
    # PIPELINE RCA SECTION (NEW in v2.5.0)
    # ==========================================================================
    all_pipeline_rca = pipeline_rca.get("POR", []) + pipeline_rca.get("R360", [])
    pipeline_issues = [p for p in all_pipeline_rca if p.get("severity") in ["CRITICAL", "HIGH", "MEDIUM"]]
    if pipeline_issues:
        html += """
        <h2>Pipeline Coverage Analysis</h2>
        <p class="note">Pipeline health and coverage analysis with root cause insights.</p>
        <table>
            <tr>
                <th>Product</th>
                <th>Region</th>
                <th>Category</th>
                <th>Pipeline</th>
                <th>Coverage</th>
                <th>Avg Age</th>
                <th>Health</th>
                <th>Severity</th>
                <th>RCA Commentary</th>
            </tr>
"""
        for p in pipeline_issues:
            health = p.get("pipeline_health", "")
            health_color = "#28a745" if health == "HEALTHY" else "#ffc107" if health == "ADEQUATE" else "#fd7e14" if health == "AT_RISK" else "#dc3545"
            severity = p.get("severity", "")
            severity_color = "#dc3545" if severity == "CRITICAL" else "#fd7e14" if severity == "HIGH" else "#ffc107"

            html += f"""
            <tr>
                <td>{p.get('product', '')}</td>
                <td>{p.get('region', '')}</td>
                <td>{p.get('category', '')}</td>
                <td>{format_currency(p.get('pipeline_acv'))}</td>
                <td>{p.get('pipeline_coverage_x', 0):.1f}x</td>
                <td>{p.get('pipeline_avg_age_days', 0):.0f} days</td>
                <td><span style="color: {health_color}; font-weight: bold;">{health}</span></td>
                <td><span style="color: {severity_color}; font-weight: bold;">{severity}</span></td>
                <td style="font-size: 11px;">{p.get('rca_commentary', '') or ''}</td>
            </tr>
"""
        html += """
        </table>
"""

    # ==========================================================================
    # TREND RCA SECTION (NEW in v2.5.0 - Declining Trends)
    # ==========================================================================
    all_trend_rca = trend_rca.get("POR", []) + trend_rca.get("R360", [])
    if all_trend_rca:
        html += """
        <h2>Trend Analysis RCA</h2>
        <p class="note" style="background: #f8d7da; border-color: #dc3545; color: #721c24;">
            <strong>Alert:</strong> Areas showing declining week-over-week trends requiring investigation.
        </p>
        <table>
            <tr>
                <th>Product</th>
                <th>Region</th>
                <th>Declining Stages</th>
                <th>MQL WoW</th>
                <th>SQL WoW</th>
                <th>Severity</th>
                <th>RCA Commentary</th>
                <th>Recommended Action</th>
            </tr>
"""
        for t in all_trend_rca:
            severity = t.get("severity", "")
            severity_color = "#dc3545" if severity == "CRITICAL" else "#fd7e14" if severity == "HIGH" else "#ffc107"
            declining = t.get("declining_stage_count", 0)

            mql_pct = t.get("mql_wow_pct") or 0
            sql_pct = t.get("sql_wow_pct") or 0

            html += f"""
            <tr>
                <td>{t.get('product', '')}</td>
                <td>{t.get('region', '')}</td>
                <td>{declining} stage{'s' if declining != 1 else ''}</td>
                <td style="color: {'#dc3545' if mql_pct < 0 else '#28a745'};">{mql_pct:+.0f}%</td>
                <td style="color: {'#dc3545' if sql_pct < 0 else '#28a745'};">{sql_pct:+.0f}%</td>
                <td><span style="color: {severity_color}; font-weight: bold;">{severity}</span></td>
                <td style="font-size: 11px;">{t.get('rca_commentary', '') or ''}</td>
                <td style="font-size: 11px; color: #0066cc;">{t.get('recommended_action', '') or ''}</td>
            </tr>
"""
        html += """
        </table>
"""

    # ==========================================================================
    # GOOGLE ADS RCA SECTION (NEW in v2.5.0)
    # ==========================================================================
    html += """
        <h2>Google Ads Performance RCA</h2>
"""
    for product in ["POR", "R360"]:
        ads_rca_data = google_ads_rca.get(product, {})
        if ads_rca_data:
            ctr_perf = ads_rca_data.get("ctr_performance", "")
            cpa_perf = ads_rca_data.get("cpa_performance", "")
            severity = ads_rca_data.get("severity", "LOW")

            ctr_color = "#28a745" if ctr_perf == "STRONG" else "#ffc107" if ctr_perf == "AVERAGE" else "#dc3545"
            cpa_color = "#28a745" if cpa_perf == "EFFICIENT" else "#ffc107" if cpa_perf == "AVERAGE" else "#dc3545"
            border_color = "#28a745" if severity == "LOW" else "#ffc107" if severity == "MEDIUM" else "#dc3545"

            html += f"""
        <div class="rca-card" style="border-left: 4px solid {border_color}; padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-weight: 600; font-size: 14px;">{product} Google Ads</span>
                <span class="severity {severity.lower()}" style="padding: 3px 8px; border-radius: 3px; font-size: 11px; background: {'#d4edda' if severity == 'LOW' else '#fff3cd' if severity == 'MEDIUM' else '#f8d7da'}; color: {'#155724' if severity == 'LOW' else '#856404' if severity == 'MEDIUM' else '#721c24'};">{severity}</span>
            </div>
            <div style="margin: 10px 0; font-size: 13px;">
                <span style="margin-right: 15px;"><strong>CTR:</strong> <span style="color: {ctr_color};">{ads_rca_data.get('ctr_pct', 0):.2f}%</span> ({ctr_perf})</span>
                <span style="margin-right: 15px;"><strong>CPC:</strong> ${ads_rca_data.get('cpc_usd', 0):.2f}</span>
                <span><strong>CPA:</strong> <span style="color: {cpa_color};">${ads_rca_data.get('cpa_usd', 0):.0f}</span> ({cpa_perf})</span>
            </div>
            <div style="font-size: 13px; margin-top: 8px;">{ads_rca_data.get('rca_commentary', '')}</div>
            <div style="font-size: 12px; color: #0066cc; margin-top: 8px; font-style: italic;">
                → {ads_rca_data.get('recommended_action', '')}
            </div>
        </div>
"""

    # ==========================================================================
    # CONSOLIDATED ACTION ITEMS SECTION (NEW in v2.5.0)
    # ==========================================================================
    immediate_items = action_items.get("immediate", [])
    short_term_items = action_items.get("short_term", [])
    strategic_items = action_items.get("strategic", [])

    if immediate_items or short_term_items or strategic_items:
        html += """
        <h2>Recommended Action Items</h2>
        <p class="note">Consolidated action items from all analyses, grouped by urgency.</p>
        <div class="action-section">
"""
        # Immediate actions
        if immediate_items:
            html += """
            <div class="action-group immediate">
                <h4>IMMEDIATE (This Week)</h4>
"""
            for item in immediate_items[:5]:  # Limit to top 5
                severity_class = (item.get("severity") or "").lower()
                html += f"""
                <div class="action-item {severity_class}">
                    <div class="action-meta">
                        <span>{item.get('product', '')}</span>
                        <span>{item.get('region', '') or 'All Regions'}</span>
                        <span>{item.get('category', '')}</span>
                        <span style="background: {'#f8d7da' if severity_class == 'critical' else '#fff3cd'};">{item.get('severity', '')}</span>
                    </div>
                    <div class="action-issue">{item.get('issue', '')}</div>
                    <div class="action-text">→ {item.get('action', '')}</div>
                </div>
"""
            html += """
            </div>
"""

        # Short-term actions
        if short_term_items:
            html += """
            <div class="action-group short-term">
                <h4>SHORT-TERM (This Month)</h4>
"""
            for item in short_term_items[:5]:  # Limit to top 5
                severity_class = (item.get("severity") or "").lower()
                html += f"""
                <div class="action-item {severity_class}">
                    <div class="action-meta">
                        <span>{item.get('product', '')}</span>
                        <span>{item.get('region', '') or 'All Regions'}</span>
                        <span>{item.get('category', '')}</span>
                    </div>
                    <div class="action-issue">{item.get('issue', '')}</div>
                    <div class="action-text">→ {item.get('action', '')}</div>
                </div>
"""
            html += """
            </div>
"""

        # Strategic actions
        if strategic_items:
            html += """
            <div class="action-group strategic">
                <h4>STRATEGIC (This Quarter)</h4>
"""
            for item in strategic_items[:5]:  # Limit to top 5
                html += f"""
                <div class="action-item">
                    <div class="action-meta">
                        <span>{item.get('product', '')}</span>
                        <span>{item.get('region', '') or 'All Regions'}</span>
                        <span>{item.get('category', '')}</span>
                    </div>
                    <div class="action-issue">{item.get('issue', '')}</div>
                    <div class="action-text">→ {item.get('action', '')}</div>
                </div>
"""
            html += """
            </div>
"""
        html += """
        </div>
"""

    # Footer
    html += f"""
        <div class="footer">
            <p>Generated by Risk Analysis Report Generator v{query_version}</p>
            <p>Data Source: BigQuery (sfdc.OpportunityViewTable, Staging.StrategicOperatingPlan, Staging.DailyRevenueFunnel)</p>
            <p>Query Version: {query_version} | Features: Wins & Bright Spots, Momentum Indicators, Pipeline RCA, Trend RCA, Google Ads RCA, Consolidated Action Items</p>
        </div>
    </div>
</body>
</html>
"""

    return html


def main():
    print("=" * 60)
    print("Q1 2026 Bookings Risk Analysis HTML Report Generator")
    print("=" * 60)

    # Run BigQuery
    print("\n[1/3] Running BigQuery query...")
    data = run_bigquery()
    print(f"      Query returned data for report date: {data.get('report_date')}")

    # Generate HTML
    print("\n[2/3] Generating HTML report...")
    html = generate_html(data)

    # Save to file
    today = datetime.now().strftime("%Y-%m-%d")
    output_dir = Path(__file__).parent / "reports"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"Q1_2026_Risk_Report_{today}.html"

    print(f"\n[3/3] Saving report to: {output_path}")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    # Summary
    print("\n" + "=" * 60)
    print("REPORT GENERATION COMPLETE")
    print("=" * 60)
    print(f"Report Date:    {data.get('report_date')}")
    print(f"Q1 Progress:    {data['period']['quarter_pct_complete']:.1f}%")
    print(f"POR Target:     ${data['quarterly_targets']['POR_Q1_target']:,.0f}")
    print(f"R360 Target:    ${data['quarterly_targets']['R360_Q1_target']:,.0f}")
    print(f"Combined:       ${data['quarterly_targets']['combined_Q1_target']:,.0f}")
    print(f"QTD Attainment: {data['grand_total']['total_qtd_attainment_pct']:.1f}%")
    print(f"\nOutput File:    {output_path}")
    print("=" * 60)

    return output_path


if __name__ == "__main__":
    main()
