#!/usr/bin/env python3
"""
Validation script to check report data against ground truth
"""
import subprocess
import json

def run_bq_query(query: str) -> list:
    """Run a BigQuery query and return results"""
    cmd = f'bq query --use_legacy_sql=false --format=json "{query}"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Query failed: {result.stderr}")
        return []
    if not result.stdout.strip() or result.stdout.strip() == '[]':
        return []
    return json.loads(result.stdout)

def validate_all():
    """Run all validation queries"""
    print("=" * 60)
    print("VALIDATION: Checking Report Data Against Ground Truth")
    print("=" * 60)

    # 1. POR Expansion
    print("\n1. POR EXPANSION (Expected: 41 deals, $195,388.53)")
    query = """
    SELECT COUNT(*) as deals, ROUND(SUM(ACV), 2) as acv
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE Won = true AND por_record__c = true AND ACV > 0
      AND Division IN ('US', 'UK', 'AU') AND Type = 'Existing Business'
      AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10'
    """
    result = run_bq_query(query)
    if result:
        print(f"   ACTUAL: {result[0].get('deals', 'N/A')} deals, ${result[0].get('acv', 'N/A')}")

    # 2. POR New Business
    print("\n2. POR NEW BUSINESS (Expected: 6 deals, $59,070.68)")
    query = """
    SELECT COUNT(*) as deals, ROUND(SUM(ACV), 2) as acv
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE Won = true AND por_record__c = true AND ACV > 0
      AND Division IN ('US', 'UK', 'AU') AND Type = 'New Business'
      AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10'
    """
    result = run_bq_query(query)
    if result:
        print(f"   ACTUAL: {result[0].get('deals', 'N/A')} deals, ${result[0].get('acv', 'N/A')}")

    # 3. R360 AE Sourced New Business
    print("\n3. R360 AE SOURCED NEW BUSINESS (Expected: 2 deals, $22,931.82)")
    query = """
    SELECT COUNT(*) as deals, ROUND(SUM(ACV), 2) as acv
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE Won = true AND r360_record__c = true AND ACV > 0
      AND Division IN ('US', 'UK', 'AU') AND Type = 'New Business'
      AND SDRSource = 'AE Sourced'
      AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10'
    """
    result = run_bq_query(query)
    if result:
        print(f"   ACTUAL: {result[0].get('deals', 'N/A')} deals, ${result[0].get('acv', 'N/A')}")

    # 4. R360 Inbound New Business by Division
    print("\n4. R360 INBOUND NEW BUSINESS by Region (Expected: EMEA/UK = 1 deal, $2,430.38)")
    query = """
    SELECT Division, COUNT(*) as deals, ROUND(SUM(ACV), 2) as acv
    FROM `data-analytics-306119.sfdc.OpportunityViewTable`
    WHERE Won = true AND r360_record__c = true AND ACV > 0
      AND Type = 'New Business' AND SDRSource = 'Inbound'
      AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10'
    GROUP BY Division
    """
    result = run_bq_query(query)
    for row in result:
        print(f"   {row.get('Division', 'N/A')}: {row.get('deals', 'N/A')} deals, ${row.get('acv', 'N/A')}")

    # 5. R360 MQL by Region
    print("\n5. R360 MQL BY REGION (Expected: AMER=16, EMEA=6, APAC=0)")
    query = """
    SELECT Region, COUNT(DISTINCT Email) as mql_count
    FROM `data-analytics-306119.MarketingFunnel.R360InboundFunnel`
    WHERE MQL_DT IS NOT NULL
      AND MQL_DT >= '2026-01-01' AND MQL_DT < '2026-01-11'
      AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
      AND MQL_Reverted = false AND Email IS NOT NULL
    GROUP BY Region
    ORDER BY Region
    """
    result = run_bq_query(query)
    for row in result:
        print(f"   {row.get('Region', 'N/A')}: {row.get('mql_count', 'N/A')} MQLs")

    # 6. Check R360 INBOUND dimension exists (to verify MQL is being applied correctly)
    print("\n6. R360 INBOUND DIMENSIONS IN SOP (checking FunnelType naming)")
    query = """
    SELECT DISTINCT Region, FunnelType, Source
    FROM `data-analytics-306119.Staging.StrategicOperatingPlan`
    WHERE RecordType = 'R360'
      AND FunnelType LIKE '%INBOUND%'
    ORDER BY Region, FunnelType
    """
    result = run_bq_query(query)
    for row in result:
        print(f"   {row.get('Region', 'N/A')} | {row.get('FunnelType', 'N/A')} | {row.get('Source', 'N/A')}")

    print("\n" + "=" * 60)
    print("Validation Complete")
    print("=" * 60)

if __name__ == "__main__":
    validate_all()
