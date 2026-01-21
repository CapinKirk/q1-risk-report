import { test, expect } from '@playwright/test';

test.describe('SAL/SQO Details Product Filtering via Data', () => {
  test('R360 filter should exclude POR from sal_details', async ({ page }) => {
    let apiResponse: any = null;

    // Intercept the report-data API response
    await page.route('**/api/report-data', async route => {
      const response = await route.fetch();
      apiResponse = await response.json();
      await route.fulfill({ response });
    });

    // Navigate with R360 filter
    await page.goto('https://q1-risk-report.vercel.app?product=R360');
    await page.waitForLoadState('networkidle');
    
    // Wait for API response to be captured
    await page.waitForTimeout(2000);

    // Check the data that was returned
    if (apiResponse) {
      // After filtering is applied client-side, we need to check what the UI receives
      // Log what the API returned
      console.log('API sal_details.POR length:', apiResponse.sal_details?.POR?.length || 0);
      console.log('API sal_details.R360 length:', apiResponse.sal_details?.R360?.length || 0);
      console.log('API sqo_details.POR length:', apiResponse.sqo_details?.POR?.length || 0);
      console.log('API sqo_details.R360 length:', apiResponse.sqo_details?.R360?.length || 0);
    }

    // Now check DOM - wait for SAL section to be visible or not
    const salSection = page.locator('h2:has-text("SAL Details")');
    const salVisible = await salSection.isVisible();
    console.log('SAL section visible:', salVisible);

    if (salVisible) {
      // Wait a bit for data to load
      await page.waitForTimeout(1000);
      
      // Count all product badges in SAL table
      const salTable = page.locator('.sal-table');
      if (await salTable.isVisible()) {
        const porBadges = await page.locator('.sal-table .product-badge.por').count();
        const r360Badges = await page.locator('.sal-table .product-badge.r360').count();
        console.log('SAL table POR badges:', porBadges);
        console.log('SAL table R360 badges:', r360Badges);
        
        // When R360 filter is applied, should see 0 POR badges
        expect(porBadges).toBe(0);
      }
    }
  });
});
