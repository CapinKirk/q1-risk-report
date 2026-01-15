-- Diagnostic query to verify SQL counts by Product, Category
-- Expected from user:
--   POR New Logo SQL: 84
--   R360 New Logo SQL: 54
--   Total New Logo SQL: 136
--   POR Expansion SQL: 112
--   POR Expansion SQO: 95

-- Query 1: Check DailyRevenueFunnel for Q1 2026 actuals by FunnelType
SELECT
  RecordType AS product,
  Region AS region,
  FunnelType,
  CASE
    WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW LOGO'
    WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
    WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
    ELSE 'OTHER'
  END AS category,
  SUM(MQL) AS actual_mql,
  SUM(SQL) AS actual_sql,
  SUM(SAL) AS actual_sal,
  SUM(SQO) AS actual_sqo
FROM `data-analytics-306119.Staging.DailyRevenueFunnel`
WHERE CAST(CaptureDate AS DATE) >= '2026-01-01'
  AND CAST(CaptureDate AS DATE) <= '2026-01-15'
  AND Region IN ('AMER', 'EMEA', 'APAC')
GROUP BY RecordType, Region, FunnelType
ORDER BY RecordType, Region, FunnelType;

-- Query 2: Summarize by Product and Category
SELECT
  RecordType AS product,
  CASE
    WHEN UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO') THEN 'NEW LOGO'
    WHEN UPPER(FunnelType) IN ('EXPANSION', 'R360 EXPANSION') THEN 'EXPANSION'
    WHEN UPPER(FunnelType) IN ('MIGRATION', 'R360 MIGRATION') THEN 'MIGRATION'
    ELSE 'OTHER'
  END AS category,
  SUM(MQL) AS actual_mql,
  SUM(SQL) AS actual_sql,
  SUM(SAL) AS actual_sal,
  SUM(SQO) AS actual_sqo
FROM `data-analytics-306119.Staging.DailyRevenueFunnel`
WHERE CAST(CaptureDate AS DATE) >= '2026-01-01'
  AND CAST(CaptureDate AS DATE) <= '2026-01-15'
  AND Region IN ('AMER', 'EMEA', 'APAC')
GROUP BY product, category
ORDER BY product, category;

-- Query 3: Total SQL by Product for NEW LOGO only
SELECT
  RecordType AS product,
  SUM(SQL) AS total_new_logo_sql
FROM `data-analytics-306119.Staging.DailyRevenueFunnel`
WHERE CAST(CaptureDate AS DATE) >= '2026-01-01'
  AND CAST(CaptureDate AS DATE) <= '2026-01-15'
  AND Region IN ('AMER', 'EMEA', 'APAC')
  AND UPPER(FunnelType) IN ('INBOUND', 'R360 INBOUND', 'NEW LOGO', 'R360 NEW LOGO')
GROUP BY RecordType
ORDER BY RecordType;
