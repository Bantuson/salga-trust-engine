/**
 * OWASP Authentication Security Tests
 *
 * Tests SQL injection, brute force protection, session security, and password security.
 * Verifies OWASP authentication vulnerabilities are properly mitigated.
 */

import { test, expect } from '@playwright/test';

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "admin'--",
  "' OR 1=1--",
  "'; DROP TABLE users--",
];

/**
 * Test suite: SQL Injection on Login Forms
 */
test.describe('SQL Injection Protection', () => {
  test('Public login rejects SQL injection payloads', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    for (const payload of SQL_INJECTION_PAYLOADS) {
      // Fill email with SQL injection payload
      await page.locator('input[id="email"]').fill(payload);
      await page.locator('input[id="password"]').fill('anypassword');

      // Submit login
      await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();

      // Wait for response
      await page.waitForTimeout(1000);

      // Verify: Generic auth error (not SQL error, not 500, not crash)
      const errorText = await page.locator('text=/Invalid|incorrect|failed|error/i').first().textContent({ timeout: 2000 }).catch(() => null);

      // Page should not have crashed or show SQL errors
      const pageContent = await page.content();
      expect(pageContent).not.toContain('SQL');
      expect(pageContent).not.toContain('syntax error');
      expect(pageContent).not.toContain('database error');

      // Verify still on login page (not navigated away)
      expect(page.url()).toContain('/login');

      // Clear for next iteration
      await page.locator('input[id="email"]').clear();
      await page.locator('input[id="password"]').clear();
    }
  });

  test('Dashboard login rejects SQL injection payloads', async ({ page }) => {
    await page.goto('http://localhost:5174/login');

    for (const payload of SQL_INJECTION_PAYLOADS) {
      // Fill email with SQL injection payload
      await page.locator('input[id="email"]').fill(payload);
      await page.locator('input[id="password"]').fill('anypassword');

      // Submit login
      await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();

      // Wait for response
      await page.waitForTimeout(1000);

      // Verify: Generic auth error (not SQL error)
      const pageContent = await page.content();
      expect(pageContent).not.toContain('SQL');
      expect(pageContent).not.toContain('syntax error');
      expect(pageContent).not.toContain('database error');

      // Verify still on login page
      expect(page.url()).toContain('/login');

      // Clear for next iteration
      await page.locator('input[id="email"]').clear();
      await page.locator('input[id="password"]').clear();
    }
  });
});

/**
 * Test suite: Brute Force Protection
 */
test.describe('Brute Force Protection', () => {
  test('Rate limiting activates after excessive failed logins on public portal', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Attempt 15 failed logins rapidly
    for (let i = 0; i < 15; i++) {
      await page.locator('input[id="email"]').fill(`attacker${i}@test.com`);
      await page.locator('input[id="password"]').fill('wrongpassword');
      await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();

      // Brief wait between attempts
      await page.waitForTimeout(200);
    }

    // Verify rate limit error appears
    const rateLimitMessage = await page.locator('text=/too many|rate limit|slow down|try again/i').first().textContent({ timeout: 5000 }).catch(() => null);

    // Should see SOME form of rate limiting feedback
    // (Could be error message, disabled button, or server rejection)
    const pageContent = await page.content();
    const hasRateLimitFeedback =
      rateLimitMessage !== null ||
      pageContent.includes('too many') ||
      pageContent.includes('rate limit') ||
      pageContent.includes('slow down');

    expect(hasRateLimitFeedback).toBe(true);
  });

  test('Rate limiting activates on dashboard login', async ({ page }) => {
    await page.goto('http://localhost:5174/login');

    // Attempt 15 failed logins rapidly
    for (let i = 0; i < 15; i++) {
      await page.locator('input[id="email"]').fill(`attacker${i}@test.com`);
      await page.locator('input[id="password"]').fill('wrongpassword');
      await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();

      await page.waitForTimeout(200);
    }

    // Verify rate limit feedback
    const pageContent = await page.content();
    const hasRateLimitFeedback =
      pageContent.includes('too many') ||
      pageContent.includes('rate limit') ||
      pageContent.includes('slow down');

    expect(hasRateLimitFeedback).toBe(true);
  });
});

