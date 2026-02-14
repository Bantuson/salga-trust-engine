/**
 * Page Object: Municipal Dashboard Onboarding Wizard Page
 *
 * Encapsulates interactions with OnboardingWizardPage.tsx
 * Multi-step wizard: Welcome → Profile → Team → Wards → SLA → Completion
 *
 * Actual step titles from the components:
 * - Welcome: h1 "Welcome to SALGA Trust Engine!"
 * - Profile: h2 "Municipality Profile"
 * - Team: h2 "Invite Your Team"
 * - Wards: h2 "Configure Your Wards"
 * - SLA: h2 "Set SLA Targets"
 * - Completion: h1 "Your Dashboard is Ready!"
 *
 * Navigation buttons are <Button> components rendered by OnboardingWizardPage:
 * - "Back" (ghost variant)
 * - "Skip" (ghost variant, only for team/wards/sla steps)
 * - "Next" or "Finish" (primary variant)
 * Welcome has "Start Setup" button from WelcomeStep component.
 * Completion has "Go to Dashboard" button from CompletionStep.
 */

import { Page, Locator } from '@playwright/test';

export class OnboardingWizardPage {
  readonly page: Page;

  // Navigation buttons (from OnboardingWizardPage step navigation bar)
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly skipButton: Locator;

  // Welcome step button (separate from nav, inside WelcomeStep component)
  readonly startButton: Locator;

  // Completion step button
  readonly dashboardButton: Locator;

  // Step-specific locators based on actual rendered headings
  readonly welcomeStepTitle: Locator;
  readonly profileStepTitle: Locator;
  readonly teamStepTitle: Locator;
  readonly wardsStepTitle: Locator;
  readonly slaStepTitle: Locator;
  readonly completionStepTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation buttons — these are the shared <Button> components
    // "Next" or "Finish" text depending on step
    this.nextButton = page.locator('button').filter({ hasText: /^Next$|^Finish$/i });
    this.backButton = page.locator('button').filter({ hasText: /^Back$/i });
    this.skipButton = page.locator('button').filter({ hasText: /^Skip$/i });

    // Welcome step "Start Setup" button (inside WelcomeStep, not in nav bar)
    this.startButton = page.locator('button').filter({ hasText: /Start Setup/i });

    // Completion step "Go to Dashboard" button
    this.dashboardButton = page.locator('button').filter({ hasText: /Go to Dashboard/i });

    // Step titles — match actual h1/h2 text from each step component
    this.welcomeStepTitle = page.locator('h1').filter({ hasText: /Welcome/i });
    this.profileStepTitle = page.locator('h2').filter({ hasText: /Municipality Profile/i });
    this.teamStepTitle = page.locator('h2').filter({ hasText: /Invite Your Team/i });
    this.wardsStepTitle = page.locator('h2').filter({ hasText: /Configure Your Wards/i });
    this.slaStepTitle = page.locator('h2').filter({ hasText: /Set SLA Targets/i });
    this.completionStepTitle = page.locator('h1').filter({ hasText: /Your Dashboard is Ready/i });
  }

  /**
   * Navigate to onboarding wizard
   */
  async goto() {
    await this.page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    // Wait for GSAP entrance animation and loading state
    await this.page.waitForTimeout(2000);
  }

  /**
   * Get current step based on visible title
   */
  async getCurrentStep(): Promise<string> {
    // Check each step title visibility (order matters for disambiguation)
    if (await this.welcomeStepTitle.isVisible().catch(() => false)) return 'welcome';
    if (await this.profileStepTitle.isVisible().catch(() => false)) return 'profile';
    if (await this.teamStepTitle.isVisible().catch(() => false)) return 'team';
    if (await this.wardsStepTitle.isVisible().catch(() => false)) return 'wards';
    if (await this.slaStepTitle.isVisible().catch(() => false)) return 'sla';
    if (await this.completionStepTitle.isVisible().catch(() => false)) return 'complete';
    return 'unknown';
  }

  /**
   * Click "Start Setup" on welcome screen
   */
  async clickStart() {
    await this.startButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go to next step (clicks "Next" or "Finish" button)
   */
  async goToNextStep() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Go back to previous step
   */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Skip current step
   */
  async skipStep() {
    await this.skipButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Fill profile step using .input-wrapper label matching.
   * ProfileStep renders these inputs via shared Input component:
   * - "Full Municipality Name *"
   * - "Municipality Code *"
   * - Province <select id="province">
   * - "Contact Email *" (type="email")
   * - "Contact Phone *" (type="tel")
   * - "Primary Contact Person Name *"
   * - "Primary Contact Person Title"
   */
  async fillProfileStep(data: {
    municipalityName?: string;
    municipalityCode?: string;
    province?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactPersonName?: string;
  }) {
    if (data.municipalityName) {
      const nameInput = this.page
        .locator('.input-wrapper')
        .filter({ hasText: /Full Municipality Name/i })
        .locator('input');
      await nameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nameInput.fill(data.municipalityName);
    }

    if (data.municipalityCode) {
      const codeInput = this.page
        .locator('.input-wrapper')
        .filter({ hasText: /Municipality Code/i })
        .locator('input');
      await codeInput.fill(data.municipalityCode);
    }

    if (data.province) {
      await this.page.locator('select#province').selectOption(data.province);
    }

    if (data.contactEmail) {
      const emailInput = this.page
        .locator('.input-wrapper')
        .filter({ hasText: /Contact Email/i })
        .locator('input');
      await emailInput.fill(data.contactEmail);
    }

    if (data.contactPhone) {
      const phoneInput = this.page
        .locator('.input-wrapper')
        .filter({ hasText: /Contact Phone/i })
        .locator('input');
      await phoneInput.fill(data.contactPhone);
    }

    if (data.contactPersonName) {
      const personInput = this.page
        .locator('.input-wrapper')
        .filter({ hasText: /Primary Contact Person Name/i })
        .locator('input');
      await personInput.fill(data.contactPersonName);
    }
  }

  /**
   * Fill team step (invite team members)
   */
  async fillTeamStep(data: { invitations: Array<{ email: string; role: string }> }) {
    for (const invite of data.invitations) {
      const emailInput = this.page.locator('input[type="email"]').last();
      const roleSelect = this.page.locator('select').last();
      const addButton = this.page.locator('button').filter({ hasText: /Add Another/i }).last();

      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.fill(invite.email);
      await roleSelect.selectOption(invite.role);
      await addButton.click();
    }
  }

  /**
   * Check if wizard is complete
   */
  async isComplete(): Promise<boolean> {
    return await this.completionStepTitle.isVisible();
  }
}
