#!/usr/bin/env python3
"""
Trend Analysis Data Generator

Executes the trend analysis BigQuery query with date parameters and saves
the results to data/trend-analysis.json.

Usage:
    python scripts/generate-trend-data.py \
        --start-date=2026-01-08 \
        --end-date=2026-01-14 \
        --prev-start-date=2026-01-01 \
        --prev-end-date=2026-01-07 \
        --products=POR,R360 \
        --regions=AMER,EMEA,APAC

Requirements:
    - Google Cloud SDK (bq command)
    - Authenticated with BigQuery access
"""

import argparse
import json
import subprocess
import sys
import re
from datetime import datetime
from pathlib import Path


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Generate trend analysis data from BigQuery')
    parser.add_argument('--start-date', required=True, help='Current period start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', required=True, help='Current period end date (YYYY-MM-DD)')
    parser.add_argument('--prev-start-date', required=True, help='Previous period start date (YYYY-MM-DD)')
    parser.add_argument('--prev-end-date', required=True, help='Previous period end date (YYYY-MM-DD)')
    parser.add_argument('--products', default='POR,R360', help='Comma-separated list of products')
    parser.add_argument('--regions', default='AMER,EMEA,APAC', help='Comma-separated list of regions')
    return parser.parse_args()


def validate_date(date_str):
    """Validate date format."""
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return True
    except ValueError:
        return False


def run_bigquery(args):
    """Execute the trend analysis query and return JSON result."""
    # Get the path to the SQL file
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    query_path = project_root / "query_trend_analysis.sql"

    if not query_path.exists():
        print(f"Error: SQL file not found at {query_path}")
        sys.exit(1)

    # Read the query template
    with open(query_path, 'r') as f:
        query = f.read()

    # Replace parameters in the query
    query = query.replace('@start_date', f"'{args.start_date}'")
    query = query.replace('@end_date', f"'{args.end_date}'")
    query = query.replace('@prev_start_date', f"'{args.prev_start_date}'")
    query = query.replace('@prev_end_date', f"'{args.prev_end_date}'")
    query = query.replace('@products', f"'{args.products}'")
    query = query.replace('@regions', f"'{args.regions}'")

    print(f"Running trend analysis query...")
    print(f"Current period: {args.start_date} to {args.end_date}")
    print(f"Previous period: {args.prev_start_date} to {args.prev_end_date}")
    print(f"Products: {args.products}")
    print(f"Regions: {args.regions}")
    print(f"Started at: {datetime.now().isoformat()}")

    try:
        result = subprocess.run(
            ["bq", "query", "--use_legacy_sql=false", "--format=json", "--max_rows=100000"],
            input=query,
            capture_output=True,
            text=True,
            timeout=180  # 3 minute timeout
        )
    except subprocess.TimeoutExpired:
        print("Error: BigQuery query timed out after 3 minutes")
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
        data = json.loads(rows[0]["trend_analysis_json"])
    except (KeyError, json.JSONDecodeError) as e:
        print(f"Error parsing JSON result: {e}")
        sys.exit(1)

    return data


def save_data(data):
    """Save the data to trend-analysis.json."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    output_path = project_root / "data" / "trend-analysis.json"

    # Ensure data directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Data saved to: {output_path}")
    return output_path


def print_summary(data):
    """Print a summary of the generated data."""
    print("\n" + "=" * 60)
    print("TREND ANALYSIS COMPLETE")
    print("=" * 60)

    period_info = data.get("periodInfo", {})
    current = period_info.get("current", {})
    previous = period_info.get("previous", {})

    print(f"Current Period: {current.get('startDate', 'N/A')} to {current.get('endDate', 'N/A')}")
    print(f"Previous Period: {previous.get('startDate', 'N/A')} to {previous.get('endDate', 'N/A')}")
    print(f"Days in Period: {period_info.get('daysInPeriod', 0)}")
    print()

    revenue = data.get("revenueSummary", {})
    acv = revenue.get("totalACV", {})
    deals = revenue.get("wonDeals", {})

    print("Revenue Summary:")
    print(f"  Total ACV: ${acv.get('current', 0):,.0f} (prev: ${acv.get('previous', 0):,.0f}) → {acv.get('trend', 'N/A')}")
    print(f"  Won Deals: {deals.get('current', 0)} (prev: {deals.get('previous', 0)}) → {deals.get('trend', 'N/A')}")
    print()

    funnel = data.get("funnelSummary", {})
    mql = funnel.get("totalMQL", {})
    sql = funnel.get("totalSQL", {})

    print("Funnel Summary:")
    print(f"  Total MQL: {mql.get('current', 0)} (prev: {mql.get('previous', 0)}) → {mql.get('trend', 'N/A')}")
    print(f"  Total SQL: {sql.get('current', 0)} (prev: {sql.get('previous', 0)}) → {sql.get('trend', 'N/A')}")
    print("=" * 60)


def main():
    """Main entry point."""
    args = parse_args()

    # Validate dates
    for date_name, date_val in [
        ('start-date', args.start_date),
        ('end-date', args.end_date),
        ('prev-start-date', args.prev_start_date),
        ('prev-end-date', args.prev_end_date),
    ]:
        if not validate_date(date_val):
            print(f"Error: Invalid date format for {date_name}: {date_val}")
            print("Expected format: YYYY-MM-DD")
            sys.exit(1)

    print("=" * 60)
    print("Trend Analysis Data Generator")
    print("=" * 60)

    # Run the query
    data = run_bigquery(args)

    # Save the data
    save_data(data)

    # Print summary
    print_summary(data)

    print("\nSuccess! Trend data is ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
