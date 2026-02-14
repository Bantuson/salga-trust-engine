/**
 * Page Object: Municipal Dashboard Onboarding Wizard Page
 *
 * Encapsulates interactions with OnboardingWizardPage.tsx
 * Multi-step wizard: Welcome → Profile → Team → Wards → SLA → Completion
 */

import { Page, Locator } from '@playwright/test';

export class OnboardingWizardPage {
  readonly page: Page;

  // Navigation buttons
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly skipButton: Locator;
  readonly completeButton: Locator;

  // Progress indicator
  readonly progressIndicator: Locator;

  // Step-specific locators (will be used conditionally based on current step)
  readonly welcomeStepTitle: Locator;
  readonly profileStepTitle: Locator;
  readonly teamStepTitle: Locator;
  readonly wardsStepTitle: Locator;
  readonly slaStepTitle: Locator;
  readonly completionStepTitle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.nextButton = page.locator('button').filter({ hasText: /next|continue/i });
    this.backButton = page.locator('button').filter({ hasText: /back|previous/i });
    this.skipButton = page.locator('button').filter({ hasText: /skip/i });
    this.completeButton = page.locator('button').filter({ hasText: /complete|finish/i });

    // Progress
    this.progressIndicator = page.locator('[class*="progress"], [class*="wizard"]').first();

    // Step titles
    this.welcomeStepTitle = page.locator('h1, h2').filter({ hasText: /welcome/i });
    this.profileStepTitle = page.locator('h1, h2').filter({ hasText: /profile/i });
    this.teamStepTitle = page.locator('h1, h2').filter({ hasText: /team|invite/i });
    this.wardsStepTitle = page.locator('h1, h2').filter({ hasText: /wards/i });
    this.slaStepTitle = page.locator('h1, h2').filter({ hasText: /sla/i });
    this.completionStepTitle = page.locator('h1, h2').filter({ hasText: /complete|done/i });
  }

  /**
   * Navigate to onboarding wizard
   */
  async goto() {
    await this.page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  }

  /**
   * Get current step based on visible title
   */
  async getCurrentStep(): Promise<string> {
    if (await this.welcomeStepTitle.isVisible()) return 'welcome';
    if (await this.profileStepTitle.isVisible()) return 'profile';
    if (await this.teamStepTitle.isVisible()) return 'team';
    if (await this.wardsStepTitle.isVisible()) return 'wards';
    if (await this.slaStepTitle.isVisible()) return 'sla';
    if (await this.completionStepTitle.isVisible()) return 'complete';
    return 'unknown';
  }

  /**
   * Go to next step
   */
  async goToNextStep() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500); // Allow step transition animation
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
   * Fill profile step (example method for specific step)
   */
  async fillProfileStep(data: {
    municipalityName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }) {
    // This would be expanded based on actual ProfileStep form fields
    // For now, generic input matching
    if (data.municipalityName) {
      const nameInput = this.page.locator('input').filter({
        has: this.page.locator('label:has-text("Municipality")'),
      }).first();
      await nameInput.fill(data.municipalityName);
    }

    if (data.contactEmail) {
      const emailInput = this.page.locator('input[type="email"]').first();
      await emailInput.fill(data.contactEmail);
    }

    if (data.contactPhone) {
      const phoneInput = this.page.locator('input[type="tel"]').first();
      await phoneInput.fill(data.contactPhone);
    }
  }

  /**
   * Fill team step (invite team members)
   */
  async fillTeamStep(data: { invitations: Array<{ email: string; role: string }> }) {
    // Add team members one by one
    for (const invite of data.invitations) {
      const emailInput = this.page.locator('input[type="email"]').last();
      const roleSelect = this.page.locator('select').last();
      const addButton = this.page.locator('button').filter({ hasText: /add|invite/i }).last();

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
