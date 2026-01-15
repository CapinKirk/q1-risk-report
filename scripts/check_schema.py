#!/usr/bin/env python3
"""Quick script to check InboundFunnel schema and investigate SQL records without OpportunityID."""

from google.cloud import bigquery
import json

client = bigquery.Client(project='data-analytics-306119')

# Get all columns from InboundFunnel
schema_query = """
SELECT column_name, data_type
FROM `data-analytics-306119.MarketingFunnel`.INFORMATION_SCHEMA.COLUMNS
WHERE table_name = 'InboundFunnel'
ORDER BY column_name
"""

print("=== InboundFunnel Columns ===")
schema_results = client.query(schema_query).result()
columns = [dict(row) for row in schema_results]
for col in columns:
    print(f"  {col['column_name']}: {col['data_type']}")

# Get columns related to status/delete/convert
relevant_cols = [c['column_name'] for c in columns if any(k in c['column_name'].lower() for k in ['status', 'delete', 'convert', 'disq', 'revert', 'opp', 'reason'])]
print(f"\n=== Relevant Columns for Investigation ===")
print(relevant_cols)

# Query SQL records without opportunities
investigate_query = """
SELECT
  COALESCE(Company, 'Unknown') AS company_name,
  Division,
  SDRSource AS source,
  CAST(SQL_DT AS STRING) AS sql_date,
  CAST(MQL_DT AS STRING) AS mql_date,
  OpportunityID,
  OpportunityName,
  LeadId,
  ContactId,
  Status,
  IsDeleted,
  IsConverted,
  ConvertedDate,
  DisqualificationReason,
  MQL_Reverted,
  DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) AS days_since_sql
FROM `data-analytics-306119.MarketingFunnel.InboundFunnel`
WHERE Division IN ('US', 'UK', 'AU')
  AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
  AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
  AND SQL_DT IS NOT NULL
  AND CAST(SQL_DT AS DATE) >= '2026-01-01'
  AND CAST(SQL_DT AS DATE) <= '2026-01-15'
  AND (OpportunityID IS NULL OR OpportunityID = '')
ORDER BY SQL_DT DESC
"""

print("\n=== SQL Records Without OpportunityID ===")
try:
    records = client.query(investigate_query).result()
    records_list = [dict(row) for row in records]
    print(f"Found {len(records_list)} records")

    # Analyze patterns
    statuses = {}
    sources = {}
    deleted_count = 0
    converted_count = 0

    for r in records_list:
        status = r.get('Status', 'None')
        source = r.get('source', 'None')

        statuses[status] = statuses.get(status, 0) + 1
        sources[source] = sources.get(source, 0) + 1

        if r.get('IsDeleted'):
            deleted_count += 1
        if r.get('IsConverted'):
            converted_count += 1

    print(f"\n  Deleted: {deleted_count}")
    print(f"  Converted: {converted_count}")
    print(f"\n  Status breakdown:")
    for s, c in sorted(statuses.items(), key=lambda x: -x[1]):
        print(f"    {s}: {c}")
    print(f"\n  Source breakdown:")
    for s, c in sorted(sources.items(), key=lambda x: -x[1]):
        print(f"    {s}: {c}")

    # Print each record
    print("\n=== Record Details ===")
    for i, r in enumerate(records_list):
        print(f"\n  Record {i+1}:")
        print(f"    Company: {r.get('company_name')}")
        print(f"    Division: {r.get('Division')}")
        print(f"    Source: {r.get('source')}")
        print(f"    SQL Date: {r.get('sql_date')}")
        print(f"    Status: {r.get('Status')}")
        print(f"    IsDeleted: {r.get('IsDeleted')}")
        print(f"    IsConverted: {r.get('IsConverted')}")
        print(f"    DisqualificationReason: {r.get('DisqualificationReason')}")
        print(f"    Days Since SQL: {r.get('days_since_sql')}")
        print(f"    LeadId: {r.get('LeadId')}")
        print(f"    ContactId: {r.get('ContactId')}")

except Exception as e:
    print(f"Error querying records: {e}")

    # Try simpler query
    print("\nTrying simpler query...")
    simple_query = """
    SELECT Company, Division, SDRSource, SQL_DT, OpportunityID, LeadId, ContactId
    FROM `data-analytics-306119.MarketingFunnel.InboundFunnel`
    WHERE Division IN ('US', 'UK', 'AU')
      AND SQL_DT IS NOT NULL
      AND CAST(SQL_DT AS DATE) >= '2026-01-01'
      AND CAST(SQL_DT AS DATE) <= '2026-01-15'
      AND (OpportunityID IS NULL OR OpportunityID = '')
    ORDER BY SQL_DT DESC
    LIMIT 30
    """
    try:
        records = client.query(simple_query).result()
        for r in records:
            print(dict(r))
    except Exception as e2:
        print(f"Simple query also failed: {e2}")
