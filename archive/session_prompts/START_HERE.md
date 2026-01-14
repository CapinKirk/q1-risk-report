# 🚀 Start Here - RevOps Report V2

## Quick Start for New Claude Session

Copy and paste this into a new Claude Code session:

---

I need you to build an improved Daily Revenue Operations Report based on the V1 prototype that was archived.

**Context:**
- V1 is archived in `/Users/prestonharris/revops_report_archive_v1/`
- Full requirements are in `/Users/prestonharris/REVOPS_REPORT_CONTINUATION_PROMPT.md`
- Archive summary is in `/Users/prestonharris/ARCHIVE_SUMMARY.md`

**Your mission:**
Build an exceptional daily RevOps report that executives would actually want to read. V1 was functional but not actionable. V2 needs to be insightful, prioritized, and drive action.

**Read these files first:**
1. `/Users/prestonharris/REVOPS_REPORT_CONTINUATION_PROMPT.md` - Full requirements
2. `/Users/prestonharris/ARCHIVE_SUMMARY.md` - What V1 did wrong
3. `/Users/prestonharris/revops_report_archive_v1/report_output.json` - V1 sample output

**Then build:**
1. `query_1_improved.sql` - Enhanced report payload with trends
2. `query_2_improved.sql` - Enhanced detail payload with prioritization
3. `generate_report_v2.py` - Better message formatting
4. Run for 2026-01-10 and show me the improved output

**BigQuery is ready:**
- Already authenticated as kirk.bennett@pointofrental.com
- Test: `bq ls` to see datasets
- Project: `data-analytics-306119`
- Table: `Staging.StrategicOperatingPlan`

**Key improvements needed:**
- Add week-over-week and month-over-month trends
- Better executive summary with key insights
- Specific actions with owners and metrics
- Alert prioritization by $ impact
- Context around every number
- Better Slack formatting with emojis and structure

Make it a report people look forward to reading. 🎯

---

## Files Ready for You

```
/Users/prestonharris/
├── REVOPS_REPORT_CONTINUATION_PROMPT.md  ← Full requirements (your main guide)
├── ARCHIVE_SUMMARY.md                     ← What V1 did and why it needs improvement
├── START_HERE.md                          ← This file
└── revops_report_archive_v1/
    ├── query_1.sql                        ← V1 report query (review but don't copy)
    ├── query_2.sql                        ← V1 detail query (review but don't copy)
    ├── generate_report.py                 ← V1 Python script (review but don't copy)
    └── report_output.json                 ← V1 sample output (see what was wrong)
```

## V1 Main Issues (Fix These)

1. **No Story**: Just numbers, no context
   - Bad: "MTD: $850K of $1.4M (58.9%)"
   - Good: "MTD: $851K of $1.4M (59% ↓ from 95% last MTD) - Revenue pacing down due to AMER Expansion shortfall (-$120K)"

2. **Generic Actions**: Not specific enough
   - Bad: "SQL: Review SQL conversion rates"
   - Good: "SQL: Sales leadership audit 15 stalled SQL opps in AMER|SMB|INBOUND worth $45K - target 30% conversion by Friday"

3. **No Prioritization**: Everything equal weight
   - Need: Rank by $ impact, highlight most urgent

4. **No Trends**: Can't see if improving/worsening
   - Need: Week-over-week, month-over-month comparisons

5. **Poor Formatting**: Doesn't use Slack features well
   - Need: Better structure, emojis, visual hierarchy

## Success = Executive-Ready Report

Imagine a VP of Sales opening Slack at 8 AM. They should:
- Immediately understand the top 3 priorities for today
- See trends (getting better/worse)
- Know exactly what actions to take
- Feel confident the data is accurate
- Actually look forward to reading it daily

**Build that.** 🚀
