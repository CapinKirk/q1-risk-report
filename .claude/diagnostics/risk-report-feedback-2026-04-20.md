# Risk Report Feedback — 2026-04-20

**Source meeting:** SDR Slides Intervention — Monday, Apr 20, 2026 at 2:30 PM CT
**Attendees:** Kirk Bennett, Jonathan Ingram, Steven Freedman
**Context:** Kirk demoed the Risk Report (with one-click MBR deck generator) to Jonathan (SDR manager, outbound). Feedback below is scoped strictly to external feedback on the Risk Report — Kirk's own notes-to-self, Walk Simulator feedback, and architectural suggestions are excluded.

---

## The Feedback

The outbound motion has **no MQL stage and no MQL goals** — the outbound funnel begins at SQL. The Risk Report currently does not reflect this, which shows up in two places plus a third stale section:

### 1. AI analysis references MQLs when the view is outbound-only

In the live demo, the AI narrative talked about "lack of new MQLs" and "zero top of funnel" risk for an outbound-filtered view. Steven pushed back:

> Steven: "I feel like we were what we were just seeing was that MQLs were up monthto date for this month… so MQL's for outbound though."
> Jonathan: "there's no such thing as MQs [out]bound"

Jonathan then confirmed the actual outbound monthly targets are **42 SQLs / 28 SALs / 14 SQOs** — no MQL target exists.

Kirk's in-meeting diagnosis:
> "the AI engine just needs to understand that MQLs are not a part of the outbound motion and or spoof them uh rather than just add them to the middle of the funnel as they're doing currently."

**Fix:** When the motion filter is outbound-only, the AI prompt context must omit MQL metrics entirely (or explicitly mark them N/A) so the narrative doesn't invent MQL callouts or treat an absence of MQLs as a risk signal.

### 2. Generated MBR deck carries the same MQL problem

The Slides deck generator reuses the AI analysis output, so the same outbound-MQL confusion propagates into the exported deck. Fixing #1 upstream should resolve this, but the deck generator also needs its prompt/template tailored for the outbound motion (funnel structure starts at SQL, different stage labels, different pacing callouts).

### 3. Google Ads section is not useful in an outbound-only view

> Kirk: "renewals not necessarily applicable Google ads" — called out live in the outbound walkthrough.

Google Ads data is paid-inbound attribution; it has no signal for outbound-sourced pipeline. When the view is outbound-only, the Google Ads section should be hidden (or replaced with a stub noting N/A for this motion).

---

## Action Items

| # | Owner | Action |
|---|-------|--------|
| 1 | Kirk | AI analysis: when motion = outbound, exclude MQL metrics from the prompt context so the narrative doesn't reference MQLs or treat missing MQLs as a risk. |
| 2 | Kirk | Deck generator: same MQL exclusion in the outbound template; verify generated slide text reads correctly for an SQL-first funnel. |
| 3 | Kirk | Hide the Google Ads section when the view is filtered to outbound-only. |

---

## Caveats

- Transcript is auto-generated; quotes above are lightly cleaned ("MQs bound" → "MQLs outbound", "Squo" → "SQO"). Interpretations reflect context, not literal transcript text.
- Risk Report was the first ~9 minutes of the meeting; Jonathan's deeper structured feedback is pending his "dream deck" prototype.
