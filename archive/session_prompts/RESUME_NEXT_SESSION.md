# Resume Prompt: Refactor Risk Reports to Use OpportunityViewTable

## CONFIRMED SOURCE OF TRUTH

**Single source for ALL actuals (bookings + renewals):**
```
data-analytics-306119.sfdc.OpportunityViewTable
```

**Critical filter:** `ACV > 0` (excludes churn/downgrades with negative ACV)

### Verified YTD 2026 POR Totals:
| Category | Won Count | ACV | Match |
|----------|-----------|-----|-------|
| Non-Renewal | 48 | $279,111 | ✓ User confirmed |
| Renewal | 29 | $13,974 | ✓ User confirmed |
| **Total** | **77** | **$293,085** | |

### Base Query:
```sql
SELECT *
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  AND por_record__c = true  -- or r360_record__c for R360
  AND CloseDate >= '2026-01-01'
  AND Type NOT IN ('Consulting', 'Credit Card')
  AND ACV > 0  -- CRITICAL: Excludes churn/downgrades
```

## DIMENSION MAPPING

OpportunityViewTable → StrategicOperatingPlan dimensions:

```sql
actuals_from_opportunities AS (
  SELECT
    -- Region: Division → AMER/EMEA/APAC
    CASE Division
      WHEN 'US' THEN 'AMER'
      WHEN 'UK' THEN 'EMEA'
      WHEN 'AU' THEN 'APAC'
      ELSE Division
    END AS region,

    -- FunnelType: Derived from Type + POR_SDRSource
    CASE
      WHEN Type = 'Existing Business' THEN 'EXPANSION'
      WHEN Type = 'New Business' AND POR_SDRSource = 'Inbound' THEN 'INBOUND'
      WHEN Type = 'New Business' THEN 'NEW LOGO'
      WHEN Type = 'Migration' THEN 'MIGRATION'
      WHEN Type = 'Renewal' THEN 'RENEWAL'
    END AS funnel_type,

    -- Source: Derived from Type + POR_SDRSource
    CASE
      WHEN Type IN ('Existing Business', 'Renewal') THEN 'AM SOURCED'
      WHEN POR_SDRSource = 'Inbound' THEN 'INBOUND'
      WHEN POR_SDRSource = 'Outbound' THEN 'OUTBOUND'
      WHEN POR_SDRSource = 'AE Sourced' THEN 'AE SOURCED'
      ELSE 'INBOUND'
    END AS source,

    -- Segment: Default to N/A
    'N/A' AS segment,

    -- OpportunityType: Direct from Type
    Type AS opportunity_type,

    -- Date for filtering
    CloseDate,

    -- Metrics (each row = 1 won opp)
    1 AS actual_won,
    ACV AS actual_acv

  FROM `data-analytics-306119.sfdc.OpportunityViewTable`
  WHERE Won = true
    AND por_record__c = true  -- Change to r360_record__c for R360
    AND Type NOT IN ('Consulting', 'Credit Card')
    AND ACV > 0  -- Exclude negative ACV (churn/downgrades)
)
```

## REFACTORING STEPS

### 1. Replace actuals source in query_por_risk_analysis.sql

**Current (WRONG):** Uses `StrategicOperatingPlan.Actual_Won`, `Actual_ACV`

**New (CORRECT):** Add `actuals_from_opportunities` CTE, then aggregate by time windows

### 2. Add time-windowed actuals CTEs

