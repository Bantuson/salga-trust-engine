/**
 * Page Object: Municipal Dashboard Request Access Page
 *
 * Encapsulates interactions with RequestAccessPage.tsx
 *
 * The form uses shared <Input> components which render:
 *   <div class="input-wrapper">
 *     <label>Label Text</label>
 *     <div><input ... /></div>
 *     <div style="error">error text</div>
 *   </div>
 *
 * Province uses a native <select id="province">.
 * File upload uses a hidden <input type="file" id="documents">.
 * Submit is a <button type="submit"> with text "Submit Request".
 * Success state renders an h1 with "Request Submitted!".
 */

import { Page, Locator } from '@playwright/test';

export class RequestAccessPage {
  readonly page: Page;

  // Form field locators — use the Input component's label text to find
  // the sibling input within .input-wrapper
  readonly municipalityNameInput: Locator;
  readonly provinceSelect: Locator;
  readonly municipalityCodeInput: Locator;
  readonly contactNameInput: Locator;
  readonly contactEmailInput: Locator;
  readonly contactPhoneInput: Locator;
  readonly notesTextarea: Locator;

  // File upload
  readonly fileInput: Locator;

  // Actions
  readonly submitButton: Locator;

  // Feedback
  readonly successState: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // The shared Input component renders <label>Municipality Name *</label>
    // followed by <div><input /></div> inside an .input-wrapper div.
    // We locate inputs by finding the .input-wrapper containing the label text
    // and then getting the input inside it.
    this.municipalityNameInput = page
      .locator('.input-wrapper')
      .filter({ hasText: /Municipality Name/i })
      .locator('input');

    // Province is a native <select id="province">
    this.provinceSelect = page.locator('select#province');

    this.municipalityCodeInput = page
      .locator('.input-wrapper')
      .filter({ hasText: /Municipality Code/i })
      .locator('input');

    this.contactNameInput = page
      .locator('.input-wrapper')
      .filter({ hasText: /Contact Person Name/i })
      .locator('input');

    this.contactEmailInput = page
      .locator('.input-wrapper')
      .filter({ hasText: /Contact Email/i })
      .locator('input');

    this.contactPhoneInput = page
      .locator('.input-wrapper')
      .filter({ hasText: /Contact Phone/i })
      .locator('input');

    this.notesTextarea = page.locator('textarea#notes');

    // File upload — hidden input with id="documents"
    this.fileInput = page.locator('input#documents');

    // Submit button — the actual button has text "Submit Request"
    this.submitButton = page.locator('button[type="submit"]');

    // Success state — the success view renders h1 "Request Submitted!"
    this.successState = page.locator('h1').filter({ hasText: /Request Submitted/i });

    // Error message — styled error box at top of form
    this.errorMessage = page.locator('div').filter({ hasText: /error|failed/i }).first();
  }

  /**
   * Navigate to request access page
   */
  async goto() {
    await this.page.goto('/request-access', { waitUntil: 'domcontentloaded' });
    // Wait for GSAP entrance animation to complete
    await this.page.waitForTimeout(1500);
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
    // Wait for form to be visible after GSAP animation
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
   * Upload supporting document via hidden file input
   */
  async uploadDocument(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  /**
   * Submit the form
   */
  async submit() {
    await this.submitButton.click();
    // Wait for success state or error — success shows h1 "Request Submitted!"
    await this.page.waitForTimeout(1000);
    await Promise.race([
      this.successState.waitFor({ state: 'visible', timeout: 15000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 15000 }),
    ]).catch(() => {
      // If neither appears, continue — the test will assert
    });
  }

  /**
   * Check if success message is shown
   */
  async isSuccessShown(): Promise<boolean> {
    return await this.successState.isVisible();
  }
}
