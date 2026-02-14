/**
 * Page Object: Municipal Dashboard Main Page
 *
 * Encapsulates interactions with DashboardPage.tsx
 * Real-time metrics, charts, and analytics
 */

import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  // Metrics cards
  readonly metricsCards: Locator;
  readonly totalTicketsMetric: Locator;
  readonly responseTimeMetric: Locator;
  readonly resolutionRateMetric: Locator;
  readonly slaComplianceMetric: Locator;

  // Charts
  readonly volumeChart: Locator;
  readonly slaChart: Locator;
  readonly teamWorkloadChart: Locator;

  // Filter bar
  readonly filterBar: Locator;
  readonly dateRangeFilter: Locator;
  readonly categoryFilter: Locator;

  // Realtime indicator
  readonly realtimeIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Metrics cards (assuming they have identifiable text/classes)
    this.metricsCards = page.locator('[class*="metric"], [class*="card"]');
    this.totalTicketsMetric = page.locator('div').filter({
      hasText: /total.*ticket/i,
    }).first();
    this.responseTimeMetric = page.locator('div').filter({
      hasText: /response.*time/i,
    }).first();
    this.resolutionRateMetric = page.locator('div').filter({
      hasText: /resolution.*rate/i,
    }).first();
    this.slaComplianceMetric = page.locator('div').filter({
      hasText: /sla.*compliance/i,
    }).first();

    // Charts (by title or class)
    this.volumeChart = page.locator('div').filter({ hasText: /volume.*category/i }).or(
      page.locator('[class*="volume-chart"]')
    ).first();
    this.slaChart = page.locator('div').filter({ hasText: /sla.*compliance/i }).or(
      page.locator('[class*="sla-chart"]')
    ).first();
    this.teamWorkloadChart = page.locator('div').filter({ hasText: /team.*workload/i }).or(
      page.locator('[class*="workload-chart"]')
    ).first();

    // Filter bar
    this.filterBar = page.locator('[class*="filter"], div').filter({
      hasText: /filter/i,
    }).first();
    this.dateRangeFilter = page.locator('select, input').filter({
      has: page.locator('label:has-text("Date Range")'),
    }).or(page.locator('select').first());
    this.categoryFilter = page.locator('select').nth(1);

    // Realtime indicator — RealtimeIndicator component renders:
    // <span>{statusText}</span> where statusText is "Live" or "Reconnecting..."
    this.realtimeIndicator = page.locator('span').filter({
      hasText: /^Live$|^Reconnecting/i,
    }).first();
  }

  /**
   * Navigate to dashboard page
   */
  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Get metric value by name
   */
  async getMetric(name: 'total' | 'response' | 'resolution' | 'sla'): Promise<string | null> {
    try {
      let locator: Locator;
      switch (name) {
        case 'total':
          locator = this.totalTicketsMetric;
          break;
        case 'response':
          locator = this.responseTimeMetric;
          break;
        case 'resolution':
          locator = this.resolutionRateMetric;
          break;
        case 'sla':
          locator = this.slaComplianceMetric;
          break;
      }
      return await locator.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Check if chart is visible
   */
  async isChartVisible(chartName: 'volume' | 'sla' | 'workload'): Promise<boolean> {
    let locator: Locator;
    switch (chartName) {
      case 'volume':
        locator = this.volumeChart;
        break;
      case 'sla':
        locator = this.slaChart;
        break;
      case 'workload':
        locator = this.teamWorkloadChart;
        break;
    }
    return await locator.isVisible();
  }

  /**
   * Check if realtime connection is active
   */
  async isRealtimeConnected(): Promise<boolean> {
    try {
      return await this.realtimeIndicator.isVisible();
    } catch {
      return false;
    }
  }
}
