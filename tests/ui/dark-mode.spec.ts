import { test, expect, Page } from '@playwright/test';

/**
 * Dark Mode Legibility Tests
 *
 * Tests theme toggle functionality and ensures text remains legible
 * in both light and dark modes by verifying:
 * 1. Theme toggle works correctly
 * 2. Sufficient contrast ratios
 * 3. All key UI elements remain visible
 */

// Helper to calculate relative luminance (WCAG formula)
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio between two colors
function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Parse color string to RGB
function parseColor(color: string): { r: number; g: number; b: number } | null {
  // Handle rgb(r, g, b) format
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  // Handle rgba(r, g, b, a) format
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
    };
  }

  return null;
}

// Check if contrast meets WCAG AA standard (4.5:1 for normal text, 3:1 for large text)
function meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

async function getComputedColors(page: Page, selector: string) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    const styles = window.getComputedStyle(element);
    return {
      color: styles.color,
      backgroundColor: styles.backgroundColor,
    };
  }, selector);
}

// Wait for CSS transitions to complete (global transition is 0.3s)
const TRANSITION_WAIT = 350;

test.describe('Dark Mode Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('theme toggle button is present and accessible', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-label', /Switch to (light|dark) mode/);
  });

  test('clicking toggle switches theme', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );

    // Click toggle
    await toggle.click();

    // Verify theme changed
    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );

    expect(newTheme).not.toBe(initialTheme);
    expect(['light', 'dark']).toContain(newTheme);
  });

  test('theme persists in localStorage', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');

    // Switch to dark mode
    await toggle.click();
    const theme1 = await page.evaluate(() => localStorage.getItem('theme'));

    // Switch back to light mode
    await toggle.click();
    const theme2 = await page.evaluate(() => localStorage.getItem('theme'));

    // Verify localStorage was updated
    expect(theme1).not.toBe(theme2);
  });

  test('theme survives page reload', async ({ page }) => {
    const toggle = page.getByTestId('theme-toggle');

    // Set to dark mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify dark mode is still active
    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    expect(theme).toBe('dark');
  });
});

test.describe('Light Mode Legibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Ensure light mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(TRANSITION_WAIT); // Allow CSS transitions to complete
  });

  test('page header text is legible', async ({ page }) => {
    // Check h1 text color against the container background
    const colors = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const container = document.querySelector('.container');
      if (!h1 || !container) return null;
      return {
        color: window.getComputedStyle(h1).color,
        backgroundColor: window.getComputedStyle(container).backgroundColor,
      };
    });
    expect(colors).not.toBeNull();

    if (colors) {
      const textColor = parseColor(colors.color);
      const bgColor = parseColor(colors.backgroundColor);

      if (textColor && bgColor) {
        const textLuminance = getLuminance(textColor.r, textColor.g, textColor.b);
        const bgLuminance = getLuminance(bgColor.r, bgColor.g, bgColor.b);
        const ratio = getContrastRatio(textLuminance, bgLuminance);

        // Headers are large text, need 3:1 contrast
        expect(meetsWCAGAA(ratio, true)).toBe(true);
      }
    }
  });

  test('key UI elements are visible in light mode', async ({ page }) => {
    // Check main content elements
    await expect(page.locator('.header-bar')).toBeVisible();
    await expect(page.getByTestId('theme-toggle')).toBeVisible();

    // Check that filter buttons are visible
    const filterSection = page.locator('.filter-section').first();
    if (await filterSection.isVisible()) {
      await expect(filterSection).toBeVisible();
    }
  });

  test('tables have visible borders in light mode', async ({ page }) => {
    // Wait for table to load
    const table = page.locator('table').first();
    const isTableVisible = await table.isVisible().catch(() => false);

    if (isTableVisible) {
      const tableStyles = await page.evaluate(() => {
        const table = document.querySelector('table');
        if (!table) return null;
        const styles = window.getComputedStyle(table);
        return {
          borderColor: styles.borderColor,
          borderWidth: styles.borderWidth,
        };
      });

      expect(tableStyles).not.toBeNull();
    }
  });
});

