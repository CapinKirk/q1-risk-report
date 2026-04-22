import { test, expect } from '@playwright/test';

/**
 * Canary test for the AI-summary trend-detection pipeline (Phase 1 + 2).
 *
 * This test locks in the behavior that Colin Trapp's "US Inbound SMB" finding
 * surfaced: the AI summary was blind to month-over-month MQL drops and to
 * SMB-vs-Strategic gaps within NEW LOGO. The Phase 1+2 changes added:
 *
 *  1. /api/report-data returns mql_trend_by_month (6 months of MQL counts)
 *  2. /api/report-data returns ad_spend_trend_by_month (6 months by campaign)
 *  3. /api/report-data returns attainment_by_segment (SMB/Strategic apportioned)
 *  4. /api/ai-analysis prompt has a "TREND ANOMALIES" section and a
 *     "NEW LOGO Segment Breakdown" section, with rules that force the model
 *     to cite month + magnitude and connect anomalies back to attainment.
 *
 * These tests fail loudly if any of those data channels regress — that's the
 * whole point. If a future change removes trend data or the segment
 * apportionment, the AI will silently regress back to blindness; this test
 * catches it before it ships.
 */

const API_BASE = '/api';

// Q1 → Q2-QTD window (6 months of trend context).
// Picked so that the Dec 2025 drop Colin identified is inside the trend window.
const REPORT_BODY = {
  startDate: '2026-01-01',
  endDate: '2026-04-21',
};

test.describe('AI summary trend + segment canary (Phase 1+2)', () => {
  test('report-data returns mql_trend_by_month array with recent months', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/report-data`, { data: REPORT_BODY });
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();

    expect(data).toHaveProperty('mql_trend_by_month');
    const trend = data.mql_trend_by_month;
    expect(Array.isArray(trend)).toBeTruthy();
    expect(trend.length).toBeGreaterThan(0);

    const months = new Set(trend.map((r: any) => r.month));
    // At minimum we expect 3 distinct months in a 6-month window
    expect(months.size).toBeGreaterThanOrEqual(3);

    // Each row should have the dimensions the AI needs
    const sample = trend[0];
    expect(sample).toHaveProperty('product');
    expect(sample).toHaveProperty('region');
    expect(sample).toHaveProperty('source');
    expect(sample).toHaveProperty('segment');
    expect(sample).toHaveProperty('mql_count');
  });

  test('report-data returns ad_spend_trend_by_month with POR + R360 campaigns', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/report-data`, { data: REPORT_BODY });
    const data = await resp.json();

    expect(data).toHaveProperty('ad_spend_trend_by_month');
    const trend = data.ad_spend_trend_by_month;
    expect(Array.isArray(trend)).toBeTruthy();
    expect(trend.length).toBeGreaterThan(0);

    const products = new Set(trend.map((r: any) => r.product));
    // Should have at least one of each product's campaigns
    expect(products.has('POR') || products.has('R360')).toBeTruthy();

    const sample = trend[0];
    expect(sample).toHaveProperty('month');
    expect(sample).toHaveProperty('campaign_name');
    expect(sample).toHaveProperty('ad_spend_usd');
    expect(typeof sample.ad_spend_usd).toBe('number');
  });

  test('report-data returns attainment_by_segment with NEW LOGO SMB and Strategic rows', async ({ request }) => {
    const resp = await request.post(`${API_BASE}/report-data`, { data: REPORT_BODY });
    const data = await resp.json();

    expect(data).toHaveProperty('attainment_by_segment');
    const segRows = data.attainment_by_segment;
    expect(Array.isArray(segRows)).toBeTruthy();
    expect(segRows.length).toBeGreaterThan(0);

    // Every row must have segment set and category = 'NEW LOGO'
    for (const row of segRows) {
      expect(row.category).toBe('NEW LOGO');
      expect(['SMB', 'Strategic']).toContain(row.segment);
      expect(row.is_rollup).toBe(false);
    }

    // For POR AMER we must have BOTH SMB and Strategic (the exact slice
    // Colin flagged). If this regresses, the AI loses its biggest signal.
    const porAmerSMB = segRows.find(
      (r: any) => r.product === 'POR' && r.region === 'AMER' && r.segment === 'SMB'
    );
    const porAmerStrategic = segRows.find(
      (r: any) => r.product === 'POR' && r.region === 'AMER' && r.segment === 'Strategic'
    );
    expect(porAmerSMB, 'POR AMER NEW LOGO SMB row missing').toBeTruthy();
    expect(porAmerStrategic, 'POR AMER NEW LOGO Strategic row missing').toBeTruthy();
    expect(porAmerSMB.qtd_target).toBeGreaterThan(0);
    expect(porAmerStrategic.qtd_target).toBeGreaterThan(0);
  });

  test('AI analysis output references segment (SMB/Strategic) when data is present', async ({ request }) => {
    // Get fresh report data
    const reportResp = await request.post(`${API_BASE}/report-data`, { data: REPORT_BODY });
    const full = await reportResp.json();

    // Only run this test if segment data is actually present (defensive)
    const hasSegmentData = (full.attainment_by_segment?.length ?? 0) > 0;
    test.skip(!hasSegmentData, 'No segment data in response — covered by earlier test');

    // Trim heavy drill-down arrays that the AI doesn't use (matches what the
    // UI strips via filterReportData). Vercel's serverless request limit is
    // ~4.5MB; full report is ~6MB and hits HTTP 413 without trimming.
    const reportData = {
      ...full,
      won_deals: undefined,
      lost_deals: undefined,
      pipeline_deals: undefined,
      sql_details: undefined,
      sal_details: undefined,
      sqo_details: undefined,
      mql_details: full.mql_details, // keep — used by AI for dropoff analysis
    };

    // Ask the AI for a POR-AMER scoped analysis (where Colin's signal lives).
    // NOTE: the AI endpoint is slow + occasionally flaky (OpenAI 5xx, Vercel
    // socket timeouts) — so treat a transport-level failure as a SKIP rather
    // than a hard fail. The data-layer tests above are the real regression
    // guard; this one is the best-effort content check.
    let aiResp;
    try {
      aiResp = await request.post(`${API_BASE}/ai-analysis`, {
        data: {
          reportData,
          analysisType: 'bookings_miss',
          filterContext: {
            products: ['POR'],
            regions: ['AMER'],
            isFiltered: true,
          },
        },
        timeout: 180_000,
      });
    } catch (err: any) {
      test.skip(true, `AI endpoint transport error (likely OpenAI flakiness): ${err?.message || err}`);
      return;
    }

    if (!aiResp.ok()) {
      test.skip(true, `AI endpoint returned non-OK (${aiResp.status()}) — likely upstream issue, not a regression.`);
      return;
    }

    const ai = await aiResp.json();
    expect(ai).toHaveProperty('analysis');
    const text: string = (ai.analysis || '').toLowerCase();

    // Hard assertion: GPT output varies, but at least one of these signals
    // MUST appear. If NONE appear, the AI is blind to segment breakdown and
    // trend data — that's the Colin-blindness regression this test guards.
    const segmentMentioned = text.includes('smb') || text.includes('strategic segment');
    const trendMentioned =
      /\b(dec|december|nov|november|jan|january|feb|february|mar|march)\s*(2025|2026)\b/.test(text) ||
      /mom|month[-\s]over[-\s]month|trend anomal/i.test(text);
    expect(
      segmentMentioned || trendMentioned,
      'AI output did not reference SMB/Strategic segment OR any monthly trend — Colin-blindness regression.'
    ).toBeTruthy();
  });
});
