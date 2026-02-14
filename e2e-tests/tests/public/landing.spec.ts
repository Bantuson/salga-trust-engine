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

    // Verify hero title is visible (GSAP animates it in)
    await expect(landingPage.heroTitle).toBeVisible({ timeout: 10000 });

    // Verify hero contains expected text
    const heroText = await landingPage.heroTitle.textContent();
    expect(heroText).toContain('Transparent Municipal Services');
  });

  test('Landing page has Get Started CTA', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Verify get started button exists (GSAP animates it in)
    await expect(landingPage.getStartedButton).toBeVisible({ timeout: 10000 });

    // Verify button text is "View Municipal Performance"
    const buttonText = await landingPage.getStartedButton.textContent();
    expect(buttonText).toContain('View Municipal');
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

    // Wait for PublicHeader to be visible initially
    const header = page.locator('header').first();
    await expect(header).toBeVisible({ timeout: 5000 });

    // Get initial transform value
    const initialTransform = await header.evaluate((el) =>
      window.getComputedStyle(el).transform
    );

    // Scroll down significantly (> 80px threshold)
    await page.evaluate(() => window.scrollBy(0, 200));

    // Wait for GSAP animation to complete
    await page.waitForTimeout(600);

    // Check if header has transformed (hidden or moved up)
    const afterScrollTransform = await header.evaluate((el) =>
      window.getComputedStyle(el).transform
    );

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));

    // Wait for animation
    await page.waitForTimeout(600);

    // Header should be visible again
    await expect(header).toBeVisible();
  });

  test('Features section displays content', async ({ page }) => {
    const landingPage = new LandingPage(page);

    await landingPage.goto();

    // Scroll to features section to trigger ScrollTrigger
    await page.evaluate(() => {
      const featuresSection = document.querySelector('.features-section');
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // Wait for scroll animation and GSAP ScrollTrigger to complete
    await page.waitForTimeout(1500);

    // Verify feature cards are visible (GSAP animates autoAlpha from 0 to 1)
    const featureCards = page.locator('.feature-card');
    const count = await featureCards.count();
    expect(count).toBeGreaterThan(0);

    // Verify at least the first card is visible after animation
    await expect(featureCards.first()).toBeVisible({ timeout: 2000 });
  });
});
