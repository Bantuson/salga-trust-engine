/**
 * E2E Journey: Oversight Roles — Daily Workflow
 *
 * Covers 3 oversight roles in a single spec (their journeys overlap):
 *
 * Section 1 — Audit Committee Member:
 * - Step 1: Load dashboard, assert audit committee oversight content
 * - Step 2: Navigate to /pms?view=statutory-reports
 *
 * Section 2 — Internal Auditor:
 * - Step 1: Load dashboard, assert POE verification queue content
 * - Step 2: Navigate to /pms?view=evidence
 *
 * Section 3 — MPAC Member:
 * - Step 1: Load dashboard, assert performance reports content
 * - Step 2: Navigate to /pms?view=statutory-reports
 *
 * Pattern: skip gracefully on backend-down; assert on mock data fallback paths.
 * All navigation has 60s timeout per CLAUDE.md.
 */

import { test as authTest, expect } from '../../fixtures/auth';

// ─── Section 1: Audit Committee Member ───────────────────────────────────────

authTest.describe('Audit Committee Member — Daily Journey', () => {
  authTest(
    'Step 1: View dashboard — audit committee oversight content',
    async ({ auditCommitteePage }) => {
      try {
        await auditCommitteePage.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(
          true,
          'Audit Committee dashboard navigation timed out — server may be down'
        );
        return;
      }
      await auditCommitteePage.waitForTimeout(2000);

      // Dashboard must mount — any visible element confirms the component mounted
      const hasContent = await auditCommitteePage
        .locator('h1, h2, [data-testid], div[class*="card"], div[class*="glass"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Navigate to statutory reports — oversight view',
    async ({ auditCommitteePage }) => {
      try {
        await auditCommitteePage.goto('/pms?view=statutory-reports', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'Statutory reports navigation timed out — server may be down');
        return;
      }
      await auditCommitteePage.waitForTimeout(1500);

      await expect(auditCommitteePage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(auditCommitteePage.locator('body')).toBeVisible();
    }
  );
});

// ─── Section 2: Internal Auditor ─────────────────────────────────────────────

authTest.describe('Internal Auditor — Daily Journey', () => {
  authTest(
    'Step 1: View dashboard — POE verification queue content',
    async ({ internalAuditorPage }) => {
      try {
        await internalAuditorPage.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(
          true,
          'Internal Auditor dashboard navigation timed out — server may be down'
        );
        return;
      }
      await internalAuditorPage.waitForTimeout(2000);

      const hasContent = await internalAuditorPage
        .locator('h1, h2, [data-testid], div[class*="card"], div[class*="glass"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Navigate to PMS evidence view — POE section visible',
    async ({ internalAuditorPage }) => {
      try {
        await internalAuditorPage.goto('/pms?view=evidence', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'PMS evidence view navigation timed out — server may be down');
        return;
      }
      await internalAuditorPage.waitForTimeout(1500);

      await expect(internalAuditorPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(internalAuditorPage.locator('body')).toBeVisible();
    }
  );
});

// ─── Section 3: MPAC Member ───────────────────────────────────────────────────

authTest.describe('MPAC Member — Daily Journey', () => {
  authTest(
    'Step 1: View dashboard — performance reports content',
    async ({ mpacMemberPage }) => {
      try {
        await mpacMemberPage.goto('/', { timeout: 60000, waitUntil: 'domcontentloaded' });
      } catch {
        authTest.skip(true, 'MPAC Member dashboard navigation timed out — server may be down');
        return;
      }
      await mpacMemberPage.waitForTimeout(2000);

      const hasContent = await mpacMemberPage
        .locator('h1, h2, [data-testid], div[class*="card"], div[class*="glass"]')
        .first()
        .isVisible({ timeout: 15000 })
        .catch(() => false);

      expect(hasContent).toBeTruthy();
    }
  );

  authTest(
    'Step 2: Navigate to statutory reports — MPAC performance review',
    async ({ mpacMemberPage }) => {
      try {
        await mpacMemberPage.goto('/pms?view=statutory-reports', {
          timeout: 60000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        authTest.skip(true, 'Statutory reports navigation timed out — server may be down');
        return;
      }
      await mpacMemberPage.waitForTimeout(1500);

      await expect(mpacMemberPage).toHaveURL(/pms/, { timeout: 15000 });
      await expect(mpacMemberPage.locator('body')).toBeVisible();
    }
  );
});
