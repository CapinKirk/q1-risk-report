import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'tests/test-results/html' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
    baseURL: process.env.CI ? 'https://q1-risk-report.vercel.app' : 'https://q1-risk-report.vercel.app',
    trace: 'on-first-retry',
    // Test bypass header for E2E testing (bypasses auth middleware)
    extraHTTPHeaders: {
      'x-playwright-test': process.env.PLAYWRIGHT_TEST_SECRET || 'e2e-test-bypass-2026',
    },
  },
  projects: [
    // Frontend UI Tests
    {
      name: 'frontend',
      testDir: './tests/ui',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // Backend API Tests
    {
      name: 'backend',
      testDir: './tests/api',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // All Tests (default)
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  outputDir: 'tests/test-results',
  // webServer config disabled - testing against production
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
