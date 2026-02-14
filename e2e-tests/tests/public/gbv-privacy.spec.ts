/**
 * GBV Privacy Firewall Security Tests (SEC-05)
 *
 * THE CRITICAL SECURITY TEST for SALGA Trust Engine.
 * Verifies GBV data is invisible to unauthorized roles at ALL layers:
 * - UI (ticket lists, dashboards)
 * - API (direct requests)
 * - URL manipulation
 * - Public transparency dashboard
 *
 * Tests BOTH negative (unauthorized CANNOT see) and positive (SAPS/admin CAN see).
 */

import { test, expect } from '../../fixtures/auth';

let gbvTrackingNumber: string | null = null;
let gbvTicketId: string | null = null;

/**
 * Setup: Submit GBV report and capture tracking number
 */
test.beforeAll(async ({ citizenGbvPage }) => {
  // Navigate to report form
  await citizenGbvPage.goto('http://localhost:5173/report');

  // Select GBV/Abuse category
  const categorySelect = citizenGbvPage.locator('select[name="category"], select[id="category"]');
  await categorySelect.selectOption('GBV/Abuse');

  // Fill description
  await citizenGbvPage.locator('textarea[name="description"], textarea[id="description"]').fill('Test GBV report for privacy testing - domestic violence incident');

  // Fill address
  await citizenGbvPage.locator('input[name="address"], input[id="address"], textarea[name="address"], textarea[id="address"]').fill('123 Privacy Test Street, Johannesburg');

  // Accept consent (if consent dialog appears)
  const consentCheckbox = citizenGbvPage.locator('input[type="checkbox"][name="gbvConsent"], input[type="checkbox"][id="gbvConsent"]').first();
  await consentCheckbox.check().catch(() => {});

  // Submit form
  await citizenGbvPage.locator('button[type="submit"]').click();

  // Wait for confirmation
  await citizenGbvPage.waitForTimeout(3000);

  // Extract tracking number from confirmation page
  const trackingNumberElement = await citizenGbvPage.locator('text=/TKT-[0-9]{8}-[a-f0-9]{6}/i').first().textContent({ timeout: 5000 }).catch(() => null);

  if (trackingNumberElement) {
    gbvTrackingNumber = trackingNumberElement.match(/TKT-[0-9]{8}-[a-f0-9]{6}/i)?.[0] || null;
    console.log(`[GBV Privacy Test] Created GBV report: ${gbvTrackingNumber}`);
  }
});

/**
 * Test suite: Negative Tests - Unauthorized Roles CANNOT See GBV
 */
