/**
 * Page Object: Public Dashboard Registration Page
 *
 * Encapsulates interactions with CitizenRegisterPage.tsx
 */

import { Page, Locator } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;

  // Form field locators
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly phoneInput: Locator;
  readonly municipalitySelect: Locator;

  // Action locators
  readonly submitButton: Locator;
  readonly loginLink: Locator;

  // Feedback locators
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly fieldErrors: Locator;

  constructor(page: Page) {
    this.page = page;

    this.fullNameInput = page.locator('input[id="fullName"]');
    this.emailInput = page.locator('input[id="email"]');
    this.passwordInput = page.locator('input[id="password"]');
    this.confirmPasswordInput = page.locator('input[id="confirmPassword"]');
    this.phoneInput = page.locator('input[id="phone"]');
    this.municipalitySelect = page.locator('select[id="municipality"]');

    this.submitButton = page.locator('button[type="submit"]', {
      hasText: 'Create Account',
    });
    this.loginLink = page.locator('a[href="/login"]', { hasText: 'Sign in' });

    this.errorMessage = page.locator('div').filter({ hasText: /Registration failed|failed|error|already registered/i }).first();
    this.successMessage = page.locator('h1').filter({ hasText: /Account Created/i });
    this.fieldErrors = page.locator('span').filter({ hasText: /required|match|characters/i });
  }

  /**
   * Navigate to registration page
   */
  async goto() {
    await this.page.goto('/register', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Register a new citizen account
   */
  async register(data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    municipality?: string;
  }) {
    // Wait for GSAP form animation to complete before interacting
    await this.fullNameInput.waitFor({ state: 'visible', timeout: 30000 });

    await this.fullNameInput.fill(data.fullName);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword);

    if (data.phone) {
      await this.phoneInput.fill(data.phone);
    }

    if (data.municipality) {
      await this.municipalitySelect.selectOption(data.municipality);
    }

    await this.submitButton.click();

    // Wait for success message, error, or page navigation
    await Promise.race([
      this.successMessage.waitFor({ state: 'visible', timeout: 15000 }),
      this.errorMessage.waitFor({ state: 'visible', timeout: 15000 }),
      this.page.waitForURL((url) => !url.pathname.endsWith('/register'), { timeout: 15000 }),
    ]).catch(() => {
      // Registration may be slow or fail silently
    });
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Check if registration was successful
   */
  async isSuccessShown(): Promise<boolean> {
    return await this.successMessage.isVisible();
  }
}
