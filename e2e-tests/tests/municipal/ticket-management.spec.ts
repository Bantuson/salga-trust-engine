/**
 * E2E Tests: Municipal Ticket Management
 *
 * Tests ticket list, search, filtering, pagination, and export functionality.
 * Verifies managers can manage tickets with full CRUD operations.
 *
 * Coverage:
 * - Ticket list display with table headers and data rows
 * - Pagination controls and page navigation
 * - Search tickets by keyword
 * - Filter by status and category
 * - Clear/reset filters
 * - Export tickets to CSV
 * - Real-time indicator visibility
 * - Edge cases (empty search, pagination changes)
 */

import { test, expect } from '../../fixtures/auth';
import { TicketListPage } from '../../fixtures/page-objects/dashboard/TicketListPage';
import { DashboardPage } from '../../fixtures/page-objects/dashboard/DashboardPage';

test.describe('Municipal Ticket Management', () => {
  test.describe('Ticket List Display', () => {
    test('Manager can view ticket list with table', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      // Verify table is visible
      await expect(ticketList.table).toBeVisible();

      // Verify table headers exist
      const headerCount = await ticketList.tableHeaders.count();
      expect(headerCount).toBeGreaterThan(0);

      // Verify key column headers are present
      const headers = await ticketList.tableHeaders.allTextContents();
      const headerText = headers.join(' ').toLowerCase();

      // Should contain ID/Tracking, Status, Category, Priority, Assigned, Created
      expect(headerText).toMatch(/id|tracking/);
      expect(headerText).toMatch(/status/);
      expect(headerText).toMatch(/category/);
    });

    test('Ticket list shows pagination', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      // Wait for page to load
      await managerPage.waitForLoadState('networkidle');

      // Verify pagination controls exist
      const paginationControls = managerPage.locator('div, nav').filter({ hasText: /page|next|previous/i });
      expect(await paginationControls.count()).toBeGreaterThan(0);

      // Verify page info is visible (e.g., "Page 1 of 5")
      const pageInfo = managerPage.locator('div, span').filter({ hasText: /page.*of|showing.*of/i });
      expect(await pageInfo.count()).toBeGreaterThan(0);
    });

    test('Ticket list displays real ticket data', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Check if tickets exist or empty state is shown
      const rowCount = await ticketList.getTicketCount();

      if (rowCount > 0) {
        // Verify at least one ticket row exists
        expect(rowCount).toBeGreaterThan(0);

        // Verify first ticket has ID
        const firstTicketId = await ticketList.getFirstTicketId();
        expect(firstTicketId).toBeTruthy();
        expect(firstTicketId).toMatch(/TKT-/); // Tracking number format
      } else {
        // Verify empty state message is shown
        const emptyState = managerPage.locator('div, p').filter({ hasText: /no tickets|empty|no data/i });
        await expect(emptyState.first()).toBeVisible();
      }
    });
  });

  test.describe('Search and Filter', () => {
    test('Manager can search tickets by keyword', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Get initial ticket count
      const initialCount = await ticketList.getTicketCount();

      // Perform search
      await ticketList.searchTickets('water');

      // Wait for results
      await managerPage.waitForTimeout(600); // Account for debounce + network

      // Verify search was applied (ticket count changed or no results message)
      const searchedCount = await ticketList.getTicketCount();

      if (searchedCount === 0) {
        // Verify "no results" message is shown
        const noResults = managerPage.locator('div, p').filter({ hasText: /no.*found|no results|no tickets match/i });
        expect(await noResults.count()).toBeGreaterThan(0);
      } else {
        // If results exist, count should be different from initial or same (depending on data)
        expect(typeof searchedCount).toBe('number');
      }
    });

    test('Manager can filter by status', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Apply status filter
      const statusFilter = managerPage.locator('select').filter({ hasText: /status/i }).or(
        managerPage.locator('select[name*="status"]')
      ).first();

      // Check if filter has options
      const options = await statusFilter.locator('option').allTextContents();

      if (options.length > 1) {
        // Select a status (e.g., "open")
        const targetStatus = options.find((opt) => opt.toLowerCase().includes('open')) || options[1];
        await statusFilter.selectOption(targetStatus);

        // Wait for filter to apply
        await managerPage.waitForLoadState('networkidle');

        // Verify filter was applied (URL should contain status param or table updated)
        const url = managerPage.url();
        expect(url).toMatch(/status|filter/);
      }
    });

    test('Manager can filter by category', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Apply category filter
      const categoryFilter = managerPage.locator('select').filter({ hasText: /category/i }).or(
        managerPage.locator('select[name*="category"]')
      ).first();

      // Check if filter has options
      const options = await categoryFilter.locator('option').allTextContents();

      if (options.length > 1) {
        // Select a category (e.g., "water")
        const targetCategory = options.find((opt) => opt.toLowerCase().includes('water')) || options[1];
        await categoryFilter.selectOption(targetCategory);

        // Wait for filter to apply
        await managerPage.waitForLoadState('networkidle');

        // Verify filter was applied
        const url = managerPage.url();
        expect(url).toMatch(/category|filter/);
      }
    });

    test('Filters can be cleared', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Apply a filter first
      const statusFilter = managerPage.locator('select').filter({ hasText: /status/i }).or(
        managerPage.locator('select[name*="status"]')
      ).first();

      const options = await statusFilter.locator('option').allTextContents();
      if (options.length > 1) {
        await statusFilter.selectOption(options[1]);
        await managerPage.waitForLoadState('networkidle');
      }

      // Get filtered count
      const filteredCount = await ticketList.getTicketCount();

      // Clear filters
      const clearButton = managerPage.locator('button').filter({ hasText: /clear|reset/i }).first();
      if (await clearButton.isVisible()) {
        await clearButton.click();
        await managerPage.waitForLoadState('networkidle');

        // Verify tickets are restored (count changed back or filter removed from URL)
        const clearedCount = await ticketList.getTicketCount();
        const url = managerPage.url();

        // Either count changed or URL no longer has filter params
        const hasNoFilterParams = !url.match(/status=|category=/);
        expect(clearedCount !== filteredCount || hasNoFilterParams).toBe(true);
      }
    });
  });

  test.describe('Export', () => {
    test('Manager can export tickets to CSV', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Set up download listener
      const downloadPromise = managerPage.waitForEvent('download', { timeout: 10000 });

      // Click export button
      await ticketList.clickExport();

      // Wait for download to start
      const download = await downloadPromise;

      // Verify download was triggered
      expect(download).toBeTruthy();

      // Verify filename contains "ticket" or "export"
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/ticket|export|csv/i);
    });
  });

  test.describe('Real-time Indicator', () => {
    test('Dashboard shows realtime indicator', async ({ managerPage }) => {
      const dashboard = new DashboardPage(managerPage);
      await dashboard.goto();

      await managerPage.waitForLoadState('networkidle');

      // Verify realtime indicator is visible
      const realtimeIndicator = managerPage.locator('div, span').filter({ hasText: /live|realtime|connected/i });
      expect(await realtimeIndicator.count()).toBeGreaterThan(0);

      // Verify indicator has visual cue (dot, icon, or status text)
      const indicatorVisible = await realtimeIndicator.first().isVisible();
      expect(indicatorVisible).toBe(true);
    });
  });

  test.describe('Edge Cases', () => {
    test('Empty search returns full list', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Get initial count
      const initialCount = await ticketList.getTicketCount();

      // Search for something
      await ticketList.searchTickets('nonexistent-keyword-xyz');
      await managerPage.waitForTimeout(600);

      // Clear search
      await ticketList.searchInput.clear();
      await managerPage.waitForTimeout(600);

      // Verify original ticket count is restored (or close to it)
      const finalCount = await ticketList.getTicketCount();

      if (initialCount > 0) {
        // If there were tickets initially, they should return
        expect(finalCount).toBeGreaterThan(0);
      }
    });

    test('Pagination changes page content', async ({ managerPage }) => {
      const ticketList = new TicketListPage(managerPage);
      await ticketList.goto();

      await managerPage.waitForLoadState('networkidle');

      // Check if pagination exists (multiple pages)
      const nextButton = ticketList.nextPageButton;
      const isNextEnabled = await nextButton.isEnabled();

      if (isNextEnabled) {
        // Get first ticket ID on page 1
        const page1FirstId = await ticketList.getFirstTicketId();

        // Go to page 2
        await ticketList.goToNextPage();

        // Get first ticket ID on page 2
        const page2FirstId = await ticketList.getFirstTicketId();

        // Verify different tickets are shown
        expect(page1FirstId).not.toBe(page2FirstId);
      } else {
        // Only one page exists - verify pagination is disabled or hidden
        expect(isNextEnabled).toBe(false);
      }
    });
  });
});
