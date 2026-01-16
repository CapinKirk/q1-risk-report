import { test, expect } from '@playwright/test';

test.describe('Report Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display all filter sections', async ({ page }) => {
    await expect(page.getByTestId('product-filter')).toBeVisible();
    await expect(page.getByTestId('region-filter')).toBeVisible();
    await expect(page.getByTestId('category-filter')).toBeVisible();
    await expect(page.getByTestId('source-filter')).toBeVisible();
  });

  test('should have "All Products" active by default', async ({ page }) => {
    const allProductsBtn = page.getByTestId('product-all');
    await expect(allProductsBtn).toHaveClass(/active/);
  });

  test('should filter by POR product', async ({ page }) => {
    const porBtn = page.getByTestId('product-por');
    await porBtn.click();

    // URL should update
    await expect(page).toHaveURL(/products=POR/);

    // Button should be active
    await expect(porBtn).toHaveClass(/active/);
  });

  test('should filter by R360 product', async ({ page }) => {
    const r360Btn = page.getByTestId('product-r360');
    await r360Btn.click();

    await expect(page).toHaveURL(/products=R360/);
    await expect(r360Btn).toHaveClass(/active/);
  });

  test('should filter by region', async ({ page }) => {
    const amerBtn = page.getByTestId('region-amer');
    await amerBtn.click();

    await expect(page).toHaveURL(/regions=AMER/);
    await expect(amerBtn).toHaveClass(/active/);
  });

  test('should filter by category', async ({ page }) => {
    const newLogoBtn = page.getByTestId('category-new-logo');
    await newLogoBtn.click();

    await expect(page).toHaveURL(/categories=NEW%20LOGO/);
    await expect(newLogoBtn).toHaveClass(/active/);
  });

  test('should filter by RENEWAL category', async ({ page }) => {
    const renewalBtn = page.getByTestId('category-renewal');
    await renewalBtn.click();

    await expect(page).toHaveURL(/categories=RENEWAL/);
    await expect(renewalBtn).toHaveClass(/active/);
  });

  test('should filter by source', async ({ page }) => {
    const inboundBtn = page.getByTestId('source-inbound');
    await inboundBtn.click();

    await expect(page).toHaveURL(/sources=INBOUND/);
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
    await page.getByTestId('region-emea').click();
    await page.getByTestId('category-expansion').click();

    const url = page.url();
    expect(url).toContain('products=POR');
    expect(url).toContain('regions=EMEA');
    expect(url).toContain('categories=EXPANSION');
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

    const kpiCards = page.locator('.kpi-card');
    await expect(kpiCards).toHaveCount(4); // Assuming 4 main KPI cards
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
