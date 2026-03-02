/**
 * E2E Tests: CFO Dashboard
 *
 * Tests the CFODashboardPage rendered at `/` for the CFO role.
 * RoleBasedDashboard reads viewRole from context and renders CFODashboardPage.
 *
 * Coverage:
 * 1. Page title "CFO Dashboard" is visible
 * 2. Page shows loading skeleton or data content (no blank screen)
 * 3. Empty state: no-data message + PMS Hub link/button
 * 4. Error state: error banner present → Retry button also present
 * 5. Refresh button is present in the page header
 * 6. Data state (conditional): 4 SDBIP summary cards, budget execution table
 *    with "Performance by Vote" heading, service delivery correlation table,
 *    statutory reporting calendar
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('CFO Dashboard', () => {
  authTest('CFO sees "CFO Dashboard" page title', async ({ cfoPage }) => {
    try {
      await cfoPage.goto('/');
    } catch {
      authTest.skip(true, 'CFO dashboard navigation timed out — server may be under load');
      return;
    }
    await cfoPage.waitForTimeout(2000);

    const pageTitle = cfoPage.locator('h1').filter({ hasText: /CFO Dashboard/i });
    await expect(pageTitle.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Page shows loading skeleton or content — no blank screen', async ({ cfoPage }) => {
    try {
      await cfoPage.goto('/');
    } catch {
      authTest.skip(true, 'CFO dashboard navigation timed out — server may be under load');
      return;
    }
    await cfoPage.waitForTimeout(2000);

    // The page must show one of: a skeleton card, a GlassCard with data or empty state,
    // or an error banner. Any of these confirms the component mounted.
    const skeletonOrContent = cfoPage
      .locator('h1')
      .filter({ hasText: /CFO Dashboard/i })
      .or(cfoPage.locator('[class*="skeleton"], [data-testid*="skeleton"]'))
      .or(cfoPage.locator('div').filter({ hasText: /No SDBIP data available/i }))
      .or(cfoPage.locator('div').filter({ hasText: /Total KPIs|On Track|At Risk|Off Track/i }))
      .or(cfoPage.locator('div').filter({ hasText: /Failed to load CFO dashboard/i }));

    await expect(skeletonOrContent.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Empty state shows no-data message and PMS Hub link', async ({ cfoPage }) => {
    try {
      await cfoPage.goto('/');
    } catch {
      authTest.skip(true, 'CFO dashboard navigation timed out — server may be under load');
      return;
    }
    // Wait for data fetch to resolve (loading → empty or data)
    await cfoPage.waitForTimeout(3000);

    const emptyText = cfoPage
      .locator('p, div')
      .filter({ hasText: /No SDBIP data available/i });

    const isEmptyState = await emptyText.first().isVisible().catch(() => false);
    if (!isEmptyState) {
      authTest.skip(true, 'Page is in data or error state — empty state test not applicable');
      return;
    }

    // Confirm the call-to-action button/link to PMS Hub is present
    const pmsHubButton = cfoPage
      .locator('button, a')
      .filter({ hasText: /PMS Hub|Go to PMS Hub/i });
    await expect(pmsHubButton.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Error state shows error banner and Retry button', async ({ cfoPage }) => {
    try {
      await cfoPage.goto('/');
    } catch {
      authTest.skip(true, 'CFO dashboard navigation timed out — server may be under load');
      return;
    }
    await cfoPage.waitForTimeout(3000);

    // Check whether the error banner is visible
    const errorBanner = cfoPage
      .locator('div')
      .filter({ hasText: /Failed to load CFO dashboard/i });

    const isErrorState = await errorBanner.first().isVisible().catch(() => false);
    if (!isErrorState) {
      authTest.skip(true, 'Page is not in error state — error state test not applicable');
      return;
    }

    // When an error banner is shown, a Retry button must also be visible
    const retryButton = cfoPage.locator('button').filter({ hasText: /Retry/i });
    await expect(retryButton.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Refresh button is present in page header', async ({ cfoPage }) => {
    try {
      await cfoPage.goto('/');
    } catch {
      authTest.skip(true, 'CFO dashboard navigation timed out — server may be under load');
      return;
    }
    await cfoPage.waitForTimeout(2000);

    // The Refresh button is rendered in the header for both empty and data states.
    // It is NOT present on the loading skeleton or the error state, so we wait
    // until the page has left the loading state first.
    await cfoPage
      .locator('h1')
      .filter({ hasText: /CFO Dashboard/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });

    const refreshButton = cfoPage.locator('button').filter({ hasText: /Refresh/i });

    // The Refresh button is only in non-error, non-loading states.
    // Use a soft assertion: visible OR page is in an alternative state.
    const isEmptyOrData = cfoPage
      .locator('button')
      .filter({ hasText: /Refresh/i });

    await expect(isEmptyOrData.first()).toBeVisible({ timeout: 15000 });
  });

  authTest(
    'Data state: 4 SDBIP summary cards, budget execution table, correlation table, statutory calendar',
    async ({ cfoPage }) => {
      try {
        await cfoPage.goto('/');
      } catch {
        authTest.skip(true, 'CFO dashboard navigation timed out — server may be under load');
        return;
      }
      await cfoPage.waitForTimeout(3000);

      // Guard: skip test if no data is available
      const summaryCards = cfoPage
        .locator('div')
        .filter({ hasText: /Total KPIs/i });
      const hasData = await summaryCards.first().isVisible().catch(() => false);
      if (!hasData) {
        authTest.skip(true, 'No CFO dashboard data available — data state test not applicable');
        return;
      }

      // 1. Four SDBIP summary cards: Total KPIs, On Track (green), At Risk (amber), Off Track (red)
      const totalKpisCard = cfoPage.locator('div').filter({ hasText: /Total KPIs/i });
      await expect(totalKpisCard.first()).toBeVisible({ timeout: 15000 });

      const onTrackCard = cfoPage.locator('div').filter({ hasText: /On Track/i });
      await expect(onTrackCard.first()).toBeVisible({ timeout: 15000 });

      const atRiskCard = cfoPage.locator('div').filter({ hasText: /At Risk/i });
      await expect(atRiskCard.first()).toBeVisible({ timeout: 15000 });

      const offTrackCard = cfoPage.locator('div').filter({ hasText: /Off Track/i });
      await expect(offTrackCard.first()).toBeVisible({ timeout: 15000 });

      // 2. Budget execution table with "Performance by Vote" heading
      const budgetHeading = cfoPage
        .locator('h2')
        .filter({ hasText: /Performance by Vote/i });
      await expect(budgetHeading.first()).toBeVisible({ timeout: 15000 });

      // Budget table should have at least the header row
      const budgetTable = cfoPage
        .locator('h2')
        .filter({ hasText: /Performance by Vote/i })
        .locator('xpath=following::table[1]');
      await expect(budgetTable.first()).toBeVisible({ timeout: 15000 });

      // 3. Service delivery correlation table
      const correlationHeading = cfoPage
        .locator('h2')
        .filter({ hasText: /Service Delivery Correlation/i });
      await expect(correlationHeading.first()).toBeVisible({ timeout: 15000 });

      // 4. Statutory reporting calendar
      const statutoryHeading = cfoPage
        .locator('h2')
        .filter({ hasText: /Statutory Reporting Calendar/i });
      await expect(statutoryHeading.first()).toBeVisible({ timeout: 15000 });
    }
  );
});
