import { test, expect } from '@playwright/test';

test('capture console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  await page.goto('/');
  await page.waitForTimeout(5000);

  console.log('=== CONSOLE ERRORS ===');
  consoleErrors.forEach(err => console.log(err));

  console.log('=== PAGE ERRORS ===');
  pageErrors.forEach(err => console.log(err));

  // Take screenshot
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });

  // Fail if there are errors so we can see them
  if (pageErrors.length > 0) {
    throw new Error(`Page errors found: ${pageErrors.join('\n')}`);
  }
});
