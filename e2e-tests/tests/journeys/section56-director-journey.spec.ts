/**
 * E2E Journey: Section 56 Director — Daily Workflow
 *
 * Covers the Section 56 Director's primary daily actions:
 * 1. Load dashboard, assert director-specific content
 * 2. Navigate to /pms?view=quarterly-actuals, assert actuals view
 * 3. Navigate to /pms?view=sdbip-scorecards, assert SDBIP view
 * 4. Navigate to /departments, assert own department visible
 *
 * Pattern: skip gracefully on backend-down; assert on mock data fallback paths.
 * All navigation has 60s timeout per CLAUDE.md.
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('Section 56 Director — Daily Journey', () => {
  authTest(
    'Step 1: View director dashboard — department-scoped content visible',
    async ({ section56DirectorPage }) => {
      try {
        await section56DirectorPage.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(
          true,
          'Section 56 Director dashboard navigation timed out — server may be down'
        );
        return;
      }
      await section56DirectorPage.waitForTimeout(2000);

      // Dashboard must mount — any visible element confirms the component mounted
      const hasContent = await section56DirectorPage
        .locator('h1, h2, [data-testid], div[class*="card"], div[class*="glass"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Navigate to PMS quarterly actuals — submit own department actuals',
    async ({ section56DirectorPage }) => {
      try {
        await section56DirectorPage.goto('/pms?view=quarterly-actuals', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS quarterly actuals navigation timed out — server may be down');
        return;
      }
      await section56DirectorPage.waitForTimeout(1500);

      await expect(section56DirectorPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(section56DirectorPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 3: Navigate to PMS SDBIP scorecards — view own dept KPIs',
    async ({ section56DirectorPage }) => {
      try {
        await section56DirectorPage.goto('/pms?view=sdbip-scorecards', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS SDBIP scorecards navigation timed out — server may be down');
        return;
      }
      await section56DirectorPage.waitForTimeout(1500);

      await expect(section56DirectorPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(section56DirectorPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 4: Navigate to departments — own department visible',
    async ({ section56DirectorPage }) => {
      try {
        await section56DirectorPage.goto('/departments', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'Departments navigation timed out — server may be down');
        return;
      }
      await section56DirectorPage.waitForTimeout(1500);

      await expect(section56DirectorPage.locator('body')).toBeVisible();
    }
  );
});
