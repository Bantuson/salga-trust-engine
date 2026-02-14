/**
 * Page Object: Public Dashboard Report Issue Page
 *
 * Encapsulates interactions with ReportIssuePage.tsx
 * Includes GBV consent dialog handling
 */

import { Page, Locator } from '@playwright/test';

export class ReportIssuePage {
  readonly page: Page;

  // Form field locators
  readonly categorySelect: Locator;
  readonly descriptionTextarea: Locator;
  readonly manualAddressInput: Locator;
  readonly gpsButton: Locator;
  readonly photoInput: Locator;
  readonly submitButton: Locator;

  // GBV consent dialog locators
  readonly gbvConsentDialog: Locator;
  readonly gbvAcceptButton: Locator;
  readonly gbvDeclineButton: Locator;

  // Receipt locators
  readonly trackingNumber: Locator;
  readonly receiptCard: Locator;

  // Error/info locators
  readonly errorMessage: Locator;
  readonly locationSuccessMessage: Locator;
  readonly residenceGate: Locator;

  constructor(page: Page) {
    this.page = page;

    this.categorySelect = page.locator('select[id="category"]');
    this.descriptionTextarea = page.locator('textarea[id="description"]');
    this.manualAddressInput = page.locator('input[id="manual-address"]');
    this.gpsButton = page.locator('button', { hasText: 'Use My Location' });
    this.photoInput = page.locator('input[id="photo-input"]');
    this.submitButton = page.locator('button[type="submit"]', {
      hasText: 'Submit Report',
    });

    // GBV consent (assuming it renders as a modal/overlay)
    this.gbvConsentDialog = page.locator('div').filter({ hasText: /GBV.*consent/i }).first();
    this.gbvAcceptButton = page.locator('button', { hasText: /accept|continue|i understand/i });
    this.gbvDeclineButton = page.locator('button', { hasText: /decline|cancel/i });

    // Receipt
    this.trackingNumber = page.locator('text=/TKT-\\d{8}-[A-F0-9]{6}/');
    this.receiptCard = page.locator('div').filter({ hasText: /tracking.*number/i }).first();

    // Errors and info
    this.errorMessage = page.locator('div').filter({ hasText: /error|failed/i }).first();
    this.locationSuccessMessage = page.locator('div').filter({
      hasText: /location captured/i,
    }).first();
    this.residenceGate = page.locator('div').filter({
      hasText: /proof of residence required/i,
    }).first();
  }

  /**
   * Navigate to report issue page
   */
  async goto() {
    await this.page.goto('/report');
  }

  /**
   * Select report category (handles GBV consent if needed)
   */
  async selectCategory(category: string) {
    await this.categorySelect.selectOption(category);

    // If GBV/Abuse category, handle consent dialog
    if (category === 'GBV/Abuse') {
      await this.gbvConsentDialog.waitFor({ state: 'visible', timeout: 3000 });
    }
  }

  /**
   * Accept GBV consent dialog
   */
  async acceptGbvConsent() {
    await this.gbvAcceptButton.click();
    await this.gbvConsentDialog.waitFor({ state: 'hidden', timeout: 3000 });
  }

  /**
   * Fill description textarea
   */
  async fillDescription(description: string) {
    await this.descriptionTextarea.fill(description);
  }

  /**
   * Fill manual address
   */
  async fillAddress(address: string) {
    await this.manualAddressInput.fill(address);
  }

  /**
   * Capture GPS location (triggers browser permission)
   */
  async captureGPS() {
    await this.gpsButton.click();
    // Wait for success message or error
    await Promise.race([
      this.locationSuccessMessage.waitFor({ state: 'visible', timeout: 10000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 10000 }),
    ]);
  }

  /**
   * Upload file (evidence photo)
   */
  async uploadFile(filePath: string) {
    await this.photoInput.setInputFiles(filePath);
  }

  /**
   * Submit the report
   */
  async submit() {
    await this.submitButton.click();
    // Wait for receipt or error
    await Promise.race([
      this.receiptCard.waitFor({ state: 'visible', timeout: 15000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 15000 }),
    ]);
  }

  /**
   * Get tracking number from receipt
   */
  async getTrackingNumber(): Promise<string | null> {
    try {
      return await this.trackingNumber.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Check if residence gate is blocking submission
   */
  async isResidenceGateShown(): Promise<boolean> {
    return await this.residenceGate.isVisible();
  }
}
