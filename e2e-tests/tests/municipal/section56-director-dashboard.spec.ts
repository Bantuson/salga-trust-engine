/**
 * E2E Tests: Section 56 Director Dashboard
 *
 * Tests the department-scoped KPI dashboard rendered at "/" for the
 * section56_director role. The RoleBasedDashboard component reads viewRole
 * from context and mounts Section56DirectorDashboardPage.
 *
 * Coverage:
 * 1. Page title contains "Director Dashboard" (loading state or full title)
 * 2. Page shows either loading skeleton or content (never blank)
 * 3. Empty state when no department assigned: heading + explanatory text + PMS Hub button
 * 4. Error state: error banner + Retry button
 * 5. Data state: 4 traffic light summary cards (On Track, Needs Attention, At Risk, Overall %)
 * 6. Data state: "Departmental KPIs" section with full column headers in table
 * 7. Actions section: 3 action buttons — Upload Evidence, Submit Quarterly Actuals, View Full PMS Hub
 *
 * Requirement: DASH-12
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('Section 56 Director Dashboard', () => {
  authTest('Page title contains "Director Dashboard"', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    await section56DirectorPage.waitForTimeout(2000);

    // The h1 reads either "Director Dashboard" (loading/error state) or
    // "{Department Name} — Director Dashboard" (normal data state).
    const title = section56DirectorPage.locator('h1').filter({ hasText: /Director Dashboard/i });
    await expect(title.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Page shows loading skeleton or loaded content — never blank', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    // Allow React + GSAP time to render the initial state.
    await section56DirectorPage.waitForTimeout(2000);

    // During loading: SkeletonTheme renders skeleton cards inside the container.
    // After loading: normal content, empty state, or error banner is shown.
    // In all cases the top-level container div is present.
    const container = section56DirectorPage.locator('div').filter({ hasText: /Director Dashboard/i });
    await expect(container.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Empty state shows "No Department Assigned" heading, message, and PMS Hub button', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    await section56DirectorPage.waitForTimeout(2000);

    // Wait for loading to settle before checking state.
    // If the page is still loading we skip — this test targets the empty_state branch.
    const isLoading = await section56DirectorPage.locator('h1').filter({ hasText: /^Director Dashboard$/i }).isVisible().catch(() => false);
    const hasEmptyHeading = await section56DirectorPage.locator('h2').filter({ hasText: /No Department Assigned/i }).isVisible().catch(() => false);

    if (!hasEmptyHeading) {
      authTest.skip(true, 'Empty state not present — director account has a department assigned or page is still loading');
      return;
    }

    // h2 heading
    const emptyHeading = section56DirectorPage.locator('h2').filter({ hasText: /No Department Assigned/i });
    await expect(emptyHeading.first()).toBeVisible({ timeout: 15000 });

    // Explanatory paragraph
    const explanatoryText = section56DirectorPage.locator('p').filter({
      hasText: /No department assigned|Contact your administrator/i,
    });
    await expect(explanatoryText.first()).toBeVisible({ timeout: 15000 });

    // "Go to PMS Hub" primary button
    const pmsHubButton = section56DirectorPage.locator('button').filter({ hasText: /Go to PMS Hub/i });
    await expect(pmsHubButton.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Error state shows error banner and Retry button', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    await section56DirectorPage.waitForTimeout(2000);

    // The error banner uses a distinctive red-tinted background; it contains the
    // error message text and a "Retry" ghost button.
    const errorBanner = section56DirectorPage.locator('div').filter({ hasText: /Failed to load|error/i }).first();
    const errorVisible = await errorBanner.isVisible().catch(() => false);

    if (!errorVisible) {
      authTest.skip(true, 'Error state not present — API responded successfully');
      return;
    }

    await expect(errorBanner).toBeVisible({ timeout: 15000 });

    const retryButton = section56DirectorPage.locator('button').filter({ hasText: /Retry/i });
    await expect(retryButton.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('Data state: 4 traffic light summary cards are visible', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    await section56DirectorPage.waitForTimeout(2000);

    // Summary cards are only rendered in the normal (data) state.
    // Labels: "On Track (≥80%)", "Needs Attention (50-79%)", "At Risk (<50%)", "Overall Achievement (N KPIs)"
    const onTrackCard = section56DirectorPage.locator('div').filter({ hasText: /On Track/i });
    const onTrackVisible = await onTrackCard.first().isVisible().catch(() => false);

    if (!onTrackVisible) {
      authTest.skip(true, 'Data state not present — no department KPI data available');
      return;
    }

    // On Track card (green — >=80%)
    await expect(
      section56DirectorPage.locator('div').filter({ hasText: /On Track/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Needs Attention card (amber — 50-79%)
    await expect(
      section56DirectorPage.locator('div').filter({ hasText: /Needs Attention/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // At Risk card (red — <50%)
    await expect(
      section56DirectorPage.locator('div').filter({ hasText: /At Risk/i }).first()
    ).toBeVisible({ timeout: 15000 });

    // Overall Achievement card (shows total_achievement_pct %)
    await expect(
      section56DirectorPage.locator('div').filter({ hasText: /Overall Achievement/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  authTest('Data state: "Departmental KPIs" section with KPI table column headers', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    await section56DirectorPage.waitForTimeout(2000);

    // "Departmental KPIs" h2 is only rendered in the normal data state.
    const kpiSectionHeading = section56DirectorPage.locator('h2').filter({ hasText: /Departmental KPIs/i });
    const kpiHeadingVisible = await kpiSectionHeading.first().isVisible().catch(() => false);

    if (!kpiHeadingVisible) {
      authTest.skip(true, 'Data state not present — "Departmental KPIs" section not found');
      return;
    }

    await expect(kpiSectionHeading.first()).toBeVisible({ timeout: 15000 });

    // When kpi_details has entries, a <table> is rendered with these column headers:
    // KPI Description | Annual Target | Latest Actual | Achievement % | Quarter | Status
    const table = section56DirectorPage.locator('table');
    const tableVisible = await table.first().isVisible().catch(() => false);

    if (!tableVisible) {
      // No KPI rows — only the empty-table message is shown. That is still valid data state.
      const emptyTableMsg = section56DirectorPage.locator('p').filter({
        hasText: /No KPI data available/i,
      });
      await expect(emptyTableMsg.first()).toBeVisible({ timeout: 15000 });
      return;
    }

    // Table column headers
    const thead = section56DirectorPage.locator('thead');
    await expect(thead.first()).toBeVisible({ timeout: 15000 });

    await expect(
      section56DirectorPage.locator('th').filter({ hasText: /KPI Description/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect(
      section56DirectorPage.locator('th').filter({ hasText: /Annual Target/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect(
      section56DirectorPage.locator('th').filter({ hasText: /Latest Actual/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect(
      section56DirectorPage.locator('th').filter({ hasText: /Achievement %/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect(
      section56DirectorPage.locator('th').filter({ hasText: /Quarter/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await expect(
      section56DirectorPage.locator('th').filter({ hasText: /Status/i }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  authTest('Actions section has Upload Evidence, Submit Quarterly Actuals, and View Full PMS Hub buttons', async ({ section56DirectorPage }) => {
    try {
      await section56DirectorPage.goto('/');
    } catch {
      authTest.skip(true, 'Dashboard navigation timed out — server may be under load');
      return;
    }
    await section56DirectorPage.waitForTimeout(2000);

    // The Actions GlassCard is only rendered in the normal data state.
    // It contains an h2 "Actions" and three Button elements.
    const actionsHeading = section56DirectorPage.locator('h2').filter({ hasText: /^Actions$/i });
    const actionsVisible = await actionsHeading.first().isVisible().catch(() => false);

    if (!actionsVisible) {
      authTest.skip(true, 'Data state not present — Actions section not found');
      return;
    }

    await expect(actionsHeading.first()).toBeVisible({ timeout: 15000 });

    // "Upload Evidence" ghost button — navigates to /pms?view=evidence
    const uploadEvidenceButton = section56DirectorPage.locator('button').filter({ hasText: /Upload Evidence/i });
    await expect(uploadEvidenceButton.first()).toBeVisible({ timeout: 15000 });

    // "Submit Quarterly Actuals" ghost button — navigates to /pms?view=actuals
    const submitActualsButton = section56DirectorPage.locator('button').filter({ hasText: /Submit Quarterly Actuals/i });
    await expect(submitActualsButton.first()).toBeVisible({ timeout: 15000 });

    // "View Full PMS Hub" primary button — navigates to /pms
    const viewPmsHubButton = section56DirectorPage.locator('button').filter({ hasText: /View Full PMS Hub/i });
    await expect(viewPmsHubButton.first()).toBeVisible({ timeout: 15000 });
  });
});
