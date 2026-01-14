import { test, expect } from '@playwright/test';

test.describe('Trend Analysis Page - Unauthenticated', () => {
  test('analysis page redirects to sign-in when unauthenticated', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 10000 });
  });
});

test.describe('Trend Analysis Page - Components', () => {
  // Skip these tests unless auth is available
  test.skip(({ browserName }) => !process.env.RUN_AUTH_TESTS, 'Requires manual Google OAuth login');

  test('analysis page loads with header', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('h1')).toHaveText('Trend Analysis', { timeout: 15000 });
  });

  test('date range picker is visible', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="start-date-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="end-date-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="analyze-btn"]')).toBeVisible();
  });

  test('preset buttons are visible and clickable', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Check preset buttons
    await expect(page.locator('[data-testid="preset-last7"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-last14"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-last30"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-mtd"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-qtd"]')).toBeVisible();
    await expect(page.locator('[data-testid="preset-custom"]')).toBeVisible();
  });

  test('clicking preset buttons updates date inputs', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Click Last 30 Days preset
    await page.locator('[data-testid="preset-last30"]').click();

    // Verify preset is active
    await expect(page.locator('[data-testid="preset-last30"]')).toHaveClass(/active/);

    // Verify period preview is shown
    await expect(page.locator('[data-testid="period-preview"]')).toBeVisible();
  });

  test('product and region filters are present', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="product-filter"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="region-filter"]')).toBeVisible();
  });

  test('product filter works on analysis page', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="product-filter"]')).toBeVisible({ timeout: 15000 });

    // Click POR filter
    await page.locator('[data-testid="product-por"]').click();

    // Check URL updated
    await expect(page).toHaveURL(/product=POR/);
    await expect(page.locator('[data-testid="product-por"]')).toHaveClass(/active/);
  });

  test('region filter works on analysis page', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="region-filter"]')).toBeVisible({ timeout: 15000 });

    // Click EMEA filter
    await page.locator('[data-testid="region-emea"]').click();

    // Check URL updated
    await expect(page).toHaveURL(/region=EMEA/);
    await expect(page.locator('[data-testid="region-emea"]')).toHaveClass(/active/);
  });

  test('empty state is shown initially', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Select a Date Range to Analyze')).toBeVisible();
  });

  test('date validation shows error for invalid range', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Set invalid date range (end before start)
    await page.locator('[data-testid="start-date-input"]').fill('2026-01-15');
    await page.locator('[data-testid="end-date-input"]').fill('2026-01-01');

    // Click analyze
    await page.locator('[data-testid="analyze-btn"]').click();

    // Should show error
    await expect(page.locator('[data-testid="date-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="date-error"]')).toContainText('Start date must be before end date');
  });

  test('URL persistence works for filters', async ({ page }) => {
    // Navigate directly with filters
    await page.goto('http://localhost:3000/analysis?product=R360&region=APAC');

    await expect(page.locator('[data-testid="product-filter"]')).toBeVisible({ timeout: 15000 });

    // Check correct filters are active
    await expect(page.locator('[data-testid="product-r360"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="region-apac"]')).toHaveClass(/active/);
  });
});

// Tests for actual analysis functionality (requires API to work)
test.describe('Trend Analysis Page - API Integration', () => {
  test.skip(({ browserName }) => !process.env.RUN_AUTH_TESTS, 'Requires manual Google OAuth login');
  test.skip(({ browserName }) => !process.env.RUN_API_TESTS, 'Requires BigQuery API access');

  test('clicking analyze triggers API call and shows results', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Select Last 7 Days
    await page.locator('[data-testid="preset-last7"]').click();

    // Click analyze
    await page.locator('[data-testid="analyze-btn"]').click();

    // Should show loading state
    await expect(page.locator('text=Analyzing...')).toBeVisible();

    // Wait for results (may take a while for BigQuery)
    await expect(page.locator('[data-testid="period-banner"]')).toBeVisible({ timeout: 120000 });
    await expect(page.locator('[data-testid="trend-kpi-cards"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-nav"]')).toBeVisible();
  });

  test('revenue and funnel tabs work', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Select date range and analyze
    await page.locator('[data-testid="preset-last7"]').click();
    await page.locator('[data-testid="analyze-btn"]').click();

    // Wait for results
    await expect(page.locator('[data-testid="tab-nav"]')).toBeVisible({ timeout: 120000 });

    // Revenue tab should be active by default
    await expect(page.locator('[data-testid="tab-revenue"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="revenue-section"]')).toBeVisible();

    // Click funnel tab
    await page.locator('[data-testid="tab-funnel"]').click();
    await expect(page.locator('[data-testid="tab-funnel"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="funnel-section"]')).toBeVisible();
  });

  test('trend charts are rendered', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Analyze
    await page.locator('[data-testid="preset-last7"]').click();
    await page.locator('[data-testid="analyze-btn"]').click();

    // Wait for chart
    await expect(page.locator('[data-testid="trend-chart"]')).toBeVisible({ timeout: 120000 });

    // Check chart type toggles
    await expect(page.locator('[data-testid="chart-type-line"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-type-area"]')).toBeVisible();
  });

  test('comparison table is rendered', async ({ page }) => {
    await page.goto('http://localhost:3000/analysis');

    await expect(page.locator('[data-testid="date-range-picker"]')).toBeVisible({ timeout: 15000 });

    // Analyze
    await page.locator('[data-testid="preset-last7"]').click();
    await page.locator('[data-testid="analyze-btn"]').click();

    // Wait for table
    await expect(page.locator('[data-testid="trend-comparison-table"]')).toBeVisible({ timeout: 120000 });
  });
});

// Production deployment tests for analysis page
test.describe('Production Analysis Page', () => {
  const PROD_URL = 'https://q1-risk-report.vercel.app';

  test('production analysis page redirects to sign-in', async ({ page }) => {
    await page.goto(`${PROD_URL}/analysis`);

    // Should redirect to sign-in
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 15000 });
  });

  // This test validates the API after deployment - skip if not deployed yet
  test('production trend-analysis API returns endpoint info', async ({ page }) => {
    const response = await page.request.get(`${PROD_URL}/api/trend-analysis`);

    // If 404, it means we haven't deployed yet - skip gracefully
    if (response.status() === 404) {
      test.skip(true, 'API not deployed yet - run after deployment');
      return;
    }

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.endpoint).toBe('/api/trend-analysis');
    expect(data.method).toBe('POST');
  });
});
