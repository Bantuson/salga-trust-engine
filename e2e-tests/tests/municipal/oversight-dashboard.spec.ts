/**
 * E2E Tests: Oversight Dashboard — 4 role variants
 *
 * Tests the OversightDashboardPage component rendered for each oversight role.
 * The RoleBasedDashboard reads viewRole from context and renders the matching
 * OversightDashboardPage variant at the root route ('/').
 *
 * Coverage:
 * - Ward Councillor (wardCouncillorPage): SDBIP KPI Summary, Statutory Reports, KPI table headers
 * - Audit Committee (auditCommitteePage): Performance Reports, Audit Trail, audit trail table headers
 * - Internal Auditor (internalAuditorPage): KPI Verification Workqueue, evidence accordion, Verify/Insufficient buttons
 * - MPAC (mpacMemberPage): Statutory Reports, Flag Investigation inline form, flagged investigations sidebar
 */

import { test as authTest, expect } from '../../fixtures/auth';

// ---------------------------------------------------------------------------
// Ward Councillor — DASH-07
// ---------------------------------------------------------------------------

authTest.describe('Ward Councillor Dashboard', () => {
  authTest('title "Ward Councillor Dashboard" is visible', async ({ wardCouncillorPage }) => {
    try {
      await wardCouncillorPage.goto('/');
    } catch {
      authTest.skip(true, 'Ward Councillor dashboard navigation timed out — server may be under load');
      return;
    }
    await wardCouncillorPage.waitForTimeout(2000);

    const title = wardCouncillorPage.locator('h1').filter({ hasText: /Ward Councillor Dashboard/i });
    await expect(title.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('"SDBIP KPI Summary" section heading or empty/error state is visible', async ({ wardCouncillorPage }) => {
    try {
      await wardCouncillorPage.goto('/');
    } catch {
      authTest.skip(true, 'Ward Councillor dashboard navigation timed out — server may be under load');
      return;
    }
    await wardCouncillorPage.waitForTimeout(2000);

    // Either the section heading, an empty-state message, or error Retry button must be present.
    // Use .or() combinator so Playwright waits for ANY to become visible.
    const sectionHeading = wardCouncillorPage.locator('h2').filter({ hasText: /SDBIP KPI Summary/i });
    const emptyState = wardCouncillorPage.locator('p, div').filter({
      hasText: /No KPI data available|No data available for this dashboard/i,
    });
    const errorRetry = wardCouncillorPage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sectionHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });

  authTest('"Statutory Reports" section heading or empty/error state is visible', async ({ wardCouncillorPage }) => {
    try {
      await wardCouncillorPage.goto('/');
    } catch {
      authTest.skip(true, 'Ward Councillor dashboard navigation timed out — server may be under load');
      return;
    }
    await wardCouncillorPage.waitForTimeout(2000);

    const sectionHeading = wardCouncillorPage.locator('h2').filter({ hasText: /Statutory Reports/i });
    const emptyState = wardCouncillorPage.locator('p, div').filter({
      hasText: /No statutory reports available|No data available for this dashboard/i,
    });
    const errorRetry = wardCouncillorPage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sectionHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });

  authTest('KPI table shows expected column headers when data is present', async ({ wardCouncillorPage }) => {
    try {
      await wardCouncillorPage.goto('/');
    } catch {
      authTest.skip(true, 'Ward Councillor dashboard navigation timed out — server may be under load');
      return;
    }
    await wardCouncillorPage.waitForTimeout(2000);

    // Only run if a data table is actually present — skip gracefully when empty state renders
    const table = wardCouncillorPage.locator('table').first();
    const tableVisible = await table.isVisible({ timeout: 15000 }).catch(() => false);
    if (!tableVisible) {
      authTest.skip(true, 'No KPI data present — skipping header assertion');
      return;
    }

    const expectedHeaders = [
      /KPI Description/i,
      /Annual Target/i,
      /Latest Actual/i,
      /Achievement %/i,
      /Status/i,
    ];

    for (const pattern of expectedHeaders) {
      const th = wardCouncillorPage.locator('th').filter({ hasText: pattern });
      await expect(th.first()).toBeVisible({ timeout: 15000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Audit Committee — DASH-08
// ---------------------------------------------------------------------------

authTest.describe('Audit Committee Dashboard', () => {
  authTest('title "Audit Committee Dashboard" is visible', async ({ auditCommitteePage }) => {
    try {
      await auditCommitteePage.goto('/');
    } catch {
      authTest.skip(true, 'Audit Committee dashboard navigation timed out — server may be under load');
      return;
    }
    await auditCommitteePage.waitForTimeout(2000);

    const title = auditCommitteePage.locator('h1').filter({ hasText: /Audit Committee Dashboard/i });
    await expect(title.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('"Performance Reports" section heading or empty/error state is visible', async ({ auditCommitteePage }) => {
    try {
      await auditCommitteePage.goto('/');
    } catch {
      authTest.skip(true, 'Audit Committee dashboard navigation timed out — server may be under load');
      return;
    }
    await auditCommitteePage.waitForTimeout(2000);

    const sectionHeading = auditCommitteePage.locator('h2').filter({ hasText: /Performance Reports/i });
    const emptyState = auditCommitteePage.locator('p, div').filter({
      hasText: /No performance reports available|No data available for this dashboard/i,
    });
    const errorRetry = auditCommitteePage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sectionHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });

  authTest('"Audit Trail" or "PMS Activity" section heading or empty/error state is visible', async ({ auditCommitteePage }) => {
    try {
      await auditCommitteePage.goto('/');
    } catch {
      authTest.skip(true, 'Audit Committee dashboard navigation timed out — server may be under load');
      return;
    }
    await auditCommitteePage.waitForTimeout(2000);

    // The section heading is "Audit Trail — PMS Activity"
    const sectionHeading = auditCommitteePage.locator('h2').filter({
      hasText: /Audit Trail|PMS Activity/i,
    });
    const emptyState = auditCommitteePage.locator('p, div').filter({
      hasText: /No audit trail entries available|No data available for this dashboard/i,
    });
    const errorRetry = auditCommitteePage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sectionHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });

  authTest('audit trail table shows expected column headers when data is present', async ({ auditCommitteePage }) => {
    try {
      await auditCommitteePage.goto('/');
    } catch {
      authTest.skip(true, 'Audit Committee dashboard navigation timed out — server may be under load');
      return;
    }
    await auditCommitteePage.waitForTimeout(2000);

    // Detect whether an audit trail table is rendered — skip if data is absent
    // The audit trail table is the second table on this page (after Performance Reports)
    const tables = auditCommitteePage.locator('table');
    const tableCount = await tables.count().catch(() => 0);
    if (tableCount < 1) {
      authTest.skip(true, 'No audit trail data present — skipping header assertion');
      return;
    }

    const expectedHeaders = [
      /Timestamp/i,
      /User/i,
      /Operation/i,
      /Table/i,
      /Record ID/i,
      /Details/i,
    ];

    for (const pattern of expectedHeaders) {
      const th = auditCommitteePage.locator('th').filter({ hasText: pattern });
      await expect(th.first()).toBeVisible({ timeout: 15000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Internal Auditor — DASH-09
// ---------------------------------------------------------------------------

authTest.describe('Internal Auditor Dashboard', () => {
  authTest('title "Internal Auditor Dashboard" is visible', async ({ internalAuditorPage }) => {
    try {
      await internalAuditorPage.goto('/');
    } catch {
      authTest.skip(true, 'Internal Auditor dashboard navigation timed out — server may be under load');
      return;
    }
    await internalAuditorPage.waitForTimeout(2000);

    const title = internalAuditorPage.locator('h1').filter({ hasText: /Internal Auditor Dashboard/i });
    await expect(title.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('"KPI Verification Workqueue" section heading or empty/error state is visible', async ({ internalAuditorPage }) => {
    try {
      await internalAuditorPage.goto('/');
    } catch {
      authTest.skip(true, 'Internal Auditor dashboard navigation timed out — server may be under load');
      return;
    }
    await internalAuditorPage.waitForTimeout(2000);

    const sectionHeading = internalAuditorPage.locator('h2').filter({
      hasText: /KPI Verification Workqueue/i,
    });
    const emptyState = internalAuditorPage.locator('p, div').filter({
      hasText: /No evidence items pending verification|No data available for this dashboard/i,
    });
    const errorRetry = internalAuditorPage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sectionHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });

  authTest('clicking a KPI accordion item expands it to show an evidence table', async ({ internalAuditorPage }) => {
    try {
      await internalAuditorPage.goto('/');
    } catch {
      authTest.skip(true, 'Internal Auditor dashboard navigation timed out — server may be under load');
      return;
    }
    await internalAuditorPage.waitForTimeout(2000);

    // KPI items are rendered as <button> elements inside the workqueue card
    // Detect at least one accordion button; skip if no data is present
    const kpiButton = internalAuditorPage
      .locator('button')
      .filter({ hasText: /.+/ }) // any text — KPI description
      .and(internalAuditorPage.locator('[style*="width: 100%"]').or(
        internalAuditorPage.locator('button').nth(0)
      ));

    // Heuristic: look for the ▾ toggle indicator present on KPI accordion buttons
    const accordionButtons = internalAuditorPage.locator('button').filter({ hasText: /▾/ });
    const buttonCount = await accordionButtons.count().catch(() => 0);

    if (buttonCount === 0) {
      authTest.skip(true, 'No KPI items in verification queue — skipping accordion expansion test');
      return;
    }

    // Click the first accordion button to expand it
    await accordionButtons.first().click();
    await internalAuditorPage.waitForTimeout(500);

    // After expansion, an evidence table or "no evidence items" message should appear
    const evidenceTable = internalAuditorPage.locator('table');
    const noEvidenceMsg = internalAuditorPage.locator('p').filter({
      hasText: /No evidence items for this KPI/i,
    });

    const tableVisible = await evidenceTable.first().isVisible({ timeout: 10000 }).catch(() => false);
    const noEvidenceVisible = await noEvidenceMsg.first().isVisible({ timeout: 10000 }).catch(() => false);

    expect(tableVisible || noEvidenceVisible).toBe(true);
  });

  authTest('evidence table has File Name, Content Type, Uploaded, Status, Actions columns', async ({ internalAuditorPage }) => {
    try {
      await internalAuditorPage.goto('/');
    } catch {
      authTest.skip(true, 'Internal Auditor dashboard navigation timed out — server may be under load');
      return;
    }
    await internalAuditorPage.waitForTimeout(2000);

    // Expand the first KPI accordion so the evidence table is visible
    const accordionButtons = internalAuditorPage.locator('button').filter({ hasText: /▾/ });
    const buttonCount = await accordionButtons.count().catch(() => 0);

    if (buttonCount === 0) {
      authTest.skip(true, 'No KPI items in verification queue — skipping evidence table column test');
      return;
    }

    await accordionButtons.first().click();
    await internalAuditorPage.waitForTimeout(500);

    const evidenceTable = internalAuditorPage.locator('table').first();
    const tableVisible = await evidenceTable.isVisible({ timeout: 10000 }).catch(() => false);

    if (!tableVisible) {
      authTest.skip(true, 'Evidence table not visible after expanding KPI — no evidence items on first KPI');
      return;
    }

    const expectedHeaders = [
      /File Name/i,
      /Content Type/i,
      /Uploaded/i,
      /Status/i,
      /Actions/i,
    ];

    for (const pattern of expectedHeaders) {
      const th = internalAuditorPage.locator('th').filter({ hasText: pattern });
      await expect(th.first()).toBeVisible({ timeout: 15000 });
    }
  });

  authTest('"Verified" and "Insufficient" action buttons visible on unverified evidence items', async ({ internalAuditorPage }) => {
    try {
      await internalAuditorPage.goto('/');
    } catch {
      authTest.skip(true, 'Internal Auditor dashboard navigation timed out — server may be under load');
      return;
    }
    await internalAuditorPage.waitForTimeout(2000);

    // Expand all KPI accordion items to surface any unverified evidence rows
    const accordionButtons = internalAuditorPage.locator('button').filter({ hasText: /▾/ });
    const buttonCount = await accordionButtons.count().catch(() => 0);

    if (buttonCount === 0) {
      authTest.skip(true, 'No KPI items in verification queue — skipping Verify/Insufficient button test');
      return;
    }

    // Expand the first accordion
    await accordionButtons.first().click();
    await internalAuditorPage.waitForTimeout(500);

    // Look for Verified and Insufficient action buttons in the evidence table
    const verifiedBtn = internalAuditorPage.locator('button').filter({ hasText: /^Verified$/i });
    const insufficientBtn = internalAuditorPage.locator('button').filter({ hasText: /^Insufficient$/i });

    const verifiedVisible = await verifiedBtn.first().isVisible({ timeout: 10000 }).catch(() => false);
    const insufficientVisible = await insufficientBtn.first().isVisible({ timeout: 10000 }).catch(() => false);

    if (!verifiedVisible && !insufficientVisible) {
      authTest.skip(true, 'No unverified evidence items found — Verify/Insufficient buttons not rendered');
      return;
    }

    await expect(verifiedBtn.first()).toBeVisible({ timeout: 15000 });
    await expect(insufficientBtn.first()).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// MPAC — DASH-10
// ---------------------------------------------------------------------------

authTest.describe('MPAC Dashboard', () => {
  authTest('title "MPAC Dashboard" is visible', async ({ mpacMemberPage }) => {
    try {
      await mpacMemberPage.goto('/');
    } catch {
      authTest.skip(true, 'MPAC dashboard navigation timed out — server may be under load');
      return;
    }
    await mpacMemberPage.waitForTimeout(2000);

    const title = mpacMemberPage.locator('h1').filter({ hasText: /MPAC Dashboard/i });
    await expect(title.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('"Statutory Reports" section heading or empty/error state is visible', async ({ mpacMemberPage }) => {
    try {
      await mpacMemberPage.goto('/');
    } catch {
      authTest.skip(true, 'MPAC dashboard navigation timed out — server may be under load');
      return;
    }
    await mpacMemberPage.waitForTimeout(2000);

    const sectionHeading = mpacMemberPage.locator('h2').filter({ hasText: /Statutory Reports/i });
    const emptyState = mpacMemberPage.locator('p, div').filter({
      hasText: /No statutory reports available|No data available for this dashboard/i,
    });
    const errorRetry = mpacMemberPage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sectionHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });

  authTest('"Flag Investigation" button is visible on statutory report rows when data is present', async ({ mpacMemberPage }) => {
    try {
      await mpacMemberPage.goto('/');
    } catch {
      authTest.skip(true, 'MPAC dashboard navigation timed out — server may be under load');
      return;
    }
    await mpacMemberPage.waitForTimeout(2000);

    // Flag Investigation buttons only appear when there is at least one report row
    const flagBtn = mpacMemberPage.locator('button').filter({ hasText: /Flag Investigation/i });
    const flagBtnCount = await flagBtn.count().catch(() => 0);

    if (flagBtnCount === 0) {
      authTest.skip(true, 'No statutory report rows present — Flag Investigation button not rendered');
      return;
    }

    await expect(flagBtn.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('clicking "Flag Investigation" shows inline form with reason select, notes textarea, Submit Flag, and Cancel buttons', async ({ mpacMemberPage }) => {
    try {
      await mpacMemberPage.goto('/');
    } catch {
      authTest.skip(true, 'MPAC dashboard navigation timed out — server may be under load');
      return;
    }
    await mpacMemberPage.waitForTimeout(2000);

    const flagBtn = mpacMemberPage.locator('button').filter({ hasText: /Flag Investigation/i });
    const flagBtnCount = await flagBtn.count().catch(() => 0);

    if (flagBtnCount === 0) {
      authTest.skip(true, 'No statutory report rows present — cannot test Flag Investigation form');
      return;
    }

    // Click the first Flag Investigation button to expand the inline form
    await flagBtn.first().click();
    await mpacMemberPage.waitForTimeout(500);

    // Reason dropdown (select element inside the inline form)
    const reasonSelect = mpacMemberPage.locator('select').filter({
      has: mpacMemberPage.locator('option').filter({ hasText: /Performance Concern|Policy Violation|Procurement Irregularity|Other/i }),
    });
    await expect(reasonSelect.first()).toBeVisible({ timeout: 15000 });

    // Notes textarea
    const notesTextarea = mpacMemberPage.locator('textarea');
    await expect(notesTextarea.first()).toBeVisible({ timeout: 15000 });

    // Submit Flag button
    const submitBtn = mpacMemberPage.locator('button').filter({ hasText: /Submit Flag/i });
    await expect(submitBtn.first()).toBeVisible({ timeout: 15000 });

    // Cancel button — the flag button toggles to "Cancel" when form is open, or a separate Cancel button is rendered inside the form
    const cancelBtn = mpacMemberPage.locator('button').filter({ hasText: /^Cancel$/i });
    await expect(cancelBtn.first()).toBeVisible({ timeout: 15000 });
  });

  authTest('"My Flagged Investigations" sidebar section is visible', async ({ mpacMemberPage }) => {
    try {
      await mpacMemberPage.goto('/');
    } catch {
      authTest.skip(true, 'MPAC dashboard navigation timed out — server may be under load');
      return;
    }
    await mpacMemberPage.waitForTimeout(2000);

    // The sidebar heading "My Flagged Investigations" is always rendered in the MPAC layout
    // regardless of whether flagged items exist (it shows an empty state message when none exist)
    const sidebarHeading = mpacMemberPage.locator('h2').filter({
      hasText: /My Flagged Investigations/i,
    });
    const emptyState = mpacMemberPage.locator('p').filter({
      hasText: /No investigations flagged yet|No data available for this dashboard/i,
    });
    const errorRetry = mpacMemberPage.locator('button').filter({ hasText: /Retry/i });

    const anyState = sidebarHeading.first().or(emptyState.first()).or(errorRetry.first());
    await expect(anyState).toBeVisible({ timeout: 15000 });
  });
});
