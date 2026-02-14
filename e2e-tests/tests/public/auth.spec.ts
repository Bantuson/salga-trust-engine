/**
 * Public Dashboard - Authentication E2E Tests
 *
 * Tests citizen authentication flows:
 * - Registration (new accounts, validation, existing email)
 * - Login (email+password, phone OTP tab visibility)
 * - Session protection (auth gates on protected routes)
 *
 * Uses LoginPage and RegisterPage page objects.
 * Uses generateCitizenData for unique test data per run.
 */

import { test, expect } from '../../fixtures/auth';
import { LoginPage } from '../../fixtures/page-objects/public/LoginPage';
import { RegisterPage } from '../../fixtures/page-objects/public/RegisterPage';
import { ProfilePage } from '../../fixtures/page-objects/public/ProfilePage';
import { generateCitizenData } from '../../fixtures/test-data';

test.describe('Citizen Registration', () => {
  test('New citizen can register with email and password', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const citizenData = generateCitizenData();

    await registerPage.goto();

    // Use the existing register helper method
    await registerPage.register({
      fullName: `${citizenData.firstName} ${citizenData.lastName}`,
      email: citizenData.email,
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
    });

    // Verify success message or redirect
    await expect(page).toHaveURL(/\/(login|profile|register)/, { timeout: 10000 });

    // Check for success indication
    const isSuccess = await registerPage.isSuccessShown();
    const onLoginPage = page.url().includes('/login');

    // Either success message shown or redirected to login
    expect(isSuccess || onLoginPage).toBeTruthy();
  });

  test('Registration shows error for existing email', async ({ page }) => {
    const registerPage = new RegisterPage(page);

    await registerPage.goto();

    // Use email from existing citizen profile
    const existingEmail = 'citizen-returning@test-jozi-001.test';

    // Try to register with existing email using helper method
    await registerPage.fullNameInput.fill('Test User');
    await registerPage.emailInput.fill(existingEmail);
    await registerPage.passwordInput.fill('SecurePass123!');
    await registerPage.confirmPasswordInput.fill('SecurePass123!');
    await registerPage.submitButton.click();

    // Wait for error or success (should be error)
    await page.waitForTimeout(2000);

    // Verify error message appears
    await expect(registerPage.errorMessage).toBeVisible({ timeout: 5000 });

    // Check error text mentions email exists
    const errorText = await registerPage.errorMessage.textContent();
    expect(errorText?.toLowerCase()).toMatch(/email|already|exists|registered/);
  });

  test('Registration validates password requirements', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const citizenData = generateCitizenData();

    await registerPage.goto();

    await registerPage.fullNameInput.fill(`${citizenData.firstName} ${citizenData.lastName}`);
    await registerPage.emailInput.fill(citizenData.email);

    // Try short password (less than 8 chars)
    await registerPage.passwordInput.fill('Short1!');
    await registerPage.confirmPasswordInput.fill('Short1!');

    await registerPage.submitButton.click();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify validation error appears
    const validationError = page.locator('text=/password.*at least.*8|minimum.*8.*character/i').first();
    await expect(validationError).toBeVisible({ timeout: 3000 });
  });

  test('Registration validates matching passwords', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const citizenData = generateCitizenData();

    await registerPage.goto();

    await registerPage.fullNameInput.fill(`${citizenData.firstName} ${citizenData.lastName}`);
    await registerPage.emailInput.fill(citizenData.email);
    await registerPage.passwordInput.fill('SecurePass123!');
    await registerPage.confirmPasswordInput.fill('DifferentPass456!');

    await registerPage.submitButton.click();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Verify password mismatch error
    const errorMessage = page.locator('text=/password.*not match|passwords.*different/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Citizen Login', () => {
  test('Citizen can log in with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    // Login with citizen-returning profile credentials
    await loginPage.loginWithEmail(
      'citizen-returning@test-jozi-001.test',
      'TestPassword123!'
    );

    // Verify redirect to profile or dashboard
    await expect(page).toHaveURL(/\/(profile|dashboard)/, { timeout: 10000 });
  });

  test('Login shows error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    // Login with wrong password
    await loginPage.emailInput.fill('citizen-returning@test-jozi-001.test');
    await loginPage.passwordInput.fill('WrongPassword123!');
    await loginPage.emailSubmitButton.click();

    // Wait for error message
    await page.waitForTimeout(2000); // Give server time to respond

    // Verify error indication (still on login page or error message shown)
    const stillOnLogin = page.url().includes('/login');
    const errorVisible = await loginPage.errorMessage.isVisible().catch(() => false);

    expect(stillOnLogin || errorVisible).toBeTruthy();
  });

  test('Login shows error for non-existent user', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const fakeData = generateCitizenData();

    await loginPage.goto();

    // Try logging in with non-existent email
    await loginPage.emailInput.fill(fakeData.email);
    await loginPage.passwordInput.fill('SomePassword123!');
    await loginPage.emailSubmitButton.click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Verify still on login or error shown
    const stillOnLogin = page.url().includes('/login');
    const errorVisible = await loginPage.errorMessage.isVisible().catch(() => false);

    expect(stillOnLogin || errorVisible).toBeTruthy();
  });

  test('Phone OTP tab is accessible', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();

    // Click phone OTP switch button
    await loginPage.phoneModeSwitchButton.click();

    // Verify phone input is now visible
    await expect(loginPage.phoneInput).toBeVisible({ timeout: 3000 });

    // Verify Send OTP button is visible
    await expect(loginPage.sendOtpButton).toBeVisible();

    // Note: Can't complete OTP flow without real SMS, this is just a smoke test
  });
});

test.describe('Session Protection', () => {
  test('Authenticated citizen can access /profile', async ({ citizenReturningPage }) => {
    const profilePage = new ProfilePage(citizenReturningPage);

    // Navigate to profile
    await profilePage.goto();

    // Verify profile content loads
    await expect(profilePage.emailInput).toBeVisible({ timeout: 5000 });

    // Verify we're on profile page
    await expect(citizenReturningPage).toHaveURL(/\/profile/, { timeout: 5000 });
  });

  test('Unauthenticated user is redirected from /profile to /login', async ({ page }) => {
    // Fresh page context with no auth

    // Try to access protected route
    await page.goto('/profile');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('Unauthenticated user is redirected from /report to /login', async ({ page }) => {
    // Fresh page context with no auth

    // Try to access report page
    await page.goto('/report');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
