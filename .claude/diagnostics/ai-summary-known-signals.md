# AI Summary — Known Signals Library

Catalog of specific revenue/marketing/pipeline signals the AI-generated business
review has been asked (by stakeholders) to catch or was found to have missed. Each
entry drives (a) a regression test in `tests/api/ai-analysis-trend-detection.spec.ts`
and (b) an understanding of which data channels the summary depends on.

**Add an entry whenever:**
- A stakeholder raises an analysis the AI summary should have surfaced but didn't.
- The AI surfaces a material insight that's worth locking in as expected behavior.
- A deep-dive (like the Colin Trapp pipeline review) produces a finding the AI missed.

**Format per entry:**
- **Date** (of the finding, not of this entry)
- **Stakeholder / Source**
- **Signal** (one-line summary)
- **Why it was missed / How it was caught** (before/after the Phase work)
- **Required data channels** (the fields/queries the AI needs to see this)
- **Covered by test?** (yes with file:line OR no — why)

---

## Entry #1 — 2026-04-21 — Colin Trapp — US Inbound SMB Q2 pipe starvation

- **Stakeholder:** Colin Trapp (DM to Kirk via Slack)
- **Signal:** POR US NEW LOGO Inbound SMB is the single biggest Q2 concern:
  34% QTD attainment, traced to a Dec 2025 MQL volume drop (199 → 121, -39% MoM)
  caused by POR US Google Ads spend being pulled back ~$6.7K MoM. Two POR US
  campaigns ("US Campaign - Mobile Only", "US PMAX") went dark in Dec 2025 and
  have stayed dark through Apr 2026.
- **Why the AI missed it (pre-Phase-1):**
  1. AI only saw current-period snapshots; no month-over-month trend data
     → couldn't see the Dec MQL drop.
  2. AI only saw Product × Region × Category attainment; no source breakdown
     within NEW LOGO → couldn't isolate "Inbound" slice of SMB.
  3. Google Ads section showed current campaign metrics only; no trend, no dark-campaign
     flagging → couldn't name the specific recoverable levers.
  4. No cross-account view — POR ↓ / R360 ↑ reallocation invisible.
- **How it was caught (post-Phase-1+2+3):**
  - `mql_trend_by_month` surfaces 6-month MQL series by product × region × source × segment.
  - `ad_spend_trend_by_month` surfaces 6-month campaign-level spend.
  - `attainment_by_segment` (Phase 3 aligned to DRF.Segment) splits NEW LOGO
     into SMB vs Strategic with matching category rows.
  - Prompt helpers `detectMqlAnomalies`, `detectAdSpendAnomalies`, `detectDarkCampaigns`,
     `detectCrossAccountReallocations` pre-compute the anomalies.
  - Prompt section "1.5. TREND ANOMALY REVIEW" forces the model to walk the
     causal chain (symptom → MQL drop → ad-spend cut → recoverable lever).
- **Required data channels:**
  - `DailyRevenueFunnel` 6-month window, grouped by `RecordType × Region × FunnelType × Segment`
  - `GoogleAds_POR_*` + `GoogleAds_Record360_*` 6-month campaign-level metrics
  - `OpportunityViewTable` joined to DRF via OpportunityID for SMB/Strategic classification
  - `RevOpsReport` category targets (used directly for segment targets after Phase 3 alignment)
- **Covered by test:** yes — `tests/api/ai-analysis-trend-detection.spec.ts` tests 1–3 verify
  the data channels populate; test 4 verifies the AI output cites either segment names or
  monthly trend markers. A manual curl of `/api/ai-analysis` with POR AMER filter on the
  April 2026 data reproduces the causal chain (verified 2026-04-22).

---

## Entry #2 — 2026-04-22 — Partial-month MoM drop false positives

- **Stakeholder:** self-audit during Round 4 verification
- **Signal:** Anomaly detection was flagging `Mar → Apr` drops at -70% to -80% MoM for
  multiple product/region/campaign combos, purely because April was 21-of-30 days in
  at the as-of date. These partial-month "drops" were burying real anomalies
  (POR EMEA Inbound SMB Nov → Dec -48%, R360 EMEA Nov → Dec -77%) in the top-10 list.
- **How it was caught:** manual inspection of `mql_trend_by_month` + `ad_spend_trend_by_month`
  output during threshold audit.
- **Fix:** `isPartialMonth(month, asOfDate)` helper; all four detectors
  (`detectMqlAnomalies`, `detectAdSpendAnomalies`, `detectDarkCampaigns`,
  `detectCrossAccountReallocations`) skip comparisons where `currentMonth` is the
  asOfDate's month AND asOfDate is not end-of-month. Monthly-series display in the
  prompt also annotates the partial month as `(partial)` so the AI never cites it
  as a closed-month drop.
- **Required data channels:** same as Entry #1 plus `period.as_of_date`.
- **Covered by test:** partially — existing canary tests assert the data channels
  populate, but no test yet guards against partial-month false positives. Follow-up:
  add a test fixture with a mid-month as-of date and assert that no MoM anomaly is
  returned where `current_month === <asOfMonth>`.

---

## How to use this file

- **Before changing the AI prompt** or any anomaly detector, scan this file for
  entries whose test would break.
- **When responding to a stakeholder's "the AI missed X" complaint**, first check
  if an entry already covers it; if so, confirm the test is still green and walk
  the AI output. If not, add a new entry and tie it to a test.
- **During /ultrareview or quarterly replay runs**, diff the current AI output
  against each entry's "signal" line; flag any entry the output no longer hits.
