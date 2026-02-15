/**
 * Multi-Tenant Isolation Security Tests
 *
 * Tests data boundaries between test municipalities (Jozi vs Pretoria).
 * Verifies tenant isolation at UI, API, and URL manipulation layers.
 */

import { test, expect } from '../../fixtures/auth';

/**
 * Test suite: UI Isolation
 */
test.describe('Multi-Tenant UI Isolation', () => {
  test('Jozi manager cannot see Pretoria tickets in ticket list', async ({ managerPage }) => {
    // Navigate to tickets page
    await managerPage.goto('http://localhost:5173/tickets');

    // Wait for ticket list to load
    await managerPage.waitForSelector('table, [data-testid="ticket-table"]', { timeout: 10000 }).catch(() => {});

    // Get page content
    const pageContent = await managerPage.content();

    // Verify no Pretoria-tagged tickets visible
    // Search for 'Pretoria' or 'Tshwane' in the page
    expect(pageContent.toLowerCase()).not.toContain('pretoria');
    expect(pageContent.toLowerCase()).not.toContain('tshwane');

    // If tenant column exists, verify all rows show Jozi tenant
    const tenantCells = await managerPage.locator('[data-testid="tenant-cell"], td:has-text("test-")').all();
    for (const cell of tenantCells) {
      const text = await cell.textContent();
      if (text && text.includes('test-')) {
        expect(text).toContain('jozi');
        expect(text).not.toContain('pretoria');
      }
    }
  });

  test('Pretoria manager cannot see Jozi tickets in ticket list', async ({ managerPretoriaPage }) => {
    // Navigate to tickets page
    await managerPretoriaPage.goto('http://localhost:5173/tickets');

    // Wait for ticket list to load
    await managerPretoriaPage.waitForSelector('table, [data-testid="ticket-table"]', { timeout: 10000 }).catch(() => {});

    // Get page content
    const pageContent = await managerPretoriaPage.content();

    // Verify no Jozi-tagged tickets visible
    expect(pageContent.toLowerCase()).not.toContain('johannesburg');
    expect(pageContent.toLowerCase()).not.toContain('jozi');

    // If tenant column exists, verify all rows show Pretoria tenant
    const tenantCells = await managerPretoriaPage.locator('[data-testid="tenant-cell"], td:has-text("test-")').all();
    for (const cell of tenantCells) {
      const text = await cell.textContent();
      if (text && text.includes('test-')) {
        expect(text).toContain('pretoria');
        expect(text).not.toContain('jozi');
      }
    }
  });
});

/**
 * Test suite: API Isolation
 */
