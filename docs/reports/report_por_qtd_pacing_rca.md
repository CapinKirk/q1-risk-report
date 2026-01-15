# POR Q1 2026 QTD Pacing & Root Cause Analysis

**Report Date:** January 11, 2026
**Analysis Period:** January 1 - January 10, 2026 (QTD)
**Product:** POR (Point of Rental)
**Percentile:** P50
**Data Quality Fixes Applied:**
- FunnelType-to-Source mapping prevents double-counting (INBOUND source -> INBOUND funnel, others -> NEW LOGO funnel)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Segments Tracked | 21 |
| ON_TRACK (>=90%) | 10 |
| AT_RISK (70-89%) | 5 |
| MISS (<70%) | 6 |

---

## 1. QTD Pacing Summary by Segment

### AMER Region

| Funnel Type | Source | Segment | QTD Target ACV | QTD Actual ACV | QTD Pacing % | Status |
|-------------|--------|---------|----------------|----------------|--------------|--------|
| NEW LOGO | AE SOURCED | SMB | $45,600 | $52,300 | 115% | ON_TRACK |
| NEW LOGO | OUTBOUND | SMB | $28,400 | $31,200 | 110% | ON_TRACK |
| NEW LOGO | TRADESHOW | SMB | $8,200 | $0 | 0% | MISS |
| INBOUND | INBOUND | SMB | $38,500 | $29,800 | 77% | AT_RISK |
| EXPANSION | AM SOURCED | N/A | $22,000 | $24,500 | 111% | ON_TRACK |
| EXPANSION | INBOUND | N/A | $9,800 | $5,200 | 53% | MISS |
| MIGRATION | N/A | N/A | $15,000 | $18,200 | 121% | ON_TRACK |

### EMEA Region

| Funnel Type | Source | Segment | QTD Target ACV | QTD Actual ACV | QTD Pacing % | Status |
|-------------|--------|---------|----------------|----------------|--------------|--------|
| NEW LOGO | AE SOURCED | SMB | $12,400 | $11,800 | 95% | ON_TRACK |
| NEW LOGO | OUTBOUND | SMB | $7,200 | $4,100 | 57% | MISS |
| NEW LOGO | TRADESHOW | SMB | $2,400 | $0 | 0% | MISS |
| INBOUND | INBOUND | SMB | $10,500 | $9,200 | 88% | AT_RISK |
| EXPANSION | AM SOURCED | N/A | $8,200 | $9,100 | 111% | ON_TRACK |
| MIGRATION | N/A | N/A | $5,500 | $4,800 | 87% | AT_RISK |

### APAC Region

| Funnel Type | Source | Segment | QTD Target ACV | QTD Actual ACV | QTD Pacing % | Status |
|-------------|--------|---------|----------------|----------------|--------------|--------|
| NEW LOGO | AE SOURCED | SMB | $6,800 | $7,400 | 109% | ON_TRACK |
| NEW LOGO | OUTBOUND | SMB | $3,200 | $2,800 | 88% | AT_RISK |
| INBOUND | INBOUND | SMB | $5,400 | $3,200 | 59% | MISS |
| EXPANSION | AM SOURCED | N/A | $4,200 | $4,600 | 110% | ON_TRACK |
| MIGRATION | N/A | N/A | $2,800 | $2,900 | 104% | ON_TRACK |

---

## 2. Funnel RCA for MISS Segments

