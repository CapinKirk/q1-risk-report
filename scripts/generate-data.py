#!/usr/bin/env python3
"""
Generate JSON data for the Q1 2026 Risk Report web application.
Runs the BigQuery query and saves the result as JSON for the Next.js app.

Usage:
    python scripts/generate-data.py
"""

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_bigquery():
    """Execute the comprehensive risk analysis query and return JSON result."""
    query_path = Path(__file__).parent.parent / "query_comprehensive_risk_analysis.sql"

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


def main():
    print("=" * 60)
    print("Q1 2026 Risk Report - Data Generation")
    print("=" * 60)

    # Run BigQuery
    print("\n[1/2] Running BigQuery query...")
    data = run_bigquery()
    print(f"      Data for: {data.get('report_date')}")

    # Save to JSON file
    output_path = Path(__file__).parent.parent / "data" / "report-data.json"
    output_path.parent.mkdir(exist_ok=True)

    print(f"\n[2/2] Saving to: {output_path}")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    # Summary
    print("\n" + "=" * 60)
    print("DATA GENERATION COMPLETE")
    print("=" * 60)
    print(f"Output: {output_path}")
    print(f"Report Date: {data.get('report_date')}")
    print(f"QTD Attainment: {data['grand_total']['total_qtd_attainment_pct']:.1f}%")
    print("=" * 60)

    return output_path


if __name__ == "__main__":
    main()
