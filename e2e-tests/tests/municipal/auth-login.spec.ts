/**
 * E2E Tests: Auth Login — Strict Role Verification
 *
 * Tests email+password login flow for 5 key roles with post-login dashboard
 * heading assertions, plus invalid credentials and empty credentials negative tests.
 *
 * Rules:
 * - NO test.skip() patterns — if it fails, let it fail.
 * - NO .catch(() => false) chains on assertions.
 * - Each test creates its own fresh browser context (NOT pre-authenticated fixtures).
 * - GSAP suppressed after navigation via globalTimeline.timeScale(100).
 * - All tests use test.slow() for extended timeout.
 *
 * Test password: process.env.TEST_PASSWORD || 'Test123!@#'
 */

import { test, expect } from '../../fixtures/auth';
import { Page } from '@playwright/test';

const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test123!@#';
const DASHBOARD_URL = 'http://localhost:5173';
const PUBLIC_URL = 'http://localhost:5174';

/**
 * Suppress GSAP animations after navigation to avoid timing issues.
 * Call after waitForURL to ensure the new page has loaded its scripts.
 */
async function suppressGsap(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    if ((window as any).gsap) {
      (window as any).gsap.globalTimeline.timeScale(100);
    }
  });
}

test.describe('Auth Login — Role Dashboard Verification', () => {
  test.slow();

  test('Admin login lands on Municipal Operations Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DASHBOARD_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill('admin@test-jozi-001.test');
      await page.locator('input[id="password"]').fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

      await suppressGsap(page);

      await expect(
        page.locator('h1, h2').filter({ hasText: /Municipal Operations Dashboard/i }).first()
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('SALGA Admin login lands on SALGA Admin dashboard', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DASHBOARD_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill('salga-admin@test-jozi-001.test');
      await page.locator('input[id="password"]').fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

      await suppressGsap(page);

      await expect(
        page.locator('h1, h2').filter({ hasText: /SALGA Admin/i }).first()
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('CFO login lands on CFO Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DASHBOARD_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill('cfo@test-jozi-001.test');
      await page.locator('input[id="password"]').fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

      await suppressGsap(page);

      await expect(
        page.locator('h1, h2').filter({ hasText: /CFO Dashboard/i }).first()
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('Municipal Manager login lands on Municipal Manager Dashboard', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DASHBOARD_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill('municipal-manager@test-jozi-001.test');
      await page.locator('input[id="password"]').fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

      await suppressGsap(page);

      await expect(
        page.locator('h1, h2').filter({ hasText: /Municipal Manager Dashboard/i }).first()
      ).toBeVisible({ timeout: 15000 });
    } finally {
      await context.close();
    }
  });

  test('Citizen login lands on profile page (public dashboard)', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: PUBLIC_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${PUBLIC_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill('citizen-new@test-jozi-001.test');
      await page.locator('input[id="password"]').fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });

      await suppressGsap(page);

      // Citizen redirects to /profile on public dashboard
      expect(page.url()).toContain('/profile');

      // Body must be visible after redirect
      await expect(page.locator('body')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('Invalid credentials show error state — remains on login page', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DASHBOARD_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill('nonexistent-user@nowhere.test');
      await page.locator('input[id="password"]').fill('WrongPassword999!');
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      // Wait for Supabase auth response
      await page.waitForTimeout(3000);

      // Strict assertion: error-like content must be visible
      const errorVisible = await page
        .locator('div, p, span')
        .filter({ hasText: /invalid|failed|error|incorrect|wrong/i })
        .first()
        .isVisible({ timeout: 10000 });

      expect(errorVisible).toBe(true);

      // Strict assertion: must still be on /login (did not navigate away)
      expect(page.url()).toContain('/login');
    } finally {
      await context.close();
    }
  });

  test('Empty credentials — does not navigate away from login page', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: DASHBOARD_URL });
    const page = await context.newPage();

    try {
      await page.goto(`${DASHBOARD_URL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[id="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      // Click submit WITHOUT filling any fields — test client-side validation
      await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

      // Wait briefly for any immediate validation or async behavior
      await page.waitForTimeout(1000);

      // Strict assertion: must remain on /login (client-side guard or server rejection)
      expect(page.url()).toContain('/login');
    } finally {
      await context.close();
    }
  });
});
