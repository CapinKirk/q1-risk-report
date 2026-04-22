import { test, expect } from '@playwright/test';

test.describe('Report Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display all filter sections', async ({ page }) => {
    // The filter bar currently exposes Product / Region / Category as primary
    // controls. Source is still a dimension in the data (see Source Attainment
    // section below) but the filter-bar pill was removed — so we no longer
    // assert a source-filter testid here.
    await expect(page.getByTestId('product-filter')).toBeVisible();
    await expect(page.getByTestId('region-filter')).toBeVisible();
    await expect(page.getByTestId('category-filter')).toBeVisible();
  });

  test('should have "All Products" active by default', async ({ page }) => {
    const allProductsBtn = page.getByTestId('product-all');
    await expect(allProductsBtn).toHaveClass(/active/);
  });

  test('should filter by POR product', async ({ page }) => {
    const porBtn = page.getByTestId('product-por');
    await porBtn.click();

    // URL should update (uses singular 'product' param)
    await expect(page).toHaveURL(/product=POR/);

    // Button should be active
    await expect(porBtn).toHaveClass(/active/);
  });

  test('should filter by R360 product', async ({ page }) => {
    const r360Btn = page.getByTestId('product-r360');
    await r360Btn.click();

    await expect(page).toHaveURL(/product=R360/);
    await expect(r360Btn).toHaveClass(/active/);
  });

  test('should filter by region', async ({ page }) => {
    const amerBtn = page.getByTestId('region-amer');
    await amerBtn.click();

    await expect(page).toHaveURL(/region=AMER/);
    await expect(amerBtn).toHaveClass(/active/);
  });

  test('should filter by category', async ({ page }) => {
    const newLogoBtn = page.getByTestId('category-new-logo');
    await newLogoBtn.click();

    await expect(page).toHaveURL(/category=NEW/);
    await expect(newLogoBtn).toHaveClass(/active/);
  });

  test('should filter by RENEWAL category', async ({ page }) => {
    const renewalBtn = page.getByTestId('category-renewal');
    await renewalBtn.click();

    await expect(page).toHaveURL(/category=RENEWAL/);
    await expect(renewalBtn).toHaveClass(/active/);
  });

  test.fixme('should filter by source', async ({ page }) => {
    // DISABLED 2026-04-22: the Source filter pill (data-testid="source-inbound")
    // was removed from the top filter bar. Source remains a valid URL param
    // (?source=INBOUND) and is still referenced in the Source Attainment by
    // Channel table, but there's no button to click to set it anymore.
    // Re-enable this test only after the filter UI is restored or replaced.
    const inboundBtn = page.getByTestId('source-inbound');
    await inboundBtn.click();

    await expect(page).toHaveURL(/source=INBOUND/);
    await expect(inboundBtn).toHaveClass(/active/);
  });

  test('should reset to all when clicking active filter again', async ({ page }) => {
    const porBtn = page.getByTestId('product-por');
    const allBtn = page.getByTestId('product-all');

    // First click - select POR
    await porBtn.click();
    await expect(porBtn).toHaveClass(/active/);

    // Second click - should reset to all
    await porBtn.click();
    await expect(allBtn).toHaveClass(/active/);
  });

  test('should handle multiple filter combinations', async ({ page }) => {
    await page.getByTestId('product-por').click();
    await page.waitForURL(/product=POR/);

    await page.getByTestId('region-emea').click();
    await page.waitForURL(/region=EMEA/);

    await page.getByTestId('category-expansion').click();
    await page.waitForURL(/category=EXPANSION/);

    const url = page.url();
    expect(url).toContain('product=POR');
    expect(url).toContain('region=EMEA');
    expect(url).toContain('category=EXPANSION');
  });
});

test.describe('Dashboard Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display header section', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Q1 2026');
  });

  test('should display KPI cards', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('.kpi-card', { timeout: 10000 });

    // Check that KPI cards exist (both executive cards and renewals cards)
    const kpiCards = page.locator('.kpi-card');
    const count = await kpiCards.count();
    expect(count).toBeGreaterThanOrEqual(4); // At least 4 executive KPI cards
  });

  test('should display renewals section', async ({ page }) => {
    const renewalsSection = page.locator('[data-testid="renewals-section"]');
    await expect(renewalsSection).toBeVisible();
  });

  test('should display AI analysis section', async ({ page }) => {
    const aiSection = page.locator('[data-testid="ai-analysis"]');
    await expect(aiSection).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('should have accessible filter buttons', async ({ page }) => {
    await page.goto('/');

    const buttons = page.locator('.filter-btn');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      // Each button should have text content
      await expect(button).not.toBeEmpty();
    }
  });
});
