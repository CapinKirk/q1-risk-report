import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('unauthenticated users are redirected to sign-in', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Should redirect to sign-in page
    await expect(page).toHaveURL(/\/auth\/signin/);
    // Sign-in page shows app title
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 10000 });
  });

  test('sign-in page shows Google OAuth button', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signin');

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 10000 });
    await expect(page.locator('button:has-text("Sign in with Google")')).toBeVisible();
  });

  test('sign-in page shows allowed domain info', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/signin');

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Report', { timeout: 10000 });
    // Check that domain restriction info is displayed
    await expect(page.locator('text=pointofrental.com')).toBeVisible();
    await expect(page.locator('text=record360.com')).toBeVisible();
  });

  test('error page renders for access denied', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/error?error=AccessDenied');

    await expect(page.locator('h1')).toHaveText('Access Denied', { timeout: 10000 });
    await expect(page.locator('text=pointofrental.com')).toBeVisible();
    await expect(page.locator('text=record360.com')).toBeVisible();
  });

  test('error page has try again link', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/error?error=AccessDenied');

    // Link styled as button (using Link component)
    await expect(page.locator('a:has-text("Try Again")')).toBeVisible();

    // Clicking should go to sign-in
    await page.locator('a:has-text("Try Again")').click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('API refresh GET endpoint returns info', async ({ page }) => {
    // Test the GET endpoint which returns API info
    const response = await page.request.get('http://localhost:3000/api/refresh');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.endpoint).toBe('/api/refresh');
    expect(data.method).toBe('POST');
  });
});

// Tests that require authentication - use with stored auth state
test.describe('Authenticated Report Tests', () => {
  // Skip these in CI or when no auth state is available
  test.skip(({ browserName }) => !process.env.RUN_AUTH_TESTS, 'Requires manual Google OAuth login');

  test('homepage loads with report data', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for loading to finish and content to appear
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 10000 });

    // Check meta info is present
    await expect(page.locator('.meta')).toContainText('Report Date:');
    await expect(page.locator('.meta')).toContainText('Q1 Progress:');

    // Check filter bar is present
    await expect(page.locator('.filter-bar')).toBeVisible();
    await expect(page.locator('.filter-btn').first()).toBeVisible();
  });

  test('region filter works', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for page load
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 10000 });

    // Click AMER filter
    await page.locator('.filter-btn:has-text("AMER")').click();

    // Check URL updated
    await expect(page).toHaveURL(/region=AMER/);

    // Click All Regions
    await page.locator('.filter-btn:has-text("All Regions")').click();

    // Check URL updated
    await expect(page).toHaveURL(/region=ALL/);
  });

  test('all report sections are present', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for page load
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 10000 });

    // Check all 7 sections
    await expect(page.locator('h2:has-text("1. Executive Summary")')).toBeVisible();
    await expect(page.locator('h2:has-text("2. Attainment by Region")')).toBeVisible();
    await expect(page.locator('h2:has-text("3. Source Attainment")')).toBeVisible();
    await expect(page.locator('h2:has-text("4. Hits & Misses")')).toBeVisible();
    await expect(page.locator('h2:has-text("5. Pipeline Coverage")')).toBeVisible();
    await expect(page.locator('h2:has-text("6. Lost Opportunities")')).toBeVisible();
    await expect(page.locator('h2:has-text("7. Google Ads Performance")')).toBeVisible();
  });

  test('user menu shows sign out', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 10000 });

    // User menu should be visible when authenticated
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });
});