test.describe('GBV Privacy Firewall - Manager CANNOT See', () => {
  test('Manager CANNOT see GBV report in ticket list UI', async ({ managerPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    // Navigate to tickets page
    await managerPage.goto('http://localhost:5174/tickets');
    await managerPage.waitForTimeout(2000);

    // Search for GBV tracking number
    const pageContent = await managerPage.content();

    // Verify tracking number NOT visible
    expect(pageContent).not.toContain(gbvTrackingNumber);

    // Verify no GBV category visible in filters or rows
    expect(pageContent.toLowerCase()).not.toContain('gbv/abuse');
    expect(pageContent.toLowerCase()).not.toContain('domestic violence');
  });

  test('Manager CANNOT access GBV report via direct API', async ({ managerPage }) => {
    // Get auth token
    const authToken = await managerPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    // Attempt to query GBV tickets via API
    const response = await managerPage.request.get('http://localhost:8000/api/v1/tickets?category=GBV/Abuse', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Should either return 403 or empty results
    if (response.ok()) {
      const data = await response.json();
      const tickets = Array.isArray(data) ? data : data.items || data.data || [];

      // Verify NO GBV tickets returned
      expect(tickets.length).toBe(0);
    } else {
      expect([403, 401]).toContain(response.status());
    }
  });

  test('Manager CANNOT access GBV report via URL', async ({ managerPage }) => {
    if (!gbvTicketId && !gbvTrackingNumber) {
      test.skip();
      return;
    }

    // Attempt to navigate to GBV ticket detail page
    // (Using tracking number as ID since we don't have internal ticket ID)
    await managerPage.goto(`http://localhost:5174/tickets/${gbvTrackingNumber || 'gbv-test'}`);
    await managerPage.waitForTimeout(2000);

    const pageContent = await managerPage.content();

    // Should show access denied or not found
    const isBlocked = pageContent.toLowerCase().includes('access denied') ||
                      pageContent.toLowerCase().includes('not found') ||
                      pageContent.toLowerCase().includes('unauthorized') ||
                      pageContent.toLowerCase().includes('forbidden');

    expect(isBlocked).toBe(true);
  });
});

test.describe('GBV Privacy Firewall - Field Worker CANNOT See', () => {
  test('Field worker CANNOT see GBV report in ticket list', async ({ fieldWorkerPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    await fieldWorkerPage.goto('http://localhost:5174/tickets');
    await fieldWorkerPage.waitForTimeout(2000);

    const pageContent = await fieldWorkerPage.content();

    // Verify tracking number NOT visible
    expect(pageContent).not.toContain(gbvTrackingNumber);
  });

  test('Field worker CANNOT access GBV via API', async ({ fieldWorkerPage }) => {
    const authToken = await fieldWorkerPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    const response = await fieldWorkerPage.request.get('http://localhost:8000/api/v1/tickets?category=GBV/Abuse', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      const tickets = Array.isArray(data) ? data : data.items || data.data || [];
      expect(tickets.length).toBe(0);
    } else {
      expect([403, 401]).toContain(response.status());
    }
  });

  test('Field worker CANNOT access GBV via URL', async ({ fieldWorkerPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    await fieldWorkerPage.goto(`http://localhost:5174/tickets/${gbvTrackingNumber}`);
    await fieldWorkerPage.waitForTimeout(2000);

    const pageContent = await fieldWorkerPage.content();

    const isBlocked = pageContent.toLowerCase().includes('access denied') ||
                      pageContent.toLowerCase().includes('not found') ||
                      pageContent.toLowerCase().includes('unauthorized');

    expect(isBlocked).toBe(true);
  });
});

test.describe('GBV Privacy Firewall - Ward Councillor CANNOT See', () => {
  test('Ward councillor CANNOT see GBV report in ticket list', async ({ wardCouncillorPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    await wardCouncillorPage.goto('http://localhost:5174/tickets');
    await wardCouncillorPage.waitForTimeout(2000);

    const pageContent = await wardCouncillorPage.content();

    // Verify tracking number NOT visible
    expect(pageContent).not.toContain(gbvTrackingNumber);
  });

  test('Ward councillor CANNOT access GBV via API', async ({ wardCouncillorPage }) => {
    const authToken = await wardCouncillorPage.evaluate(() => {
      const supabaseAuth = localStorage.getItem('sb-localhost-auth-token');
      if (supabaseAuth) {
        const parsed = JSON.parse(supabaseAuth);
        return parsed.access_token;
      }
      return null;
    });

    const response = await wardCouncillorPage.request.get('http://localhost:8000/api/v1/tickets?category=GBV/Abuse', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      const tickets = Array.isArray(data) ? data : data.items || data.data || [];
      expect(tickets.length).toBe(0);
    } else {
      expect([403, 401]).toContain(response.status());
    }
  });

  test('Ward councillor CANNOT access GBV via URL', async ({ wardCouncillorPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    await wardCouncillorPage.goto(`http://localhost:5174/tickets/${gbvTrackingNumber}`);
    await wardCouncillorPage.waitForTimeout(2000);

    const pageContent = await wardCouncillorPage.content();

    const isBlocked = pageContent.toLowerCase().includes('access denied') ||
                      pageContent.toLowerCase().includes('not found') ||
                      pageContent.toLowerCase().includes('unauthorized');

    expect(isBlocked).toBe(true);
  });
});

/**
 * Test suite: Public Dashboard GBV Exclusion
 */
test.describe('Public Dashboard GBV Exclusion', () => {
  test('GBV data NOT visible on public dashboard', async ({ page }) => {
    // Navigate to public transparency dashboard
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForTimeout(3000);

    const pageContent = await page.content();

    // Verify no GBV category visible in charts or stats
    expect(pageContent.toLowerCase()).not.toContain('gbv/abuse');
    expect(pageContent.toLowerCase()).not.toContain('domestic violence');
    expect(pageContent.toLowerCase()).not.toContain('gender-based violence');

    // Verify GBV tracking number not visible
    if (gbvTrackingNumber) {
      expect(pageContent).not.toContain(gbvTrackingNumber);
    }
  });

  test('Public statistics do NOT include GBV in category breakdown', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForTimeout(2000);

    // Check category chart/legend for GBV
    const categoryLegend = await page.locator('[data-testid="category-chart"], [data-testid="category-legend"]').textContent().catch(() => '') || '';

    expect(categoryLegend.toLowerCase()).not.toContain('gbv');
    expect(categoryLegend.toLowerCase()).not.toContain('abuse');
  });

  test('Public heatmap does NOT show GBV report locations', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');
    await page.waitForTimeout(2000);

    // Check for heatmap component
    const heatmap = await page.locator('[data-testid="heatmap"], .leaflet-container').first().isVisible().catch(() => false);

    if (heatmap) {
      // Verify GBV location not rendered (hard to test visually, but check data attributes)
      const heatmapData = await page.evaluate(() => {
        const heatmapElement = document.querySelector('[data-testid="heatmap"]');
        return heatmapElement?.getAttribute('data-points') || '';
      });

      // If heatmap data is accessible, verify no GBV category points
      expect(heatmapData.toLowerCase()).not.toContain('gbv');
    }
  });
});

/**
 * Test suite: Positive Tests - SAPS and Admin CAN See
 */
test.describe('GBV Privacy Firewall - SAPS Liaison CAN See', () => {
  test('SAPS liaison CAN see GBV report in ticket list', async ({ sapsLiaisonPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    await sapsLiaisonPage.goto('http://localhost:5174/tickets');
    await sapsLiaisonPage.waitForTimeout(2000);

    const pageContent = await sapsLiaisonPage.content();

    // Verify tracking number IS visible for SAPS
    expect(pageContent).toContain(gbvTrackingNumber);
  });
});

test.describe('GBV Privacy Firewall - Admin CAN See', () => {
  test('Admin CAN see GBV report', async ({ adminPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    await adminPage.goto('http://localhost:5174/tickets');
    await adminPage.waitForTimeout(2000);

    const pageContent = await adminPage.content();

    // Verify tracking number IS visible for admin
    expect(pageContent).toContain(gbvTrackingNumber);
  });
});

/**
 * Test suite: GBV Citizen Privacy
 */
test.describe('GBV Citizen Privacy', () => {
  test('Citizen who submitted GBV sees limited info on profile', async ({ citizenGbvPage }) => {
    if (!gbvTrackingNumber) {
      test.skip();
      return;
    }

    // Navigate to citizen profile
    await citizenGbvPage.goto('http://localhost:5173/profile');
    await citizenGbvPage.waitForTimeout(2000);

    const pageContent = await citizenGbvPage.content();

    // Verify GBV report shows limited fields only
    // Should show: tracking number, status
    // Should NOT show: full description, exact location, municipal assignment details

    // Tracking number should be visible
    expect(pageContent).toContain(gbvTrackingNumber);

    // Status should be visible (open, in_progress, etc.)
    const hasStatus = pageContent.toLowerCase().includes('status') ||
                      pageContent.toLowerCase().includes('open') ||
                      pageContent.toLowerCase().includes('in progress');

    expect(hasStatus).toBe(true);

    // Full description should NOT be visible (privacy decision from Phase 06.2-08)
    expect(pageContent).not.toContain('domestic violence incident');
  });
});