```sql
-- After actuals_from_opportunities CTE, add:

actuals_mtd AS (
  SELECT
    region, funnel_type, source, segment, opportunity_type,
    SUM(actual_won) AS actual_won,
    SUM(actual_acv) AS actual_acv
  FROM actuals_from_opportunities, dates
  WHERE CloseDate BETWEEN dates.mtd_start AND dates.as_of_date
  GROUP BY region, funnel_type, source, segment, opportunity_type
),

actuals_qtd AS (
  SELECT
    region, funnel_type, source, segment, opportunity_type,
    SUM(actual_won) AS actual_won,
    SUM(actual_acv) AS actual_acv
  FROM actuals_from_opportunities, dates
  WHERE CloseDate BETWEEN dates.qtd_start AND dates.as_of_date
  GROUP BY region, funnel_type, source, segment, opportunity_type
),

actuals_rolling_7d AS (
  SELECT
    region, funnel_type, source, segment, opportunity_type,
    SUM(actual_won) AS actual_won,
    SUM(actual_acv) AS actual_acv
  FROM actuals_from_opportunities, dates
  WHERE CloseDate BETWEEN dates.rolling_7d_start AND dates.as_of_date
  GROUP BY region, funnel_type, source, segment, opportunity_type
),

actuals_rolling_30d AS (
  SELECT
    region, funnel_type, source, segment, opportunity_type,
    SUM(actual_won) AS actual_won,
    SUM(actual_acv) AS actual_acv
  FROM actuals_from_opportunities, dates
  WHERE CloseDate BETWEEN dates.rolling_30d_start AND dates.as_of_date
  GROUP BY region, funnel_type, source, segment, opportunity_type
),

actuals_annual AS (
  SELECT
    region, funnel_type, source, segment, opportunity_type,
    SUM(actual_won) AS actual_won,
    SUM(actual_acv) AS actual_acv
  FROM actuals_from_opportunities, dates
  WHERE EXTRACT(YEAR FROM CloseDate) = EXTRACT(YEAR FROM dates.as_of_date)
  GROUP BY region, funnel_type, source, segment, opportunity_type
),
```

### 3. Modify aggregation CTEs to JOIN actuals

Replace inline `SUM(Actual_Won)` with JOINs:

```sql
-- Example for mtd_aggregated
mtd_aggregated AS (
  SELECT
    t.region, t.funnel_type, t.source, t.segment,
    SUM(t.Target_Won) AS target_won,
    SUM(t.Target_ACV) AS target_acv,
    -- ... other targets
    COALESCE(SUM(a.actual_won), 0) AS actual_won,
    COALESCE(SUM(a.actual_acv), 0) AS actual_acv
  FROM targets_from_sop t
  LEFT JOIN actuals_mtd a
    ON t.region = a.region
    AND t.funnel_type = a.funnel_type
    AND t.source = a.source
    AND t.segment = a.segment
  WHERE t.RecordType = params.product_filter
    AND t.OpportunityType != 'RENEWAL'  -- or include for renewal report
    AND t.TargetDate BETWEEN dates.mtd_start AND dates.as_of_date
  GROUP BY t.region, t.funnel_type, t.source, t.segment
)
```

### 4. For R360, change filter:
```sql
AND r360_record__c = true  -- Instead of por_record__c
```

## FILES TO MODIFY

1. **`/Users/prestonharris/query_por_risk_analysis.sql`**
   - Add `actuals_from_opportunities` CTE with dimension mapping
   - Add time-windowed actuals CTEs
   - Modify aggregation CTEs to use new actuals
   - Keep targets from StrategicOperatingPlan (Target_* columns only)

2. **`/Users/prestonharris/query_r360_risk_analysis.sql`**
   - Same changes with `r360_record__c = true`

3. **`/Users/prestonharris/generate_risk_reports.py`**
   - Already fixed (removed misleading annual pacing %)
   - No changes needed

## VALIDATION

After refactoring, verify totals match:

```sql
-- Should return: 48 non-renewal, $279,111 | 29 renewal, $13,974
SELECT
  CASE WHEN Type = 'Renewal' THEN 'Renewal' ELSE 'Non-Renewal' END as category,
  COUNT(*) as won_count,
  SUM(ACV) as total_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  AND por_record__c = true
  AND CloseDate >= '2026-01-01'
  AND Type NOT IN ('Consulting', 'Credit Card')
  AND ACV > 0
GROUP BY 1
```

## QUICK START

```bash
cd /Users/prestonharris

# View current query
head -100 query_por_risk_analysis.sql

# After changes, test
bq query --use_legacy_sql=false < query_por_risk_analysis.sql

# Regenerate reports
python3 generate_risk_reports.py

# Verify
head -70 report_por_risks.txt
```

## NOTES

1. **ACV > 0 filter is CRITICAL** - Excludes 17 records with negative ACV (churn/downgrades totaling -$27K)

2. **MQL/SQL/SAL/SQO metrics:** OpportunityViewTable only has Won and ACV. For funnel metrics, consider keeping RevenueFunnel as secondary source or removing those metrics.

3. **Renewals work now:** With `ACV > 0` filter, renewal metrics are accurate (29 won, $13,974)

4. **Single source:** OpportunityViewTable replaces both StrategicOperatingPlan actuals AND handles renewals correctly
