# QA Round 3: Validation & Remaining Fixes

## Context
Working directory: /Users/prestonharris

QA Round 3 on POR/R360 Risk Analysis Reports. Previous fixes applied, need validation and remaining items addressed.

## Previous QA Status
- **Round 1:** COMPLETE - MIGRATION source mapping fixed ($24.6K recovered)
- **Round 2:** COMPLETE - STRATEGIC segment mapping fixed (ACV >= 100K OR Segment__c IN ('Enterprise', 'Strategic'))

## Round 3 Objectives

### 1. Validate STRATEGIC Fix
Run this query in BigQuery to confirm STRATEGIC deals now appear:
```sql
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

### 2. Remaining Medium-Severity Items

| Finding | Severity | Status | Action |
|---------|----------|--------|--------|
| Dual-product double-counting risk | MEDIUM | Needs validation | Run Section 2 of validation queries |
| R360 MQL source alignment | MEDIUM | Needs validation | Run Section 4A of validation queries |
| Data quality edge cases | LOW | Needs review | Run Section 3 of validation queries |

### 3. Run Validation Queries
Execute queries from `/Users/prestonharris/qa_round2_validation_queries.sql`:
- Section 2: Dual-product opportunities (POR + R360 on same opp)
- Section 3: Data quality edge cases (NULL SDRSource, unusual ACV)
- Section 4A: R360 MQL funnel vs SOP comparison
- Section 5: Conversion rate sanity checks
- Section 8: Pipeline coverage analysis

### 4. Update Documentation
After validation, update these files:
- `/Users/prestonharris/POR_R360_Risk_Analysis_Report_2026-01-11.md` - Add QA Round 3 results
- `/Users/prestonharris/QA_Round2_Findings_2026-01-11.md` - Mark validated items as RESOLVED

## Query Files (with fixes applied)
- `/Users/prestonharris/query_por_risk_analysis.sql`
- `/Users/prestonharris/query_r360_risk_analysis.sql`
- `/Users/prestonharris/query_full_detail_report.sql`
- `/Users/prestonharris/query_r360_full_detail_report.sql`

## Reference Files
- Validation queries: `/Users/prestonharris/qa_round2_validation_queries.sql`
- QA Round 2 findings: `/Users/prestonharris/QA_Round2_Findings_2026-01-11.md`
- Resume prompt (Round 2): `/Users/prestonharris/RESUME_QA_ROUND2_FIX.md`

## Tasks

1. Read the validation queries file
2. Execute key validation queries (or provide them for user to run in BigQuery)
3. Analyze results for any remaining data quality issues
4. If issues found, apply fixes to query files
5. Update documentation with QA Round 3 results
6. Create summary of all QA fixes applied across Rounds 1-3

## Expected Outcomes
- Confirm STRATEGIC actuals now appear (previously $0)
- Quantify dual-product overlap (if any)
- Verify R360 MQL alignment between funnel table and SOP
- Document any remaining edge cases or known limitations
