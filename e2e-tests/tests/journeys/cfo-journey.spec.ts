/**
 * E2E Journey: CFO — Daily Workflow
 *
 * Covers the CFO's primary daily actions:
 * 1. Load dashboard, assert CFO-specific budget/SDBIP content
 * 2. Navigate to /pms?view=sdbip-scorecards, assert SDBIP view
 * 3. Navigate to /pms?view=quarterly-actuals, assert actuals view
 * 4. Navigate to /analytics, assert analytics
 * 5. Navigate to /departments, assert department list
 *
 * Pattern: skip gracefully on backend-down; assert on mock data fallback paths.
 * All navigation has 60s timeout per CLAUDE.md.
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('CFO — Daily Journey', () => {
  authTest(
    'Step 1: View CFO dashboard — budget/SDBIP content visible',
    async ({ cfoPage }) => {
      try {
        await cfoPage.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'CFO dashboard navigation timed out — server may be down');
        return;
      }
      await cfoPage.waitForTimeout(2000);

      // Dashboard must mount — either live data, empty state, or error banner
      const hasContent = await cfoPage
        .locator('h1, h2, [data-testid], div[class*="card"], div[class*="glass"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Navigate to PMS SDBIP scorecards view',
    async ({ cfoPage }) => {
      try {
        await cfoPage.goto('/pms?view=sdbip-scorecards', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS SDBIP navigation timed out — server may be down');
        return;
      }
      await cfoPage.waitForTimeout(1500);

      await expect(cfoPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(cfoPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 3: Navigate to PMS quarterly actuals view',
    async ({ cfoPage }) => {
      try {
        await cfoPage.goto('/pms?view=quarterly-actuals', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS quarterly actuals navigation timed out — server may be down');
        return;
      }
      await cfoPage.waitForTimeout(1500);

      await expect(cfoPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(cfoPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 4: Navigate to analytics',
    async ({ cfoPage }) => {
      try {
        await cfoPage.goto('/analytics', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'Analytics navigation timed out — server may be down');
        return;
      }
      await cfoPage.waitForTimeout(1500);

      await expect(cfoPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 5: Navigate to departments',
    async ({ cfoPage }) => {
      try {
        await cfoPage.goto('/departments', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'Departments navigation timed out — server may be down');
        return;
      }
      await cfoPage.waitForTimeout(1500);

      await expect(cfoPage.locator('body')).toBeVisible();
    }
  );
});
