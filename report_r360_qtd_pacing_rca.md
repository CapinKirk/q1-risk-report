# R360 Q1 2026 QTD Pacing & Root Cause Analysis

**Report Date:** January 11, 2026
**Analysis Period:** January 1 - January 10, 2026 (QTD)
**Product:** R360
**Percentile:** P50
**Data Quality Fixes Applied:**
- PARTNERSHIPS targets zeroed ($0)
- FunnelType-to-Source mapping prevents double-counting (INBOUND -> R360 INBOUND, others -> R360 NEW LOGO)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Segments Tracked | 24 |
| ON_TRACK (>=90%) | 8 |
| AT_RISK (70-89%) | 7 |
| MISS (<70%) | 9 |

---

## 1. QTD Pacing Summary by Segment

### AMER Region

| Funnel Type | Source | Segment | QTD Target ACV | QTD Actual ACV | QTD Pacing % | Status |
|-------------|--------|---------|----------------|----------------|--------------|--------|
| R360 NEW LOGO | AE SOURCED | SMB | $14,222 | $23,450 | 165% | ON_TRACK |
| R360 NEW LOGO | OUTBOUND | SMB | $8,333 | $7,200 | 86% | AT_RISK |
| R360 NEW LOGO | TRADESHOW | SMB | $3,840 | $0 | 0% | MISS |
| R360 NEW LOGO | PARTNERSHIPS | SMB | $0 | $0 | N/A | N/A |
| R360 INBOUND | INBOUND | SMB | $18,444 | $12,500 | 68% | MISS |
| R360 EXPANSION | AM SOURCED | N/A | $12,000 | $8,500 | 71% | AT_RISK |
| R360 EXPANSION | INBOUND | N/A | $5,500 | $3,200 | 58% | MISS |

### EMEA Region

| Funnel Type | Source | Segment | QTD Target ACV | QTD Actual ACV | QTD Pacing % | Status |
|-------------|--------|---------|----------------|----------------|--------------|--------|
| R360 NEW LOGO | AE SOURCED | SMB | $4,800 | $5,100 | 106% | ON_TRACK |
| R360 NEW LOGO | OUTBOUND | SMB | $2,800 | $1,500 | 54% | MISS |
| R360 NEW LOGO | TRADESHOW | SMB | $1,200 | $0 | 0% | MISS |
| R360 INBOUND | INBOUND | SMB | $6,200 | $4,800 | 77% | AT_RISK |
| R360 EXPANSION | AM SOURCED | N/A | $4,500 | $4,200 | 93% | ON_TRACK |

### APAC Region

| Funnel Type | Source | Segment | QTD Target ACV | QTD Actual ACV | QTD Pacing % | Status |
|-------------|--------|---------|----------------|----------------|--------------|--------|
| R360 NEW LOGO | AE SOURCED | SMB | $2,400 | $2,800 | 117% | ON_TRACK |
| R360 NEW LOGO | OUTBOUND | SMB | $1,400 | $400 | 29% | MISS |
| R360 INBOUND | INBOUND | SMB | $3,100 | $1,800 | 58% | MISS |
| R360 EXPANSION | AM SOURCED | N/A | $2,200 | $2,100 | 95% | ON_TRACK |

---

## 2. Funnel RCA for MISS Segments

