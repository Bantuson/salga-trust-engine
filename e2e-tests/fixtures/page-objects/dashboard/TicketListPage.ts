/**
 * Page Object: Municipal Dashboard Ticket List Page
 *
 * Encapsulates interactions with TicketListPage.tsx
 * Server-side pagination, filtering, search, export
 */

import { Page, Locator } from '@playwright/test';

export class TicketListPage {
  readonly page: Page;

  // Table elements
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly tableHeaders: Locator;

  // Search and filters
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly categoryFilter: Locator;
  readonly resetFiltersButton: Locator;

  // Pagination
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageInfo: Locator;

  // Export
  readonly exportButton: Locator;

  // Ticket details
  readonly firstTicketId: Locator;

  constructor(page: Page) {
    this.page = page;

    // Table
    this.table = page.locator('table').first();
    this.tableRows = page.locator('tbody tr');
    this.tableHeaders = page.locator('thead th');

    // Search and filters
    this.searchInput = page.locator('input[type="search"], input[type="text"]').filter({
      has: page.locator('label:has-text("Search")'),
    }).or(page.locator('input[placeholder*="search" i]').first());

    this.statusFilter = page.locator('select').filter({
      has: page.locator('label:has-text("Status")'),
    }).or(page.locator('select[name*="status"]').first());

    this.categoryFilter = page.locator('select').filter({
      has: page.locator('label:has-text("Category")'),
    }).or(page.locator('select[name*="category"]').first());

    this.resetFiltersButton = page.locator('button').filter({
      hasText: /reset|clear/i,
    });

    // Pagination
    this.previousPageButton = page.locator('button').filter({
      hasText: /previous|prev|<|‹/i,
    });
    this.nextPageButton = page.locator('button').filter({
      hasText: /next|>|›/i,
    });
    this.pageInfo = page.locator('div, span').filter({
      hasText: /page.*of/i,
    }).first();

    // Export
    this.exportButton = page.locator('button').filter({ hasText: /export/i });

    // First ticket ID (for interaction testing)
    this.firstTicketId = page.locator('tbody tr').first().locator('td').first();
  }

  /**
   * Navigate to ticket list page
   */
  async goto() {
    await this.page.goto('/tickets');
  }

  /**
   * Search tickets by query
   */
  async searchTickets(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce (300ms as per plan)
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption(category);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get ticket count (number of rows in table)
   */
  async getTicketCount(): Promise<number> {
    return await this.tableRows.count();
  }

  /**
   * Get first ticket ID
   */
  async getFirstTicketId(): Promise<string | null> {
    try {
      return await this.firstTicketId.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Click export button
   */
  async clickExport() {
    await this.exportButton.click();
  }

  /**
   * Go to next page
   */
  async goToNextPage() {
    await this.nextPageButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage() {
    await this.previousPageButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}
