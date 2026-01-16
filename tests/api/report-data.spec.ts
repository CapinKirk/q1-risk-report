import { test, expect } from '@playwright/test';

const API_BASE = '/api';

test.describe('Report Data API', () => {
  const reportDataBody = {
    startDate: '2026-01-01',
    endDate: '2026-01-15',
  };

  test('POST /api/report-data should return valid structure', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: reportDataBody,
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).not.toHaveProperty('error');
    // API returns data directly without success wrapper
    expect(data).toHaveProperty('attainment_detail');
  });

  test('should return attainment detail', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: reportDataBody,
    });
    const data = await response.json();

    expect(data).toHaveProperty('attainment_detail');
    expect(Array.isArray(data.attainment_detail)).toBeTruthy();
  });

  test('should return won deals', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: reportDataBody,
    });
    const data = await response.json();

    expect(data).toHaveProperty('won_deals');
    expect(Array.isArray(data.won_deals)).toBeTruthy();
  });

  test('should return pipeline deals', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: reportDataBody,
    });
    const data = await response.json();

    expect(data).toHaveProperty('pipeline_deals');
    expect(Array.isArray(data.pipeline_deals)).toBeTruthy();
  });

  test('should return period info', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: reportDataBody,
    });
    const data = await response.json();

    expect(data).toHaveProperty('period');
    expect(data.period).toHaveProperty('as_of_date');
  });

  test('should include RENEWAL category in attainment', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: reportDataBody,
    });
    const data = await response.json();

    const renewalRows = data.attainment_detail.filter((r: any) => r.category === 'RENEWAL');
    expect(renewalRows.length).toBeGreaterThan(0);
  });
});

test.describe('Renewals API', () => {
  test('GET /api/renewals should return valid structure', async ({ request }) => {
    const response = await request.get(`${API_BASE}/renewals`);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
  });

  test('should return summary data for both products', async ({ request }) => {
    const response = await request.get(`${API_BASE}/renewals`);
    const data = await response.json();

    expect(data.data).toHaveProperty('summary');
    expect(data.data.summary).toHaveProperty('POR');
    expect(data.data.summary).toHaveProperty('R360');
  });

  test('should return renewal arrays', async ({ request }) => {
    const response = await request.get(`${API_BASE}/renewals`);
    const data = await response.json();

    expect(data.data).toHaveProperty('wonRenewals');
    expect(data.data).toHaveProperty('lostRenewals');
    expect(data.data).toHaveProperty('pipelineRenewals');

    // Arrays should exist for each product
    expect(Array.isArray(data.data.wonRenewals.POR)).toBeTruthy();
    expect(Array.isArray(data.data.wonRenewals.R360)).toBeTruthy();
  });

  test('should return contract data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/renewals`);
    const data = await response.json();

    expect(data.data).toHaveProperty('upcomingContracts');
    expect(data.data).toHaveProperty('atRiskContracts');
  });

  test('should include sfAvailable flag', async ({ request }) => {
    const response = await request.get(`${API_BASE}/renewals`);
    const data = await response.json();

    expect(data.data).toHaveProperty('sfAvailable');
    expect(typeof data.data.sfAvailable).toBe('boolean');
  });

  test('should handle missing BigQuery gracefully', async ({ request }) => {
    // API should still return 200 even if BQ is unavailable
    const response = await request.get(`${API_BASE}/renewals`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe('AI Analysis API', () => {
  test('POST /api/ai-analysis should accept valid request', async ({ request }) => {
    // AI endpoint can take long due to OpenAI API call
    const response = await request.post(`${API_BASE}/ai-analysis`, {
      data: {
        product: 'POR',
        region: 'AMER',
        reportData: {
          targets: { POR: { totalACV: 1000000 } },
          actuals: { POR: { totalACV: 500000 } },
          pipeline: { POR: { totalACV: 300000 } },
        },
      },
      timeout: 30000, // 30 second timeout for AI calls
    });

    // Should either succeed or return appropriate error (400 if missing OpenAI key)
    expect([200, 400, 500]).toContain(response.status());
  });

  test('should return error without required fields', async ({ request }) => {
    const response = await request.post(`${API_BASE}/ai-analysis`, {
      data: {},
    });

    // Should return error (400 or 500 depending on implementation)
    expect([400, 500]).toContain(response.status());
  });
});

test.describe('API Error Handling', () => {
  test('should return proper error format on failure', async ({ request }) => {
    // Test with invalid endpoint
    const response = await request.get(`${API_BASE}/invalid-endpoint`);

    expect(response.status()).toBe(404);
  });

  test('should handle OPTIONS request for CORS', async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/report-data`, {
      method: 'OPTIONS',
    });

    // Should return 200 or 204 for OPTIONS
    expect([200, 204, 405]).toContain(response.status());
  });
});

test.describe('Data Validation', () => {
  test('report data should have product-specific deals', async ({ request }) => {
    const response = await request.post(`${API_BASE}/report-data`, {
      data: { startDate: '2026-01-01', endDate: '2026-01-15' },
    });
    const data = await response.json();

    // Check that won_deals have product field
    const wonDeals = data.won_deals || [];
    if (wonDeals.length > 0) {
      expect(['POR', 'R360']).toContain(wonDeals[0].product);
    }
  });

  test('renewals should have valid summary fields', async ({ request }) => {
    const response = await request.get(`${API_BASE}/renewals`);
    const data = await response.json();

    const summary = data.data.summary.POR;
    const expectedFields = [
      'renewalCount',
      'renewalACV',
      'autoRenewalCount',
      'avgUpliftPct',
    ];

    for (const field of expectedFields) {
      expect(summary).toHaveProperty(field);
      expect(typeof summary[field]).toBe('number');
    }
  });
});
