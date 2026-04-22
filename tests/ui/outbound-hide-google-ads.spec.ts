import { test, expect } from '@playwright/test';

test.describe('Outbound source filter hides inbound-only UI', () => {
  test('Google Ads Performance section is hidden when source=OUTBOUND', async ({ page }) => {
    await page.goto('/?source=OUTBOUND');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Google Ads Performance/i })).toHaveCount(0);
  });

  test('Google Ads Performance section is visible without source filter', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /Google Ads Performance/i })).toBeVisible();
  });
});
