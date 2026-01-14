# Resume Prompt: POR & R360 Risk Analysis Reports - Verified Data

## Working Directory
```
/Users/prestonharris
```

## IMMEDIATE TASK
Find the correct MQL data source in BigQuery that matches verified totals. Current source (StrategicOperatingPlan) shows incorrect MQL counts. Search for tables with "marketing" or "mql" in the name.

## Key Files
| File | Purpose |
|------|---------|
| `query_por_risk_analysis.sql` | POR risk analysis query |
| `query_r360_risk_analysis.sql` | R360 risk analysis query |
| `generate_risk_reports.py` | Python script to run queries and format reports |
| `report_por_risks.txt` | Generated POR report output |
| `report_r360_risks.txt` | Generated R360 report output |

## Data Sources
- **Actuals**: `data-analytics-306119.sfdc.OpportunityViewTable`
- **Targets/Funnel Metrics**: `data-analytics-306119.Staging.StrategicOperatingPlan` (MQL data may be wrong)
- **MQL Source**: NEEDS INVESTIGATION - find table matching verified MQL totals

---

## VERIFIED GROUND TRUTH DATA (100% Accurate - Use to Validate Queries)

### POR Verified Numbers (YTD 2026 through Jan 10)

| Metric | Region | Source | Deals | ACV |
|--------|--------|--------|-------|-----|
| **Expansion** | Global | All Sources | 41 | $195,389 |
| **New Business** | Global | All Sources | 6 | $59,071 |

### R360 Verified Numbers (YTD 2026 through Jan 10)

| Metric | Region | Details | Deals | ACV |
|--------|--------|---------|-------|-----|
| **Inbound New Business** | US (AMER) | 17 MQL in US | 1 | $2,430 |
| **AE Sourced New Business** | Global | 0 MQL (direct to SQO) | 2 | $22,932 |

### R360 MQL VERIFIED TOTALS (Must Match)
| Region | MQL Count | Notes |
|--------|-----------|-------|
| US (AMER) | 17 | Inbound only |
| UK/EMEA | 6 | Inbound only |
| **Global Total** | **23** | Only Inbound has MQL |

**Key Business Rules:**
- Only Inbound source has MQL
- AE Sourced deals have 0 MQL (go directly to SQO)

---

## PRIORITY TASK: FIND CORRECT MQL SOURCE

### Current Problem
StrategicOperatingPlan shows wrong MQL counts:
- AMER: 17 ✓ (correct)
- EMEA: 4 ✗ (should be 6)
- Global: 21 ✗ (should be 23)

### Search for Alternative MQL Tables
Run these queries to find tables with marketing/MQL data:

```sql
-- Search for tables with 'marketing' in name
SELECT table_schema, table_name
FROM `data-analytics-306119.INFORMATION_SCHEMA.TABLES`
WHERE LOWER(table_name) LIKE '%marketing%'
ORDER BY table_schema, table_name;
```

```sql
-- Search for tables with 'mql' in name
SELECT table_schema, table_name
FROM `data-analytics-306119.INFORMATION_SCHEMA.TABLES`
WHERE LOWER(table_name) LIKE '%mql%'
ORDER BY table_schema, table_name;
```

```sql
-- Search for tables with 'lead' in name
SELECT table_schema, table_name
FROM `data-analytics-306119.INFORMATION_SCHEMA.TABLES`
WHERE LOWER(table_name) LIKE '%lead%'
ORDER BY table_schema, table_name;
```

```sql
-- Search for tables with 'funnel' in name
SELECT table_schema, table_name
FROM `data-analytics-306119.INFORMATION_SCHEMA.TABLES`
WHERE LOWER(table_name) LIKE '%funnel%'
ORDER BY table_schema, table_name;
```

```sql
-- List all datasets
SELECT schema_name
FROM `data-analytics-306119.INFORMATION_SCHEMA.SCHEMATA`
ORDER BY schema_name;
```

```sql
-- Check Staging dataset for all tables
SELECT table_name
FROM `data-analytics-306119.Staging.INFORMATION_SCHEMA.TABLES`
ORDER BY table_name;
```

```sql
-- Check sfdc dataset for all tables
SELECT table_name
FROM `data-analytics-306119.sfdc.INFORMATION_SCHEMA.TABLES`
ORDER BY table_name;
```

### Once Found, Validate MQL Table
When you find a potential MQL source, run this validation:

```sql
-- Replace TABLE_NAME with discovered table
-- Look for columns like: Region, MQL, Lead, Date, Product, RecordType
SELECT *
FROM `data-analytics-306119.DATASET.TABLE_NAME`
LIMIT 100;
```

```sql
-- Test if it matches verified R360 MQL totals (23 global, 17 US, 6 EMEA)
SELECT
  Region,
  COUNT(*) AS mql_count  -- or SUM(mql_field)
FROM `data-analytics-306119.DATASET.TABLE_NAME`
WHERE [product = 'R360' or similar filter]
  AND [date filters for YTD 2026 through Jan 10]
GROUP BY Region;
```

---

## VERIFIED DATABASE MATCHES (Already Confirmed Correct)

```sql
-- POR Expansion Global: 41 deals, $195,389 ✓
SELECT COUNT(*), ROUND(SUM(ACV), 2)
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND por_record__c = true AND ACV > 0
  AND Division IN ('US', 'UK', 'AU') AND Type = 'Existing Business'
  AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10';

-- POR New Business Global: 6 deals, $59,071 ✓
SELECT COUNT(*), ROUND(SUM(ACV), 2)
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND por_record__c = true AND ACV > 0
  AND Division IN ('US', 'UK', 'AU') AND Type = 'New Business'
  AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10';

-- R360 AE Sourced New Business Global: 2 deals, $22,932 ✓
SELECT COUNT(*), ROUND(SUM(ACV), 2)
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND r360_record__c = true AND ACV > 0
  AND Division IN ('US', 'UK', 'AU') AND Type = 'New Business'
  AND SDRSource = 'AE Sourced'
  AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10';
```

---

## DISCREPANCY TO INVESTIGATE

### R360 Inbound New Business Location
- **User says**: 1 deal in US at $2,430
- **Database shows**: 1 deal in EMEA (Division='UK') at $2,430.38

```sql
-- Check the actual deal details
SELECT Division, Type, SDRSource, Name, CloseDate, ROUND(ACV, 2) AS acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true AND r360_record__c = true AND ACV > 0
  AND Type = 'New Business' AND SDRSource = 'Inbound'
  AND EXTRACT(YEAR FROM CloseDate) = 2026 AND CloseDate <= '2026-01-10';
```

---

## AFTER FINDING CORRECT MQL SOURCE

1. Update `query_por_risk_analysis.sql` and `query_r360_risk_analysis.sql` to use new MQL source
2. Regenerate reports: `python3 generate_risk_reports.py`
3. Verify reports match all verified totals

---

## QUICK COMMANDS

```bash
cd /Users/prestonharris

# Regenerate reports after fixes
python3 generate_risk_reports.py

# View reports
cat report_por_risks.txt
cat report_r360_risks.txt
```
