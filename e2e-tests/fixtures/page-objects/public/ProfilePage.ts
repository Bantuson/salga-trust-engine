/**
 * Page Object: Public Dashboard Profile Page
 *
 * Encapsulates interactions with ProfilePage.tsx (citizen portal)
 */

import { Page, Locator } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;

  // User info display
  readonly emailDisplay: Locator;
  readonly fullNameDisplay: Locator;
  readonly phoneDisplay: Locator;
  readonly residenceStatusBadge: Locator;

  // Edit mode
  readonly editButton: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  // Form fields (edit mode)
  readonly fullNameInput: Locator;
  readonly phoneInput: Locator;
  readonly municipalitySelect: Locator;

  // Reports section
  readonly reportsList: Locator;
  readonly reportCount: Locator;

  // Proof of residence
  readonly residenceUploadArea: Locator;
  readonly residenceVerifiedBadge: Locator;

  constructor(page: Page) {
    this.page = page;

    // Display elements (view mode)
    this.emailDisplay = page.locator('text=/[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$/i').first();
    this.fullNameDisplay = page.locator('h2, h3').filter({ hasText: /\w+\s+\w+/ }).first();
    this.phoneDisplay = page.locator('text=/\\+27\\d{9}/').first();
    this.residenceStatusBadge = page.locator('div, span').filter({
      hasText: /verified|pending|not uploaded/i,
    }).first();

    // Buttons
    this.editButton = page.locator('button', { hasText: 'Edit' });
    this.saveButton = page.locator('button', { hasText: 'Save' });
    this.cancelButton = page.locator('button', { hasText: 'Cancel' });

    // Form fields (edit mode - these match ProfilePage form)
    this.fullNameInput = page.locator('input').filter({ hasText: /name/i }).or(
      page.locator('input[type="text"]').first()
    );
    this.phoneInput = page.locator('input').filter({ hasText: /phone/i }).or(
      page.locator('input[type="tel"]')
    );
    this.municipalitySelect = page.locator('select').first();

    // Reports
    this.reportsList = page.locator('[data-reports-list], div').filter({
      hasText: /your reports|recent activity/i,
    }).first();
    this.reportCount = page.locator('text=/\\d+\\s+(report|ticket)/i').first();

    // Residence upload
    this.residenceUploadArea = page.locator('div, section').filter({
      hasText: /proof of residence|upload document/i,
    }).first();
    this.residenceVerifiedBadge = page.locator('span, div').filter({
      hasText: /verified/i,
    }).first();
  }

  /**
   * Navigate to profile page
   */
  async goto() {
    await this.page.goto('/profile');
  }

  /**
   * Get user email
   */
  async getUserEmail(): Promise<string | null> {
    try {
      return await this.emailDisplay.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Get report count
   */
  async getReportCount(): Promise<number> {
    try {
      const text = await this.reportCount.textContent();
      const match = text?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if residence is verified
   */
  async isResidenceVerified(): Promise<boolean> {
    try {
      const text = await this.residenceVerifiedBadge.textContent();
      return text?.toLowerCase().includes('verified') || false;
    } catch {
      return false;
    }
  }
}
