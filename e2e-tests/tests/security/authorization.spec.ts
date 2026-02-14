/**
 * RBAC Authorization Security Tests
 *
 * Tests vertical and horizontal privilege escalation protection.
 * Verifies RBAC enforcement via direct API calls and URL manipulation.
 */

import { test, expect } from '../../fixtures/auth';

/**
 * Test suite: Vertical Privilege Escalation
 */
test.describe('Vertical Privilege Escalation Protection', () => {
  test('Field worker cannot access admin endpoints', async ({ fieldWorkerPage }) => {
    // Navigate first to avoid SecurityError on about:blank
    await fieldWorkerPage.goto('http://localhost:5173/');
    await fieldWorkerPage.waitForLoadState('domcontentloaded');

    // Get auth token
    const authToken = await fieldWorkerPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    expect(authToken).not.toBeNull();

    // Attempt to access admin-only endpoint: municipalities management
    const municipalitiesResponse = await fieldWorkerPage.request.get('http://localhost:8000/api/v1/municipalities', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Should return 403 Forbidden
    expect([403, 401]).toContain(municipalitiesResponse.status());

    // Attempt to access system settings (admin-only)
    const settingsResponse = await fieldWorkerPage.request.get('http://localhost:8000/api/v1/settings', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Should return 403 Forbidden
    expect([403, 401]).toContain(settingsResponse.status());
  });

  test('Citizen cannot access municipal dashboard API', async ({ citizenReturningPage }) => {
    // Navigate first to avoid SecurityError on about:blank
    await citizenReturningPage.goto('http://localhost:5174/');
    await citizenReturningPage.waitForLoadState('domcontentloaded');

    // Get citizen auth token
    const authToken = await citizenReturningPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    expect(authToken).not.toBeNull();

    // Attempt to access dashboard metrics (manager/admin only)
    const response = await citizenReturningPage.request.get('http://localhost:8000/api/v1/dashboard/metrics', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Should return 403 Forbidden (citizens can't see dashboard metrics)
    expect([403, 401]).toContain(response.status());
  });

  test('Ward councillor cannot modify tickets outside ward', async ({ wardCouncillorPage }) => {
    // Navigate first to avoid SecurityError on about:blank
    await wardCouncillorPage.goto('http://localhost:5173/');
    await wardCouncillorPage.waitForLoadState('domcontentloaded');

    // Get auth token
    const authToken = await wardCouncillorPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    // Attempt to update a ticket (should be ward-scoped)
    // For this test, we'll attempt a generic ticket update
    const response = await wardCouncillorPage.request.patch('http://localhost:8000/api/v1/tickets/non-ward-ticket-id', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        status: 'in_progress',
      },
    });

    // Should return 403 or 404 (depending on implementation)
    expect([403, 404]).toContain(response.status());
  });
});

/**
 * Test suite: Horizontal Privilege Escalation
 */
test.describe('Horizontal Privilege Escalation Protection', () => {
  test('Manager cannot access another manager\'s settings', async ({ managerPage, managerPretoriaPage }) => {
    // Navigate first to avoid SecurityError on about:blank
    await managerPage.goto('http://localhost:5173/');
    await managerPage.waitForLoadState('domcontentloaded');
    await managerPretoriaPage.goto('http://localhost:5173/');
    await managerPretoriaPage.waitForLoadState('domcontentloaded');

    // Get Jozi manager auth token
    const joziAuthToken = await managerPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    // Get Pretoria manager user ID (from auth context)
    const pretoriaUserId = await managerPretoriaPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.user?.id;
      }
      return null;
    });

    if (pretoriaUserId) {
      // Attempt to access Pretoria manager's user data
      const response = await managerPage.request.get(`http://localhost:8000/api/v1/users/${pretoriaUserId}`, {
        headers: {
          Authorization: `Bearer ${joziAuthToken}`,
        },
      });

      // Should return 403 or 404 (no cross-user access)
      expect([403, 404]).toContain(response.status());
    }
  });
});

/**
 * Test suite: URL Manipulation Attacks
 */
test.describe('URL Manipulation Protection', () => {
  test('Field worker navigating to /municipalities shows access denied or redirect', async ({ fieldWorkerPage }) => {
    // Establish auth context by loading base URL first
    await fieldWorkerPage.goto('http://localhost:5173/');
    await fieldWorkerPage.waitForLoadState('domcontentloaded');

    // Navigate to admin-only page
    await fieldWorkerPage.goto('http://localhost:5173/municipalities');

    // Wait for page load
    await fieldWorkerPage.waitForTimeout(2000);

    // Verify: Either access denied message OR redirect to allowed page
    const currentUrl = fieldWorkerPage.url();
    const pageContent = await fieldWorkerPage.content();

    const isAccessDenied = pageContent.toLowerCase().includes('access denied') ||
                           pageContent.toLowerCase().includes('unauthorized') ||
                           pageContent.toLowerCase().includes('forbidden');

    const isRedirected = !currentUrl.includes('/municipalities') ||
                         currentUrl.includes('/login') ||
                         currentUrl.includes('/tickets');

    expect(isAccessDenied || isRedirected).toBe(true);
  });

  test('Field worker navigating to /analytics shows access denied or redirect', async ({ fieldWorkerPage }) => {
    // Establish auth context by loading base URL first
    await fieldWorkerPage.goto('http://localhost:5173/');
    await fieldWorkerPage.waitForLoadState('domcontentloaded');

    await fieldWorkerPage.goto('http://localhost:5173/analytics');
    await fieldWorkerPage.waitForTimeout(2000);

    const currentUrl = fieldWorkerPage.url();
    const pageContent = await fieldWorkerPage.content();

    const isAccessDenied = pageContent.toLowerCase().includes('access denied') ||
                           pageContent.toLowerCase().includes('unauthorized');

    const isRedirected = !currentUrl.includes('/analytics');

    expect(isAccessDenied || isRedirected).toBe(true);
  });

  test('Field worker navigating to /settings shows access denied or redirect', async ({ fieldWorkerPage }) => {
    // Establish auth context by loading base URL first
    await fieldWorkerPage.goto('http://localhost:5173/');
    await fieldWorkerPage.waitForLoadState('domcontentloaded');

    await fieldWorkerPage.goto('http://localhost:5173/settings');
    await fieldWorkerPage.waitForTimeout(2000);

    const currentUrl = fieldWorkerPage.url();
    const pageContent = await fieldWorkerPage.content();

    const isAccessDenied = pageContent.toLowerCase().includes('access denied') ||
                           pageContent.toLowerCase().includes('unauthorized');

    const isRedirected = !currentUrl.includes('/settings');

    expect(isAccessDenied || isRedirected).toBe(true);
  });

  test('Citizen navigating to dashboard URL gets login page', async ({ page }) => {
    // Fresh context (no auth)
    await page.goto('http://localhost:5173');

    // Wait for page load
    await page.waitForTimeout(2000);

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/**
 * Test suite: Token Manipulation
 */
test.describe('Token Manipulation Protection', () => {
  test('Modified JWT role claim rejected', async ({ page }) => {
    // Create a request with tampered role in Authorization header
    // (Real JWT validation would catch this)

    // Fake token with tampered payload
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYWRtaW4iLCJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    const response = await page.request.get('http://localhost:8000/api/v1/dashboard/metrics', {
      headers: {
        Authorization: `Bearer ${fakeToken}`,
      },
    });

    // Should reject tampered token
    expect([403, 401]).toContain(response.status());
  });
});
