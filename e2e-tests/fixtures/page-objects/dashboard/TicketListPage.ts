/**
 * Page Object: Municipal Dashboard Ticket List Page
 *
 * Encapsulates interactions with TicketListPage.tsx
 * Server-side pagination, filtering, search, export
 *
 * Actual DOM structure:
 * - h1: "Ticket Management"
 * - ExportButton: two buttons "Export CSV" and "Export Excel"
 * - FilterBar: input#search, select#status, select#category, button "Reset"
 * - TicketTable: <table> with thead/tbody, columns: Tracking #, Category, Status, Severity, Created, SLA Deadline, Address
 * - Pagination: buttons "Previous" and "Next", span "Page X of Y"
 */

import { Page, Locator } from '@playwright/test';

export class TicketListPage {
  readonly page: Page;

  // Table elements
  readonly table: Locator;
  readonly tableRows: Locator;
  readonly tableHeaders: Locator;

  // Search and filters (using actual IDs from FilterBar component)
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly categoryFilter: Locator;
  readonly resetFiltersButton: Locator;

  // Pagination (using actual button text from Pagination component)
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageInfo: Locator;

  // Export (ExportButton renders "Export CSV" and "Export Excel")
  readonly exportButton: Locator;
  readonly exportCsvButton: Locator;
  readonly exportExcelButton: Locator;

  // First ticket ID (tracking number in first cell of first row)
  readonly firstTicketId: Locator;

  // Empty state
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Table
    this.table = page.locator('table').first();
    this.tableRows = page.locator('tbody tr');
    this.tableHeaders = page.locator('thead th');

    // Search and filters — use actual element IDs from FilterBar
    this.searchInput = page.locator('input#search');
    this.statusFilter = page.locator('select#status');
    this.categoryFilter = page.locator('select#category');
    this.resetFiltersButton = page.locator('button').filter({ hasText: /^Reset$/i });

    // Pagination — Pagination component renders "Previous" and "Next" buttons
    this.previousPageButton = page.locator('button').filter({ hasText: /^Previous$/i });
    this.nextPageButton = page.locator('button').filter({ hasText: /^Next$/i });
    this.pageInfo = page.locator('span').filter({ hasText: /Page \d+ of \d+/i }).first();

    // Export buttons
    this.exportButton = page.locator('button').filter({ hasText: /Export CSV/i });
    this.exportCsvButton = page.locator('button').filter({ hasText: /Export CSV/i });
    this.exportExcelButton = page.locator('button').filter({ hasText: /Export Excel/i });

    // First ticket ID (tracking number in first cell of first row)
    this.firstTicketId = page.locator('tbody tr').first().locator('td').first();

    // Empty state — "No tickets found" message (exact text match for the inner div)
    this.emptyState = page.locator('div', { hasText: /No tickets found/i });
  }

  /**
   * Navigate to ticket list page
   */
  async goto() {
    await this.page.goto('/tickets', { waitUntil: 'domcontentloaded' });
    // Wait for React render + GSAP animations + initial data fetch
    await this.page.waitForTimeout(2000);
  }

  /**
   * Search tickets by query
   */
  async searchTickets(query: string) {
    await this.searchInput.waitFor({ state: 'visible', timeout: 30000 });
    await this.searchInput.fill(query);
    // Wait for debounce (300ms) + network response
    await this.page.waitForTimeout(600);
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
    await this.page.waitForTimeout(500);
  }

  /**
   * Filter by category
   */
  async filterByCategory(category: string) {
    await this.categoryFilter.selectOption(category);
    await this.page.waitForTimeout(500);
  }

  /**
   * Get ticket count (number of rows in table body)
   */
  async getTicketCount(): Promise<number> {
    // If table is not visible (loading or empty state), return 0
    const tableVisible = await this.table.isVisible().catch(() => false);
    if (!tableVisible) return 0;
    return await this.tableRows.count();
  }

  /**
   * Get first ticket tracking number
   */
  async getFirstTicketId(): Promise<string | null> {
    try {
      const count = await this.tableRows.count();
      if (count === 0) return null;
      return await this.firstTicketId.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Click export CSV button (force to bypass GSAP/AnimatedCard overlay)
   */
  async clickExport() {
    await this.exportCsvButton.click({ force: true });
  }

  /**
   * Go to next page
   */
  async goToNextPage() {
    await this.nextPageButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage() {
    await this.previousPageButton.click();
    await this.page.waitForTimeout(500);
  }
}