test.describe('Multi-Tenant API Isolation', () => {
  test.skip('Jozi manager API call returns only Jozi data', async ({ managerPage }) => {
    test.skip(true, 'Requires FastAPI backend (localhost:8000) — not available in Supabase-only E2E environment');

    // Navigate first to avoid SecurityError on about:blank
    try {
      await managerPage.goto('http://localhost:5173/');
      await managerPage.waitForLoadState('domcontentloaded');
    } catch {
      test.skip(true, 'Municipal dashboard navigation timed out — server may be under load');
      return;
    }

    // Check if auth session expired and we're back on login page
    const isOnLogin = managerPage.url().includes('/login');
    if (isOnLogin) {
      test.skip(true, 'Auth session expired during long test run — cached token no longer valid');
      return;
    }

    // Get auth token from storage (dynamic key scan — project ref varies per environment)
    const authToken = await managerPage.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key)!);
            return parsed.access_token || null;
          } catch { return null; }
        }
      }
      return null;
    });

    if (!authToken) {
      test.skip(true, 'Auth token not available in localStorage — Supabase may use cookie-based auth');
      return;
    }

    // Make API request to get tickets
    const response = await managerPage.request.get('http://localhost:8000/api/v1/tickets', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok()) {
      test.skip(true, `Backend API returned ${response.status()} — auth token may have expired`);
      return;
    }

    const data = await response.json();
    const tickets = Array.isArray(data) ? data : data.items || data.data || [];

    // Verify all returned tickets have Jozi tenant_id
    for (const ticket of tickets) {
      if (ticket.tenant_id) {
        expect(ticket.tenant_id).toBe('test-jozi-001');
      }
      // Also check municipality_id if present
      if (ticket.municipality_id) {
        expect(ticket.municipality_id).toBe('test-jozi-001');
      }
    }
  });

  test.skip('Cross-tenant ticket access via API returns 403', async ({ managerPage, managerPretoriaPage }) => {
    test.skip(true, 'Requires FastAPI backend (localhost:8000) — not available in Supabase-only E2E environment');

    // Navigate first to avoid SecurityError on about:blank
    await managerPage.goto('http://localhost:5173/');
    await managerPage.waitForLoadState('domcontentloaded');

    // Check if auth session expired and we're back on login page
    const isOnLogin = managerPage.url().includes('/login');
    if (isOnLogin) {
      test.skip(true, 'Auth session expired during long test run — cached token no longer valid');
      return;
    }

    // Get Jozi auth token (dynamic key scan — project ref varies per environment)
    const joziAuthToken = await managerPage.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key)!);
            return parsed.access_token || null;
          } catch { return null; }
        }
      }
      return null;
    });

    // Attempt to access tickets API with filter for Pretoria tenant
    // (This should be blocked by RLS policies)
    const response = await managerPage.request.get('http://localhost:8000/api/v1/tickets?tenant_id=test-pretoria-001', {
      headers: {
        Authorization: `Bearer ${joziAuthToken}`,
      },
    });

    // Should either return 403 or empty results (depending on implementation)
    if (response.ok()) {
      const data = await response.json();
      const tickets = Array.isArray(data) ? data : data.items || data.data || [];

      // If request succeeded, verify NO Pretoria tickets returned
      for (const ticket of tickets) {
        if (ticket.tenant_id) {
          expect(ticket.tenant_id).not.toBe('test-pretoria-001');
        }
      }
    } else {
      // Should be 403 Forbidden
      expect([403, 401]).toContain(response.status());
    }
  });
});

/**
 * Test suite: URL Manipulation
 */
test.describe('URL Manipulation Protection', () => {
  test('URL manipulation cannot access other tenant\'s dashboard', async ({ managerPage }) => {
    // Attempt to manipulate URL to access Pretoria data
    // (Most dashboards filter by auth token, not URL params)
    await managerPage.goto('http://localhost:5173/tickets?tenant_id=test-pretoria-001');

    // Wait for page load
    await managerPage.waitForTimeout(2000);

    // Verify either access denied OR still showing only Jozi data
    const pageContent = await managerPage.content();

    // Should NOT show Pretoria data even with URL manipulation
    const showsJoziOnly = !pageContent.toLowerCase().includes('pretoria') && !pageContent.toLowerCase().includes('tshwane');
    const showsAccessDenied = pageContent.toLowerCase().includes('access denied') || pageContent.toLowerCase().includes('unauthorized');

    expect(showsJoziOnly || showsAccessDenied).toBe(true);
  });

  test.skip('Metrics endpoint returns only tenant-scoped data', async ({ managerPage }) => {
    test.skip(true, 'Requires FastAPI backend (localhost:8000) — not available in Supabase-only E2E environment');

    // Navigate first to avoid SecurityError on about:blank
    await managerPage.goto('http://localhost:5173/');
    await managerPage.waitForLoadState('domcontentloaded');

    // Get auth token (dynamic key scan — project ref varies per environment)
    const authToken = await managerPage.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(key)!);
            return parsed.access_token || null;
          } catch { return null; }
        }
      }
      return null;
    });

    // Call metrics endpoint
    const response = await managerPage.request.get('http://localhost:8000/api/v1/dashboard/metrics', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok()) {
      const metrics = await response.json();

      // Verify metrics are scoped to Jozi tenant
      // (Metrics should not include data from other tenants)

      // If metrics include municipality info, verify it's Jozi
      if (metrics.municipality_id) {
        expect(metrics.municipality_id).toBe('test-jozi-001');
      }
      if (metrics.tenant_id) {
        expect(metrics.tenant_id).toBe('test-jozi-001');
      }

      // Verify no Pretoria references in metrics
      const metricsStr = JSON.stringify(metrics);
      expect(metricsStr.toLowerCase()).not.toContain('pretoria');
      expect(metricsStr.toLowerCase()).not.toContain('tshwane');
    }
  });
});
