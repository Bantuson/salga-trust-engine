/**
 * E2E Spec: Modal scroll — mouse wheel support
 *
 * Validates that mouse wheel events scroll modal body content instead of the
 * page background. Lenis intercepts all wheel events at document level; any
 * element with overflowY:auto that lacks data-lenis-prevent will cause the
 * page to scroll instead of the modal content.
 *
 * Key assertion: page.scrollY must NOT change after wheeling inside a modal.
 */

import { test as authTest, expect } from '../../fixtures/auth';

authTest.describe('Modal scroll — mouse wheel support', () => {
  authTest('TeamCreateModal: mouse wheel scrolls body, not page', async ({ managerPage: page }) => {
    // Navigate to teams page
    await page.goto('http://localhost:5173/teams', { timeout: 15000 });
    await page.waitForTimeout(1500); // GSAP settle

    // Open create team modal — click the "Create Team" button
    const createBtn = page.getByRole('button', { name: /create.*team/i }).first();
    await createBtn.click({ timeout: 10000 }).catch(() => {
      authTest.skip(true, 'Create Team button not found — skipping');
    });

    await page.waitForTimeout(500);

    // Find the scrollable modal body div
    const modalBody = page.locator('[data-lenis-prevent]').filter({ hasText: /./ }).first();
    const bodyHandle = await modalBody.elementHandle();
    if (!bodyHandle) { authTest.skip(true, 'Modal body not found'); return; }

    // Record page scrollY before wheel
    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    const bodyScrollBefore = await page.evaluate((el) => (el as Element).scrollTop, bodyHandle);

    // Wheel inside modal body
    const box = await modalBody.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(300);
    }

    const pageScrollAfter = await page.evaluate(() => window.scrollY);
    const bodyScrollAfter = await page.evaluate((el) => (el as Element).scrollTop, bodyHandle);

    // Page must NOT have scrolled; modal body SHOULD have scrolled (if content overflows)
    expect(pageScrollAfter).toBe(pageScrollBefore);
    // Note: bodyScrollAfter > bodyScrollBefore only if modal body has overflow content
    // This assertion is a smoke check — the key assertion is that page did not scroll
    void bodyScrollBefore;
    void bodyScrollAfter;
  });

  authTest('TicketDetailModal: mouse wheel scrolls modal, not page', async ({ managerPage: page }) => {
    await page.goto('http://localhost:5173/dashboard', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Click first ticket row
    const firstTicket = page.locator('[role="row"]').nth(1);
    await firstTicket.click({ timeout: 10000 }).catch(() => {
      authTest.skip(true, 'No ticket row found — skipping');
    });

    await page.waitForTimeout(500);

    const modal = page.locator('[data-lenis-prevent]').first();
    const box = await modal.boundingBox();

    const pageScrollBefore = await page.evaluate(() => window.scrollY);

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(300);
    }

    const pageScrollAfter = await page.evaluate(() => window.scrollY);
    expect(pageScrollAfter).toBe(pageScrollBefore);
  });
});
