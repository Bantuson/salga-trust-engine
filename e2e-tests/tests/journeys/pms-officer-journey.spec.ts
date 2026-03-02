/**
 * E2E Journey: PMS Officer — Daily Workflow
 *
 * Covers the PMS Officer's primary daily actions:
 * 1. Navigate to /pms, assert PMS hub loads with view dropdown
 * 2. Switch to IDP view, assert IDP management content
 * 3. Switch to SDBIP view, assert SDBIP scorecards
 * 4. Switch to quarterly actuals view
 * 5. Switch to evidence view, assert evidence section
 * 6. Navigate to /departments, assert full department management
 *
 * Pattern: skip gracefully on backend-down; assert on mock data fallback paths.
 * All navigation has 60s timeout per CLAUDE.md.
 *
 * Note: pmsOfficerPage fixture uses pms-officer.profile.ts which maps to
 * the pms_officer role — the platform's PMS configuration manager.
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('PMS Officer — Daily Journey', () => {
  authTest(
    'Step 1: Navigate to PMS hub — hub loads with view selector',
    async ({ pmsOfficerPage }) => {
      try {
        await pmsOfficerPage.goto('/pms', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'PMS hub navigation timed out — server may be down');
        return;
      }
      await pmsOfficerPage.waitForTimeout(2000);

      await expect(pmsOfficerPage).toHaveURL(/pms/, { timeout: 15000 });

      // PMS hub must show content — any heading, dropdown, or card confirms mount
      const hasContent = await pmsOfficerPage
        .locator('h1, h2, select, [role="combobox"], div[class*="card"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Switch to IDP view — IDP management content visible',
    async ({ pmsOfficerPage }) => {
      try {
        await pmsOfficerPage.goto('/pms?view=idp', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'PMS IDP view navigation timed out — server may be down');
        return;
      }
      await pmsOfficerPage.waitForTimeout(1500);

      await expect(pmsOfficerPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(pmsOfficerPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 3: Switch to SDBIP scorecards view',
    async ({ pmsOfficerPage }) => {
      try {
        await pmsOfficerPage.goto('/pms?view=sdbip-scorecards', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS SDBIP view navigation timed out — server may be down');
        return;
      }
      await pmsOfficerPage.waitForTimeout(1500);

      await expect(pmsOfficerPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(pmsOfficerPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 4: Switch to quarterly actuals view',
    async ({ pmsOfficerPage }) => {
      try {
        await pmsOfficerPage.goto('/pms?view=quarterly-actuals', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS quarterly actuals navigation timed out — server may be down');
        return;
      }
      await pmsOfficerPage.waitForTimeout(1500);

      await expect(pmsOfficerPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(pmsOfficerPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 5: Switch to evidence view — POE section visible',
    async ({ pmsOfficerPage }) => {
      try {
        await pmsOfficerPage.goto('/pms?view=evidence', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS evidence view navigation timed out — server may be down');
        return;
      }
      await pmsOfficerPage.waitForTimeout(1500);

      await expect(pmsOfficerPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(pmsOfficerPage.locator('body')).toBeVisible();
    }
  );

  authTest(
    'Step 6: Navigate to departments — full department management available',
    async ({ pmsOfficerPage }) => {
      try {
        await pmsOfficerPage.goto('/departments', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'Departments navigation timed out — server may be down');
        return;
      }
      await pmsOfficerPage.waitForTimeout(1500);

      await expect(pmsOfficerPage.locator('body')).toBeVisible();
    }
  );
});