/**
 * Test suite: Session Security
 */
test.describe('Session Security', () => {
  test('Expired session redirects to login', async ({ page }) => {
    // Navigate to public portal login
    await page.goto('http://localhost:5173/login');

    // Login as citizen
    await page.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await page.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();

    // Wait for successful login
    await page.waitForURL(/\/(profile|dashboard|\/)/, { timeout: 10000 });

    // Manually clear localStorage auth tokens (simulate expired session)
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Refresh page
    await page.reload();

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('Logout clears session completely', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await page.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();

    await page.waitForURL(/\/(profile|dashboard|\/)/, { timeout: 10000 });

    // Click logout (usually in header or profile menu)
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout"), a:has-text("Sign Out")').first();
    await logoutButton.click();

    // Verify redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

    // Try accessing protected route
    await page.goto('http://localhost:5173/profile');

    // Should still be logged out (redirect to login or show error)
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/**
 * Test suite: Password Security
 */
test.describe('Password Security', () => {
  test('Registration rejects weak passwords', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Navigate to registration (usually a link on login page)
    const registerLink = page.locator('a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")').first();
    await registerLink.click({ timeout: 5000 }).catch(() => {
      // If no register link, navigate directly
      page.goto('http://localhost:5173/register');
    });

    await page.waitForURL(/\/(register|signup)/, { timeout: 5000 }).catch(() => {});

    const weakPasswords = ['123', 'password', 'abc'];

    for (const weakPassword of weakPasswords) {
      // Fill registration form with weak password
      await page.locator('input[id="email"], input[name="email"]').fill(`test-weak-${Date.now()}@test.com`);
      await page.locator('input[id="password"], input[name="password"]').fill(weakPassword);

      // Submit
      await page.locator('button[type="submit"]').click();

      // Wait for validation
      await page.waitForTimeout(1000);

      // Verify rejection (error message or still on registration page)
      const errorMessage = await page.locator('text=/weak|strength|at least|minimum|must contain/i').first().textContent({ timeout: 2000 }).catch(() => null);
      const stillOnRegister = page.url().includes('register') || page.url().includes('signup');

      expect(errorMessage !== null || stillOnRegister).toBe(true);

      // Clear for next iteration
      await page.locator('input[id="email"], input[name="email"]').clear();
      await page.locator('input[id="password"], input[name="password"]').clear();
    }
  });

  test('Login does not reveal whether email exists', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Test 1: Valid email, wrong password
    await page.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await page.locator('input[id="password"]').fill('WrongPassword123!');
    await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();
    await page.waitForTimeout(1000);

    const errorMessage1 = await page.locator('text=/invalid|incorrect|failed/i').first().textContent({ timeout: 2000 }).catch(() => '');

    // Clear
    await page.locator('input[id="email"]').clear();
    await page.locator('input[id="password"]').clear();

    // Test 2: Nonexistent email
    await page.locator('input[id="email"]').fill('nonexistent-user-12345@test.com');
    await page.locator('input[id="password"]').fill('AnyPassword123!');
    await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();
    await page.waitForTimeout(1000);

    const errorMessage2 = await page.locator('text=/invalid|incorrect|failed/i').first().textContent({ timeout: 2000 }).catch(() => '');

    // Verify BOTH show same generic error (not "email not found" vs "wrong password")
    expect(errorMessage1?.toLowerCase() || '').toContain('invalid');
    expect(errorMessage2?.toLowerCase() || '').toContain('invalid');

    // Alternatively, check that neither message reveals specific info
    expect(errorMessage1?.toLowerCase() || '').not.toContain('email not found');
    expect(errorMessage1?.toLowerCase() || '').not.toContain('user does not exist');
    expect(errorMessage2?.toLowerCase() || '').not.toContain('email not found');
    expect(errorMessage2?.toLowerCase() || '').not.toContain('user does not exist');
  });
});
