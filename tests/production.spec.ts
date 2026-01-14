import { test, expect } from '@playwright/test';

const PROD_URL = 'https://q1-risk-report.vercel.app';

test.describe('Production Deployment Verification', () => {
  test('production redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto(PROD_URL);

    // Should redirect to sign-in page
    await expect(page).toHaveURL(/\/auth\/signin/);
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 15000 });
  });

  test('production sign-in page shows Google OAuth button', async ({ page }) => {
    await page.goto(`${PROD_URL}/auth/signin`);

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 15000 });
    await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible();
  });

  test('production sign-in page shows allowed domains', async ({ page }) => {
    await page.goto(`${PROD_URL}/auth/signin`);

    await expect(page.locator('text=pointofrental.com')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=record360.com')).toBeVisible();
  });

  test('production error page renders correctly', async ({ page }) => {
    await page.goto(`${PROD_URL}/auth/error?error=AccessDenied`);

    await expect(page.locator('h1')).toHaveText('Access Denied', { timeout: 15000 });
    await expect(page.locator('a:has-text("Try Again")')).toBeVisible();
  });

  test('production API refresh endpoint accessible', async ({ page }) => {
    const response = await page.request.get(`${PROD_URL}/api/refresh`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.endpoint).toBe('/api/refresh');
  });

  test('take screenshot of production sign-in page', async ({ page }) => {
    await page.goto(`${PROD_URL}/auth/signin`);

    await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'tests/screenshots/production-signin.png', fullPage: true });
  });
});

// Tests requiring authentication on production
test.describe('Production Authenticated Tests', () => {
  test.skip(({ browserName }) => !process.env.RUN_AUTH_TESTS, 'Requires manual Google OAuth login');

  test('production product filter is visible', async ({ page }) => {
    await page.goto(PROD_URL);

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 15000 });

    // Check both filter bars are present
    await expect(page.locator('[data-testid="product-filter"]')).toBeVisible();
    await expect(page.locator('[data-testid="region-filter"]')).toBeVisible();
  });

  test('production product filter POR works', async ({ page }) => {
    await page.goto(PROD_URL);

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 15000 });

    // Click POR filter
    await page.locator('[data-testid="product-por"]').click();

    // Check URL updated
    await expect(page).toHaveURL(/product=POR/);
    await expect(page.locator('[data-testid="product-por"]')).toHaveClass(/active/);
  });

  test('production product filter R360 works', async ({ page }) => {
    await page.goto(PROD_URL);

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 15000 });

    // Click R360 filter
    await page.locator('[data-testid="product-r360"]').click();

    // Check URL updated
    await expect(page).toHaveURL(/product=R360/);
    await expect(page.locator('[data-testid="product-r360"]')).toHaveClass(/active/);
  });

  test('production combined filters work', async ({ page }) => {
    await page.goto(`${PROD_URL}?product=POR&region=AMER`);

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 15000 });

    // Check correct filters are active
    await expect(page.locator('[data-testid="product-por"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="region-amer"]')).toHaveClass(/active/);
  });
});
