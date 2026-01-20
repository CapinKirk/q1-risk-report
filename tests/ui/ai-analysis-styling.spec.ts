import { test, expect } from '@playwright/test';

/**
 * AI Analysis Section Styling Tests
 *
 * These tests verify that both AI Analysis sections (Analysis & Recommendations and
 * Inbound Marketing Deep Dive) have consistent styling per the design requirements.
 *
 * Key elements to verify:
 * - AI icon with gradient background
 * - Blue primary buttons
 * - Content panel with 2px border and 12px border-radius
 * - Consistent placeholder, loading, and error states
 */

test.describe('AI Analysis Section Styling', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page which has AI Analysis section
    await page.goto('/');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('Analysis & Recommendations section exists with correct structure', async ({ page }) => {
    const aiSection = page.locator('[data-testid="ai-analysis"]');
    await expect(aiSection).toBeVisible({ timeout: 30000 });

    // Verify header structure
    const header = aiSection.locator('.ai-header');
    await expect(header).toBeVisible();

    // Verify AI icon
    const aiIcon = aiSection.locator('.ai-icon');
    await expect(aiIcon).toBeVisible();
    await expect(aiIcon).toHaveText('AI');

    // Verify title
    const title = aiSection.locator('h2');
    await expect(title).toContainText('Analysis & Recommendations');

    // Verify Generate Analysis button exists
    const generateBtn = aiSection.locator('.btn-primary');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toContainText('Generate Analysis');
  });

  test('Inbound Marketing Deep Dive section exists with correct structure', async ({ page }) => {
    const inboundSection = page.locator('[data-testid="inbound-ai-analysis"]');
    await expect(inboundSection).toBeVisible({ timeout: 30000 });

    // Verify header structure
    const header = inboundSection.locator('.ai-header');
    await expect(header).toBeVisible();

    // Verify AI icon
    const aiIcon = inboundSection.locator('.ai-icon');
    await expect(aiIcon).toBeVisible();
    await expect(aiIcon).toHaveText('AI');

    // Verify title
    const title = inboundSection.locator('h2');
    await expect(title).toContainText('Inbound Marketing Deep Dive');

    // Verify Generate Analysis button exists
    const generateBtn = inboundSection.locator('.btn-primary');
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toContainText('Generate Analysis');
  });

  test('AI icons have matching gradient styling', async ({ page }) => {
    // Get both AI icons
    const aiAnalysisIcon = page.locator('[data-testid="ai-analysis"] .ai-icon');
    const inboundIcon = page.locator('[data-testid="inbound-ai-analysis"] .ai-icon');

    await expect(aiAnalysisIcon).toBeVisible({ timeout: 30000 });
    await expect(inboundIcon).toBeVisible();

    // Verify both icons have the gradient background
    // The gradient is: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)
    const aiAnalysisStyle = await aiAnalysisIcon.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.backgroundImage,
        width: computed.width,
        height: computed.height,
        borderRadius: computed.borderRadius,
        color: computed.color,
      };
    });

    const inboundStyle = await inboundIcon.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        background: computed.backgroundImage,
        width: computed.width,
        height: computed.height,
        borderRadius: computed.borderRadius,
        color: computed.color,
      };
    });

    // Both should have gradient background
    expect(aiAnalysisStyle.background).toContain('linear-gradient');
    expect(inboundStyle.background).toContain('linear-gradient');

    // Both should be 36px x 36px with 8px border-radius
    expect(aiAnalysisStyle.width).toBe('36px');
    expect(inboundStyle.width).toBe('36px');
    expect(aiAnalysisStyle.height).toBe('36px');
    expect(inboundStyle.height).toBe('36px');
    expect(aiAnalysisStyle.borderRadius).toBe('8px');
    expect(inboundStyle.borderRadius).toBe('8px');

    // Both should have white text
    expect(aiAnalysisStyle.color).toContain('rgb(255, 255, 255)');
    expect(inboundStyle.color).toContain('rgb(255, 255, 255)');
  });

  test('Primary buttons have matching blue color (#2563eb)', async ({ page }) => {
    const aiAnalysisBtn = page.locator('[data-testid="ai-analysis"] .btn-primary');
    const inboundBtn = page.locator('[data-testid="inbound-ai-analysis"] .btn-primary');

    await expect(aiAnalysisBtn).toBeVisible({ timeout: 30000 });
    await expect(inboundBtn).toBeVisible();

    const aiAnalysisBtnStyle = await aiAnalysisBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
      };
    });

    const inboundBtnStyle = await inboundBtn.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
      };
    });

    // Both should have blue background (#2563eb = rgb(37, 99, 235))
    expect(aiAnalysisBtnStyle.backgroundColor).toBe('rgb(37, 99, 235)');
    expect(inboundBtnStyle.backgroundColor).toBe('rgb(37, 99, 235)');

    // Both should have 8px border-radius
    expect(aiAnalysisBtnStyle.borderRadius).toBe('8px');
    expect(inboundBtnStyle.borderRadius).toBe('8px');
  });

  test('Content panels have matching styling', async ({ page }) => {
    const aiAnalysisPanel = page.locator('[data-testid="ai-analysis"] .content-panel');
    const inboundPanel = page.locator('[data-testid="inbound-ai-analysis"] .content-panel');

    await expect(aiAnalysisPanel).toBeVisible({ timeout: 30000 });
    await expect(inboundPanel).toBeVisible();

    const aiAnalysisPanelStyle = await aiAnalysisPanel.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderWidth: computed.borderWidth,
        borderRadius: computed.borderRadius,
        borderStyle: computed.borderStyle,
      };
    });

    const inboundPanelStyle = await inboundPanel.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderWidth: computed.borderWidth,
        borderRadius: computed.borderRadius,
        borderStyle: computed.borderStyle,
      };
    });

    // Both should have 2px solid border
    expect(aiAnalysisPanelStyle.borderWidth).toBe('2px');
    expect(inboundPanelStyle.borderWidth).toBe('2px');
    expect(aiAnalysisPanelStyle.borderStyle).toBe('solid');
    expect(inboundPanelStyle.borderStyle).toBe('solid');

    // Both should have 12px border-radius
    expect(aiAnalysisPanelStyle.borderRadius).toBe('12px');
    expect(inboundPanelStyle.borderRadius).toBe('12px');
  });

  test('Filter context bars have matching styling', async ({ page }) => {
    const aiAnalysisFilter = page.locator('[data-testid="ai-analysis"] .filter-context');
    const inboundFilter = page.locator('[data-testid="inbound-ai-analysis"] .filter-context');

    await expect(aiAnalysisFilter).toBeVisible({ timeout: 30000 });
    await expect(inboundFilter).toBeVisible();

    const aiAnalysisFilterStyle = await aiAnalysisFilter.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        borderRadius: computed.borderRadius,
      };
    });

    const inboundFilterStyle = await inboundFilter.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        padding: computed.padding,
        borderRadius: computed.borderRadius,
      };
    });

    // Both should have 16px 24px padding
    expect(aiAnalysisFilterStyle.padding).toBe('16px 24px');
    expect(inboundFilterStyle.padding).toBe('16px 24px');

    // Both should have 10px 10px 0 0 border-radius (top corners only)
    expect(aiAnalysisFilterStyle.borderRadius).toBe('10px 10px 0px 0px');
    expect(inboundFilterStyle.borderRadius).toBe('10px 10px 0px 0px');
  });

  test('Placeholder states have matching styling', async ({ page }) => {
    const aiAnalysisPlaceholder = page.locator('[data-testid="ai-analysis"] .placeholder');
    const inboundPlaceholder = page.locator('[data-testid="inbound-ai-analysis"] .placeholder');

    await expect(aiAnalysisPlaceholder).toBeVisible({ timeout: 30000 });
    await expect(inboundPlaceholder).toBeVisible();

    // Verify placeholder icons exist
    const aiAnalysisPlaceholderIcon = page.locator('[data-testid="ai-analysis"] .placeholder-icon');
    const inboundPlaceholderIcon = page.locator('[data-testid="inbound-ai-analysis"] .placeholder-icon');

    await expect(aiAnalysisPlaceholderIcon).toBeVisible();
    await expect(inboundPlaceholderIcon).toBeVisible();

    // Both icons should have "AI" text
    await expect(aiAnalysisPlaceholderIcon).toHaveText('AI');
    await expect(inboundPlaceholderIcon).toHaveText('AI');

    const aiAnalysisIconStyle = await aiAnalysisPlaceholderIcon.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        height: computed.height,
        borderRadius: computed.borderRadius,
        background: computed.backgroundImage,
      };
    });

    const inboundIconStyle = await inboundPlaceholderIcon.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        width: computed.width,
        height: computed.height,
        borderRadius: computed.borderRadius,
        background: computed.backgroundImage,
      };
    });

    // Both should be 64px x 64px with 16px border-radius
    expect(aiAnalysisIconStyle.width).toBe('64px');
    expect(inboundIconStyle.width).toBe('64px');
    expect(aiAnalysisIconStyle.height).toBe('64px');
    expect(inboundIconStyle.height).toBe('64px');
    expect(aiAnalysisIconStyle.borderRadius).toBe('16px');
    expect(inboundIconStyle.borderRadius).toBe('16px');

    // Both should have gradient background
    expect(aiAnalysisIconStyle.background).toContain('linear-gradient');
    expect(inboundIconStyle.background).toContain('linear-gradient');
  });

  test('Section containers have matching class names', async ({ page }) => {
    // Both sections should use .ai-analysis-section class
    const aiAnalysisSection = page.locator('[data-testid="ai-analysis"]');
    const inboundSection = page.locator('[data-testid="inbound-ai-analysis"]');

    await expect(aiAnalysisSection).toBeVisible({ timeout: 30000 });
    await expect(inboundSection).toBeVisible();

    // Verify class names
    const aiAnalysisClass = await aiAnalysisSection.getAttribute('class');
    const inboundClass = await inboundSection.getAttribute('class');

    expect(aiAnalysisClass).toContain('ai-analysis-section');
    expect(inboundClass).toContain('ai-analysis-section');
  });
});

test.describe('AI Analysis Section Visual Regression', () => {
  test('AI Analysis sections match visually', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshots of both sections for visual comparison
    const aiAnalysisSection = page.locator('[data-testid="ai-analysis"]');
    const inboundSection = page.locator('[data-testid="inbound-ai-analysis"]');

    await expect(aiAnalysisSection).toBeVisible({ timeout: 30000 });
    await expect(inboundSection).toBeVisible();

    // Screenshot the Analysis & Recommendations section
    await aiAnalysisSection.screenshot({
      path: 'tests/test-results/ai-analysis-section.png'
    });

    // Screenshot the Inbound Marketing Deep Dive section
    await inboundSection.screenshot({
      path: 'tests/test-results/inbound-ai-analysis-section.png'
    });

    // The tests above verify the styles match programmatically
    // These screenshots can be used for manual visual comparison or
    // added to a visual regression testing system
  });
});
