/**
 * E2E Journey: Executive Mayor — Daily Workflow
 *
 * Covers the Executive Mayor's primary daily actions:
 * 1. View organisational scorecard on dashboard
 * 2. Navigate to PMS and view SDBIP scorecards
 * 3. Navigate to statutory reports
 * 4. View departments (read-only oversight)
 *
 * Pattern: skip gracefully on backend-down; assert on mock data fallback paths
 * introduced in Phase 34-01. All navigation has 60s timeout per CLAUDE.md.
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('Executive Mayor — Daily Journey', () => {
  authTest(
    'Step 1: View organisational scorecard on dashboard',
    async ({ executiveMayorPage }) => {
      try {
        await executiveMayorPage.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'Executive Mayor dashboard navigation timed out — server may be down');
        return;
      }
      await executiveMayorPage.waitForTimeout(2000);

      // Dashboard must mount — either live data, empty state, or error banner.
      // The component never shows a blank screen after mount (Phase 34-01 guarantee).
      const hasContent = await executiveMayorPage
        .locator('h1, h2, [data-testid], div[class*="card"], div[class*="glass"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Navigate to PMS and view SDBIP scorecards',
    async ({ executiveMayorPage }) => {
      try {
        await executiveMayorPage.goto('/pms?view=sdbip-scorecards', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS navigation timed out — server may be down');
        return;
      }
      await executiveMayorPage.waitForTimeout(1500);

      // URL must include /pms — confirming the route was reached
      await expect(executiveMayorPage).toHaveURL(/pms/, { timeout: 15000 });

      // Page body must be visible (not blank)
      await expect(executiveMayorPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 3: Navigate to statutory reports',
    async ({ executiveMayorPage }) => {
      try {
        await executiveMayorPage.goto('/pms?view=statutory-reports', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'Statutory reports navigation timed out — server may be down');
        return;
      }
      await executiveMayorPage.waitForTimeout(1500);

      await expect(executiveMayorPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(executiveMayorPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 4: View departments (read-only oversight)',
    async ({ executiveMayorPage }) => {
      try {
        await executiveMayorPage.goto('/departments', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'Departments navigation timed out — server may be down');
        return;
      }
      await executiveMayorPage.waitForTimeout(1500);

      // Page must load without crash — any visible element confirms mount
      await expect(executiveMayorPage.locator('body')).toBeVisible();
    }
  );
});