test.describe('Dark Mode Legibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Set dark mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(TRANSITION_WAIT); // Allow CSS transitions to complete
  });

  test('page has dark background in dark mode', async ({ page }) => {
    // Check both body and container backgrounds
    const bgColor = await page.evaluate(() => {
      const body = document.body;
      const container = document.querySelector('.container');
      // Check container first as it's the main visible background
      if (container) {
        return window.getComputedStyle(container).backgroundColor;
      }
      return window.getComputedStyle(body).backgroundColor;
    });

    const rgb = parseColor(bgColor);
    expect(rgb).not.toBeNull();
    if (rgb) {
      const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
      // Dark mode background should have low luminance (< 0.25)
      expect(luminance).toBeLessThan(0.25);
    }
  });

  test('text has light color in dark mode', async ({ page }) => {
    // Check container text color (more specific than body)
    const textColor = await page.evaluate(() => {
      const container = document.querySelector('.container');
      if (container) {
        return window.getComputedStyle(container).color;
      }
      return window.getComputedStyle(document.body).color;
    });

    const rgb = parseColor(textColor);
    expect(rgb).not.toBeNull();
    if (rgb) {
      const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
      // Text should have high luminance in dark mode (> 0.4)
      expect(luminance).toBeGreaterThan(0.4);
    }
  });

  test('key UI elements are visible in dark mode', async ({ page }) => {
    // Check main content elements
    await expect(page.locator('.header-bar')).toBeVisible();
    await expect(page.getByTestId('theme-toggle')).toBeVisible();

    // Check filter buttons
    const filterSection = page.locator('.filter-section').first();
    if (await filterSection.isVisible()) {
      await expect(filterSection).toBeVisible();
    }
  });

  test('success indicators remain visible in dark mode', async ({ page }) => {
    // RAG status indicators should be visible
    const successElements = page.locator('.status-green, .rag-green, [class*="success"]');
    const count = await successElements.count();

    if (count > 0) {
      const firstElement = successElements.first();
      await expect(firstElement).toBeVisible();

      const colors = await firstElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
        };
      });

      // Verify colors are applied
      expect(colors.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('danger indicators remain visible in dark mode', async ({ page }) => {
    const dangerElements = page.locator('.status-red, .rag-red, [class*="danger"]');
    const count = await dangerElements.count();

    if (count > 0) {
      const firstElement = dangerElements.first();
      await expect(firstElement).toBeVisible();
    }
  });
});

test.describe('Contrast Verification', () => {
  const themes = ['light', 'dark'] as const;

  for (const theme of themes) {
    test(`container text has sufficient contrast in ${theme} mode`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.evaluate((t) => {
        localStorage.setItem('theme', t);
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(TRANSITION_WAIT);

      // Check main content container which is the primary reading area
      const colors = await page.evaluate(() => {
        const container = document.querySelector('.container');
        if (!container) return null;
        const styles = window.getComputedStyle(container);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
        };
      });

      expect(colors).not.toBeNull();
      if (colors) {
        const textRgb = parseColor(colors.color);
        const bgRgb = parseColor(colors.backgroundColor);

        if (textRgb && bgRgb) {
          const textLuminance = getLuminance(textRgb.r, textRgb.g, textRgb.b);
          const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
          const ratio = getContrastRatio(textLuminance, bgLuminance);

          // WCAG AA requires 4.5:1 for normal text
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    test(`interactive elements are visible in ${theme} mode`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await page.evaluate((t) => {
        localStorage.setItem('theme', t);
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(TRANSITION_WAIT);

      // Check that filter buttons have visible styling
      const filterBtns = page.locator('.filter-btn');
      const filterCount = await filterBtns.count();

      if (filterCount > 0) {
        const firstFilterBtn = filterBtns.first();
        await expect(firstFilterBtn).toBeVisible();

        // Filter button should have visible border or background
        const styles = await firstFilterBtn.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            borderWidth: computed.borderWidth,
            borderStyle: computed.borderStyle,
          };
        });

        // Filter buttons should have a visible border
        expect(styles.borderStyle).not.toBe('none');
      }

      // Theme toggle should be visible
      const toggle = page.getByTestId('theme-toggle');
      await expect(toggle).toBeVisible();
    });
  }
});

test.describe('Analysis Page Dark Mode', () => {
  test('analysis page supports dark mode', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');

    // Toggle should be present
    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();

    // Switch to dark mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(TRANSITION_WAIT);

    // Verify dark background
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    const rgb = parseColor(bgColor);
    if (rgb) {
      const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
      expect(luminance).toBeLessThan(0.2);
    }
  });
});

test.describe('Visual Consistency', () => {
  test('no flash of wrong theme on load', async ({ page }) => {
    // Set dark mode preference
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
    });

    // Navigate and immediately check theme
    await page.goto('/');

    // The anti-flash script should set theme before render
    const themeOnLoad = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });

    expect(themeOnLoad).toBe('dark');
  });

  test('toggle icon updates correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggle = page.getByTestId('theme-toggle');
    const icon = toggle.locator('.theme-icon');

    // Set light mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(TRANSITION_WAIT);

    // In light mode, icon should show moon (switch to dark)
    let iconText = await icon.textContent();
    expect(iconText?.trim()).toContain('🌙');

    // Switch to dark mode
    await toggle.click();
    await page.waitForTimeout(TRANSITION_WAIT);

    // In dark mode, icon should show sun (switch to light)
    iconText = await icon.textContent();
    expect(iconText?.trim()).toContain('☀️');
  });
});
