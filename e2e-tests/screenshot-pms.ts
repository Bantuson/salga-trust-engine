/**
 * Quick Playwright screenshot script for PMS components visual verification.
 * Run: npx playwright test screenshot-pms.ts --project=dashboard-chromium
 */
import { test, expect } from '@playwright/test';

const DASHBOARD_URL = 'http://localhost:5173';

// Helper: bypass auth by navigating directly (dashboard uses client-side auth)
async function gotoWithRetry(page: any, url: string) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Wait for any animations
  await page.waitForTimeout(1500);
}

test.describe('PMS Visual Verification', () => {

  test('01 - PMS Hub default view (IDP)', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms`);
    await page.screenshot({ path: 'screenshots/01-pms-hub-default.png', fullPage: true });
  });

  test('02 - PMS Hub view dropdown (check styled, not system default)', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms`);
    // Find and click the Select/dropdown to open it
    const select = page.locator('[class*="select"], [role="combobox"], [data-testid="view-select"]').first();
    if (await select.isVisible()) {
      await select.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/02-pms-hub-dropdown-open.png', fullPage: true });
    } else {
      // Try clicking any select-like element
      const customSelect = page.locator('div').filter({ hasText: /IDP|SDBIP|Performance/ }).first();
      await customSelect.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/02-pms-hub-dropdown-open.png', fullPage: true });
    }
  });

  test('03 - PMS Hub SDBIP view', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=sdbip`);
    await page.screenshot({ path: 'screenshots/03-pms-sdbip-view.png', fullPage: true });
  });

  test('04 - PMS Hub Performance Agreements view', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=performance-agreements`);
    await page.screenshot({ path: 'screenshots/04-pms-pa-view.png', fullPage: true });
  });

  test('05 - PMS Hub Golden Thread view', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=golden-thread`);
    await page.screenshot({ path: 'screenshots/05-pms-golden-thread.png', fullPage: true });
  });

  test('06 - Statutory Reports view (main target)', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=statutory-reports`);
    await page.screenshot({ path: 'screenshots/06-statutory-reports-main.png', fullPage: true });
  });

  test('07 - Statutory Reports create form', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=statutory-reports`);
    // Click the create/+ button
    const createBtn = page.locator('button').filter({ hasText: /Create|New|\+/ }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/07-statutory-reports-create-form.png', fullPage: true });
    } else {
      await page.screenshot({ path: 'screenshots/07-statutory-reports-no-create-btn.png', fullPage: true });
    }
  });

  test('08 - Statutory Reports type dropdown (check styled)', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=statutory-reports`);
    // Look for filter dropdowns
    const typeFilter = page.locator('select, [role="combobox"], [class*="select"]');
    const count = await typeFilter.count();
    if (count > 0) {
      await typeFilter.first().click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'screenshots/08-statutory-reports-type-filter.png', fullPage: true });
  });

  test('09 - Deadline calendar section', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms?view=statutory-reports`);
    // Scroll to deadline calendar section
    const deadlineSection = page.locator('text=Deadline Calendar, text=Statutory Deadline').first();
    if (await deadlineSection.isVisible()) {
      await deadlineSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'screenshots/09-deadline-calendar.png', fullPage: true });
  });

  test('10 - Dashboard header notification bell', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms`);
    // Look for the bell icon / notification button
    const bellBtn = page.locator('button[aria-label="Notifications"], button:has(svg path[d*="M18 8A6"])').first();
    if (await bellBtn.isVisible()) {
      // Screenshot header area first
      await page.screenshot({ path: 'screenshots/10a-header-with-bell.png', fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 80 } });
      // Click to open notification dropdown
      await bellBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/10b-notification-dropdown.png', fullPage: false, clip: { x: 600, y: 0, width: 680, height: 500 } });
    } else {
      await page.screenshot({ path: 'screenshots/10-no-bell-found.png', fullPage: false, clip: { x: 0, y: 0, width: 1280, height: 80 } });
    }
  });

  test('11 - Dashboard sidebar navigation', async ({ page }) => {
    await gotoWithRetry(page, `${DASHBOARD_URL}/pms`);
    await page.screenshot({ path: 'screenshots/11-sidebar-nav.png', fullPage: false, clip: { x: 0, y: 0, width: 280, height: 720 } });
  });

});
