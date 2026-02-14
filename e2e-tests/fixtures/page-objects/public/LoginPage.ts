/**
 * Page Object: Public Dashboard Login Page
 *
 * Encapsulates interactions with CitizenLoginPage.tsx
 * Supports both email+password and phone OTP authentication
 */

import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  // Email mode locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly emailSubmitButton: Locator;

  // Phone mode locators
  readonly phoneInput: Locator;
  readonly sendOtpButton: Locator;
  readonly otpInput: Locator;
  readonly verifyOtpButton: Locator;

  // Common locators
  readonly errorMessage: Locator;
  readonly phoneModeSwitchButton: Locator;
  readonly emailModeSwitchButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Email mode (default)
    this.emailInput = page.locator('input[id="email"]');
    this.passwordInput = page.locator('input[id="password"]');
    this.emailSubmitButton = page.locator('button[type="submit"]', { hasText: 'Sign In' });

    // Phone mode switch
    this.phoneModeSwitchButton = page.locator('button', {
      hasText: 'Sign in with Phone OTP',
    });
    this.emailModeSwitchButton = page.locator('button', {
      hasText: 'Back to email login',
    });

    // Phone mode
    this.phoneInput = page.locator('input[id="phone"]');
    this.sendOtpButton = page.locator('button[type="submit"]', { hasText: 'Send OTP' });
    this.otpInput = page.locator('input[id="otp"]');
    this.verifyOtpButton = page.locator('button[type="submit"]', {
      hasText: 'Verify OTP',
    });

    // Error messages
    this.errorMessage = page.locator('div').filter({ hasText: /Login failed|Invalid|Error/ }).first();
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await this.page.goto('/login');
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.emailSubmitButton.click();
    // Wait for navigation or error
    await this.page.waitForURL(/\/(profile|login)/, { timeout: 10000 });
  }

  /**
   * Login with phone OTP
   */
  async loginWithPhone(phone: string, otp: string) {
    // Switch to phone mode
    await this.phoneModeSwitchButton.click();

    // Enter phone number and request OTP
    await this.phoneInput.fill(phone);
    await this.sendOtpButton.click();

    // Wait for OTP mode
    await this.otpInput.waitFor({ state: 'visible' });

    // Enter OTP and verify
    await this.otpInput.fill(otp);
    await this.verifyOtpButton.click();

    // Wait for navigation
    await this.page.waitForURL(/\/(profile|login)/, { timeout: 10000 });
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
}
