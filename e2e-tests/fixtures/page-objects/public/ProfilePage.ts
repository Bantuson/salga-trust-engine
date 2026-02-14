/**
 * Page Object: Public Dashboard Profile Page (/profile)
 *
 * The /profile route renders CitizenPortalPage — a citizen reports portal
 * showing personal stats, report filters, and report list.
 *
 * NOTE: The actual ProfilePage.tsx component (with edit form, proof of residence)
 * is NOT mounted on any route. This page object targets what /profile actually renders.
 */

import { Page, Locator } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;

  // Page heading
  readonly heading: Locator;

  // Report New Issue CTA
  readonly reportNewIssueButton: Locator;

  // Filter tabs (inside MyReportsList component)
  readonly filterAll: Locator;
  readonly filterOpen: Locator;
  readonly filterResolved: Locator;

  // Reports section
  readonly reportsHeading: Locator;

  // Personal stats cards (PersonalStats component)
  readonly statsSection: Locator;

  // Nav bar user identity (PublicHeader)
  readonly userMenuButton: Locator;
  readonly userName: Locator;
  readonly userDropdown: Locator;
  readonly dropdownProfileLink: Locator;
  readonly dropdownReportIssueLink: Locator;
  readonly dropdownSignOutButton: Locator;

  // Demo mode banner
  readonly demoBanner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main page heading: "My Reports"
    this.heading = page.getByRole('heading', { name: 'My Reports', level: 1 });

    // "Report New Issue" button inside the header area
    this.reportNewIssueButton = page.getByRole('link', { name: /Report New Issue/i });

    // Filter tab buttons (rendered by MyReportsList)
    this.filterAll = page.getByRole('button', { name: 'All Reports' });
    this.filterOpen = page.getByRole('button', { name: 'Open' });
    this.filterResolved = page.getByRole('button', { name: 'Resolved' });

    // "Your Reports" sub-heading
    this.reportsHeading = page.getByRole('heading', { name: 'Your Reports', level: 2 });

    // Stats section — container with stat cards (Total Reports, Resolved, Avg Days)
    this.statsSection = page.locator('div').filter({
      hasText: /Total Reports/,
    }).first();

    // Nav bar user button (desktop) — the button that opens the user dropdown
    this.userMenuButton = page.locator('.header-user-button');
    this.userName = page.locator('.header-user-button .user-name');

    // Dropdown items (visible after clicking userMenuButton)
    this.userDropdown = page.locator('.header-user-dropdown');
    this.dropdownProfileLink = page.locator('.header-user-dropdown a', { hasText: 'Profile' });
    this.dropdownReportIssueLink = page.locator('.header-user-dropdown a', { hasText: 'Report Issue' });
    this.dropdownSignOutButton = page.locator('.header-user-dropdown button', { hasText: 'Sign Out' });

    // Demo mode banner
    this.demoBanner = page.locator('div').filter({ hasText: /Demo Mode/i }).first();
  }

  /**
   * Navigate to the profile/reports page
   */
  async goto() {
    await this.page.goto('/profile', { waitUntil: 'domcontentloaded' });
    // Wait for the page heading to appear (confirms page loaded and auth passed)
    await this.heading.waitFor({ state: 'visible', timeout: 60000 });
  }

  /**
   * Get the displayed user name from the nav bar
   */
  async getUserName(): Promise<string> {
    return (await this.userName.textContent()) || '';
  }

  /**
   * Open the user dropdown in the nav bar
   */
  async openUserMenu() {
    await this.userMenuButton.click();
    await this.userDropdown.waitFor({ state: 'visible', timeout: 3000 });
  }

  /**
   * Click a specific filter tab
   */
  async selectFilter(filter: 'all' | 'open' | 'resolved') {
    const filterMap = {
      all: this.filterAll,
      open: this.filterOpen,
      resolved: this.filterResolved,
    };
    await filterMap[filter].click();
  }
}
