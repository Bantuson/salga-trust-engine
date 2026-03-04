/**
 * Page Object: Municipal Dashboard Onboarding Wizard Page
 *
 * Encapsulates interactions with OnboardingWizardPage.tsx (v2 — 9-step wizard).
 *
 * Step indicator text: "Step N of 9: {STEP_LABELS[step]}"
 *
 * Storage key: 'salga_onboarding_wizard_v3'
 *
 * Steps (in order):
 *   1. welcome        — Welcome
 *   2. departments    — Departments
 *   3. invite-tier1   — Tier 1 Leaders
 *   4. invite-directors — Directors
 *   5. invite-dept-managers — Dept Managers
 *   6. create-teams   — Teams
 *   7. invite-supervisors — Supervisors
 *   8. sla-config     — SLA & Wards
 *   9. pms-gate       — Readiness Check
 */

import { Page, Locator } from '@playwright/test';

export class OnboardingWizardPage {
  readonly page: Page;

  // Step definitions matching frontend OnboardingWizardPage.tsx v3
  static readonly STEPS = [
    'welcome',
    'departments',
    'invite-tier1',
    'invite-directors',
    'invite-dept-managers',
    'create-teams',
    'invite-supervisors',
    'sla-config',
    'pms-gate',
  ] as const;

  static readonly STEP_LABELS: Record<string, string> = {
    welcome: 'Welcome',
    departments: 'Departments',
    'invite-tier1': 'Tier 1 Leaders',
    'invite-directors': 'Directors',
    'invite-dept-managers': 'Dept Managers',
    'create-teams': 'Teams',
    'invite-supervisors': 'Supervisors',
    'sla-config': 'SLA & Wards',
    'pms-gate': 'Readiness Check',
  };

  // Step indicator — "Step N of 9: {label}"
  readonly stepIndicator: Locator;

  // Navigation buttons
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly skipButton: Locator;

  // Welcome step button
  readonly startButton: Locator;

  // Final step button
  readonly finishButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.stepIndicator = page.locator('span').filter({ hasText: /Step \d+ of 9:/i });

    this.nextButton = page.locator('button').filter({ hasText: /^Next$/i });
    this.backButton = page.locator('button').filter({ hasText: /^Back$/i });
    this.skipButton = page.locator('button').filter({ hasText: /^Skip$/i });

    this.startButton = page.locator('button').filter({ hasText: /Start Setup|Get Started|Begin/i });
    this.finishButton = page.locator('button').filter({ hasText: /Finish|Complete|Go to Dashboard/i });
  }

  /**
   * Navigate to onboarding wizard.
   * Clears the v3 wizard storage key, navigates to /onboarding,
   * suppresses GSAP to speed up transitions, then verifies the wizard loaded.
   */
  async goto(): Promise<boolean> {
    // Navigate first so we have a page context, then clear storage
    await this.page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    // Clear correct v3 storage key to ensure fresh start
    await this.page.evaluate(() => {
      try {
        localStorage.removeItem('salga_onboarding_wizard_v3');
      } catch (_) {
        // Ignore storage errors
      }
    });

    // Reload after clearing storage so wizard initializes from scratch
    await this.page.reload({ waitUntil: 'domcontentloaded' });

    // Suppress GSAP animations to speed up test execution
    await this.page.evaluate(() => {
      if ((window as any).gsap) {
        (window as any).gsap.globalTimeline.timeScale(100);
      }
    });

    // Wait for animations to settle
    await this.page.waitForTimeout(500);

    // Check if step indicator is visible (wizard loaded)
    return await this.stepIndicator.isVisible().catch(() => false);
  }

  /**
   * Get current step key by parsing the step indicator text.
   * Returns the step key (e.g. 'welcome', 'departments') or 'unknown' if not found.
   */
  async getCurrentStep(): Promise<string> {
    // Allow GSAP transition to settle (suppressed — 500ms is sufficient)
    await this.page.waitForTimeout(500);

    try {
      const indicatorText = await this.stepIndicator.textContent({ timeout: 3000 });
      if (!indicatorText) return 'unknown';

      const match = indicatorText.match(/Step (\d+) of 9:/i);
      if (!match) return 'unknown';

      const stepNumber = parseInt(match[1], 10);
      const stepKey = OnboardingWizardPage.STEPS[stepNumber - 1];
      return stepKey ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current step number (1-based) by parsing the step indicator text.
   * Returns 0 if not found.
   */
  async getStepNumber(): Promise<number> {
    try {
      const indicatorText = await this.stepIndicator.textContent({ timeout: 3000 });
      if (!indicatorText) return 0;

      const match = indicatorText.match(/Step (\d+) of 9:/i);
      if (!match) return 0;

      return parseInt(match[1], 10);
    } catch {
      return 0;
    }
  }

  /**
   * Click "Start Setup" / "Get Started" / "Begin" on the welcome step
   */
  async clickStart() {
    await this.startButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.startButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go to next step (clicks "Next" button)
   */
  async goToNextStep() {
    await this.nextButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go back to previous step
   */
  async goBack() {
    await this.backButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.backButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Skip current step
   */
  async skipStep() {
    await this.skipButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.skipButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Click finish/complete button on the final step
   */
  async clickFinish() {
    await this.finishButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.finishButton.click();
    await this.page.waitForTimeout(500);
  }
}
