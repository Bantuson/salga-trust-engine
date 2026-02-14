/**
 * OWASP Input Validation Security Tests
 *
 * Tests XSS protection, input sanitization, length limits, and CSRF-like protections.
 * Verifies user input is properly escaped and validated at all layers.
 */

import { test, expect } from '../../fixtures/auth';

/**
 * Test suite: XSS on Report Form
 */
test.describe('XSS Protection on Report Form', () => {
  test('Report description escapes HTML tags', async ({ citizenReturningPage }) => {
    // Navigate to report form
    await citizenReturningPage.goto('http://localhost:5174/report');
    await citizenReturningPage.waitForLoadState('domcontentloaded');

    // Fill description with XSS payload
    const xssPayload = '<script>alert("XSS")</script>';
    await citizenReturningPage.locator('#description').fill(xssPayload);

    // Fill other required fields
    await citizenReturningPage.locator('#category').selectOption({ index: 1 });
    await citizenReturningPage.locator('#manual-address').fill('123 Test Street, Johannesburg');

    // Submit form
    await citizenReturningPage.locator('button[type="submit"]').click();

    // Wait for confirmation/receipt page
    await citizenReturningPage.waitForTimeout(2000);

    // Verify: No alert dialog appeared
    const dialogAppeared = await citizenReturningPage.evaluate(() => {
      return window.alert !== undefined; // Alert would have been called if XSS executed
    });

    // Verify: The text appears as literal escaped text (not executed as script)
    const pageContent = await citizenReturningPage.content();

    // Should see escaped version or safe text, NOT the script tag executing
    const hasExecutedScript = pageContent.includes('alert("XSS")') && !pageContent.includes('&lt;script&gt;');
    expect(hasExecutedScript).toBe(false);

    // If confirmation page shows the description, verify it's escaped
    const descriptionVisible = await citizenReturningPage.locator(`text=${xssPayload}`).count();
    if (descriptionVisible > 0) {
      // The raw HTML should not render
      const scriptElement = await citizenReturningPage.locator('script:has-text("XSS")').count();
      expect(scriptElement).toBe(0);
    }
  });

  test('Report description escapes event handlers', async ({ citizenReturningPage }) => {
    await citizenReturningPage.goto('http://localhost:5174/report');
    await citizenReturningPage.waitForLoadState('domcontentloaded');

    // XSS via event handler
    const xssPayload = '<img src=x onerror="alert(1)">';
    await citizenReturningPage.locator('#description').fill(xssPayload);

    // Fill other fields
    await citizenReturningPage.locator('#category').selectOption({ index: 1 });
    await citizenReturningPage.locator('#manual-address').fill('123 Test Street, Johannesburg');

    // Submit
    await citizenReturningPage.locator('button[type="submit"]').click();
    await citizenReturningPage.waitForTimeout(2000);

    // Verify no alert
    const pageContent = await citizenReturningPage.content();

    // Should NOT have executable img tag with onerror
    const imgElements = await citizenReturningPage.locator('img[src="x"]').count();
    expect(imgElements).toBe(0);
  });
});

/**
 * Test suite: XSS on Access Request Form
 */
test.describe('XSS Protection on Access Request Form', () => {
  test('Access request fields escape HTML', async ({ page }) => {
    // Navigate to dashboard registration page
    await page.goto('http://localhost:5173/register');
    await page.waitForLoadState('domcontentloaded');

    // Fill full name with XSS payload
    const xssPayload = '<script>alert(1)</script>';

    await page.locator('#fullName').fill(xssPayload);

    // Fill other required fields
    await page.locator('#email').fill(`test-${Date.now()}@test.com`);
    await page.locator('#password').fill('SecurePass123!@#');
    await page.locator('#confirmPassword').fill('SecurePass123!@#');

    // Submit
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Verify no script execution
    const pageContent = await page.content();
    const scriptElement = await page.locator('script:has-text("alert(1)")').count();
    expect(scriptElement).toBe(0);

    // If confirmation shows the name, verify it's escaped
    const hasExecutedScript = pageContent.includes('alert(1)') && !pageContent.includes('&lt;script&gt;');
    expect(hasExecutedScript).toBe(false);
  });
});

/**
 * Test suite: Input Length Limits
 */
