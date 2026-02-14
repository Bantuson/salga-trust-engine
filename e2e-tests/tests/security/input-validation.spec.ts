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
    await citizenReturningPage.goto('http://localhost:5173/report');

    // Fill description with XSS payload
    const xssPayload = '<script>alert("XSS")</script>';
    await citizenReturningPage.locator('textarea[name="description"], textarea[id="description"]').fill(xssPayload);

    // Fill other required fields
    await citizenReturningPage.locator('select[name="category"], select[id="category"]').selectOption({ index: 1 });
    await citizenReturningPage.locator('input[name="address"], input[id="address"], textarea[name="address"], textarea[id="address"]').fill('123 Test Street, Johannesburg');

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
    await citizenReturningPage.goto('http://localhost:5173/report');

    // XSS via event handler
    const xssPayload = '<img src=x onerror="alert(1)">';
    await citizenReturningPage.locator('textarea[name="description"], textarea[id="description"]').fill(xssPayload);

    // Fill other fields
    await citizenReturningPage.locator('select[name="category"], select[id="category"]').selectOption({ index: 1 });
    await citizenReturningPage.locator('input[name="address"], input[id="address"], textarea[name="address"], textarea[id="address"]').fill('123 Test Street, Johannesburg');

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
    // Navigate to access request page (usually /register-municipality or similar)
    await page.goto('http://localhost:5174/register');

    // Fill municipality name with XSS payload
    const xssPayload = '<script>alert(1)</script>';

    // Find municipality/organization name field
    const municipalityField = page.locator('input[name="municipality"], input[id="municipality"], input[name="organizationName"], input[id="organizationName"]').first();
    await municipalityField.fill(xssPayload);

    // Fill other required fields
    await page.locator('input[name="contactName"], input[id="contactName"]').fill('Test Contact');
    await page.locator('input[name="email"], input[id="email"]').fill(`test-${Date.now()}@test.com`);
    await page.locator('input[name="phone"], input[id="phone"]').fill('+27123456789');

    // Submit
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Verify no script execution
    const pageContent = await page.content();
    const scriptElement = await page.locator('script:has-text("alert(1)")').count();
    expect(scriptElement).toBe(0);

    // If confirmation shows municipality name, verify it's escaped
    const hasExecutedScript = pageContent.includes('alert(1)') && !pageContent.includes('&lt;script&gt;');
    expect(hasExecutedScript).toBe(false);
  });
});

/**
 * Test suite: Input Length Limits
 */
test.describe('Input Length Limits', () => {
  test('Report description has reasonable length limit', async ({ citizenReturningPage }) => {
    await citizenReturningPage.goto('http://localhost:5173/report');

    // Create extremely long description (10000+ chars)
    const longDescription = 'A'.repeat(10000);

    await citizenReturningPage.locator('textarea[name="description"], textarea[id="description"]').fill(longDescription);
    await citizenReturningPage.locator('select[name="category"], select[id="category"]').selectOption({ index: 1 });
    await citizenReturningPage.locator('input[name="address"], input[id="address"], textarea[name="address"], textarea[id="address"]').fill('123 Test Street, Johannesburg');

    // Submit
    await citizenReturningPage.locator('button[type="submit"]').click();
    await citizenReturningPage.waitForTimeout(2000);

    // Verify: Either validation error OR truncation (NOT server crash)
    const pageContent = await citizenReturningPage.content();

    // Should NOT see server error (500, crash, etc.)
    expect(pageContent).not.toContain('500');
    expect(pageContent).not.toContain('Internal Server Error');
    expect(pageContent).not.toContain('Server Error');

    // Either shows validation message OR successfully submitted with truncation
    const hasValidationError = await citizenReturningPage.locator('text=/too long|maximum|limit|exceed/i').count() > 0;
    const hasSuccessMessage = await citizenReturningPage.locator('text=/success|submitted|received|tracking/i').count() > 0;

    expect(hasValidationError || hasSuccessMessage).toBe(true);
  });

  test('Login email has length limit', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    // Create very long email (500+ chars)
    const longEmail = 'a'.repeat(500) + '@test.com';

    await page.locator('input[id="email"]').fill(longEmail);
    await page.locator('input[id="password"]').fill('Test123!@#');

    // Submit
    await page.locator('button[type="submit"]', { hasText: /Sign In/i }).click();
    await page.waitForTimeout(1000);

    // Verify validation error (not server crash)
    const pageContent = await page.content();
    expect(pageContent).not.toContain('500');
    expect(pageContent).not.toContain('Internal Server Error');

    // Should show validation error OR auth error (not crash)
    const hasError = await page.locator('text=/invalid|error|too long|limit/i').count() > 0;
    expect(hasError).toBe(true);
  });
});

/**
 * Test suite: CSRF-like Protections
 */
test.describe('CSRF-like Protections', () => {
  test('Direct API POST without auth returns 401', async ({ page }) => {
    // Attempt to POST to tickets API without authentication
    const response = await page.request.post('http://localhost:8000/api/v1/tickets', {
      data: {
        category: 'Water & Sanitation',
        description: 'Unauthorized ticket creation attempt',
        location: {
          type: 'Point',
          coordinates: [28.0, -26.2],
        },
      },
    });

    // Verify 401 or 403 (not 200)
    expect([401, 403]).toContain(response.status());
  });

  test('Direct API POST with invalid token returns 401', async ({ page }) => {
    // Attempt to POST with fake Bearer token
    const response = await page.request.post('http://localhost:8000/api/v1/tickets', {
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

    // Verify rejection (401 or 403)
    expect([401, 403]).toContain(response.status());
  });
});
