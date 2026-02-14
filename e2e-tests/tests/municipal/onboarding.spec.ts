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
 *
 * Actual step titles:
 * - Welcome: h1 "Welcome to SALGA Trust Engine!"
 * - Profile: h2 "Municipality Profile"
 * - Team: h2 "Invite Your Team"
 * - Wards: h2 "Configure Your Wards"
 * - SLA: h2 "Set SLA Targets"
 * - Completion: h1 "Your Dashboard is Ready!"
 */

import { test, expect } from '../../fixtures/auth';
import { OnboardingWizardPage } from '../../fixtures/page-objects/dashboard/OnboardingWizardPage';

test.describe('Municipal Onboarding Wizard', () => {
  test('Admin sees onboarding wizard on first login', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Verify welcome step is visible — h1 "Welcome to SALGA Trust Engine!"
    await expect(wizard.welcomeStepTitle).toBeVisible();
    await expect(wizard.welcomeStepTitle).toContainText(/welcome/i);

    // Verify "Start Setup" button is visible
    await expect(wizard.startButton).toBeVisible();

    // Verify current step is welcome
    const currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('welcome');
  });

  test('Onboarding wizard progresses through steps', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start from Welcome
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('welcome');

    // Click "Start Setup" button on welcome screen
    await wizard.clickStart();

    // Should now be on Profile step — h2 "Municipality Profile"
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('profile');
    await expect(wizard.profileStepTitle).toBeVisible();

    // Fill profile form using page object helper
    await wizard.fillProfileStep({
      municipalityName: 'Test Municipality',
      municipalityCode: 'TST',
      province: 'Gauteng',
      contactEmail: 'contact@test.gov.za',
      contactPhone: '+27123456789',
      contactPersonName: 'Test Contact',
    });

    // Click Next to go to Team step
    await wizard.goToNextStep();

    // Should now be on Team step — h2 "Invite Your Team"
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');
    await expect(wizard.teamStepTitle).toBeVisible();
  });

  test('Onboarding steps can be skipped', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Navigate to Team step (skip Welcome, fill Profile)
    await wizard.clickStart();

    // Fill required profile fields
    await wizard.fillProfileStep({
      municipalityName: 'Skip Test Muni',
      municipalityCode: 'SKP',
      province: 'Free State',
      contactEmail: 'skip@test.gov.za',
      contactPhone: '+27111111111',
      contactPersonName: 'Skip Contact',
    });

    await wizard.goToNextStep();

    // Now at Team step
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');

    // Skip Team step
    await wizard.skipStep();

    // Should be at Wards step — h2 "Configure Your Wards"
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('wards');
    await expect(wizard.wardsStepTitle).toBeVisible();

    // Skip Wards step
    await wizard.skipStep();

    // Should be at SLA step — h2 "Set SLA Targets"
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('sla');
    await expect(wizard.slaStepTitle).toBeVisible();
  });

  test('Onboarding persists progress after page refresh', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start wizard and complete Profile step
    await wizard.clickStart();

    // Fill profile
    await wizard.fillProfileStep({
      municipalityName: 'Persistence Test Muni',
      municipalityCode: 'PER',
      province: 'Limpopo',
      contactEmail: 'persist@test.gov.za',
      contactPhone: '+27222222222',
      contactPersonName: 'Persist Contact',
    });

    // Move to Team step
    await wizard.goToNextStep();

    // Verify we're at Team step
    let currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');

    // Refresh page
    await adminPage.reload();
    await adminPage.waitForLoadState('networkidle');
    // Wait for loading state and GSAP animation
    await adminPage.waitForTimeout(3000);

    // Verify wizard resumes at Team step (not back to Welcome)
    // The wizard loads progress from backend/localStorage and resumes
    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('team');
    await expect(wizard.teamStepTitle).toBeVisible();
  });

  test('Onboarding wizard can navigate backwards', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start wizard
    await wizard.clickStart();

    // Fill profile and go to Team
    await wizard.fillProfileStep({
      municipalityName: 'Back Nav Muni',
      municipalityCode: 'BCK',
      province: 'Mpumalanga',
      contactEmail: 'back@test.gov.za',
      contactPhone: '+27333333333',
      contactPersonName: 'Back Contact',
    });

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

    // Go back to Profile
    await wizard.goBack();

    currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('profile');

    // Verify profile data is still there — check municipality name input
    const municipalityInput = adminPage
      .locator('.input-wrapper')
      .filter({ hasText: /Full Municipality Name/i })
      .locator('input');
    await expect(municipalityInput).toHaveValue('Back Nav Muni');
  });

  test('Onboarding completion redirects to dashboard', async ({ adminPage }) => {
    const wizard = new OnboardingWizardPage(adminPage);
    await wizard.goto();

    // Start wizard
    await wizard.clickStart();

    // Fill profile (minimal required)
    await wizard.fillProfileStep({
      municipalityName: 'Complete Test Muni',
      municipalityCode: 'CMP',
      province: 'Northern Cape',
      contactEmail: 'complete@test.gov.za',
      contactPhone: '+27444444444',
      contactPersonName: 'Complete Contact',
    });

    await wizard.goToNextStep();

    // Skip all optional steps
    await wizard.skipStep(); // Team
    await wizard.skipStep(); // Wards
    await wizard.skipStep(); // SLA

    // Should be at Completion step — h1 "Your Dashboard is Ready!"
    // Wait for the completion API call to finish (shows loading spinner first)
    await adminPage.waitForTimeout(3000);

    const currentStep = await wizard.getCurrentStep();
    expect(currentStep).toBe('complete');
    await expect(wizard.completionStepTitle).toBeVisible();

    // Click "Go to Dashboard" button
    await wizard.dashboardButton.click();

    // Verify redirect to dashboard (URL should be / or /dashboard)
    await adminPage.waitForURL(/\/(dashboard)?$/);

    // Verify dashboard elements are visible — h1 "Municipal Operations Dashboard"
    const dashboardTitle = adminPage.locator('h1').filter({ hasText: /Municipal Operations Dashboard/i });
    await expect(dashboardTitle.first()).toBeVisible({ timeout: 10000 });
  });
});
