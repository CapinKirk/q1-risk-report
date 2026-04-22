import { test, expect } from '@playwright/test';

test.describe('Filter-aware UI gating', () => {
  test('category=RENEWAL hides MQL, Google Ads, and Inbound AI analysis', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/?category=RENEWAL', { waitUntil: 'domcontentloaded' });

    // Wait for page scaffolding so we know the gated sections were skipped, not just un-rendered yet.
    await expect(page.getByRole('heading', { name: /Q1 2026 Risk Analysis Report/i })).toBeVisible({ timeout: 30000 });

    await expect(page.getByRole('heading', { name: /Lead Details \(MQL \+ EQL\)/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Google Ads Performance/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Inbound Marketing Deep Dive/i })).toHaveCount(0);
  });

  test('source=OUTBOUND hides Renewals and MQL sections (cross-rule)', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/?source=OUTBOUND', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Q1 2026 Risk Analysis Report/i })).toBeVisible({ timeout: 30000 });

    await expect(page.locator('[data-testid="renewals-section"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Lead Details \(MQL \+ EQL\)/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Google Ads Performance/i })).toHaveCount(0);
  });

  test('default view (no filters) shows all sections', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Renewals card renders from an async /api/renewals call — locate by testid
    // so we match the container whether it's in loading, error, or data state.
    await expect(page.locator('[data-testid="renewals-section"]')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Lead Details \(MQL \+ EQL\)/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: /Google Ads Performance/i })).toBeVisible({ timeout: 30000 });
  });
});
