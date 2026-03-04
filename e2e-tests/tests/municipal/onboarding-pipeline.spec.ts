/**
 * onboarding-pipeline.spec.ts
 *
 * Strict E2E tests for the full SALGA-driven municipal onboarding pipeline:
 *   1. Request-Access Form Validation
 *   2. SALGA Admin — Access Request Pipeline (approve / reject)
 *   3. Onboarding Wizard — Step Navigation & Department Validation
 *
 * Covers: request-access form validation, SALGA admin approval/rejection flow,
 * and onboarding wizard step navigation with department step gate.
 *
 * Rules:
 * - NO test.skip() patterns
 * - NO .catch(() => false) assertion chains
 * - GSAP suppression applied in all tests
 * - Each test navigates freshly (React state resets on navigation)
 */

import { test as base, test, expect } from '../../fixtures/auth';
import { OnboardingWizardPage } from '../../fixtures/page-objects/dashboard/OnboardingWizardPage';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// GSAP suppression helper
// ---------------------------------------------------------------------------

async function suppressGsap(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    if ((window as any).gsap) {
      (window as any).gsap.globalTimeline.timeScale(100);
    }
  });
}

// ===========================================================================
// Section 1: Request-Access Form Validation
// Public route — no auth needed, use base test fixture
// ===========================================================================

