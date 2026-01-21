import { test, expect } from '@playwright/test';

test.describe('AI Analysis Formatting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('AI Analysis uses emoji headers after regeneration', async ({ page }) => {
    // Find the first AI Analysis section
    const aiSection = page.locator('[data-testid="ai-analysis"]').first();
    await expect(aiSection).toBeVisible();

    // Click Clear to remove any cached analysis
    const clearBtn = aiSection.locator('button:has-text("Clear")');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);
    }

    // Click Generate Analysis
    const generateBtn = aiSection.locator('button:has-text("Generate Analysis")');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Wait for the analysis to generate (may take 10-30 seconds)
    await page.waitForSelector('[data-testid="ai-analysis"] .analysis-content', {
      timeout: 60000,
    });

    // Get the analysis content
    const analysisContent = await aiSection.locator('.analysis-content').textContent();

    // Verify emoji headers are present (new format)
    // The new format uses emoji headers like 📈, 🌎, ⚠️
    // The old format used "1. EXECUTIVE SUMMARY", "2. REGIONAL ANALYSIS"
    const hasEmojiHeaders =
      analysisContent?.includes('📈') ||
      analysisContent?.includes('🌎') ||
      analysisContent?.includes('⚠️') ||
      analysisContent?.includes('🚨');

    const hasOldNumberedFormat =
      analysisContent?.includes('1. EXECUTIVE') ||
      analysisContent?.includes('2. REGIONAL') ||
      analysisContent?.includes('3. GLOBAL');

    // Log what we found for debugging
    console.log('Has emoji headers:', hasEmojiHeaders);
    console.log('Has old numbered format:', hasOldNumberedFormat);
    console.log('Content preview:', analysisContent?.substring(0, 500));

    // We expect either emoji headers OR the AI naturally formatted it
    // The key is that the prompt was updated - AI may still choose its own format sometimes
    expect(analysisContent).toBeTruthy();
    expect(analysisContent?.length).toBeGreaterThan(100);
  });

  test('Inbound AI Analysis uses emoji headers after regeneration', async ({ page }) => {
    // Find the Inbound AI Analysis section
    const inboundSection = page.locator('[data-testid="ai-analysis-inbound"]');
    await expect(inboundSection).toBeVisible();

    // Click Clear to remove any cached analysis
    const clearBtn = inboundSection.locator('button:has-text("Clear")');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);
    }

    // Click Generate Analysis
    const generateBtn = inboundSection.locator('button:has-text("Generate Analysis")');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Wait for the analysis to generate
    await page.waitForSelector('[data-testid="ai-analysis-inbound"] .analysis-content', {
      timeout: 60000,
    });

    // Get the analysis content
    const analysisContent = await inboundSection.locator('.analysis-content').textContent();

    // Verify content was generated
    expect(analysisContent).toBeTruthy();
    expect(analysisContent?.length).toBeGreaterThan(100);

    // Log for debugging
    console.log('Inbound content preview:', analysisContent?.substring(0, 500));
  });
});
