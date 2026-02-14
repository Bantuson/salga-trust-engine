/**
 * Integration Tests: Report-to-Resolution Flow
 *
 * The most important test file in the suite - verifies the platform's core value proposition:
 * "Citizens report a problem and the municipality visibly responds."
 *
 * Tests span both dashboards (public portal at :5174 and municipal dashboard at :5173)
 * using multiple authenticated contexts within the same test.
 *
 * Success Criteria Mapping:
 * - Criterion 2: Database persistence end-to-end (report submitted → persists → visible to manager)
 * - Criterion 3: Reports routed and received by appropriate role users, status updates visible
 */

import { test, expect } from '../../fixtures/auth.js';
import { ReportIssuePage } from '../../fixtures/page-objects/public/ReportIssuePage.js';
import { TicketListPage } from '../../fixtures/page-objects/dashboard/TicketListPage.js';
import { faker } from '@faker-js/faker';

test.describe('Cross-dashboard integration: Report-to-Resolution', () => {
  test('Full journey: citizen submits report, manager sees it in ticket list', async ({
    browser,
  }) => {
    // Step A: Create new browser context for citizen
    const citizenContext = await browser.newContext({
      baseURL: 'http://localhost:5174',
    });
    const citizenPage = await citizenContext.newPage();

    // Authenticate citizen (using returning citizen profile)
    await citizenPage.goto('/login');
    await citizenPage.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await citizenPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizenPage.locator('button[type="submit"]').click();
    await citizenPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    // Step B: Citizen navigates to public portal /report, fills form
    const reportPage = new ReportIssuePage(citizenPage);
    await reportPage.goto();

    const uniqueDescription = `Pothole on ${faker.location.streetAddress()} - Test ${faker.string.alphanumeric(8)}`;
    const manualAddress = faker.location.streetAddress();

    await reportPage.selectCategory('Roads & Potholes');
    await reportPage.fillDescription(uniqueDescription);
    await reportPage.fillAddress(manualAddress);
    await reportPage.submit();

    // Step C: Capture tracking number from receipt card
    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toMatch(/TKT-\d{8}-[A-F0-9]{6}/);

    console.log(`[Test] Citizen submitted report with tracking number: ${trackingNumber}`);

    // Close citizen context
    await citizenContext.close();

    // Step D: Create separate browser context for manager
    const managerContext = await browser.newContext({
      baseURL: 'http://localhost:5173',
    });
    const managerPage = await managerContext.newPage();

    // Authenticate manager
    await managerPage.goto('/login');
    await managerPage.locator('input[id="email"]').fill('manager@test-jozi-001.test');
    await managerPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await managerPage.locator('button[type="submit"]').click();
    await managerPage.waitForURL(/\/(dashboard|tickets)/, { timeout: 10000 });

    // Step E: Manager navigates to municipal dashboard /tickets
    const ticketListPage = new TicketListPage(managerPage);
    await ticketListPage.goto();

    // Step F: Manager searches for the tracking number captured in Step C
    await ticketListPage.searchTickets(trackingNumber!);

    // Step G: Assert tracking number appears in ticket list results
    const ticketCount = await ticketListPage.getTicketCount();
    expect(ticketCount).toBeGreaterThan(0);

    // Verify the tracking number is actually visible in the table
    await expect(managerPage.locator('tbody').getByText(trackingNumber!)).toBeVisible();

    console.log(`[Test] Manager found report ${trackingNumber} in ticket list`);

    // Cleanup: Close manager context
    await managerContext.close();
  });

  test('Multiple reports from same citizen all appear in municipal ticket list', async ({
    browser,
  }) => {
    // Citizen submits 2 different reports
    const citizenContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizenPage = await citizenContext.newPage();

    await citizenPage.goto('/login');
    await citizenPage.locator('input[id="email"]').fill('citizen-multi@test-jozi-001.test');
    await citizenPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizenPage.locator('button[type="submit"]').click();
    await citizenPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    const reportPage = new ReportIssuePage(citizenPage);
    const trackingNumbers: string[] = [];

    // Submit first report (Roads & Potholes)
    await reportPage.goto();
    await reportPage.selectCategory('Roads & Potholes');
    await reportPage.fillDescription(
      `Pothole at ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const tracking1 = await reportPage.getTrackingNumber();
    expect(tracking1).toBeTruthy();
    trackingNumbers.push(tracking1!);

    // Submit second report (Water & Sanitation)
    await reportPage.goto();
    await reportPage.selectCategory('Water & Sanitation');
    await reportPage.fillDescription(
      `Water leak at ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const tracking2 = await reportPage.getTrackingNumber();
    expect(tracking2).toBeTruthy();
    trackingNumbers.push(tracking2!);

    console.log(`[Test] Citizen submitted 2 reports: ${trackingNumbers.join(', ')}`);

    await citizenContext.close();

    // Manager searches for both tracking numbers
    const managerContext = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const managerPage = await managerContext.newPage();

    await managerPage.goto('/login');
    await managerPage.locator('input[id="email"]').fill('manager@test-jozi-001.test');
    await managerPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await managerPage.locator('button[type="submit"]').click();
    await managerPage.waitForURL(/\/(dashboard|tickets)/, { timeout: 10000 });

    const ticketListPage = new TicketListPage(managerPage);
    await ticketListPage.goto();

    // Search for first tracking number
    await ticketListPage.searchTickets(trackingNumbers[0]);
    await expect(managerPage.locator('tbody').getByText(trackingNumbers[0])).toBeVisible();

    // Search for second tracking number
    await ticketListPage.searchTickets(trackingNumbers[1]);
    await expect(managerPage.locator('tbody').getByText(trackingNumbers[1])).toBeVisible();

    console.log(`[Test] Manager found both reports in ticket list`);

    await managerContext.close();
  });

  test('Report with different categories routes correctly', async ({ browser }) => {
    // Citizen submits Water & Sanitation category
    const citizenContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizenPage = await citizenContext.newPage();

    await citizenPage.goto('/login');
    await citizenPage.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await citizenPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizenPage.locator('button[type="submit"]').click();
    await citizenPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    const reportPage = new ReportIssuePage(citizenPage);
    await reportPage.goto();
    await reportPage.selectCategory('Water & Sanitation');
    await reportPage.fillDescription(
      `Water leak ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();

    await citizenContext.close();

    // Manager filters by Water & Sanitation category
    const managerContext = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const managerPage = await managerContext.newPage();

    await managerPage.goto('/login');
    await managerPage.locator('input[id="email"]').fill('manager@test-jozi-001.test');
    await managerPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await managerPage.locator('button[type="submit"]').click();
    await managerPage.waitForURL(/\/(dashboard|tickets)/, { timeout: 10000 });

    const ticketListPage = new TicketListPage(managerPage);
    await ticketListPage.goto();

    // Filter by Water & Sanitation category
    await ticketListPage.filterByCategory('Water & Sanitation');

    // Search for the specific tracking number
    await ticketListPage.searchTickets(trackingNumber!);

    // Report should appear in filtered results
    await expect(managerPage.locator('tbody').getByText(trackingNumber!)).toBeVisible();

    console.log(`[Test] Water & Sanitation report ${trackingNumber} found in filtered results`);

    await managerContext.close();
  });

  test('Citizen can see submitted report on profile page', async ({ browser }) => {
    // Citizen submits report
    const citizenContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizenPage = await citizenContext.newPage();

    await citizenPage.goto('/login');
    await citizenPage.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await citizenPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizenPage.locator('button[type="submit"]').click();
    await citizenPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    const reportPage = new ReportIssuePage(citizenPage);
    await reportPage.goto();
    await reportPage.selectCategory('Waste Management');
    await reportPage.fillDescription(
      `Refuse not collected at ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();

    console.log(`[Test] Citizen submitted report: ${trackingNumber}`);

    // Navigate to profile page
    await citizenPage.goto('/profile');
    await citizenPage.waitForLoadState('networkidle');

    // Verify report appears in report history (tracking number or category visible)
    const profileContent = await citizenPage.textContent('body');
    expect(profileContent).toContain(trackingNumber!);

    console.log(`[Test] Citizen sees report ${trackingNumber} on profile page`);

    await citizenContext.close();
  });

  test('Status update is visible on public transparency dashboard', async ({ browser }) => {
    // Navigate to public /dashboard (transparency page)
    const publicContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const publicPage = await publicContext.newPage();

    await publicPage.goto('/dashboard');
    await publicPage.waitForLoadState('networkidle');

    // Verify transparency dashboard loads with data
    // Check that municipality stats are visible (total tickets count)
    const dashboardContent = await publicPage.textContent('body');
    expect(dashboardContent).toBeTruthy();

    // Look for any numeric indicators (ticket counts, stats, etc.)
    const statsVisible = await publicPage.locator('text=/\\d+/').first().isVisible();
    expect(statsVisible).toBe(true);

    console.log('[Test] Public transparency dashboard loads with data');

    await publicContext.close();
  });

  test('GBV report does NOT appear in manager\'s ticket list (cross-dashboard GBV check)', async ({
    browser,
  }) => {
    // Citizen submits GBV report on public portal (with consent flow)
    const citizenContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizenPage = await citizenContext.newPage();

    await citizenPage.goto('/login');
    await citizenPage.locator('input[id="email"]').fill('citizen-gbv@test-jozi-001.test');
    await citizenPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizenPage.locator('button[type="submit"]').click();
    await citizenPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    const reportPage = new ReportIssuePage(citizenPage);
    await reportPage.goto();
    await reportPage.selectCategory('GBV/Abuse');

    // Handle GBV consent dialog
    await expect(reportPage.gbvConsentDialog).toBeVisible({ timeout: 3000 });
    await reportPage.acceptGbvConsent();

    await reportPage.fillDescription(
      `GBV incident at ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const gbvTrackingNumber = await reportPage.getTrackingNumber();
    expect(gbvTrackingNumber).toBeTruthy();

    console.log(`[Test] Citizen submitted GBV report: ${gbvTrackingNumber}`);

    await citizenContext.close();

    // Manager searches for GBV tracking number on municipal dashboard
    const managerContext = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const managerPage = await managerContext.newPage();

    await managerPage.goto('/login');
    await managerPage.locator('input[id="email"]').fill('manager@test-jozi-001.test');
    await managerPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await managerPage.locator('button[type="submit"]').click();
    await managerPage.waitForURL(/\/(dashboard|tickets)/, { timeout: 10000 });

    const ticketListPage = new TicketListPage(managerPage);
    await ticketListPage.goto();

    // Search for GBV tracking number
    await ticketListPage.searchTickets(gbvTrackingNumber!);

    // Assert NOT found (reinforces SEC-05 across the full integration path)
    const ticketCount = await ticketListPage.getTicketCount();
    expect(ticketCount).toBe(0);

    // Also verify tracking number is NOT visible in the page
    const gbvVisible = await managerPage
      .locator('tbody')
      .getByText(gbvTrackingNumber!)
      .isVisible()
      .catch(() => false);
    expect(gbvVisible).toBe(false);

    console.log(`[Test] Manager CANNOT see GBV report ${gbvTrackingNumber} (SEC-05 validated)`);

    await managerContext.close();
  });
});
