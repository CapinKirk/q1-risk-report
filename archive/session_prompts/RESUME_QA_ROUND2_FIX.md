# Resume: QA Round 2 - STRATEGIC Segment Fix APPLIED

## Status: COMPLETE

**Fix Applied:** 2026-01-11

## Summary

STRATEGIC segment mapping fix has been applied to all 4 query files.

### Rule Applied
```
STRATEGIC = ACV >= 100K USD OR Segment__c IN ('Enterprise', 'Strategic')
```

### Files Updated

1. `/Users/prestonharris/query_por_risk_analysis.sql` - Line 87-94
2. `/Users/prestonharris/query_r360_risk_analysis.sql` - Line 109-116
3. `/Users/prestonharris/query_full_detail_report.sql` - Line 70-76
4. `/Users/prestonharris/query_r360_full_detail_report.sql` - Line 70-76

### New Logic Applied
```sql
-- STRATEGIC FIX 2026-01-11: ACV >= 100K USD OR Segment__c IN ('Enterprise', 'Strategic')
-- EXPANSION/MIGRATION use N/A (matches SOP), others check for STRATEGIC criteria first
CASE
  WHEN Type IN ('Existing Business', 'Migration') THEN 'N/A'
  WHEN ACV >= 100000 THEN 'STRATEGIC'
  WHEN UPPER(COALESCE(Segment__c, '')) IN ('ENTERPRISE', 'STRATEGIC') THEN 'STRATEGIC'
  ELSE 'SMB'
END AS segment,
```

## QA Round 2 Status

| Finding | Severity | Status |
|---------|----------|--------|
| STRATEGIC segment mapping gap | CRITICAL | **FIXED** |
| Dual-product double-counting risk | MEDIUM | Validation query created |
| R360 MQL source alignment | MEDIUM | Validation query created |
| Pipeline coverage metric | ENHANCEMENT | Query added |

## Next Steps

1. Run queries in BigQuery to validate STRATEGIC actuals now appear
2. Review validation queries in `/Users/prestonharris/qa_round2_validation_queries.sql`
3. Update report documents to mark STRATEGIC issue resolved

## Validation Query
```sql
-- Verify STRATEGIC deals are now being captured
SELECT
  CASE Division WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC' END AS region,
  CASE
    WHEN ACV >= 100000 THEN 'STRATEGIC (ACV>=100K)'
    WHEN UPPER(COALESCE(Segment__c, '')) IN ('ENTERPRISE', 'STRATEGIC') THEN 'STRATEGIC (Segment__c)'
    ELSE 'SMB'
  END AS segment_source,
  COUNT(*) AS deal_count,
  SUM(ACV) AS total_acv
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  AND (por_record__c = true OR r360_record__c = true)
  AND Type = 'New Business'
  AND CloseDate BETWEEN '2026-01-01' AND '2026-01-10'
  AND Division IN ('US', 'UK', 'AU')
  AND ACV > 0
GROUP BY 1, 2
ORDER BY 1, 2;
```

## Reference Files

- Validation queries: `/Users/prestonharris/qa_round2_validation_queries.sql`
- Full findings: `/Users/prestonharris/QA_Round2_Findings_2026-01-11.md`
- Main report: `/Users/prestonharris/POR_R360_Risk_Analysis_Report_2026-01-11.md`
