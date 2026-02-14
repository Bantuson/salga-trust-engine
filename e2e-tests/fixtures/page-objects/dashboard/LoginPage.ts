/**
 * Page Object: Municipal Dashboard Login Page
 *
 * Encapsulates interactions with LoginPage.tsx (municipal dashboard)
 */

import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  // Email mode locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  // Phone mode locators
  readonly phoneModeSwitchButton: Locator;
  readonly emailModeSwitchButton: Locator;
  readonly phoneInput: Locator;
  readonly sendOtpButton: Locator;
  readonly otpInput: Locator;
  readonly verifyOtpButton: Locator;

  // Product info section
  readonly productInfoSection: Locator;
  readonly requestAccessLink: Locator;

  // Error message
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Email mode (default)
    this.emailInput = page.locator('input[id="email"]');
    this.passwordInput = page.locator('input[id="password"]');
    this.submitButton = page.locator('button[type="submit"]', { hasText: 'Sign In' });

    // Phone mode
    this.phoneModeSwitchButton = page.locator('button', {
      hasText: 'Sign in with Phone OTP',
    });
    this.emailModeSwitchButton = page.locator('button', {
      hasText: 'Back to email login',
    });
    this.phoneInput = page.locator('input[id="phone"]');
    this.sendOtpButton = page.locator('button[type="submit"]', { hasText: 'Send OTP' });
    this.otpInput = page.locator('input[id="otp"]');
    this.verifyOtpButton = page.locator('button[type="submit"]', {
      hasText: 'Verify OTP',
    });

    // Product info
    this.productInfoSection = page.locator('.login-product-info, div').filter({
      hasText: /municipal service management/i,
    }).first();
    this.requestAccessLink = page.locator('a[href="/request-access"]');

    // Error
    this.errorMessage = page.locator('div').filter({ hasText: /failed|error/i }).first();
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    // Wait for navigation
    await this.page.waitForURL(/\/(login|onboarding|\/)/, { timeout: 10000 });
  }

  /**
   * Get error message
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  /**
   * Check if product info section is visible
   */
  async isProductInfoVisible(): Promise<boolean> {
    return await this.productInfoSection.isVisible();
  }
}
