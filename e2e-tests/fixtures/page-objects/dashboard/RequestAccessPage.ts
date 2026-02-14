/**
 * Page Object: Municipal Dashboard Request Access Page
 *
 * Encapsulates interactions with RequestAccessPage.tsx
 */

import { Page, Locator } from '@playwright/test';

export class RequestAccessPage {
  readonly page: Page;

  // Form field locators
  readonly municipalityNameInput: Locator;
  readonly provinceSelect: Locator;
  readonly municipalityCodeInput: Locator;
  readonly contactNameInput: Locator;
  readonly contactEmailInput: Locator;
  readonly contactPhoneInput: Locator;
  readonly notesTextarea: Locator;

  // File upload
  readonly fileInput: Locator;
  readonly uploadButton: Locator;

  // Actions
  readonly submitButton: Locator;

  // Feedback
  readonly successState: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form fields (based on common naming patterns)
    this.municipalityNameInput = page.locator('input').filter({
      has: page.locator('label:has-text("Municipality Name")'),
    }).or(page.locator('input[name="municipalityName"], input[id*="municipality"]').first());

    this.provinceSelect = page.locator('select').first();

    this.municipalityCodeInput = page.locator('input').filter({
      has: page.locator('label:has-text("Code")'),
    }).or(page.locator('input[name*="code"]').first());

    this.contactNameInput = page.locator('input').filter({
      has: page.locator('label:has-text("Contact Name")'),
    }).or(page.locator('input[name*="contactName"]').first());

    this.contactEmailInput = page.locator('input[type="email"]').first();
    this.contactPhoneInput = page.locator('input[type="tel"]').first();

    this.notesTextarea = page.locator('textarea').first();

    // File upload
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.locator('button').filter({ hasText: /upload/i }).first();

    // Submit
    this.submitButton = page.locator('button[type="submit"]').or(
      page.locator('button').filter({ hasText: /submit|send/i })
    );

    // Feedback
    this.successState = page.locator('div').filter({ hasText: /success|submitted/i }).first();
    this.errorMessage = page.locator('div').filter({ hasText: /error|failed/i }).first();
  }

  /**
   * Navigate to request access page
   */
  async goto() {
    await this.page.goto('/request-access', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Fill request access form
   */
  async fillForm(data: {
    municipalityName: string;
    province: string;
    municipalityCode: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes?: string;
  }) {
    // Wait for GSAP form animation to complete before interacting
    await this.municipalityNameInput.waitFor({ state: 'visible', timeout: 10000 });

    await this.municipalityNameInput.fill(data.municipalityName);
    await this.provinceSelect.selectOption(data.province);
    await this.municipalityCodeInput.fill(data.municipalityCode);
    await this.contactNameInput.fill(data.contactName);
    await this.contactEmailInput.fill(data.contactEmail);
    await this.contactPhoneInput.fill(data.contactPhone);

    if (data.notes) {
      await this.notesTextarea.fill(data.notes);
    }
  }

  /**
   * Upload supporting document
   */
  async uploadDocument(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Submit the form
   */
  async submit() {
    await this.submitButton.click();
    // Wait for success or error
    await Promise.race([
      this.successState.waitFor({ state: 'visible', timeout: 10000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 10000 }),
    ]);
  }

  /**
   * Check if success message is shown
   */
  async isSuccessShown(): Promise<boolean> {
    return await this.successState.isVisible();
  }
}
