#!/usr/bin/env python3
"""
Q1 2026 Risk Report Data Generator

Executes the comprehensive risk analysis BigQuery query and saves
the results to data/report-data.json for the Next.js app.

Usage:
    python scripts/generate-data.py

Requirements:
    - Google Cloud SDK (bq command)
    - Authenticated with BigQuery access
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_bigquery():
    """Execute the comprehensive risk analysis query and return JSON result."""
    # Get the path to the SQL file relative to this script
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    query_path = project_root / "query_comprehensive_risk_analysis.sql"

    if not query_path.exists():
        print(f"Error: SQL file not found at {query_path}")
        sys.exit(1)

    print(f"Running BigQuery query from: {query_path}")
    print(f"Started at: {datetime.now().isoformat()}")

    try:
        result = subprocess.run(
            ["bq", "query", "--use_legacy_sql=false", "--format=json", "--max_rows=100000"],
            stdin=open(query_path, "r"),
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
    except subprocess.TimeoutExpired:
        print("Error: BigQuery query timed out after 5 minutes")
        sys.exit(1)
    except FileNotFoundError:
        print("Error: 'bq' command not found. Please install Google Cloud SDK.")
        sys.exit(1)

    if result.returncode != 0:
        print(f"Error running BigQuery: {result.stderr}")
        sys.exit(1)

    # Parse the outer JSON array
    try:
        rows = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"Error parsing BigQuery output: {e}")
        print(f"Output was: {result.stdout[:500]}...")
        sys.exit(1)

    if not rows:
        print("Error: No data returned from BigQuery")
        sys.exit(1)

    # Parse the inner JSON string
    try:
        data = json.loads(rows[0]["comprehensive_risk_analysis_json"])
    except (KeyError, json.JSONDecodeError) as e:
        print(f"Error parsing JSON result: {e}")
        sys.exit(1)

    return data


def save_data(data):
    """Save the data to report-data.json."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_path = project_root / "data" / "report-data.json"

    # Ensure data directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Add generation timestamp
    data["generated_at_utc"] = datetime.utcnow().isoformat()

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Data saved to: {output_path}")
    return output_path


def print_summary(data):
    """Print a summary of the generated data."""
    print("\n" + "=" * 60)
    print("DATA GENERATION COMPLETE")
    print("=" * 60)

    period = data.get("period", {})
    grand_total = data.get("grand_total", {})

    print(f"Report Date: {period.get('as_of_date', 'N/A')}")
    print(f"Quarter Progress: {period.get('quarter_pct_complete', 0):.1f}%")
    print(f"Days Elapsed: {period.get('days_elapsed', 0)}/{period.get('total_days', 90)}")
    print()
    print(f"QTD Attainment: {grand_total.get('total_qtd_attainment_pct', 0):.1f}%")
    print(f"QTD ACV: ${grand_total.get('total_qtd_acv', 0):,.0f}")
    print(f"Pipeline: ${grand_total.get('total_pipeline_acv', 0):,.0f}")
    print()

    # Count deals
    won_deals = data.get("won_deals", {})
    lost_deals = data.get("lost_deals", {})
    pipeline_deals = data.get("pipeline_deals", {})

    won_count = len(won_deals.get("POR", [])) + len(won_deals.get("R360", []))
    lost_count = len(lost_deals.get("POR", [])) + len(lost_deals.get("R360", []))
    pipeline_count = len(pipeline_deals.get("POR", [])) + len(pipeline_deals.get("R360", []))

    print(f"Won Deals: {won_count}")
    print(f"Lost Deals: {lost_count}")
    print(f"Pipeline Deals: {pipeline_count}")
    print("=" * 60)


def main():
    """Main entry point."""
    print("=" * 60)
    print("Q1 2026 Risk Report Data Generator")
    print("=" * 60)

    # Run the query
    data = run_bigquery()

    # Save the data
    save_data(data)

    # Print summary
    print_summary(data)

    print("\nSuccess! Data is ready for the Next.js app.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