base.describe('Request-Access Form Validation', () => {
  base.slow();

  base('request-access page loads with form fields', async ({ page }) => {
    await page.goto('http://localhost:5173/request-access', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await suppressGsap(page);
    await page.waitForTimeout(500);

    // At least one form input or select is visible
    await expect(page.locator('input, select').first()).toBeVisible({ timeout: 15000 });

    // A submit-like button exists
    await expect(
      page.locator('button').filter({ hasText: /submit|request|apply|send/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  base('submitting empty form shows validation errors', async ({ page }) => {
    await page.goto('http://localhost:5173/request-access', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await suppressGsap(page);

    // Clear any draft data that might pre-fill the form
    await page.evaluate(() => localStorage.removeItem('salga_access_request_draft_v2'));

    await page.waitForTimeout(500);

    // Find and click the submit button
    const submitButton = page.locator('button').filter({ hasText: /submit.*registration|submit/i }).first();
    await submitButton.click();

    // Wait for validation to render
    await page.waitForTimeout(1000);

    // Assert validation error for municipality name
    const muniError = page
      .locator('p, span, div')
      .filter({ hasText: /municipality name.*required|required.*municipality name/i })
      .first();
    await expect(muniError).toBeVisible({ timeout: 5000 });

    // Assert validation error for demarcation code
    const demaError = page
      .locator('p, span, div')
      .filter({ hasText: /demarcation code.*required|required.*demarcation/i })
      .first();
    await expect(demaError).toBeVisible({ timeout: 5000 });

    // Still on /request-access — did not navigate away
    expect(page.url()).toMatch(/\/request-access/);
  });

  base('invalid email format shows validation error', async ({ page }) => {
    await page.goto('http://localhost:5173/request-access', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await suppressGsap(page);

    // Clear draft data
    await page.evaluate(() => localStorage.removeItem('salga_access_request_draft_v2'));

    await page.waitForTimeout(500);

    // Fill municipality name via its input (Input component renders a standard input)
    const muniInput = page.locator('input').nth(0);
    await muniInput.fill('Test Municipality');

    // Fill demarcation code
    const demaInput = page.locator('input').nth(1);
    await demaInput.fill('TST01');

    // Fill Municipal Manager Name
    const mmNameInput = page.locator('input').nth(2);
    await mmNameInput.fill('Test Manager');

    // Fill Municipal Manager Email with an invalid value
    const mmEmailInput = page.locator('input[type="email"]').first();
    await mmEmailInput.fill('not-an-email');

    // Disable HTML5 native form validation so the app's custom validateForm() fires
    await page.locator('form').evaluate((form: HTMLFormElement) => { form.noValidate = true; });

    // Click submit
    const submitButton = page.locator('button').filter({ hasText: /submit.*registration|submit/i }).first();
    await submitButton.click();

    // Wait for validation
    await page.waitForTimeout(1000);

    // Assert email validation error
    const emailError = page
      .locator('p, span, div')
      .filter({ hasText: /valid email|invalid email|email.*format|Invalid email/i })
      .first();
    await expect(emailError).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// Section 2: SALGA Admin — Access Request Pipeline
// Authenticated routes — use auth fixtures
// ===========================================================================

test.describe('SALGA Admin — Access Request Pipeline', () => {
  test.slow();

  test('SALGA admin sees pending access requests', async ({ salgaAdminPage }) => {
    await salgaAdminPage.goto('http://localhost:5173/access-requests', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await suppressGsap(salgaAdminPage);
    await salgaAdminPage.waitForTimeout(500);

    // At least one row with "pending" status text visible
    const pendingRow = salgaAdminPage
      .locator('td, div, span')
      .filter({ hasText: /pending/i })
      .first();
    await expect(pendingRow).toBeVisible({ timeout: 15000 });

    // "Approve & Onboard" button visible
    const approveButton = salgaAdminPage
      .locator('button')
      .filter({ hasText: /Approve.*Onboard/i })
      .first();
    await expect(approveButton).toBeVisible({ timeout: 10000 });
  });

  test('SALGA admin clicks Approve & Onboard and navigates to /onboarding', async ({ salgaAdminPage }) => {
    // Navigate fresh to /access-requests (React state resets on navigation)
    await salgaAdminPage.goto('http://localhost:5173/access-requests', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await suppressGsap(salgaAdminPage);
    await salgaAdminPage.waitForTimeout(500);

    // Click first "Approve & Onboard" button
    const approveButton = salgaAdminPage
      .locator('button')
      .filter({ hasText: /Approve.*Onboard/i })
      .first();
    await approveButton.click();

    // Assert navigation to /onboarding
    await salgaAdminPage.waitForURL(/\/onboarding/, { timeout: 15000 });

    // Assert wizard page loaded — step indicator or any visible heading
    const wizardContent = salgaAdminPage.locator('span, h1, h2').filter({ hasText: /Step|Welcome|onboarding/i }).first();
    await expect(wizardContent).toBeVisible({ timeout: 15000 });
  });

  test('SALGA admin can reject a pending request', async ({ salgaAdminPage }) => {
    // Navigate fresh to /access-requests
    await salgaAdminPage.goto('http://localhost:5173/access-requests', {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
    await suppressGsap(salgaAdminPage);
    await salgaAdminPage.waitForTimeout(500);

    // Count initial pending rows (identify by "Approve & Onboard" buttons)
    const approveButtons = salgaAdminPage.locator('button').filter({ hasText: /Approve.*Onboard/i });
    const initialCount = await approveButtons.count();

    // Find and click the first "Reject" button
    const rejectButton = salgaAdminPage
      .locator('button')
      .filter({ hasText: /^Reject$/i })
      .first();
    await rejectButton.click();

    // Wait for optimistic update
    await salgaAdminPage.waitForTimeout(1000);

    // Assert the UI responded — either the Approve & Onboard count decreased
    // or a "rejected" status badge appeared. The key assertion is that the action
    // had a visible effect (not a no-op).
    const afterCount = await approveButtons.count();
    const rejectedBadge = salgaAdminPage.locator('span').filter({ hasText: /^Rejected$/i }).first();

    // At least one of: fewer approve buttons, or a rejected badge appeared
    const uiUpdated = afterCount < initialCount || (await rejectedBadge.isVisible());
    expect(uiUpdated).toBe(true);
  });
});

// ===========================================================================
// Section 3: Onboarding Wizard — Step Navigation
// Authenticated routes — use auth fixtures
// ===========================================================================

test.describe('Onboarding Wizard — Step Navigation', () => {
  test.slow();

  test('onboarding wizard renders with 9-step indicator', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    await expect(wizard.stepIndicator).toBeVisible({ timeout: 15000 });
    const indicatorText = await wizard.stepIndicator.textContent();
    expect(indicatorText).toMatch(/Step \d+ of 9/i);
  });

  test('wizard starts at Welcome step (Step 1)', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    const step = await wizard.getCurrentStep();
    expect(step).toBe('welcome');

    const stepNumber = await wizard.getStepNumber();
    expect(stepNumber).toBe(1);
  });

  test('Confirm & Continue / Next button advances wizard to Step 2', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // The welcome step uses "Confirm & Continue" rather than "Next" or "Start Setup".
    // Use a flexible locator that covers all common advance button text variants.
    const advanceButton = adminPage
      .locator('button')
      .filter({ hasText: /Confirm.*Continue|Start Setup|Get Started|Begin|^Next$/i })
      .first();

    await advanceButton.waitFor({ state: 'visible', timeout: 15000 });
    await advanceButton.click();
    await adminPage.waitForTimeout(500);

    const stepNumber = await wizard.getStepNumber();
    expect(stepNumber).toBe(2);
  });

  test('Back button returns to previous step', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Advance from welcome (step 1) to departments (step 2)
    const advanceButton = adminPage
      .locator('button')
      .filter({ hasText: /Confirm.*Continue|Start Setup|Get Started|Begin|^Next$/i })
      .first();

    await advanceButton.waitFor({ state: 'visible', timeout: 15000 });
    await advanceButton.click();
    await adminPage.waitForTimeout(500);

    // Should now be at step 2
    expect(await wizard.getStepNumber()).toBe(2);

    // Click Back
    await wizard.goBack();

    // Should return to step 1
    const stepNumber = await wizard.getStepNumber();
    expect(stepNumber).toBe(1);
  });

  test('department step Next button is disabled when no departments added', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Advance from welcome to departments (step 2)
    const advanceButton = adminPage
      .locator('button')
      .filter({ hasText: /Confirm.*Continue|Start Setup|Get Started|Begin|^Next$/i })
      .first();

    await advanceButton.waitFor({ state: 'visible', timeout: 15000 });
    await advanceButton.click();
    await adminPage.waitForTimeout(500);

    // Verify we are now on the departments step
    const currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('departments');

    // The departments step Next button is disabled when departments.length === 0.
    // This is the UI's gate: the button is present but disabled, preventing progression.
    const nextButton = adminPage.locator('button').filter({ hasText: /^Next$/i }).first();
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await expect(nextButton).toBeDisabled();

    // Confirm wizard did NOT advance past departments
    const stepNumber = await wizard.getStepNumber();
    expect(stepNumber).toBe(2);
  });
});