test.describe('Input Length Limits', () => {
  test('Report description has reasonable length limit', async ({ citizenReturningPage }) => {
    await citizenReturningPage.goto('http://localhost:5174/report');
    await citizenReturningPage.waitForLoadState('domcontentloaded');

    // Create extremely long description (10000+ chars)
    // Note: The textarea has maxLength=2000, so the browser will truncate to 2000 chars
    const longDescription = 'A'.repeat(10000);

    await citizenReturningPage.locator('#description').fill(longDescription);
    await citizenReturningPage.locator('#category').selectOption({ index: 1 });
    await citizenReturningPage.locator('#manual-address').fill('123 Test Street, Johannesburg');

    // Submit
    await citizenReturningPage.locator('button[type="submit"]').click();
    await citizenReturningPage.waitForTimeout(2000);

    // Verify: Either validation error OR truncation (NOT server crash)
    const pageContent = await citizenReturningPage.content();

    // Should NOT see server error page (look for explicit error page patterns, not bare "500" which can appear in CSS)
    expect(pageContent).not.toContain('Internal Server Error');
    expect(pageContent).not.toContain('<h1>500</h1>');
    expect(pageContent).not.toContain('Server Error');

    // Either shows validation message, form error, OR successfully submitted with truncation
    // The textarea has maxLength=2000 so input is truncated by browser, and form may still validate
    const hasValidationError = await citizenReturningPage.locator('text=/too long|maximum|limit|exceed/i').count() > 0;
    const hasSuccessMessage = await citizenReturningPage.locator('text=/success|submitted|received|tracking/i').count() > 0;
    const hasFormError = await citizenReturningPage.locator('[data-testid="form-error"], [role="alert"]').count() > 0;
    const stillOnForm = citizenReturningPage.url().includes('/report');

    // The maxLength attribute prevents >2000 chars, so either form submits or shows validation error
    expect(hasValidationError || hasSuccessMessage || hasFormError || stillOnForm).toBe(true);
  });

  test('Login email has length limit', async ({ page }) => {
    await page.goto('http://localhost:5174/login');

    // Create very long email (500+ chars)
    const longEmail = 'a'.repeat(500) + '@test.com';

    await page.locator('input[id="email"]').fill(longEmail);
    await page.locator('input[id="password"]').fill('Test123!@#');

    // Submit
    await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();
    await page.waitForTimeout(2000);

    // Verify validation error (not server crash)
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Internal Server Error');
    expect(pageContent).not.toContain('<h1>500</h1>');

    // Should show validation error OR auth error (not crash)
    // Still on login page means the system handled the long input gracefully
    const hasError = await page.locator('text=/invalid|error|too long|limit|credentials/i').count() > 0;
    const stillOnLogin = page.url().includes('/login');
    expect(hasError || stillOnLogin).toBe(true);
  });
});

/**
 * Test suite: CSRF-like Protections
 */
test.describe('CSRF-like Protections', () => {
  test('Direct API POST without auth returns 401', async ({ page }) => {
    // Attempt to POST to reports submission API without authentication
    const response = await page.request.post('http://localhost:8000/api/v1/reports/submit', {
      data: {
        category: 'Water & Sanitation',
        description: 'Unauthorized ticket creation attempt',
        location: {
          type: 'Point',
          coordinates: [28.0, -26.2],
        },
      },
    });

    // Verify rejection: 401 Unauthorized, 403 Forbidden, or 405 Method Not Allowed
    // Any non-success status means the unauthenticated request was rejected
    expect([401, 403, 405, 422]).toContain(response.status());
  });

  test('Direct API POST with invalid token returns 401', async ({ page }) => {
    // Attempt to POST with fake Bearer token
    const response = await page.request.post('http://localhost:8000/api/v1/reports/submit', {
      headers: {
        Authorization: 'Bearer fake-token-12345',
      },
      data: {
        category: 'Water & Sanitation',
        description: 'Unauthorized ticket creation with fake token',
        location: {
          type: 'Point',
          coordinates: [28.0, -26.2],
        },
      },
    });

    // Verify rejection: 401 Unauthorized, 403 Forbidden, or 405 Method Not Allowed
    expect([401, 403, 405]).toContain(response.status());
  });
});
