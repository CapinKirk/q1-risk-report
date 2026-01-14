# PROMPT: Generate Q1 2026 Bookings Risk Analysis HTML Report

## SESSION CONTEXT

You are continuing work on the Risk Analysis reporting project. The main query has been updated to use dynamic targets from StrategicOperatingPlan (v2.0.0).

**Working Directory:** `/Users/prestonharris/Risk Report`

**Key Files:**
- `query_comprehensive_risk_analysis.sql` - Main query (v2.0.0, dynamic targets)
- `DATA_ISSUES_LOG.md` - Documents the EMEA MQL target investigation
- `Q1_2026_TARGET_REFERENCE.md` - Target reference guide

---

## YOUR TASK

### STEP 1: Refactor Pipeline Filter (Created Last 6 Months)

Update the `open_pipeline` CTE in `query_comprehensive_risk_analysis.sql` to only include opportunities created within the last 6 months:

**Current (No date filter):**
```sql
open_pipeline AS (
  SELECT
    CASE WHEN por_record__c = true THEN 'POR' ELSE 'R360' END AS product,
    ...
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE IsClosed = false
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
  GROUP BY product, region, category
),
```

**Required Change:**
```sql
open_pipeline AS (
  SELECT
    ...
  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE IsClosed = false
    AND (por_record__c = true OR r360_record__c = true)
    AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
    AND ACV > 0
    AND Division IN ('US', 'UK', 'AU')
    -- NEW: Only pipeline created in last 6 months
    AND CreatedDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
  GROUP BY product, region, category
),
```

---

### STEP 2: Add Owner Role Filter (AE or AM Only)

Filter pipeline to only include opportunities owned by AEs or AMs.

**First, discover the Owner Role field in OpportunityViewTable:**
```sql
-- Check what owner/role fields are available
SELECT column_name, data_type
FROM `data-analytics-306119.sfdc.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'OpportunityViewTable'
  AND LOWER(column_name) LIKE '%owner%' OR LOWER(column_name) LIKE '%role%'
ORDER BY column_name;

-- Check sample values for owner role
SELECT DISTINCT Owner_Role, COUNT(*) as cnt
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE IsClosed = false
GROUP BY Owner_Role
ORDER BY cnt DESC
LIMIT 20;
```

**Expected Filter (adjust field name based on discovery):**
```sql
-- Add to open_pipeline WHERE clause:
AND Owner_Role IN ('Account Executive', 'Account Manager', 'AE', 'AM')
-- OR if using a different field:
AND UPPER(OwnerRole) LIKE '%AE%' OR UPPER(OwnerRole) LIKE '%AM%'
```

---

### STEP 3: Verify Query Changes

Run these verification queries after making changes:

```sql
-- 1. Verify pipeline now only shows last 6 months
SELECT
  MIN(CreatedDate) AS oldest_opp,
  MAX(CreatedDate) AS newest_opp,
  COUNT(*) AS total_opps,
  ROUND(SUM(ACV), 2) AS total_pipeline
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE IsClosed = false
  AND (por_record__c = true OR r360_record__c = true)
  AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
  AND ACV > 0
  AND Division IN ('US', 'UK', 'AU')
  AND CreatedDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH);

-- 2. Verify owner role filter
SELECT
  Owner_Role,
  COUNT(*) AS opp_count,
  ROUND(SUM(ACV), 2) AS pipeline_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE IsClosed = false
  AND (por_record__c = true OR r360_record__c = true)
  AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
  AND ACV > 0
  AND Division IN ('US', 'UK', 'AU')
  AND CreatedDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
GROUP BY Owner_Role
ORDER BY pipeline_acv DESC;

