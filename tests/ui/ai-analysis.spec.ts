import { test, expect } from '@playwright/test';

test.describe('AI Analysis Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AI Risk Analysis section should be visible', async ({ page }) => {
    const aiSection = page.locator('[data-testid="ai-analysis"]');
    await expect(aiSection).toBeVisible();
  });

  test('AI Risk Analysis should have correct header', async ({ page }) => {
    const header = page.locator('[data-testid="ai-analysis"] h2');
    await expect(header).toContainText('Analysis');
  });

  test('AI Risk Analysis should show Generate button', async ({ page }) => {
    const generateBtn = page.locator('[data-testid="ai-analysis"] button').filter({ hasText: /Generate/ });
    await expect(generateBtn).toBeVisible();
  });

  test('AI Risk Analysis should show scope indicator', async ({ page }) => {
    const filterContext = page.locator('[data-testid="ai-analysis"] .filter-context');
    await expect(filterContext).toBeVisible();
    await expect(filterContext).toContainText('All Products');
  });

  test('AI Risk Analysis should show placeholder when no analysis', async ({ page }) => {
    const placeholder = page.locator('[data-testid="ai-analysis"] .placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('Generate Analysis');
  });

  test('Inbound AI Analysis section should be visible', async ({ page }) => {
    const inboundSection = page.locator('[data-testid="inbound-ai-analysis"]');
    await expect(inboundSection).toBeVisible();
  });

  test('Inbound AI Analysis should have correct header', async ({ page }) => {
    const header = page.locator('[data-testid="inbound-ai-analysis"] h2');
    await expect(header).toContainText('Inbound Marketing');
  });

  test('Inbound AI Analysis should show Generate button', async ({ page }) => {
    const generateBtn = page.locator('[data-testid="inbound-ai-analysis"] button').filter({ hasText: /Generate/ });
    await expect(generateBtn).toBeVisible();
  });

  test('Inbound AI Analysis should show placeholder', async ({ page }) => {
    const placeholder = page.locator('[data-testid="inbound-ai-analysis"] .placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('Generate Analysis');
  });
});

test.describe('AI Analysis Button States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Generate buttons should be enabled when data is loaded', async ({ page }) => {
    // Wait for data to load
    await page.waitForSelector('.kpi-card', { timeout: 10000 });

    const aiGenerateBtn = page.locator('[data-testid="ai-analysis"] button').filter({ hasText: /Generate/ });
    const inboundGenerateBtn = page.locator('[data-testid="inbound-ai-analysis"] button').filter({ hasText: /Generate/ });

    await expect(aiGenerateBtn).toBeEnabled();
    await expect(inboundGenerateBtn).toBeEnabled();
  });
});

test.describe('AI Analysis Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AI Risk Analysis should have proper structure', async ({ page }) => {
    const section = page.locator('[data-testid="ai-analysis"]');

    // Header with icon and title
    const header = section.locator('.ai-header');
    await expect(header).toBeVisible();

    // Title
    await expect(section.locator('.ai-title')).toBeVisible();
    await expect(section.locator('.ai-icon')).toBeVisible();

    // Content area
    await expect(section.locator('.panel-content')).toBeVisible();
  });

  test('Inbound Analysis should have proper structure', async ({ page }) => {
    const section = page.locator('[data-testid="inbound-ai-analysis"]');

    // Header
    await expect(section.locator('.ai-header')).toBeVisible();

    // Title
    await expect(section.locator('.ai-title')).toBeVisible();

    // Content area
    await expect(section.locator('.panel-content')).toBeVisible();
  });
});

test.describe('AI Analysis Responsive Design', () => {
  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const aiSection = page.locator('[data-testid="ai-analysis"]');
    await expect(aiSection).toBeVisible();

    const inboundSection = page.locator('[data-testid="inbound-ai-analysis"]');
    await expect(inboundSection).toBeVisible();

    // Check buttons are visible
    const generateBtn = page.locator('[data-testid="ai-analysis"] button').filter({ hasText: /Generate/ });
    await expect(generateBtn).toBeVisible();
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const aiSection = page.locator('[data-testid="ai-analysis"]');
    await expect(aiSection).toBeVisible();

    const inboundSection = page.locator('[data-testid="inbound-ai-analysis"]');
    await expect(inboundSection).toBeVisible();
  });
});
