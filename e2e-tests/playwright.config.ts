import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for SALGA Trust Engine E2E tests.
 *
 * Two separate test projects target public dashboard (port 5173) and municipal dashboard (port 5174).
 * Global setup seeds test municipalities and users. Global teardown cleans up test data.
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 2 : 4,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list']
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Take screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Capture video only on failure */
    video: 'retain-on-failure',

    /* Increase timeouts for GSAP animations and Lenis smooth scroll */
    navigationTimeout: 60000, // 60s for heavy animations on landing page
    actionTimeout: 15000, // 15s for element interactions
  },

  /* Global setup and teardown */
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',

  /* Configure projects for major browsers and dashboards */
  projects: [
    // Setup project - runs first, creates test data
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Public dashboard - Chromium
    {
      name: 'public-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
      dependencies: ['setup'],
    },

    // Public dashboard - Firefox
    {
      name: 'public-firefox',
      use: {
        ...devices['Desktop Firefox'],
        baseURL: 'http://localhost:5173',
      },
      dependencies: ['setup'],
    },

    // Municipal dashboard - Chromium
    {
      name: 'dashboard-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
      dependencies: ['setup'],
    },

    // Mobile testing - Public dashboard on mobile
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5173',
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      cwd: '../frontend-public',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5174',
      cwd: '../frontend-dashboard',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