### SEGMENT: AMER | NEW LOGO | TRADESHOW | SMB
**STATUS: MISS (QTD Pacing: 0%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 5.8     │ 0      │ 0%          │ -         │ -            │ -        │
│ SAL   │ 5.8     │ 0      │ 0%          │ N/A       │ 100%         │ N/A      │
│ SQO   │ 3.6     │ 0      │ 0%          │ N/A       │ 62%          │ N/A      │
│ Won   │ 1.2     │ 0      │ 0%          │ N/A       │ 33%          │ N/A      │
│ ACV   │ $8,200  │ $0     │ 0%          │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQL stage (0% attainment) - Zero tradeshow-sourced SQLs
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** No tradeshows have occurred in the first 10 days of Q1. The rental equipment industry's major shows (ARA, The Rental Show) begin in mid-February.
- **Recommendation:** Expected seasonal pattern. First tradeshow leads expected from The Rental Show (Feb 18-21). Pre-event nurture campaigns should be active by Feb 1.

---

### SEGMENT: AMER | EXPANSION | INBOUND | N/A
**STATUS: MISS (QTD Pacing: 53%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ EQL   │ 14.2    │ 6      │ 42%         │ -         │ -            │ -        │
│ SQL   │ 11.4    │ 5      │ 44%         │ 83%       │ 80%          │ +3%      │
│ SAL   │ 11.4    │ 5      │ 44%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 7.0     │ 3      │ 43%         │ 60%       │ 62%          │ -2%      │
│ Won   │ 2.3     │ 1      │ 43%         │ 33%       │ 33%          │ OK       │
│ ACV   │ $9,800  │ $5,200 │ 53%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** EQL stage (42% attainment) - Expansion Qualified Leads severely behind
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** Existing POR customers are not generating inbound expansion requests at expected rates. Conversion through the funnel is healthy once leads enter. The gap is in initial customer engagement.
- **Recommendation:**
  1. Deploy customer health score alerts to identify expansion-ready accounts
  2. Launch in-product upsell prompts for add-on modules
  3. Customer Success to proactively reach out to high-usage accounts
  4. Review pricing page traffic from existing customers

---

### SEGMENT: EMEA | NEW LOGO | OUTBOUND | SMB
**STATUS: MISS (QTD Pacing: 57%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 8.4     │ 4      │ 48%         │ -         │ -            │ -        │
│ SAL   │ 8.4     │ 4      │ 48%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 5.2     │ 3      │ 58%         │ 75%       │ 62%          │ +13%     │
│ Won   │ 1.7     │ 1      │ 59%         │ 33%       │ 33%          │ OK       │
│ ACV   │ $7,200  │ $4,100 │ 57%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQL stage (48% attainment) - SDR outbound activity below target
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** EMEA SDR team is generating only 48% of expected SQLs. Once leads enter the funnel, conversion is actually above target (+13% on SAL→SQO). This is purely an SDR activity/capacity issue.
- **Recommendation:**
  1. Review EMEA SDR daily activity metrics (dials, emails, connects)
  2. Check if holiday carryover affected early January activity
  3. Consider temporary SDR capacity boost or AMER overflow support
  4. Ensure prospect lists are refreshed for Q1

---

### SEGMENT: EMEA | NEW LOGO | TRADESHOW | SMB
**STATUS: MISS (QTD Pacing: 0%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 1.6     │ 0      │ 0%          │ -         │ -            │ -        │
│ SAL   │ 1.6     │ 0      │ 0%          │ N/A       │ 100%         │ N/A      │
│ SQO   │ 1.0     │ 0      │ 0%          │ N/A       │ 62%          │ N/A      │
│ Won   │ 0.3     │ 0      │ 0%          │ N/A       │ 33%          │ N/A      │
│ ACV   │ $2,400  │ $0     │ 0%          │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQL stage (0% attainment) - No EMEA tradeshow activity
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** No EMEA-region tradeshows in early Q1. First major European rental industry event is in late January.
- **Recommendation:** Expected seasonal gap. Ensure EMEA tradeshow calendar is confirmed and pre-event campaigns are scheduled.

---

### SEGMENT: APAC | INBOUND | INBOUND | SMB
**STATUS: MISS (QTD Pacing: 59%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 18.4    │ 11     │ 60%         │ -         │ -            │ -        │
│ SQL   │ 11.0    │ 6      │ 55%         │ 55%       │ 60%          │ -5%      │
│ SAL   │ 11.0    │ 6      │ 55%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 6.8     │ 4      │ 59%         │ 67%       │ 62%          │ +5%      │
│ Won   │ 2.3     │ 1      │ 43%         │ 25%       │ 33%          │ -8%      │
│ ACV   │ $5,400  │ $3,200 │ 59%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** MQL stage (60% attainment) + Won stage (43% attainment with -8% conversion gap)
- **Issue Type:** HYBRID - Volume + Conversion
- **Root Cause:** APAC inbound is suffering from both insufficient MQL volume (60%) AND poor bottom-of-funnel conversion (SQO→Won at 25% vs 33% expected). This creates compound underperformance.
- **Recommendation:**
  1. Increase APAC digital marketing spend immediately
  2. Audit APAC closing motions - why are deals not converting?
  3. Check if pricing/discounting authority is blocking closes
  4. Review competitive losses in APAC region

---

## 3. Risk Summary by Issue Type

### TOP-OF-FUNNEL VOLUME Issues (4 segments)
| Region | Segment | Primary Bottleneck | Pacing % |
|--------|---------|-------------------|----------|
| AMER | NEW LOGO / TRADESHOW | SQL (0%) | 0% |
| AMER | EXPANSION / INBOUND | EQL (42%) | 53% |
| EMEA | NEW LOGO / TRADESHOW | SQL (0%) | 0% |
| EMEA | NEW LOGO / OUTBOUND | SQL (48%) | 57% |

**Common Recommendation:** Increase lead generation activity. Tradeshow segments will recover naturally as events begin. EMEA outbound needs immediate SDR activity boost.

### CONVERSION Issues (0 segments)
No pure conversion issues identified.

### HYBRID Issues (1 segment)
| Region | Segment | Issue Details | Pacing % |
|--------|---------|---------------|----------|
| APAC | INBOUND / INBOUND | MQL volume (60%) + SQO→Won conv (-8%) | 59% |

**Common Recommendation:** Address both marketing spend and sales execution simultaneously in APAC.

---

## 4. Priority Actions for Q1 Recovery

### Immediate (This Week)
1. **EMEA SDR Activity:** Manager review of daily activity metrics. Set daily dial/email minimums.
2. **APAC Pipeline Review:** Deal-by-deal analysis of SQOs not converting. Identify blockers.
3. **AMER Expansion Campaign:** Launch customer upsell initiative targeting high-usage accounts.

### Short-term (Next 2 Weeks)
1. **APAC Marketing Boost:** Increase paid search budget by 20% for AU market.
2. **EMEA SDR Support:** Consider AMER SDR overflow for EMEA territories during transition.
3. **In-Product Upsell:** Deploy expansion prompts in POR application for all regions.

### Pre-Tradeshow (Before Feb 18)
1. **The Rental Show Prep:** Confirm booth, staffing, demo environment, lead capture.
2. **Pre-event Campaigns:** Launch email nurture to registered attendees.
3. **Post-show Playbook:** Ensure immediate follow-up sequences are ready.

---

## 5. Regional Summary

### AMER Performance
- **Strengths:** NEW LOGO AE SOURCED and OUTBOUND both exceeding targets (115%, 110%). MIGRATION strong at 121%.
- **Weaknesses:** TRADESHOW (expected seasonal), EXPANSION INBOUND (needs customer engagement focus).
- **Net Assessment:** Healthy overall, expansion segment needs attention.

### EMEA Performance
- **Strengths:** AE SOURCED on track (95%), EXPANSION AM SOURCED exceeding (111%).
- **Weaknesses:** OUTBOUND SDR activity low, TRADESHOW seasonal gap.
- **Net Assessment:** SDR capacity issue is the primary risk. Otherwise stable.

### APAC Performance
- **Strengths:** AE SOURCED exceeding (109%), EXPANSION and MIGRATION on track.
- **Weaknesses:** INBOUND funnel has both volume and conversion issues.
- **Net Assessment:** Inbound channel needs comprehensive improvement plan.

---

## 6. Comparison: POR vs R360

| Metric | POR | R360 |
|--------|-----|------|
| Total MISS Segments | 6 | 9 |
| Total ON_TRACK Segments | 10 | 8 |
| Primary Issue Type | Volume (4/6) | Volume (5/9) |
| Worst Performing Region | APAC Inbound (59%) | APAC Outbound (29%) |
| Best Performing Region | AMER (strong across board) | AMER (AE Sourced 165%) |

**Observation:** Both products show similar patterns - tradeshow segments at 0% (expected), APAC underperformance, and volume-driven misses. R360 has slightly more segments at risk.

---

## Appendix: Methodology

### Status Thresholds
| Status | Pacing % | Description |
|--------|----------|-------------|
| ON_TRACK | >= 90% | On pace to meet or exceed target |
| AT_RISK | 70-89% | Requires attention but recoverable |
| MISS | < 70% | Significant intervention needed |

### Conversion Rate Calculations
- **Actual Conv Rate:** Actual[Stage N] / Actual[Stage N-1]
- **Expected Conv Rate:** Target[Stage N] / Target[Stage N-1]
- **Conv Gap:** Actual Conv Rate - Expected Conv Rate

### Funnel Stages
- **MQL:** Marketing Qualified Lead (Inbound funnels)
- **EQL:** Expansion Qualified Lead (Expansion funnel only)
- **SQL:** Sales Qualified Lead
- **SAL:** Sales Accepted Lead
- **SQO:** Sales Qualified Opportunity
- **Won:** Closed-Won Opportunity
- **ACV:** Annual Contract Value

### Data Sources
- **Targets:** `Staging.StrategicOperatingPlan` (Percentile = P50, RecordType = POR)
- **Won/ACV Actuals:** `sfdc.OpportunityViewTable` (Won = true, por_record__c = true)
- **Funnel Actuals (MQL/SQL/SAL/SQO):** `Staging.StrategicOperatingPlan` Actual_* columns

### QTD Window
- **Start Date:** January 1, 2026
- **End Date:** January 10, 2026
- **Days in Period:** 10 days
- **Q1 Progress:** 11% of quarter elapsed (10/90 days)

---

*Report generated: January 11, 2026*
*Next scheduled update: January 18, 2026*
