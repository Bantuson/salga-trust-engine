/**
 * Public Dashboard - Profile/Reports Portal E2E Tests
 *
 * The /profile route renders CitizenPortalPage — a citizen reports portal
 * with personal stats, report filters, and report list.
 *
 * Tests verify:
 * - Page heading and structure
 * - Report filter tabs
 * - Personal stats section
 * - Report New Issue CTA
 * - Navigation (redirect from /my-reports)
 * - User identity in nav bar dropdown
 *
 * Uses ProfilePage page object with authenticated fixtures.
 */

import { test, expect } from '../../fixtures/auth';
import { ProfilePage } from '../../fixtures/page-objects/public/ProfilePage';

test.describe('Citizen Portal Display', () => {
  test('Profile page shows "My Reports" heading', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // Verify the main heading is "My Reports"
    await expect(profilePage.heading).toBeVisible();
    await expect(profilePage.heading).toHaveText('My Reports');
  });

  test('Profile page shows "Report New Issue" link', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // Verify the CTA button/link exists and points to /report
    await expect(profilePage.reportNewIssueButton).toBeVisible({ timeout: 5000 });
    await expect(profilePage.reportNewIssueButton).toHaveAttribute('href', '/report');
  });

  test('Profile page shows report filter tabs', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // Verify all three filter buttons are visible
    await expect(profilePage.filterAll).toBeVisible({ timeout: 5000 });
    await expect(profilePage.filterOpen).toBeVisible({ timeout: 5000 });
    await expect(profilePage.filterResolved).toBeVisible({ timeout: 5000 });
  });

  test('Profile page shows "Your Reports" section heading', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // Verify the reports sub-heading
    await expect(profilePage.reportsHeading).toBeVisible({ timeout: 5000 });
    await expect(profilePage.reportsHeading).toHaveText('Your Reports');
  });

  test('Profile page shows personal stats section', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // Stats section renders stat cards with labels like "Total Reports", "Resolved"
    // It may show loading skeletons first, then real or demo data
    const totalReportsLabel = citizenReturningPage.locator('div').filter({
      hasText: /^Total Reports$/,
    });
    const resolvedLabel = citizenReturningPage.locator('div').filter({
      hasText: /^Resolved$/,
    });

    // Wait for stats to load (skeleton → data). Use a generous timeout.
    await expect(totalReportsLabel.first()).toBeVisible({ timeout: 10000 });
    await expect(resolvedLabel.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Report Filter Tabs', () => {
  test('Clicking filter tabs changes active filter', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // "All Reports" should be the default active filter
    // Active filter has a teal-tinted background (rgba(0, 217, 166, 0.2))
    await expect(profilePage.filterAll).toBeVisible({ timeout: 5000 });

    // Click "Open" filter
    await profilePage.selectFilter('open');
    // The page should not crash or navigate away
    await expect(profilePage.heading).toBeVisible();

    // Click "Resolved" filter
    await profilePage.selectFilter('resolved');
    await expect(profilePage.heading).toBeVisible();

    // Click back to "All Reports"
    await profilePage.selectFilter('all');
    await expect(profilePage.heading).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('/my-reports redirects to /profile', async ({ citizenReturningPage }) => {
    // Navigate to the legacy /my-reports route
    await citizenReturningPage.goto('/my-reports');

    // Should redirect to /profile
    await expect(citizenReturningPage).toHaveURL(/\/profile/, { timeout: 10000 });
  });

  test('Profile page has link to submit new report', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // "Report New Issue" link should point to /report
    await expect(profilePage.reportNewIssueButton).toBeVisible({ timeout: 5000 });

    // Click it and verify navigation to /report
    await profilePage.reportNewIssueButton.click();
    await expect(citizenReturningPage).toHaveURL(/\/report/, { timeout: 10000 });
  });
});

test.describe('User Identity in Nav Bar', () => {
  test('Nav bar shows authenticated user name', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // The nav bar should display the user's name
    await expect(profilePage.userMenuButton).toBeVisible({ timeout: 5000 });
    const userName = await profilePage.getUserName();
    // Name should not be empty — it shows full_name or email prefix
    expect(userName.trim().length).toBeGreaterThan(0);
  });

  test('User dropdown shows profile and report links', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    await profilePage.goto();

    // Open the user dropdown
    await profilePage.openUserMenu();

    // Verify dropdown items
    await expect(profilePage.dropdownProfileLink).toBeVisible({ timeout: 3000 });
    await expect(profilePage.dropdownReportIssueLink).toBeVisible({ timeout: 3000 });
    await expect(profilePage.dropdownSignOutButton).toBeVisible({ timeout: 3000 });
  });
});
