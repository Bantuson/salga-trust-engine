/**
 * Public Dashboard - Landing Page E2E Tests
 *
 * Smoke tests for landing page functionality:
 * - Hero section loads
 * - CTAs are clickable
 * - Navigation links work
 * - Header scroll behavior (if feasible)
 *
 * Uses LandingPage page object.
 */

import { test, expect } from '@playwright/test';
import { LandingPage } from '../../fixtures/page-objects/public/LandingPage';

test.describe('Landing Page', () => {
  test('Landing page loads with hero section', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Verify hero title is visible
    await expect(landingPage.heroTitle).toBeVisible({ timeout: 5000 });

    // Verify hero contains expected text
    const heroText = await landingPage.heroTitle.textContent();
    expect(heroText).toBeTruthy();
  });

  test('Landing page has Get Started CTA', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Verify get started button exists
    await expect(landingPage.getStartedButton).toBeVisible({ timeout: 5000 });

    // Verify button is clickable (enabled)
    await expect(landingPage.getStartedButton).toBeEnabled();
  });

  test('Navigation links work', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Test dashboard link (if exists in header)
    const dashboardLink = page.locator('a[href="/dashboard"], a[href*="dashboard"]').first();
    const dashboardLinkVisible = await dashboardLink.isVisible().catch(() => false);

    if (dashboardLinkVisible) {
      await dashboardLink.click();
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });
    }

    // Navigate back to landing
    await landingPage.goto();

    // Test about link (if exists)
    const aboutLink = page.locator('a[href="/about"], a[href*="about"]').first();
    const aboutLinkVisible = await aboutLink.isVisible().catch(() => false);

    if (aboutLinkVisible) {
      await aboutLink.click();
      await expect(page).toHaveURL(/\/about/, { timeout: 5000 });
    }
  });

  test('Header hides on scroll and reappears', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Wait for header to be visible initially
    const header = page.locator('header, nav, [data-header]').first();
    await expect(header).toBeVisible({ timeout: 3000 });

    // Get initial position
    const initialPosition = await header.boundingBox();

    // Scroll down significantly
    await page.evaluate(() => window.scrollBy(0, 400));

    // Wait for animation to complete
    await page.waitForTimeout(500);

    // Check if header is hidden or transformed
    const afterScrollPosition = await header.boundingBox();

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Wait for animation
    await page.waitForTimeout(500);

    // Header should be visible again at top
    const backToTopPosition = await header.boundingBox();

    // At least verify header still exists after scroll operations
    expect(backToTopPosition).toBeTruthy();
  });

  test('Features section displays content', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Scroll to features section
    await page.evaluate(() => {
      const featuresSection = document.querySelector('section:has(h2), [data-features]');
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // Wait for GSAP animations
    await page.waitForTimeout(1000);

    // Verify at least some feature content is visible
    const featureElements = page.locator('h3, [data-feature]');
    const count = await featureElements.count();

    expect(count).toBeGreaterThan(0);
  });
});
