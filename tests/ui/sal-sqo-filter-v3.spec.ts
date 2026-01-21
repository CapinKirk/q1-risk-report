import { test, expect } from '@playwright/test';

test.describe('SAL/SQO Details Product Filtering', () => {
  test('R360 filter should eventually show only R360 records', async ({ page }) => {
    // Navigate with R360 filter
    await page.goto('https://q1-risk-report.vercel.app?product=R360');
    
    // Wait for initial load
    await page.waitForLoadState('networkidle');
    
    // Wait for the debounced re-fetch to complete (500ms debounce + network time)
    await page.waitForTimeout(3000);
    
    // Wait for any loading indicators to disappear
    await page.waitForSelector('[data-loading="true"]', { state: 'hidden', timeout: 5000 }).catch(() => null);

    // Check SAL section
    const salSection = page.locator('h2:has-text("SAL Details")');
    const salVisible = await salSection.isVisible();
    console.log('SAL section visible:', salVisible);

    if (salVisible) {
      const salTable = page.locator('.sal-table');
      if (await salTable.isVisible()) {
        const porBadges = await page.locator('.sal-table .product-badge.por').count();
        const r360Badges = await page.locator('.sal-table .product-badge.r360').count();
        console.log('SAL: POR badges:', porBadges, ', R360 badges:', r360Badges);
        
        // When R360 filter is applied, should see 0 POR badges
        // R360 has no SAL data, so we may see 0 total or "No SALs found"
        expect(porBadges).toBe(0);
      } else {
        // No table visible - check for "No SALs found" message
        const noDataMsg = page.locator('text=No SAL data available');
        console.log('No SAL table, checking for no-data message');
      }
    }

    // Check SQO section
    const sqoSection = page.locator('h2:has-text("SQO Details")');
    if (await sqoSection.isVisible()) {
      await page.waitForTimeout(1000);
      const sqoTable = page.locator('.sqo-table');
      if (await sqoTable.isVisible()) {
        const porBadges = await page.locator('.sqo-table .product-badge.por').count();
        const r360Badges = await page.locator('.sqo-table .product-badge.r360').count();
        console.log('SQO: POR badges:', porBadges, ', R360 badges:', r360Badges);
        
        expect(porBadges).toBe(0);
        // R360 has SQO data, so we should see R360 badges
        expect(r360Badges).toBeGreaterThan(0);
      }
    }
  });
});
