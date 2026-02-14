/**
 * Auth fixtures for Playwright tests.
 *
 * Extends base Playwright test with role-specific authenticated page fixtures.
 * Uses Supabase storageState caching for fast authentication reuse.
 *
 * Usage:
 * ```ts
 * import { test, expect } from './fixtures/auth';
 *
 * test('citizen can view profile', async ({ citizenNewPage }) => {
 *   await citizenNewPage.goto('/profile');
 *   // ... test logic
 * });
 * ```
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { supabase } from './supabase-test-client.js';
import * as path from 'path';
import * as fs from 'fs';

// Import all profiles
import { profile as citizenNew } from '../profiles/public/citizen-new.profile.js';
import { profile as citizenReturning } from '../profiles/public/citizen-returning.profile.js';
import { profile as citizenGbv } from '../profiles/public/citizen-gbv.profile.js';
import { profile as citizenMulti } from '../profiles/public/citizen-multireport.profile.js';
import { profile as citizenTracking } from '../profiles/public/citizen-tracking.profile.js';
import { profile as admin } from '../profiles/municipal/admin.profile.js';
import { profile as manager } from '../profiles/municipal/manager.profile.js';
import { profile as managerPretoria } from '../profiles/municipal/manager-pretoria.profile.js';
import { profile as fieldWorker } from '../profiles/municipal/field-worker.profile.js';
import { profile as sapsLiaison } from '../profiles/municipal/saps-liaison.profile.js';
import { profile as wardCouncillor } from '../profiles/municipal/ward-councillor.profile.js';

/**
 * Auth fixtures interface
 */
interface AuthFixtures {
  // Citizen fixtures (public dashboard)
  citizenNewPage: Page;
  citizenReturningPage: Page;
  citizenGbvPage: Page;
  citizenMultiPage: Page;
  citizenTrackingPage: Page;

  // Municipal fixtures (dashboard)
  adminPage: Page;
  managerPage: Page;
  managerPretoriaPage: Page;
  fieldWorkerPage: Page;
  sapsLiaisonPage: Page;
  wardCouncillorPage: Page;
}

/**
 * Helper: Get login URL based on role
 */
function getLoginUrl(role: string): string {
  // Citizen roles use public dashboard login (port 5174)
  if (role === 'citizen') {
    return 'http://localhost:5174/login';
  }
  // Municipal roles use dashboard login (port 5173)
  return 'http://localhost:5173/login';
}

/**
 * Helper: Get base URL based on role
 */
function getBaseUrl(role: string): string {
  if (role === 'citizen') {
    return 'http://localhost:5174';
  }
  return 'http://localhost:5173';
}

/**
 * Helper: Authenticate and cache storageState
 */
async function getAuthenticatedPage(
  context: BrowserContext,
  profile: { name: string; role: string; email: string; password: string; tenantId: string }
): Promise<Page> {
  const authDir = path.join(process.cwd(), '.auth');
  const authFile = path.join(authDir, `${profile.role}-${profile.tenantId}.json`);

  // Ensure .auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // If cached auth exists and is recent (< 1 hour old), use it
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageInMs = Date.now() - stats.mtimeMs;
    const oneHour = 60 * 60 * 1000;

    if (ageInMs < oneHour) {
      console.log(`[Auth] Using cached auth for ${profile.email}`);
      // Create new context with cached storageState
      const authenticatedContext = await context.browser()!.newContext({
        storageState: authFile,
        baseURL: getBaseUrl(profile.role),
      });
      return await authenticatedContext.newPage();
    }
  }

  // Otherwise, perform fresh login and cache storageState
  console.log(`[Auth] Fresh login for ${profile.email}`);
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(getLoginUrl(profile.role));

    // Wait for GSAP form entrance animation to complete
    const emailInput = page.locator('input[id="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    // Fill email and password
    await emailInput.fill(profile.email);
    await page.locator('input[id="password"]').fill(profile.password);

    // Submit login
    await page.locator('button[type="submit"]').filter({ hasText: /sign in/i }).click();

    // Wait for successful navigation (not back to /login)
    // Citizens redirect to /profile, municipal users redirect to / (dashboard)
    await page.waitForURL(/\/(profile|onboarding|dashboard|tickets)?\/?$/, { timeout: 15000 });

    // Save storageState
    await page.context().storageState({ path: authFile });

    console.log(`[Auth] Cached auth for ${profile.email}`);

    return page;
  } catch (error) {
    console.error(`[Auth] Failed to authenticate ${profile.email}:`, error);
    throw error;
  }
}

/**
 * Extend Playwright test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Citizen fixtures (public dashboard on port 5174)
  citizenNewPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const page = await getAuthenticatedPage(context, citizenNew);
    await use(page);
    await context.close();
  },

  citizenReturningPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const page = await getAuthenticatedPage(context, citizenReturning);
    await use(page);
    await context.close();
  },

  citizenGbvPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const page = await getAuthenticatedPage(context, citizenGbv);
    await use(page);
    await context.close();
  },

  citizenMultiPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const page = await getAuthenticatedPage(context, citizenMulti);
    await use(page);
    await context.close();
  },

  citizenTrackingPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    const page = await getAuthenticatedPage(context, citizenTracking);
    await use(page);
    await context.close();
  },

  // Municipal fixtures (dashboard on port 5173)
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await getAuthenticatedPage(context, admin);
    await use(page);
    await context.close();
  },

  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await getAuthenticatedPage(context, manager);
    await use(page);
    await context.close();
  },

  managerPretoriaPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await getAuthenticatedPage(context, managerPretoria);
    await use(page);
    await context.close();
  },

  fieldWorkerPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await getAuthenticatedPage(context, fieldWorker);
    await use(page);
    await context.close();
  },

  sapsLiaisonPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await getAuthenticatedPage(context, sapsLiaison);
    await use(page);
    await context.close();
  },

  wardCouncillorPage: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await getAuthenticatedPage(context, wardCouncillor);
    await use(page);
    await context.close();
  },
});

// Re-export expect
export { expect };
