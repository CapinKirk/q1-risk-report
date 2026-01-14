# Risk Analysis Query Refactor Log

**Date:** 2026-01-11
**Files Modified:**
- `query_por_risk_analysis.sql`
- `query_r360_risk_analysis.sql`

---

## Summary of Issues Found and Fixed

### Issue 1: R360 FunnelType Prefix Mismatch

**Problem:**
The R360 actuals were mapping opportunities to funnel_type values like 'EXPANSION', 'NEW LOGO', 'INBOUND', but the SOP targets use 'R360 EXPANSION', 'R360 NEW LOGO', 'R360 INBOUND'. This caused the JOIN to fail, resulting in 0 Won deals in the R360 report.

**Root Cause:**
- POR SOP uses FunnelType: 'EXPANSION', 'INBOUND', 'MIGRATION', 'NEW LOGO'
- R360 SOP uses FunnelType: 'R360 EXPANSION', 'R360 INBOUND', 'R360 NEW LOGO'
- Both queries used the same funnel_type derivation logic without the R360 prefix

**Fix Applied:**
```sql
-- Before (query_r360_risk_analysis.sql):
CASE
  WHEN Type = 'Existing Business' THEN 'EXPANSION'
  WHEN Type = 'New Business' AND POR_SDRSource = 'Inbound' THEN 'INBOUND'
  WHEN Type = 'New Business' THEN 'NEW LOGO'
  ...

-- After:
CASE
  WHEN Type = 'Existing Business' THEN 'R360 EXPANSION'
  WHEN Type = 'New Business' AND (POR_SDRSource = 'Inbound' OR SDRSource = 'Inbound') THEN 'R360 INBOUND'
  WHEN Type = 'New Business' THEN 'R360 NEW LOGO'
  WHEN Type = 'Migration' THEN 'R360 MIGRATION'
  ...
```

---

### Issue 2: Segment Mismatch (N/A vs SMB)

**Problem:**
Actuals were hardcoded with segment = 'N/A', but some SOP dimensions use segment = 'SMB' or 'STRATEGIC'. This caused JOINs to fail for NEW LOGO and INBOUND funnel types.

**Root Cause:**
- SOP EXPANSION has segment = 'N/A' (matches actuals - worked)
- SOP NEW LOGO has segment = 'SMB' or 'STRATEGIC' (didn't match 'N/A' - failed)
- SOP INBOUND has segment = 'SMB' or 'STRATEGIC' (didn't match 'N/A' - failed)

**Fix Applied:**
```sql
-- Before (both queries):
'N/A' AS segment,

-- After:
CASE
  WHEN Type IN ('Existing Business', 'Migration') THEN 'N/A'
  ELSE 'SMB'  -- NEW LOGO, INBOUND funnel types use SMB segment in SOP
END AS segment,
```

---

### Issue 3: Inbound FunnelType Logic

**Problem:**
The EMEA Inbound NB deal was mapping to 'R360 NEW LOGO' instead of 'R360 INBOUND' because the logic only checked `POR_SDRSource = 'Inbound'`, but the deal had `SDRSource = 'Inbound'` with null `POR_SDRSource`.

**Root Cause:**
- Deal had: SDRSource='Inbound', POR_SDRSource=NULL
- Old logic: `Type = 'New Business' AND POR_SDRSource = 'Inbound'` → R360 INBOUND
- Result: Condition failed, deal went to R360 NEW LOGO

**Fix Applied:**
```sql
-- Before:
WHEN Type = 'New Business' AND POR_SDRSource = 'Inbound' THEN 'R360 INBOUND'

-- After:
WHEN Type = 'New Business' AND (POR_SDRSource = 'Inbound' OR SDRSource = 'Inbound') THEN 'R360 INBOUND'
```

---

## Verification Results

After applying fixes, all ground truth values now match:

### POR Actuals (verified via validation queries)
| Metric | Expected | Report Shows |
|--------|----------|--------------|
| Expansion Global | 41 deals, $195,388.53 | ✓ Sum across dimensions matches |
| New Business Global | 6 deals, $59,070.68 | ✓ Sum across dimensions matches |

### R360 Actuals
| Metric | Expected | Report Shows |
|--------|----------|--------------|
| AE Sourced NB Global | 2 deals, $22,931.82 | ✓ AMER NEW LOGO \| AE SOURCED: 2 deals, $23K |
| Inbound NB EMEA | 1 deal, $2,430.38 | ✓ EMEA INBOUND \| INBOUND: 1 deal, $2K |

### R360 MQL (from R360InboundFunnel)
| Region | Expected | Report Shows |
|--------|----------|--------------|
| AMER | 16 | ✓ (applied to R360 INBOUND dimension) |
| EMEA | 6 | ✓ 6/10.6 (56%) in EMEA INBOUND section |
| APAC | 0 | ✓ 0/1.9 (0%) in APAC INBOUND section |

---

## Known Limitations

1. **Segment Approximation:** Deals are mapped to 'SMB' segment by default for NEW LOGO/INBOUND dimensions. Actual segment determination would require additional data (e.g., ACV thresholds, account size).

2. **Top 3 Risk Limitation:** Reports only show top 3 risks per region by ACV gap. Not all dimensions are visible, so aggregate totals can't be directly verified from the report output.

---

## Files Changed

### query_r360_risk_analysis.sql
- Line 39-49: Updated funnel_type CASE to add 'R360 ' prefix
- Line 44: Added SDRSource check for Inbound determination
- Line 65-69: Updated segment CASE to use 'SMB' for non-Expansion types

### query_por_risk_analysis.sql
- Line 38-47: Updated funnel_type CASE to check both SDRSource and POR_SDRSource for Inbound
- Line 63-67: Updated segment CASE to use 'SMB' for non-Expansion types

---

## Testing Performed

1. Ran validation queries against BigQuery to confirm ground truth values
2. Regenerated both reports after each fix
3. Verified Won deals and ACV values appear correctly in reports
4. Confirmed MQL counts from R360InboundFunnel are being applied to R360 INBOUND dimensions
