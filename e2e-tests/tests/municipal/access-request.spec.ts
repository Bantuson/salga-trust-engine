/**
 * E2E Tests: Municipal Access Request
 *
 * Tests the public access request form for municipalities to request platform access.
 * Verifies form validation, file uploads, auto-save, and submission flow.
 *
 * Coverage:
 * - Form submission with valid data
 * - Field validation (required fields, email format)
 * - Document upload functionality
 * - Auto-save to localStorage
 * - Province dropdown contains all 9 SA provinces
 */

import { test, expect, Page } from '@playwright/test';
import { RequestAccessPage } from '../../fixtures/page-objects/dashboard/RequestAccessPage';
import * as path from 'path';
import * as fs from 'fs';

// South African provinces (official list)
const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
];

test.describe('Municipal Access Request', () => {
  let page: Page;
  let requestAccessPage: RequestAccessPage;

  test.beforeEach(async ({ browser }) => {
    // Create fresh context without authentication (public form)
    const context = await browser.newContext({ baseURL: 'http://localhost:5174' });
    page = await context.newPage();
    requestAccessPage = new RequestAccessPage(page);
    await requestAccessPage.goto();
  });

  test.afterEach(async () => {
    await page.context().close();
  });

  test('Municipality can submit access request', async () => {
    // Fill form with valid data
    await requestAccessPage.fillForm({
      municipalityName: 'City of Cape Town',
      province: 'Western Cape',
      municipalityCode: 'CPT',
      contactName: 'John Smith',
      contactEmail: 'john.smith@capetown.gov.za',
      contactPhone: '+27214001111',
      notes: 'We would like to join the SALGA Trust Engine pilot program.',
    });

    // Submit form
    await requestAccessPage.submit();

    // Verify success confirmation
    const isSuccess = await requestAccessPage.isSuccessShown();
    expect(isSuccess).toBe(true);

    // Verify success message contains confirmation details
    await expect(requestAccessPage.successState).toContainText(/submitted/i);
    await expect(requestAccessPage.successState).toContainText(/5 business days/i);
    await expect(requestAccessPage.successState).toContainText('john.smith@capetown.gov.za');
  });

  test('Access request validates required fields', async () => {
    // Submit empty form
    await requestAccessPage.submitButton.click();

    // Wait for validation errors
    await page.waitForTimeout(500);

    // Verify validation errors are displayed
    const validationErrors = page.locator('div, span').filter({ hasText: /required|invalid/i });
    const errorCount = await validationErrors.count();
    expect(errorCount).toBeGreaterThan(0);

    // Verify specific required fields have errors
    const municipalityError = page.locator('div, span').filter({ hasText: /municipality.*required/i });
    await expect(municipalityError.first()).toBeVisible();

    const provinceError = page.locator('div, span').filter({ hasText: /province.*required/i });
    await expect(provinceError.first()).toBeVisible();

    const contactNameError = page.locator('div, span').filter({ hasText: /contact.*name.*required/i });
    await expect(contactNameError.first()).toBeVisible();

    const emailError = page.locator('div, span').filter({ hasText: /email.*required/i });
    await expect(emailError.first()).toBeVisible();
  });

  test('Access request validates email format', async () => {
    // Fill form with invalid email
    await requestAccessPage.municipalityNameInput.fill('Test Municipality');
    await requestAccessPage.provinceSelect.selectOption('Gauteng');
    await requestAccessPage.contactNameInput.fill('Jane Doe');
    await requestAccessPage.contactEmailInput.fill('invalid-email');

    // Submit form
    await requestAccessPage.submitButton.click();
    await page.waitForTimeout(500);

    // Verify email validation error
    const emailError = page.locator('div, span').filter({ hasText: /invalid.*email/i });
    await expect(emailError.first()).toBeVisible();
  });

  test('Access request accepts document upload', async () => {
    // Create a test file
    const testFilePath = path.join(process.cwd(), 'test-document.txt');
    fs.writeFileSync(testFilePath, 'Test document content');

    try {
      // Upload file
      await requestAccessPage.uploadDocument(testFilePath);

      // Wait for file to appear in file list
      await page.waitForTimeout(500);

      // Verify file is listed
      const fileList = page.locator('div').filter({ hasText: /test-document\.txt/i });
      await expect(fileList.first()).toBeVisible();

      // Verify remove button is present
      const removeButton = page.locator('button').filter({ hasText: /remove/i });
      await expect(removeButton.first()).toBeVisible();
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  test('Access request auto-saves draft to localStorage', async () => {
    // Fill partial form
    await requestAccessPage.municipalityNameInput.fill('eThekwini Municipality');
    await requestAccessPage.provinceSelect.selectOption('KwaZulu-Natal');
    await requestAccessPage.contactNameInput.fill('Sarah Johnson');
    await requestAccessPage.contactEmailInput.fill('sarah@ethekwini.gov.za');

    // Wait for auto-save (debounce)
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify fields are restored
    await expect(requestAccessPage.municipalityNameInput).toHaveValue('eThekwini Municipality');
    await expect(requestAccessPage.provinceSelect).toHaveValue('KwaZulu-Natal');
    await expect(requestAccessPage.contactNameInput).toHaveValue('Sarah Johnson');
    await expect(requestAccessPage.contactEmailInput).toHaveValue('sarah@ethekwini.gov.za');
  });

  test('Access request province dropdown has all 9 SA provinces', async () => {
    // Get all province options
    const provinceOptions = await requestAccessPage.provinceSelect.locator('option').allTextContents();

    // Filter out empty/placeholder option
    const actualProvinces = provinceOptions.filter((opt) => opt.trim() && opt !== 'Select province');

    // Verify count
    expect(actualProvinces.length).toBe(9);

    // Verify each province is present
    for (const province of SA_PROVINCES) {
      expect(actualProvinces).toContain(province);
    }
  });
});
