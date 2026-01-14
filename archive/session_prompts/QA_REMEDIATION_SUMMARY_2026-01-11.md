# QA Remediation Summary - 2026-01-11
## BigQuery Deal Count Discrepancy Analysis

### Problem Statement
BigQuery reported **50 deals** for Jan 1-11, 2026.
Actual verified count is **108 bookings** (including renewals) / **73 deals** (excluding renewals).
- **10 New Business** confirmed
- **~23 deals were incorrectly filtered out** due to R360 exclusion

---

## Root Causes Identified

### 1. `por_record__c = true` Filter Excludes ALL R360 Deals

**Impact:** 23 R360 deals excluded

| RecordType | por_record__c | Deals Excluded |
|------------|---------------|----------------|
| Record360  | **false**     | 23 (after type exclusions) |
| POR Records| true          | 0 |

**Fix:** Remove `por_record__c = true` filter or use `(por_record__c = true OR RecordType.Name = 'Record360')`

### 2. Wrong ACV Field Used

**Impact:** Additional deals with $0 in `Annual_Contract_Value__c` but positive `Annual_Contract_Value_with_Downpayment__c`

| Field | R360 Behavior | POR Behavior |
|-------|---------------|--------------|
| `Annual_Contract_Value__c` | Often $0 | Has value |
| `Annual_Contract_Value_with_Downpayment__c` | **Has value** | Has value |

**Fix:** Use `Annual_Contract_Value_with_Downpayment__c > 0` instead of `ACV__c > 0`

---

## Filter Waterfall Analysis

| Step | Filter | Count | Deals Lost |
|------|--------|-------|------------|
| Base | Closed Won + Division | **196** | - |
| +1 | `por_record__c = true` | **167** | -29 (ALL R360!) |
| +2 | Type NOT IN (Renewal, Consulting, Credit Card) | **109** | -58 |
| +3 | `Annual_Contract_Value__c > 0` (WRONG) | **53** | -56 |
| +3 | `Annual_Contract_Value_with_Downpayment__c > 0` (CORRECT) | **75** | n/a |

---

## Corrected Numbers (Jan 1-11, 2026)

### Authoritative Totals (Including Renewals, Global)

| Category   | Bookings | Bookings % YoY | Amount    | Amount % YoY |
|------------|----------|----------------|-----------|--------------|
| New Logo   |       10 |        +66.7%  |  $88,345  |     +248.1%  |
| Expansion  |       62 |       +158.3%  | $221,290  |     +293.2%  |
| Migration  |        1 |        -66.7%  |  $24,652  |       +1.8%  |
| **Total**  |  **108** |        -88.6%  | **$355,965** | **+16.0%** |

*Note: Total includes 35 Renewals not shown in breakdown above*

### BigQuery vs Correct Comparison
| Metric | BigQuery (Wrong) | Corrected |
|--------|------------------|-----------|
| Total Deals (excl Renewals) | ~50 | **73** |
| Total Bookings (incl Renewals) | - | **108** |
| Total Amount | - | **$355,965** |
| New Business Deals | - | **10** |
| New Business Amount | - | **$88,345** |

### New Business Breakdown (10 deals)
| Source | Deals | ACV |
|--------|-------|-----|
| POR (New - RMS) | 7 | $62,982 |
| R360 | 3 | $25,362 |
| **Total New Business** | **10** | **$88,345** |

### Expansion Breakdown (62 deals)
| Source | Deals | Amount |
|--------|-------|--------|
| POR (Add-on + EBNC) | ~44 | ~$198,127 |
| R360 (Existing Business) | ~18 | ~$23,163 |
| **Total Expansion** | **62** | **$221,290** |

---

## BigQuery Fix Required

### Current (Wrong) Query
```sql
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  AND por_record__c = true  -- PROBLEM: Excludes R360
  AND CloseDate BETWEEN DATE('2026-01-01') AND DATE('2026-01-11')
  AND Division IN ('US', 'UK', 'AU')
  AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
  AND ACV > 0  -- PROBLEM: May use wrong field
```

### Corrected Query
```sql
FROM `data-analytics-306119.sfdc.OpportunityViewTable`
WHERE Won = true
  -- REMOVED: por_record__c = true (was excluding all R360)
  AND CloseDate BETWEEN DATE('2026-01-01') AND DATE('2026-01-11')
  AND Division IN ('US', 'UK', 'AU')
  AND Type NOT IN ('Renewal', 'Consulting', 'Credit Card')
  AND ACV_with_Downpayment > 0  -- Use correct field for R360
```

**Or if por_record__c filter is needed for other reasons:**
```sql
WHERE Won = true
  AND (por_record__c = true OR RecordType = 'Record360')
  AND CloseDate BETWEEN ...
```

---

## Data Export

Full deal list exported to:
`/Users/prestonharris/sf_all_closed_won_jan1-11_2026.csv`

Contains 196 deals (all closed won, all divisions, all types) for verification.

---

## Action Items

1. **Immediate:** Update BigQuery query to remove `por_record__c = true` filter
2. **Immediate:** Verify correct ACV field mapping in BigQuery (`Annual_Contract_Value_with_Downpayment__c`)
3. **Verify:** Check if the OpportunityViewTable in BigQuery has the correct field names
4. **Long-term:** Add data quality monitoring to catch such discrepancies

---

*Generated: 2026-01-11*
*Verified by: Salesforce SOQL queries against por-prod org*