-- 3. Run full query and verify output
-- Execute query_comprehensive_risk_analysis.sql and confirm JSON output
```

---

### STEP 4: Generate HTML Report

Create a Node.js or Python script to:
1. Execute the BigQuery query
2. Parse the JSON output
3. Generate a styled HTML report

**Create file:** `generate_html_report.js` or `generate_html_report.py`

**HTML Report Requirements:**
- Professional styling (clean, modern look)
- Executive Summary section at top
- Color-coded RAG status (Green/Yellow/Red)
- Sortable tables
- Collapsible sections for detailed data
- Copy-paste friendly formatting
- Include report metadata (generated date, data freshness)

**HTML Template Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Q1 2026 Bookings Risk Analysis</title>
  <style>
    /* Professional styling */
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .rag-green { background: #d4edda; color: #155724; }
    .rag-yellow { background: #fff3cd; color: #856404; }
    .rag-red { background: #f8d7da; color: #721c24; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background: #f8f9fa; }
    /* ... more styles */
  </style>
</head>
<body>
  <h1>Q1 2026 Bookings Risk Analysis</h1>
  <div class="metadata">
    <p>Generated: {{generated_at}}</p>
    <p>Report Date: {{report_date}}</p>
    <p>Quarter Progress: {{quarter_pct_complete}}%</p>
  </div>

  <!-- Executive Summary -->
  <section class="executive-summary">
    <h2>Executive Summary</h2>
    <!-- Grand totals, key metrics -->
  </section>

  <!-- Product Summaries -->
  <section class="product-summary">
    <h2>Product Performance</h2>
    <!-- POR and R360 tables -->
  </section>

  <!-- Risk Pockets -->
  <section class="risk-pockets">
    <h2>Top Risk Pockets</h2>
    <!-- Sorted by gap, color-coded -->
  </section>

  <!-- Funnel Pacing (INBOUND) -->
  <section class="funnel-pacing">
    <h2>Inbound Funnel Pacing</h2>
    <p class="note">Note: MQL targets are INBOUND channel only.
       EMEA is outbound-heavy, APAC is inbound-heavy.</p>
    <!-- Funnel tables -->
  </section>

  <!-- Pipeline Analysis -->
  <section class="pipeline">
    <h2>Pipeline Analysis</h2>
    <p class="note">Filtered: Created last 6 months, AE/AM owned only</p>
    <!-- Pipeline coverage -->
  </section>

  <!-- Loss Analysis -->
  <section class="losses">
    <h2>Close Lost Analysis</h2>
    <!-- Loss reasons, competitors -->
  </section>
</body>
</html>
```

---

### STEP 5: Output HTML File

Save the generated HTML report to:
- `/Users/prestonharris/Risk Report/reports/Q1_2026_Risk_Report_{{DATE}}.html`

Also output a summary to console confirming:
- Query executed successfully
- Number of rows processed
- Report file location
- Any warnings (missing data, etc.)

---

## VERIFICATION CHECKLIST

Before completing, verify:

- [ ] Pipeline filter: Only opps created in last 6 months
- [ ] Owner filter: Only AE/AM owned opportunities
- [ ] Q1 totals match: POR = $2,659,310, R360 ≈ $868,610
- [ ] Funnel pacing shows source_channel = "INBOUND"
- [ ] HTML report renders correctly in browser
- [ ] RAG colors display properly
- [ ] All sections have data (no empty tables)
- [ ] Report is copy-paste friendly

---

## EXPECTED OUTPUT FILES

1. `query_comprehensive_risk_analysis.sql` - Updated with pipeline filters
2. `generate_html_report.js` or `.py` - Report generation script
3. `reports/Q1_2026_Risk_Report_2026-01-13.html` - Generated HTML report

---

## REFERENCE: Key Data Quality Notes

1. **MQL Targets are INBOUND-only:**
   - EMEA: 22% of NEW LOGO from INBOUND → fewer MQLs, larger deals
   - APAC: 63% of NEW LOGO from INBOUND → more MQLs, smaller deals

2. **PARTNERSHIPS targets are zeroed out** (per data quality fix)

3. **Pipeline age was excessive** - new 6-month filter addresses this

4. **Owner role filter** ensures only sales-managed pipeline is counted

---

## START HERE

Begin by:
1. Reading `query_comprehensive_risk_analysis.sql` to understand current structure
2. Discovering the Owner Role field in OpportunityViewTable
3. Making the pipeline filter changes
4. Verifying with test queries
5. Creating the HTML report generator
6. Generating and validating the final report
