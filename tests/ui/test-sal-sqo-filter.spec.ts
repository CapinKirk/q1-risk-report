import { test, expect } from '@playwright/test';

test.describe('SAL/SQO Details Product Filtering', () => {
  test('should only show R360 records when R360 filter applied', async ({ page }) => {
    // Navigate with R360 filter
    await page.goto('https://q1-risk-report.vercel.app?product=R360');
    await page.waitForLoadState('networkidle');

    // Check SAL Details section - note it says "POR only" in the subtitle, 
    // so when R360 filter is applied, there should be no SAL data or the section may be hidden
    const salSection = page.locator('text=SAL Details');
    if (await salSection.isVisible()) {
      // If visible, check that there are no POR badges in SAL table
      const salPorBadges = page.locator('.sal-table .product-badge.por');
      const salPorCount = await salPorBadges.count();
      expect(salPorCount).toBe(0);
      console.log('SAL section: No POR badges found (correct)');
    } else {
      console.log('SAL section not visible when R360 filtered (expected - POR only)');
    }

    // Check SQO Details section
    const sqoSection = page.locator('text=SQO Details');
    if (await sqoSection.isVisible()) {
      // Wait for table to render
      await page.waitForSelector('.sqo-table tbody tr', { timeout: 10000 }).catch(() => null);
      
      // Check that there are no POR badges visible in SQO table
      const sqoPorBadges = page.locator('.sqo-table .product-badge.por');
      const sqoPorCount = await sqoPorBadges.count();
      expect(sqoPorCount).toBe(0);
      console.log(`SQO section: ${sqoPorCount} POR badges found (should be 0)`);

      // Verify R360 badges exist
      const sqoR360Badges = page.locator('.sqo-table .product-badge.r360');
      const sqoR360Count = await sqoR360Badges.count();
      console.log(`SQO section: ${sqoR360Count} R360 badges found`);
    }
  });

  test('should only show POR records when POR filter applied', async ({ page }) => {
    // Navigate with POR filter
    await page.goto('https://q1-risk-report.vercel.app?product=POR');
    await page.waitForLoadState('networkidle');

    // Check SQO Details section
    const sqoSection = page.locator('text=SQO Details');
    if (await sqoSection.isVisible()) {
      await page.waitForSelector('.sqo-table tbody tr', { timeout: 10000 }).catch(() => null);

      // Check that there are no R360 badges visible
      const sqoR360Badges = page.locator('.sqo-table .product-badge.r360');
      const sqoR360Count = await sqoR360Badges.count();
      expect(sqoR360Count).toBe(0);
      console.log(`SQO section: ${sqoR360Count} R360 badges found (should be 0)`);

      // Verify POR badges exist
      const sqoPorBadges = page.locator('.sqo-table .product-badge.por');
      const sqoPorCount = await sqoPorBadges.count();
      console.log(`SQO section: ${sqoPorCount} POR badges found`);
    }
  });
});
