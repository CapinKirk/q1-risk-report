---
paths:
  - "**/*.sql"
  - "app/api/**/*.ts"
---

# BigQuery Data Patterns

## Database Schema

### Primary Tables

| Table | Dataset | Description |
|-------|---------|-------------|
| `OpportunityViewTable` | `sfdc` | All opportunities with ACV, stage, close dates |
| `InboundFunnel` | `MarketingFunnel` | POR funnel: MQL/SQL/SAL/SQO dates |
| `R360InboundFunnel` | `MarketingFunnel` | R360 funnel metrics |
| `StrategicOperatingPlan` | `sfdc` | Q1 2026 targets (P50) |
| `DailyRevenueFunnel` | `Staging` | Daily funnel aggregates |

### Key Field Mappings

#### Division to Region
```sql
CASE Division
  WHEN 'US' THEN 'AMER'
  WHEN 'UK' THEN 'EMEA'
  WHEN 'AU' THEN 'APAC'
END AS region
```

#### Deal Type to Category
```sql
CASE Type
  WHEN 'Existing Business' THEN 'EXPANSION'
  WHEN 'New Business' THEN 'NEW LOGO'
  WHEN 'Migration' THEN 'MIGRATION'
  ELSE 'OTHER'
END AS category
```

#### Product Identification
```sql
-- In OpportunityViewTable
CASE WHEN por_record__c THEN 'POR' ELSE 'R360' END AS product

-- In InboundFunnel
-- Always POR (separate table for R360)
```

## Query Patterns

### Standard Filters
Always include these filters for clean data:
```sql
-- Exclude test data
AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)

-- Exclude reverted MQLs
AND (MQL_Reverted IS NULL OR MQL_Reverted = false)

-- Filter by division
AND Division IN ('US', 'UK', 'AU')
```

### Date Handling
```sql
-- Cast TIMESTAMP to DATE for comparison
CAST(SQL_DT AS DATE) >= '2026-01-01'

-- Date math
DATE_DIFF(CURRENT_DATE(), CAST(SQL_DT AS DATE), DAY) AS days_since

-- Safe date formatting
CAST(SQL_DT AS STRING) AS sql_date
```

### Aggregation Patterns
```sql
-- Safe division
ROUND(SAFE_DIVIDE(numerator, NULLIF(denominator, 0)) * 100, 2) AS percentage

-- Conditional counting
COUNT(CASE WHEN condition THEN 1 END) AS conditional_count

-- NULL-safe sums
COALESCE(SUM(value), 0) AS total
```

## Common Queries

### Won Deals
```sql
SELECT *
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE StageName = 'Closed Won'
  AND CloseDate >= '2026-01-01'
  AND CloseDate <= '2026-01-15'
  AND Division IN ('US', 'UK', 'AU')
```

### Funnel Metrics
```sql
SELECT
  Division,
  COUNT(CASE WHEN MQL_DT IS NOT NULL THEN 1 END) AS mql_count,
  COUNT(CASE WHEN SQL_DT IS NOT NULL THEN 1 END) AS sql_count,
  COUNT(CASE WHEN SAL_DT IS NOT NULL THEN 1 END) AS sal_count,
  COUNT(CASE WHEN SQO_DT IS NOT NULL THEN 1 END) AS sqo_count
FROM `data-analytics-306119.MarketingFunnel.InboundFunnel`
WHERE Division IN ('US', 'UK', 'AU')
  AND (SpiralyzeTest IS NULL OR SpiralyzeTest = false)
  AND (MQL_Reverted IS NULL OR MQL_Reverted = false)
  AND CAST(MQL_DT AS DATE) >= '2026-01-01'
GROUP BY Division
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Unrecognized name: X" | Column doesn't exist | Check table schema |
| "Cannot query SELECT list" | Missing GROUP BY | Add field to GROUP BY |
| "Division by zero" | Zero in denominator | Use SAFE_DIVIDE or NULLIF |

### Schema Discovery
```sql
-- List columns in a table
SELECT column_name, data_type
FROM `dataset`.INFORMATION_SCHEMA.COLUMNS
WHERE table_name = 'TableName'
ORDER BY column_name
```

## Performance Tips

1. Use column pruning - only SELECT needed columns
2. Apply filters early with WHERE clauses
3. Use CTEs for complex queries
4. Limit results when debugging: `LIMIT 100`
5. Use partitioned tables when available (by date)

## BigQuery Client in Node.js

```typescript
import { BigQuery } from '@google-cloud/bigquery';

// Initialize with credentials
const bigquery = process.env.GOOGLE_CREDENTIALS_JSON
  ? new BigQuery({
      projectId: 'data-analytics-306119',
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
    })
  : new BigQuery({ projectId: 'data-analytics-306119' });

// Execute query
const [rows] = await bigquery.query({ query: sqlString });
```
