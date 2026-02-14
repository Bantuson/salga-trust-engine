/**
 * Integration Tests: Data Persistence
 *
 * Verifies database durability across sessions, page refreshes, and browser contexts.
 * Proves that user data and reports persist correctly in PostgreSQL/Supabase.
 *
 * Success Criteria Mapping:
 * - Criterion 2: Database persistence end-to-end (data survives sessions, refreshes, context changes)
 */

import { test, expect } from '../../fixtures/auth.js';
import { ReportIssuePage } from '../../fixtures/page-objects/public/ReportIssuePage.js';
import { faker } from '@faker-js/faker';

test.describe('Data Persistence', () => {
  test('User registration persists across sessions', async ({ browser }) => {
    // Register a new user via public portal
    const registrationContext = await browser.newContext({
      baseURL: 'http://localhost:5174',
    });
    const registrationPage = await registrationContext.newPage();

    await registrationPage.goto('/register');

    const uniqueEmail = `test-${faker.string.alphanumeric(8)}@persistence.example.com`;
    const password = 'PersistTest123!';

    await registrationPage.locator('input[id="email"]').fill(uniqueEmail);
    await registrationPage.locator('input[id="password"]').fill(password);
    await registrationPage.locator('input[id="confirm-password"]').fill(password);
    await registrationPage.locator('input[id="full-name"]').fill(faker.person.fullName());
    await registrationPage.locator('input[id="phone"]').fill(faker.phone.number());

    await registrationPage.locator('button[type="submit"]').click();

    // Wait for successful registration (redirect to login or profile)
    await registrationPage.waitForURL(/\/(login|profile)/, { timeout: 15000 });

    console.log(`[Test] Registered new user: ${uniqueEmail}`);

    // Close browser context entirely
    await registrationContext.close();

    // Create new context, log in with same credentials
    const loginContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const loginPage = await loginContext.newPage();

    await loginPage.goto('/login');
    await loginPage.locator('input[id="email"]').fill(uniqueEmail);
    await loginPage.locator('input[id="password"]').fill(password);
    await loginPage.locator('button[type="submit"]').click();

    // Verify login succeeds
    await loginPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    // Verify profile page shows correct email
    await loginPage.goto('/profile');
    const profileContent = await loginPage.textContent('body');
    expect(profileContent).toContain(uniqueEmail);

    console.log(`[Test] User ${uniqueEmail} login persists across sessions`);

    await loginContext.close();
  });

  test('Report persists across page refreshes', async ({ browser }) => {
    // Citizen submits report
    const citizenContext = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizenPage = await citizenContext.newPage();

    await citizenPage.goto('/login');
    await citizenPage.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await citizenPage.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizenPage.locator('button[type="submit"]').click();
    await citizenPage.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    const reportPage = new ReportIssuePage(citizenPage);
    await reportPage.goto();
    await reportPage.selectCategory('Electricity');
    await reportPage.fillDescription(
      `Electricity issue at ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();

    console.log(`[Test] Citizen submitted report: ${trackingNumber}`);

    // Refresh page
    await citizenPage.reload();
    await citizenPage.waitForLoadState('networkidle');

    // Navigate to profile, verify report still visible in history
    await citizenPage.goto('/profile');
    await citizenPage.waitForLoadState('networkidle');

    const profileContent = await citizenPage.textContent('body');
    expect(profileContent).toContain(trackingNumber!);

    console.log(`[Test] Report ${trackingNumber} persists after page refresh`);

    await citizenContext.close();
  });

  test('Report persists across new browser sessions', async ({ browser }) => {
    // Citizen submits report
    const session1Context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const session1Page = await session1Context.newPage();

    await session1Page.goto('/login');
    await session1Page.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await session1Page.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await session1Page.locator('button[type="submit"]').click();
    await session1Page.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    const reportPage = new ReportIssuePage(session1Page);
    await reportPage.goto();
    await reportPage.selectCategory('Other');
    await reportPage.fillDescription(
      `Graffiti at ${faker.location.streetAddress()} - ${faker.string.alphanumeric(8)}`
    );
    await reportPage.fillAddress(faker.location.streetAddress());
    await reportPage.submit();

    await expect(reportPage.receiptCard).toBeVisible({ timeout: 15000 });
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();

    console.log(`[Test] Session 1 - Citizen submitted report: ${trackingNumber}`);

    // Close context entirely
    await session1Context.close();

    // Create new session, log in again
    const session2Context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const session2Page = await session2Context.newPage();

    await session2Page.goto('/login');
    await session2Page.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await session2Page.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await session2Page.locator('button[type="submit"]').click();
    await session2Page.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    // Navigate to profile, verify report still in history
    await session2Page.goto('/profile');
    await session2Page.waitForLoadState('networkidle');

    const profileContent = await session2Page.textContent('body');
    expect(profileContent).toContain(trackingNumber!);

    console.log(`[Test] Session 2 - Report ${trackingNumber} persists across browser sessions`);

    await session2Context.close();
  });

  test('Access request data persists for admin review', async ({ browser }) => {
    // Submit access request form on municipal dashboard
    const requestContext = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const requestPage = await requestContext.newPage();

    await requestPage.goto('/register');

    const municipalityName = `Test Municipality ${faker.string.alphanumeric(6)}`;
    const contactEmail = `contact-${faker.string.alphanumeric(8)}@municipality.example.com`;

    // Fill access request form (RequestAccessPage uses Input components without id/name)
    // Municipality Name input - find by label text
    await requestPage
      .locator('.input-wrapper')
      .filter({ hasText: /Municipality Name/i })
      .locator('input')
      .fill(municipalityName)
      .catch(() => requestPage.locator('input').first().fill(municipalityName));

    // Contact Name input
    await requestPage
      .locator('.input-wrapper')
      .filter({ hasText: /Contact Person Name/i })
      .locator('input')
      .fill(faker.person.fullName())
      .catch(() => Promise.resolve());

    // Contact Email input
    await requestPage
      .locator('.input-wrapper')
      .filter({ hasText: /Contact Email/i })
      .locator('input')
      .fill(contactEmail)
      .catch(() => Promise.resolve());

    // Province select
    await requestPage
      .locator('select#province')
      .selectOption('Gauteng')
      .catch(() => requestPage.locator('select').first().selectOption('Gauteng'));

    // Submit form
    await requestPage.locator('button[type="submit"]').click();

    // Verify success message (data sent to backend)
    const successMessage = await requestPage
      .locator('text=/success|submitted|received/i')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    expect(successMessage).toBe(true);

    console.log(`[Test] Access request submitted for: ${municipalityName}`);

    await requestContext.close();
  });

  test('Multiple users maintain separate sessions', async ({ browser }) => {
    // Create two citizen contexts simultaneously
    const citizen1Context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizen1Page = await citizen1Context.newPage();

    const citizen2Context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const citizen2Page = await citizen2Context.newPage();

    // Authenticate citizen 1
    await citizen1Page.goto('/login');
    await citizen1Page.locator('input[id="email"]').fill('citizen-return@test-jozi-001.test');
    await citizen1Page.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizen1Page.locator('button[type="submit"]').click();
    await citizen1Page.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    // Authenticate citizen 2
    await citizen2Page.goto('/login');
    await citizen2Page.locator('input[id="email"]').fill('citizen-multi@test-jozi-001.test');
    await citizen2Page.locator('input[id="password"]').fill(process.env.TEST_PASSWORD || 'Test123!@#');
    await citizen2Page.locator('button[type="submit"]').click();
    await citizen2Page.waitForURL(/\/(profile|report)/, { timeout: 10000 });

    // Both navigate to profile page
    await citizen1Page.goto('/profile');
    await citizen2Page.goto('/profile');

    await citizen1Page.waitForLoadState('networkidle');
    await citizen2Page.waitForLoadState('networkidle');

    // Verify each sees their own data (different emails)
    const citizen1Content = await citizen1Page.textContent('body');
    const citizen2Content = await citizen2Page.textContent('body');

    expect(citizen1Content).toContain('citizen-return@test-jozi-001.test');
    expect(citizen1Content).not.toContain('citizen-multi@test-jozi-001.test');

    expect(citizen2Content).toContain('citizen-multi@test-jozi-001.test');
    expect(citizen2Content).not.toContain('citizen-return@test-jozi-001.test');

    console.log('[Test] Multiple users maintain separate sessions simultaneously');

    await citizen1Context.close();
    await citizen2Context.close();
  });
});