### SEGMENT: AMER | R360 NEW LOGO | TRADESHOW | SMB
**STATUS: MISS (QTD Pacing: 0%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 2.4     │ 0      │ 0%          │ -         │ -            │ -        │
│ SAL   │ 2.4     │ 0      │ 0%          │ N/A       │ 100%         │ N/A      │
│ SQO   │ 1.5     │ 0      │ 0%          │ N/A       │ 62%          │ N/A      │
│ Won   │ 0.4     │ 0      │ 0%          │ N/A       │ 27%          │ N/A      │
│ ACV   │ $3,840  │ $0     │ 0%          │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQL stage (0% attainment) - Zero SQLs generated
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** No tradeshow leads generated in Q1 to date. This is expected early in Q1 as major tradeshows typically begin mid-February.
- **Recommendation:** Monitor tradeshow calendar. First major events expected Feb 15-20. Ensure pre-event lead gen campaigns are active.

---

### SEGMENT: AMER | R360 INBOUND | INBOUND | SMB
**STATUS: MISS (QTD Pacing: 68%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 45.6    │ 38     │ 83%         │ -         │ -            │ -        │
│ SQL   │ 27.4    │ 19     │ 69%         │ 50%       │ 60%          │ -10%     │
│ SAL   │ 27.4    │ 18     │ 66%         │ 95%       │ 100%         │ -5%      │
│ SQO   │ 16.9    │ 10     │ 59%         │ 56%       │ 62%          │ -6%      │
│ Won   │ 4.6     │ 3      │ 65%         │ 30%       │ 27%          │ +3%      │
│ ACV   │ $18,444 │ $12,500│ 68%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQO stage (59% attainment) - Fewest opportunities qualified
- **Issue Type:** HYBRID - Volume + Conversion
- **Root Cause:** MQL generation is below target (83%) AND MQL-to-SQL conversion is underperforming (-10% gap). The funnel degradation compounds through each stage.
- **Recommendation:**
  1. Increase paid media spend to boost MQL volume
  2. Review SDR qualification criteria - may be too strict
  3. Check lead quality from recent campaigns

---

### SEGMENT: AMER | R360 EXPANSION | INBOUND | N/A
**STATUS: MISS (QTD Pacing: 58%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ EQL   │ 8.2     │ 4      │ 49%         │ -         │ -            │ -        │
│ SQL   │ 6.6     │ 3      │ 45%         │ 75%       │ 80%          │ -5%      │
│ SAL   │ 6.6     │ 3      │ 45%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 4.1     │ 2      │ 49%         │ 67%       │ 62%          │ +5%      │
│ Won   │ 1.1     │ 1      │ 91%         │ 50%       │ 27%          │ +23%     │
│ ACV   │ $5,500  │ $3,200 │ 58%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** EQL stage (49% attainment) - Expansion Qualified Leads severely behind
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** Existing customer expansion opportunities from inbound channels are not materializing. Downstream conversion is actually strong (+23% on Won/SQO), but insufficient lead volume.
- **Recommendation:**
  1. Launch customer upsell campaign for existing R360 base
  2. Enable in-app expansion prompts for usage-based triggers
  3. AM team to proactively identify expansion opportunities

---

### SEGMENT: EMEA | R360 NEW LOGO | OUTBOUND | SMB
**STATUS: MISS (QTD Pacing: 54%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 4.2     │ 2      │ 48%         │ -         │ -            │ -        │
│ SAL   │ 4.2     │ 2      │ 48%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 2.6     │ 1      │ 38%         │ 50%       │ 62%          │ -12%     │
│ Won   │ 0.7     │ 0      │ 0%          │ 0%        │ 27%          │ -27%     │
│ ACV   │ $2,800  │ $1,500 │ 54%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQL stage (48% attainment) + Won stage (0% closed from target)
- **Issue Type:** VOLUME + CONVERSION
- **Root Cause:** Outbound SDR activity in EMEA is generating insufficient SQLs (only 2 vs 4.2 target). Additionally, SQO-to-Won conversion is 0% indicating deals are stalling at negotiation.
- **Recommendation:**
  1. Increase EMEA SDR outbound activity - review daily dial/email targets
  2. Audit pipeline deals - identify blockers in negotiation stage
  3. Consider EMEA-specific pricing or discount approval for Q1 close push

---

### SEGMENT: EMEA | R360 NEW LOGO | TRADESHOW | SMB
**STATUS: MISS (QTD Pacing: 0%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 0.8     │ 0      │ 0%          │ -         │ -            │ -        │
│ SAL   │ 0.8     │ 0      │ 0%          │ N/A       │ 100%         │ N/A      │
│ SQO   │ 0.5     │ 0      │ 0%          │ N/A       │ 62%          │ N/A      │
│ Won   │ 0.1     │ 0      │ 0%          │ N/A       │ 27%          │ N/A      │
│ ACV   │ $1,200  │ $0     │ 0%          │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQL stage (0% attainment)
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** No EMEA tradeshows have occurred in Q1 to date. First EMEA events typically start late January.
- **Recommendation:** Expected behavior for early Q1. Monitor first EMEA tradeshow leads expected ~Jan 25.

---

### SEGMENT: APAC | R360 NEW LOGO | OUTBOUND | SMB
**STATUS: MISS (QTD Pacing: 29%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 0       │ 0      │ N/A         │ -         │ -            │ -        │
│ SQL   │ 2.1     │ 1      │ 48%         │ -         │ -            │ -        │
│ SAL   │ 2.1     │ 1      │ 48%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 1.3     │ 0      │ 0%          │ 0%        │ 62%          │ -62%     │
│ Won   │ 0.4     │ 0      │ 0%          │ N/A       │ 27%          │ N/A      │
│ ACV   │ $1,400  │ $400   │ 29%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** SQO stage (0% attainment) - No SQLs converting to opportunities
- **Issue Type:** CONVERSION FAILURE
- **Root Cause:** APAC outbound is generating some SQLs but they are not converting to qualified opportunities. SAL-to-SQO conversion is 0% vs 62% expected.
- **Recommendation:**
  1. Review APAC AE follow-up on outbound SQLs - check response time
  2. Audit SQL quality from APAC SDRs - ensure proper qualification
  3. Check if APAC AEs have bandwidth to work outbound leads

---

### SEGMENT: APAC | R360 INBOUND | INBOUND | SMB
**STATUS: MISS (QTD Pacing: 58%)**

#### Funnel Breakdown
```
┌───────┬─────────┬────────┬─────────────┬───────────┬──────────────┬──────────┐
│ Stage │ Target  │ Actual │ Attainment  │ Conv Rate │ Expected Conv│ Conv Gap │
├───────┼─────────┼────────┼─────────────┼───────────┼──────────────┼──────────┤
│ MQL   │ 12.4    │ 8      │ 65%         │ -         │ -            │ -        │
│ SQL   │ 7.4     │ 5      │ 68%         │ 63%       │ 60%          │ +3%      │
│ SAL   │ 7.4     │ 5      │ 68%         │ 100%      │ 100%         │ OK       │
│ SQO   │ 4.6     │ 3      │ 65%         │ 60%       │ 62%          │ -2%      │
│ Won   │ 1.2     │ 1      │ 83%         │ 33%       │ 27%          │ +6%      │
│ ACV   │ $3,100  │ $1,800 │ 58%         │ -         │ -            │ -        │
└───────┴─────────┴────────┴─────────────┴───────────┴──────────────┴──────────┘
```

#### Diagnosis
- **Primary Bottleneck:** MQL stage (65% attainment) - Insufficient inbound leads
- **Issue Type:** TOP-OF-FUNNEL VOLUME
- **Root Cause:** APAC inbound MQL generation is below target. Conversion rates through the funnel are healthy (even slightly above expected on Won). The miss is purely a volume issue.
- **Recommendation:**
  1. Increase APAC digital marketing spend (SEM, display)
  2. Launch APAC-specific content marketing campaigns
  3. Consider APAC timezone webinar series to drive leads

---

## 3. Risk Summary by Issue Type

### TOP-OF-FUNNEL VOLUME Issues (5 segments)
| Region | Segment | Primary Bottleneck | Pacing % |
|--------|---------|-------------------|----------|
| AMER | R360 NEW LOGO / TRADESHOW | SQL (0%) | 0% |
| AMER | R360 EXPANSION / INBOUND | EQL (49%) | 58% |
| EMEA | R360 NEW LOGO / TRADESHOW | SQL (0%) | 0% |
| APAC | R360 INBOUND / INBOUND | MQL (65%) | 58% |

**Common Recommendation:** Increase lead generation activity in these channels. Tradeshow segments are expected to recover as events begin mid-Q1.

### CONVERSION Issues (2 segments)
| Region | Segment | Conversion Gap | Pacing % |
|--------|---------|----------------|----------|
| APAC | R360 NEW LOGO / OUTBOUND | SAL→SQO (-62%) | 29% |
| EMEA | R360 NEW LOGO / OUTBOUND | SQO→Won (-27%) | 54% |

**Common Recommendation:** Audit deal progression and AE follow-up in these segments. Check for process or qualification issues.

### HYBRID Issues (2 segments)
| Region | Segment | Issue Details | Pacing % |
|--------|---------|---------------|----------|
| AMER | R360 INBOUND / INBOUND | MQL volume + MQL→SQL conv | 68% |

**Common Recommendation:** Address both lead generation volume AND qualification process simultaneously.

---

## 4. Priority Actions for Q1 Recovery

### Immediate (This Week)
1. **APAC Outbound Audit:** Investigate zero SAL→SQO conversion. Review AE response times and SQL quality.
2. **AMER Inbound:** Increase paid media budget by 15% to recover MQL gap.
3. **EMEA Outbound:** Pipeline review for stuck deals - identify and resolve blockers.

### Short-term (Next 2 Weeks)
1. **Expansion Campaign:** Launch customer upsell email campaign targeting R360 power users.
2. **APAC Lead Gen:** Deploy APAC-timezone webinar series.
3. **SDR Training:** Review qualification criteria with AMER/EMEA SDRs.

### Pre-Tradeshow (Before Feb 15)
1. Confirm booth staffing and lead capture processes.
2. Pre-event outreach campaigns to registered attendees.
3. Post-event follow-up sequences ready to deploy.

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
- **Targets:** `Staging.StrategicOperatingPlan` (Percentile = P50)
- **Won/ACV Actuals:** `sfdc.OpportunityViewTable` (Won = true, r360_record__c = true)
- **MQL Actuals:** `MarketingFunnel.R360InboundFunnel` (INBOUND funnel only)
- **EQL Actuals:** `sfdc.OpportunityViewTable` (ExpansionQualified = true)
