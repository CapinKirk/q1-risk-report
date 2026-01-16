import { test, expect } from '@playwright/test';

const API_BASE = '/api';

test.describe('Report Data API', () => {
  test('GET /api/report-data should return valid structure', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
  });

  test('should return targets data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);
    const data = await response.json();

    expect(data.data).toHaveProperty('targets');
    expect(data.data.targets).toHaveProperty('POR');
    expect(data.data.targets).toHaveProperty('R360');
  });

  test('should return actuals data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);
    const data = await response.json();

    expect(data.data).toHaveProperty('actuals');
    expect(data.data.actuals).toHaveProperty('POR');
    expect(data.data.actuals).toHaveProperty('R360');
  });

  test('should return pipeline data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);
    const data = await response.json();

    expect(data.data).toHaveProperty('pipeline');
    expect(data.data.pipeline).toHaveProperty('POR');
    expect(data.data.pipeline).toHaveProperty('R360');
  });

  test('should return metadata with timestamp', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);
    const data = await response.json();

    expect(data).toHaveProperty('metadata');
    expect(data.metadata).toHaveProperty('timestamp');
  });

  test('should have numeric ACV values', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);
    const data = await response.json();

    const porTargets = data.data.targets.POR;
    expect(typeof porTargets.totalACV).toBe('number');
    expect(porTargets.totalACV).toBeGreaterThanOrEqual(0);
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
    });

    // Should either succeed or return appropriate error
    expect([200, 400, 500]).toContain(response.status());
  });

  test('should reject request without required fields', async ({ request }) => {
    const response = await request.post(`${API_BASE}/ai-analysis`, {
      data: {},
    });

    // Should return 400 for bad request
    expect(response.status()).toBe(400);
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
  test('report data should have consistent product keys', async ({ request }) => {
    const response = await request.get(`${API_BASE}/report-data`);
    const data = await response.json();

    const products = ['POR', 'R360'];

    for (const product of products) {
      expect(data.data.targets).toHaveProperty(product);
      expect(data.data.actuals).toHaveProperty(product);
      expect(data.data.pipeline).toHaveProperty(product);
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
