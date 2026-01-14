# Resume Prompt: POR & R360 Risk Analysis Reports QA

## Context
You are continuing work on POR and R360 Risk Analysis Reports. The queries have been refactored to fix data accuracy issues.

## Working Directory
```
/Users/prestonharris
```

## Key Files
| File | Purpose |
|------|---------|
| `query_por_risk_analysis.sql` | POR risk analysis query (FIXED) |
| `query_r360_risk_analysis.sql` | R360 risk analysis query (FIXED) |
| `generate_risk_reports.py` | Python script to run queries and format reports |
| `report_por_risks.txt` | Generated POR report output |
| `report_r360_risks.txt` | Generated R360 report output |
| `verify_expansion_inbound.sql` | Diagnostic query for verification |

## Recent Fix Summary (Commit cc3d53a)

### Problem Identified
- AMER EXPANSION | INBOUND showed 0 won deals (expected: 8 deals, $54,580)
- UK/EMEA INBOUND showed 0 (expected: 1 deal, $16,785)

### Root Causes Found
1. **Missing Division filter**: Query included records with NULL/invalid Division values
2. **Wrong source field**: Used `POR_SDRSource` which is NULL for Existing Business deals
   - Correct field is `SDRSource` which has values like 'Inbound', 'AM Sourced', 'Outbound'

### Fixes Applied
```sql
-- 1. Added Division filter
AND Division IN ('US', 'UK', 'AU')

-- 2. Fixed source mapping to use SDRSource first
CASE
  WHEN Type = 'Renewal' THEN 'AM SOURCED'
  WHEN SDRSource = 'Inbound' THEN 'INBOUND'
  WHEN SDRSource = 'Outbound' THEN 'OUTBOUND'
  WHEN SDRSource = 'AE Sourced' THEN 'AE SOURCED'
  WHEN SDRSource = 'AM Sourced' THEN 'AM SOURCED'
  WHEN POR_SDRSource = 'Inbound' THEN 'INBOUND'
  WHEN POR_SDRSource = 'Outbound' THEN 'OUTBOUND'
  WHEN POR_SDRSource = 'AE Sourced' THEN 'AE SOURCED'
  ELSE 'INBOUND'
END AS source
```

## Verified Totals (YTD 2026 through Jan 10)

### Overall POR Totals
- **77 won deals, $293,085 ACV** (48 non-renewal + 29 renewal) ✓

### Segment-Level Verification
| Segment | Expected | Actual | Status |
|---------|----------|--------|--------|
| AMER EXPANSION \| INBOUND | 8 deals, $54,580 | 8 won, $55K | ✓ |
| AMER EXPANSION \| AM SOURCED | 9 deals, $90K | 9 won, $90K | ✓ |
| EMEA New Business \| INBOUND | 1 deal, $16,785 | 1 deal | ✓ |

## Data Source Details
- **Actuals**: `data-analytics-306119.sfdc.OpportunityViewTable`
- **Targets**: `data-analytics-306119.Staging.StrategicOperatingPlan`
- **Critical filters**:
  - `Won = true`
  - `por_record__c = true` (POR) or `r360_record__c = true` (R360)
  - `ACV > 0` (excludes churn/downgrades)
  - `Division IN ('US', 'UK', 'AU')`

## Key Field Mappings
| OpportunityViewTable | Report Dimension |
|---------------------|------------------|
| Division = 'US' | Region = 'AMER' |
| Division = 'UK' | Region = 'EMEA' |
| Division = 'AU' | Region = 'APAC' |
| Type = 'Existing Business' | FunnelType = 'EXPANSION' |
| Type = 'New Business' + SDRSource='Inbound' | FunnelType = 'INBOUND' |
| Type = 'New Business' (other) | FunnelType = 'NEW LOGO' |
| Type = 'Migration' | FunnelType = 'MIGRATION' |
| SDRSource (primary) / POR_SDRSource (fallback) | Source dimension |

## Tasks for QA

### 1. Regenerate and Verify Reports
```bash
cd /Users/prestonharris
python3 generate_risk_reports.py
```

### 2. Run Verification Query
```bash
bq query --use_legacy_sql=false --format=pretty "
SELECT
  CASE Division WHEN 'US' THEN 'AMER' WHEN 'UK' THEN 'EMEA' WHEN 'AU' THEN 'APAC' END AS region,
  Type,
  SDRSource,
  COUNT(*) AS deal_count,
  ROUND(SUM(ACV), 2) AS total_acv
FROM \`data-analytics-306119.sfdc.OpportunityViewTable\`
WHERE Won = true
  AND por_record__c = true
  AND ACV > 0
  AND Division IN ('US', 'UK', 'AU')
  AND EXTRACT(YEAR FROM CloseDate) = 2026
  AND CloseDate <= '2026-01-10'
GROUP BY 1, 2, 3
ORDER BY region, Type, SDRSource
"
```

### 3. Check for Additional Issues
- Verify EMEA EXPANSION segments align with targets
- Verify APAC segments (currently showing limited data)
- Check Migration segment categorization
- Validate funnel metrics (MQL/SQL/SAL/SQO) from StrategicOperatingPlan

### 4. Potential Enhancements
- Add INBOUND funnel type for New Business deals to report output
- Consider segment field mapping (currently defaults to 'N/A')
- Review time horizon calculations (MTD/QTD/Rolling windows)

## Quick Commands

```bash
# Regenerate reports
python3 generate_risk_reports.py

# View POR report
cat report_por_risks.txt

# View R360 report
cat report_r360_risks.txt

# Check git status
git log --oneline -5
```
