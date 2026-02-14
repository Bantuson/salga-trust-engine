/**
 * Page Object: Public Dashboard Landing Page
 *
 * Encapsulates interactions with LandingPage.tsx
 */

import { Page, Locator } from '@playwright/test';

export class LandingPage {
  readonly page: Page;

  // Hero section
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly getStartedButton: Locator;

  // Header
  readonly header: Locator;
  readonly viewDashboardLink: Locator;

  // Features section
  readonly featuresSection: Locator;
  readonly featureCards: Locator;

  // CTA section
  readonly dashboardCTA: Locator;

  // Footer
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heroSection = page.locator('.hero-section').first();
    this.heroTitle = page.locator('h1.hero-headline').first();
    this.getStartedButton = page.locator('a, button').filter({
      hasText: /view municipal|get started|start reporting/i,
    }).first();

    this.header = page.locator('header, nav').first();
    this.viewDashboardLink = page.locator('a[href="/dashboard"]').or(
      page.locator('a').filter({ hasText: /view dashboard|transparency/i })
    );

    this.featuresSection = page.locator('section').filter({
      hasText: /features|how it works/i,
    }).first();
    this.featureCards = page.locator('.feature-card');

    this.dashboardCTA = page.locator('section').filter({
      hasText: /dashboard|transparency/i,
    }).last();

    this.footer = page.locator('footer').first();
  }

  /**
   * Navigate to landing page
   * Uses domcontentloaded to avoid GSAP animation timeout
   */
  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Click "Get Started" CTA
   */
  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  /**
   * Click "View Dashboard" link
   */
  async clickViewDashboard() {
    await this.viewDashboardLink.click();
  }

  /**
   * Check if header is visible
   */
  async isHeaderVisible(): Promise<boolean> {
    return await this.header.isVisible();
  }
}
