import { test, expect } from '@playwright/test';

test.describe('Funnel MQL Column Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  const getFunnelSection = (page: import('@playwright/test').Page) =>
    page.locator('section:has(h2:has-text("Full Funnel Pacing"))');

  // Use exact role-based match so "New Business" doesn't collide with the
  // "New Business + Strategic" tab (both contain "New Business" as a substring).
  const clickTab = async (section: import('@playwright/test').Locator, tabName: string) => {
    await section.getByRole('button', { name: tabName, exact: true }).click();
    // Allow React re-render
    await section.page().waitForTimeout(300);
  };

  test('New Business tab shows MQL columns', async ({ page }) => {
    const section = getFunnelSection(page);
    await expect(section).toBeVisible();

    // Default tab is "New Business + Strategic" (MQL+EQL blended). Click
    // into "New Business" explicitly so the table shows the MQL-only view.
    await clickTab(section, 'New Business');
    const table = section.locator('table.funnel-table').first();
    await expect(table).toBeVisible();

    // MQL group header should be present
    const mqlHeader = table.locator('thead tr:first-child th:has-text("MQL")');
    await expect(mqlHeader).toBeVisible();

    // 4 stages (MQL/SQL/SAL/SQO) × 3 sub-headers (Act/Tgt/Pace) = 12
    const subHeaders = table.locator('thead tr.sub-header th');
    expect(await subHeaders.count()).toBe(12);
  });

  test('Expansion tab hides MQL columns', async ({ page }) => {
    const section = getFunnelSection(page);
    await expect(section).toBeVisible();

    await clickTab(section, 'Expansion');

    const table = section.locator('table.funnel-table').first();
    await expect(table).toBeVisible();

    // MQL group header should NOT be in the DOM
    const mqlHeader = table.locator('thead tr:first-child th:has-text("MQL")');
    await expect(mqlHeader).toHaveCount(0);

    // Sub-headers should be 4 stages x 3 = 12
    const subHeaders = table.locator('thead tr.sub-header th');
    const subHeaderCount = await subHeaders.count();
    expect(subHeaderCount).toBe(12);
  });

  test('Migration tab hides MQL columns', async ({ page }) => {
    const section = getFunnelSection(page);
    await expect(section).toBeVisible();

    await clickTab(section, 'Migration');

    const table = section.locator('table.funnel-table').first();
    await expect(table).toBeVisible();

    // MQL group header should NOT be in the DOM
    const mqlHeader = table.locator('thead tr:first-child th:has-text("MQL")');
    await expect(mqlHeader).toHaveCount(0);

    // Sub-headers should be 4 stages x 3 = 12
    const subHeaders = table.locator('thead tr.sub-header th');
    const subHeaderCount = await subHeaders.count();
    expect(subHeaderCount).toBe(12);
  });

  test('MQL columns reappear when switching back to New Business', async ({ page }) => {
    const section = getFunnelSection(page);
    await expect(section).toBeVisible();

    const table = section.locator('table.funnel-table').first();

    // Click into New Business first so we see MQL columns
    await clickTab(section, 'New Business');
    const mqlHeader = table.locator('thead tr:first-child th:has-text("MQL")');
    await expect(mqlHeader).toBeVisible();

    // Switch to Expansion — tab uses EQL not MQL
    await clickTab(section, 'Expansion');
    await expect(mqlHeader).toHaveCount(0);

    // Switch back to New Business — MQL reappears
    await clickTab(section, 'New Business');
    const mqlHeaderAgain = table.locator('thead tr:first-child th:has-text("MQL")');
    await expect(mqlHeaderAgain).toBeVisible();

    // 4 stages × 3 = 12 sub-headers on New Business tab
    const subHeaders = table.locator('thead tr.sub-header th');
    expect(await subHeaders.count()).toBe(12);
  });

  test('Lead stage label matches tab semantics (MQL for NEW LOGO motions, EQL for existing)', async ({ page }) => {
    const section = getFunnelSection(page);
    await expect(section).toBeVisible();
    const table = section.locator('table.funnel-table').first();

    // Tabs that represent net-new customer motions → MQL column
    for (const tab of ['New Business', 'Strategic']) {
      await clickTab(section, tab);
      const mqlHeader = table.locator('thead tr:first-child th:has-text("MQL")');
      await expect(mqlHeader, `${tab} tab should show MQL`).toBeVisible();
    }

    // Tabs that represent existing-customer motions → EQL column
    for (const tab of ['Expansion', 'Migration']) {
      await clickTab(section, tab);
      const eqlHeader = table.locator('thead tr:first-child th:has-text("EQL")');
      await expect(eqlHeader, `${tab} tab should show EQL`).toBeVisible();
    }
  });
});
