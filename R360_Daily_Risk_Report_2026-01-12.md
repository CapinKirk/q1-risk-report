# R360 Daily Risk Analysis Report
**Report Date:** January 12, 2026
**Period:** Q1 2026 QTD (January 1-12)
**Scope:** New Logo + Expansion (Excludes Renewals)

---

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| **QTD Attainment** | 42.9% | CRITICAL |
| **QTD Actual** | $49,662 | |
| **QTD Target** | $115,815 | |
| **Q1 Full Target** | $868,610 | |

**Key Takeaways:**
- R360 at **42.9% QTD attainment** - CRITICALLY BEHIND target pace
- **AMER New Logo** at 32.7% - primary risk pocket with $47K gap
- **EMEA New Logo** at 16.2% - only 1 deal closed QTD
- **APAC** has ZERO bookings across all categories
- **AMER Expansion** at 86.8% - only category near pace

---

## QTD Attainment Scorecard

**RAG Thresholds:** Green >=90% | Yellow 70-89% | Red <70%
**QTD Proration:** 12 days / 90 days = 13.33%

### AMER (Americas)

| Category | Q1 Target | QTD Target | Actual | Deals | Attain% | Status |
|----------|-----------|------------|--------|-------|---------|--------|
| New Logo | $525,160 | $70,021 | $22,932 | 2 | 32.7% | RED |
| Expansion | $210,000 | $28,000 | $24,300 | 20 | 86.8% | YELLOW |
| **SUBTOTAL** | **$735,160** | **$98,021** | **$47,232** | **22** | **48.2%** | **RED** |

### EMEA (UK/Europe)

| Category | Q1 Target | QTD Target | Actual | Deals | Attain% | Status |
|----------|-----------|------------|--------|-------|---------|--------|
| New Logo | $112,200 | $14,960 | $2,430 | 1 | 16.2% | RED |
| Expansion | $0 | $0 | $0 | 0 | N/A | - |
| **SUBTOTAL** | **$112,200** | **$14,960** | **$2,430** | **1** | **16.2%** | **RED** |

### APAC (Australia)

| Category | Q1 Target | QTD Target | Actual | Deals | Attain% | Status |
|----------|-----------|------------|--------|-------|---------|--------|
| New Logo | $20,400 | $2,720 | $0 | 0 | 0.0% | RED |
| Expansion | $850 | $113 | $0 | 0 | 0.0% | RED |
| **SUBTOTAL** | **$21,250** | **$2,833** | **$0** | **0** | **0.0%** | **RED** |

### Grand Total

| Metric | Target | Actual | Attainment | Status |
|--------|--------|--------|------------|--------|
| **Q1 QTD** | $115,815 | $49,662 | **42.9%** | RED |

---

## Risk Flags

### CRITICAL (Immediate Action Required)

| Risk | Gap | Impact |
|------|-----|--------|
| **AMER New Logo** at 32.7% | -$47,089 | $525K Q1 at risk; win rate concern |
| **EMEA New Logo** at 16.2% | -$12,530 | Only 1 deal closed; $112K Q1 at risk |
| **APAC** at 0% | -$2,833 | Zero activity; market viability question |

### HIGH (Monitor Closely)

| Risk | Gap | Impact |
|------|-----|--------|
| **AMER Expansion** at 86.8% | -$3,700 | Close to pace but needs monitoring |
| **Overall R360** at 42.9% | -$66,153 | Significantly behind all regions |

### ROOT CAUSE ANALYSIS

Based on loss reason data from Q1 QTD:

| Loss Reason | Deals | Lost ACV | % of Losses |
|-------------|-------|----------|-------------|
| Pricing was too high | 9 | $102,504 | 68.9% |
| Not Ready to Buy | 6 | $29,406 | 19.8% |
| Not Interested | 2 | $7,440 | 5.0% |
| Unresponsive | 2 | $3,038 | 2.0% |
| Timing | 1 | $6,380 | 4.3% |

**PRIMARY ISSUE: 68.9% of lost ACV is due to PRICING**

---

## Funnel Analysis

### Inbound Funnel (Q1 QTD)

| Division | MQL | SQL | Demo | SQO | Won | MQL->SQL |
|----------|-----|-----|------|-----|-----|----------|
| US | 18 | 7 | 5 | 5 | 0 | 38.9% |
| UK | 5 | 4 | 3 | 3 | 1 | 80.0% |
| AU | 0 | 0 | 0 | 0 | 0 | N/A |
| **TOTAL** | **23** | **11** | **8** | **8** | **1** | **47.8%** |

**Critical Finding:** SQO->Won dropout is 100% in US, 66.7% in UK
- Deals are reaching pipeline but NOT closing
- This aligns with pricing being the #1 loss reason

---

## Recommended Actions

### This Week (Critical)

- [ ] **Win/Loss Analysis:** Deep dive on 20 lost New Logo deals ($149K lost ACV)
- [ ] **Pricing Review:** 69% of losses are pricing-related - need competitive analysis
- [ ] **AMER New Logo:** Review top 10 deals by close date for pull-forward opportunities
- [ ] **EMEA:** Understand the 6 lost deals - product positioning gap?

### This Month (High Priority)

- [ ] **Sales Enablement:** Price objection handling training + competitive battlecards
- [ ] **Marketing:** Improve US lead quality (38.9% MQL->SQL vs 80% UK)
- [ ] **Product:** Competitive feature analysis to justify pricing
- [ ] **RevOps:** Mandate competitor field capture on Closed Lost stage

### Pipeline Coverage Analysis

| Region | Category | Q1 Target | Pipeline | Coverage | Assessment |
|--------|----------|-----------|----------|----------|------------|
| AMER | New Logo | $525K | $11.4M | 21.8x | Excess/Stale |
| AMER | Expansion | $210K | $541K | 2.6x | Adequate |
| EMEA | New Logo | $112K | $640K | 5.7x | Excess/Stale |
| APAC | New Logo | $20K | $11K | 0.5x | INSUFFICIENT |

**Note:** High coverage with low win rate indicates QUALITY issue, not quantity.
Pipeline scrub recommended - average age exceeds 1,700 days in some segments.

---

## Trends

| Metric | 7-Day Trend | Assessment |
|--------|-------------|------------|
| AMER Expansion | Improving | Rolling 7d at 121% vs MTD 81% |
| AMER New Logo | Improving | Recent wins accelerating |
| EMEA Inbound MQL | Improving | MQL volume up in last 7 days |
| APAC Overall | Flat/Zero | No momentum; market concern |

---

## Data Sources

- **Actuals:** `sfdc.OpportunityViewTable` (real-time Salesforce)
- **Targets:** `2026 Bookings Plan Draft.xlsx` (Plan by Month sheet)
- **Generated:** 2026-01-12 16:04 UTC

---

*Report generated automatically. RAG: Green >=90% | Yellow 70-89% | Red <70%*
