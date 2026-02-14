/**
 * E2E Tests: Municipal Onboarding Wizard
 *
 * Tests the multi-step onboarding wizard for new municipalities.
 * Verifies wizard progression, step navigation, data persistence, and completion flow.
 *
 * Coverage:
 * - Admin sees onboarding wizard on first login
 * - Wizard progresses through all steps (Welcome → Profile → Team → Wards → SLA → Completion)
 * - Steps can be skipped (Team, Wards, SLA are optional)
 * - Progress persists after page refresh (backend + localStorage)
 * - Wizard can navigate backwards
 * - Completion redirects to main dashboard
 */

import { test, expect } from '../../fixtures/auth';
import { OnboardingWizardPage } from '../../fixtures/page-objects/dashboard/OnboardingWizardPage';

test.describe('Municipal Onboarding Wizard', () => {
  test('Admin sees onboarding wizard on first login', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Verify welcome step is visible
    await expect(wizard.welcomeStepTitle).toBeVisible();
    await expect(wizard.welcomeStepTitle).toContainText(/welcome/i);

    // Verify no progress indicator on welcome (it's the first screen)
    const currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('welcome');
  });

  test('Onboarding wizard progresses through steps', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start from Welcome
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('welcome');

    // Click Start button (on Welcome screen, Next is labeled "Start")
    const startButton = adminPage.locator('button').filter({ hasText: /start|begin|next/i }).first();
    await startButton.click();
    await adminPage.waitForTimeout(500);

    // Should now be on Profile step
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('profile');
    await expect(wizard.profileStepTitle).toBeVisible();

    // Fill profile form (required fields)
    await adminPage.locator('input').filter({ hasText: /municipality.*name/i }).or(
      adminPage.locator('input[name*="municipality"]').first()
    ).fill('Test Municipality');

    await adminPage.locator('input').filter({ hasText: /code/i }).or(
      adminPage.locator('input[name*="code"]').first()
    ).fill('TST');

    await adminPage.locator('select').first().selectOption('Gauteng');

    await adminPage.locator('input[type="email"]').first().fill('contact@test.gov.za');
    await adminPage.locator('input[type="tel"]').first().fill('+27123456789');

    await adminPage.locator('input').filter({ hasText: /contact.*name/i }).or(
      adminPage.locator('input[name*="contactPerson"]').first()
    ).fill('Test Contact');

    // Click Next to go to Team step
    await wizard.goToNextStep();

    // Should now be on Team step
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');
    await expect(wizard.teamStepTitle).toBeVisible();
  });

  test('Onboarding steps can be skipped', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Navigate to Team step (skip Welcome, fill Profile)
    const startButton = adminPage.locator('button').filter({ hasText: /start|begin|next/i }).first();
    await startButton.click();
    await adminPage.waitForTimeout(500);

    // Fill required profile fields
    await adminPage.locator('input').filter({ hasText: /municipality.*name/i }).or(
      adminPage.locator('input[name*="municipality"]').first()
    ).fill('Skip Test Muni');

    await adminPage.locator('input').filter({ hasText: /code/i }).or(
      adminPage.locator('input[name*="code"]').first()
    ).fill('SKP');

    await adminPage.locator('select').first().selectOption('Free State');

    await adminPage.locator('input[type="email"]').first().fill('skip@test.gov.za');
    await adminPage.locator('input[type="tel"]').first().fill('+27111111111');

    await adminPage.locator('input').filter({ hasText: /contact.*name/i }).or(
      adminPage.locator('input[name*="contactPerson"]').first()
    ).fill('Skip Contact');

    await wizard.goToNextStep();

    // Now at Team step
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');

    // Skip Team step
    await wizard.skipStep();

    // Should be at Wards step
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('wards');
    await expect(wizard.wardsStepTitle).toBeVisible();

    // Skip Wards step
    await wizard.skipStep();

    // Should be at SLA step
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('sla');
    await expect(wizard.slaStepTitle).toBeVisible();
  });

  test('Onboarding persists progress after page refresh', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start wizard and complete Profile step
    const startButton = adminPage.locator('button').filter({ hasText: /start|begin|next/i }).first();
    await startButton.click();
    await adminPage.waitForTimeout(500);

    // Fill profile
    await adminPage.locator('input').filter({ hasText: /municipality.*name/i }).or(
      adminPage.locator('input[name*="municipality"]').first()
    ).fill('Persistence Test Muni');

    await adminPage.locator('input').filter({ hasText: /code/i }).or(
      adminPage.locator('input[name*="code"]').first()
    ).fill('PER');

    await adminPage.locator('select').first().selectOption('Limpopo');

    await adminPage.locator('input[type="email"]').first().fill('persist@test.gov.za');
    await adminPage.locator('input[type="tel"]').first().fill('+27222222222');

    await adminPage.locator('input').filter({ hasText: /contact.*name/i }).or(
      adminPage.locator('input[name*="contactPerson"]').first()
    ).fill('Persist Contact');

    // Move to Team step
    await wizard.goToNextStep();

    // Verify we're at Team step
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');

    // Refresh page
    await adminPage.reload();
    await adminPage.waitForLoadState('networkidle');

    // Verify wizard resumes at Team step (not back to Welcome)
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');
    await expect(wizard.teamStepTitle).toBeVisible();
  });

  test('Onboarding wizard can navigate backwards', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start wizard
    const startButton = adminPage.locator('button').filter({ hasText: /start|begin|next/i }).first();
    await startButton.click();
    await adminPage.waitForTimeout(500);

    // Fill profile and go to Team
    await adminPage.locator('input').filter({ hasText: /municipality.*name/i }).or(
      adminPage.locator('input[name*="municipality"]').first()
    ).fill('Back Nav Muni');

    await adminPage.locator('input').filter({ hasText: /code/i }).or(
      adminPage.locator('input[name*="code"]').first()
    ).fill('BCK');

    await adminPage.locator('select').first().selectOption('Mpumalanga');

    await adminPage.locator('input[type="email"]').first().fill('back@test.gov.za');
    await adminPage.locator('input[type="tel"]').first().fill('+27333333333');

    await adminPage.locator('input').filter({ hasText: /contact.*name/i }).or(
      adminPage.locator('input[name*="contactPerson"]').first()
    ).fill('Back Contact');

    await wizard.goToNextStep();

    // At Team step, skip to Wards
    await wizard.skipStep();

    // Now at Wards step (step 3)
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('wards');

    // Click Back to return to Team
    await wizard.goBack();

    // Verify we're back at Team step
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');
    await expect(wizard.teamStepTitle).toBeVisible();

    // Data should be preserved - verify by going back to Profile
    await wizard.goBack();

    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('profile');

    // Verify profile data is still there
    const municipalityInput = adminPage.locator('input').filter({ hasText: /municipality.*name/i }).or(
      adminPage.locator('input[name*="municipality"]').first()
    );
    await expect(municipalityInput).toHaveValue('Back Nav Muni');
  });

  test('Onboarding completion redirects to dashboard', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start wizard
    const startButton = adminPage.locator('button').filter({ hasText: /start|begin|next/i }).first();
    await startButton.click();
    await adminPage.waitForTimeout(500);

    // Fill profile (minimal required)
    await adminPage.locator('input').filter({ hasText: /municipality.*name/i }).or(
      adminPage.locator('input[name*="municipality"]').first()
    ).fill('Complete Test Muni');

    await adminPage.locator('input').filter({ hasText: /code/i }).or(
      adminPage.locator('input[name*="code"]').first()
    ).fill('CMP');

    await adminPage.locator('select').first().selectOption('Northern Cape');

    await adminPage.locator('input[type="email"]').first().fill('complete@test.gov.za');
    await adminPage.locator('input[type="tel"]').first().fill('+27444444444');

    await adminPage.locator('input').filter({ hasText: /contact.*name/i }).or(
      adminPage.locator('input[name*="contactPerson"]').first()
    ).fill('Complete Contact');

    await wizard.goToNextStep();

    // Skip all optional steps
    await wizard.skipStep(); // Team
    await wizard.skipStep(); // Wards
    await wizard.skipStep(); // SLA

    // Should be at Completion step
    const currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('complete');
    await expect(wizard.completionStepTitle).toBeVisible();

    // Click "Go to Dashboard" or "Finish" button
    const finishButton = adminPage.locator('button').filter({ hasText: /dashboard|finish|complete/i }).first();
    await finishButton.click();

    // Verify redirect to dashboard (URL should be / or /dashboard)
    await adminPage.waitForURL(/\/(dashboard)?$/);

    // Verify dashboard elements are visible
    const dashboardTitle = adminPage.locator('h1').filter({ hasText: /dashboard/i });
    await expect(dashboardTitle.first()).toBeVisible();
  });
});
