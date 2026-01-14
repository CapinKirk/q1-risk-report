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
