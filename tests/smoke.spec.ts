import { test, expect } from '@playwright/test';

test.describe('Q1 2026 Risk Report', () => {
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

  test('executive summary shows data', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for page load
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 10000 });

    // Check table has Q1 Target row with currency
    await expect(page.locator('td:has-text("Q1 Target")')).toBeVisible();
    await expect(page.locator('td:has-text("QTD Actual")')).toBeVisible();
    await expect(page.locator('td:has-text("QTD Attainment")')).toBeVisible();
  });

  test('takes screenshot of full report', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Wait for full load
    await expect(page.locator('h1')).toHaveText('Q1 2026 Risk Analysis Report', { timeout: 10000 });
    await page.waitForTimeout(1000); // Extra wait for all data

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/full-report.png', fullPage: true });
  });
});
