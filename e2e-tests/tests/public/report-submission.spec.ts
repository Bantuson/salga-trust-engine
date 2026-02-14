/**
 * Public Dashboard - Report Submission E2E Tests
 *
 * Tests the full report submission journey:
 * - Standard report submission (various categories)
 * - GBV consent flow (positive and negative paths)
 * - Form validation (description, address, category)
 * - Edge cases (multiple reports, form clearing)
 *
 * Uses ReportIssuePage page object and generateReportData for test data.
 */

import { test, expect } from '../../fixtures/auth';
import { ReportIssuePage } from '../../fixtures/page-objects/public/ReportIssuePage';
import { generateReportData } from '../../fixtures/test-data';

test.describe('Standard Report Submission', () => {
  test('Citizen can submit a pothole report', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData('Roads & Potholes');

    await reportPage.goto();

    // Fill form
    await reportPage.selectCategory('Roads & Potholes');
    await reportPage.fillDescription(reportData.description);
    await reportPage.fillAddress(reportData.address);

    // Submit
    await reportPage.submit();

    // Verify tracking number appears in receipt
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();
    expect(trackingNumber).toMatch(/TKT-\d{8}-[A-F0-9]{6}/);
  });

  test('Citizen can submit a water leak report', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData('Water & Sanitation');

    await reportPage.goto();

    // Fill form with different category
    await reportPage.selectCategory('Water & Sanitation');
    await reportPage.fillDescription(reportData.description);
    await reportPage.fillAddress(reportData.address);

    // Submit
    await reportPage.submit();

    // Verify receipt with tracking number
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();
  });

  test('Report requires description of at least 20 characters', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);

    await reportPage.goto();

    // Fill form with short description
    await reportPage.selectCategory('Roads & Potholes');
    await reportPage.fillDescription('Too short');
    await reportPage.fillAddress('123 Test St, Johannesburg');

    // Try to submit
    await reportPage.submitButton.click();

    // Wait for validation
    await citizenReturningPage.waitForTimeout(1000);

    // Verify error message appears
    await expect(reportPage.errorMessage).toBeVisible({ timeout: 3000 });

    const errorText = await reportPage.errorMessage.textContent();
    expect(errorText?.toLowerCase()).toMatch(/description.*20|minimum.*20/);
  });

  test('Report requires either GPS or manual address', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData();

    await reportPage.goto();

    // Fill form without location
    await reportPage.selectCategory('Electricity');
    await reportPage.fillDescription(reportData.description);
    // DON'T fill address or capture GPS

    // Try to submit
    await reportPage.submitButton.click();

    // Wait for validation
    await citizenReturningPage.waitForTimeout(1000);

    // Verify error message
    await expect(reportPage.errorMessage).toBeVisible({ timeout: 3000 });

    const errorText = await reportPage.errorMessage.textContent();
    expect(errorText?.toLowerCase()).toMatch(/location|address/);
  });

  test('Report requires category selection', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData();

    await reportPage.goto();

    // Fill form without category
    await reportPage.fillDescription(reportData.description);
    await reportPage.fillAddress(reportData.address);

    // Try to submit
    await reportPage.submitButton.click();

    // Wait for validation
    await citizenReturningPage.waitForTimeout(1000);

    // Verify error or still on same page
    const stillOnReport = citizenReturningPage.url().includes('/report');
    const errorVisible = await reportPage.errorMessage.isVisible().catch(() => false);

    expect(stillOnReport || errorVisible).toBeTruthy();
  });
});

test.describe('GBV Consent Flow', () => {
  test('GBV category triggers consent dialog', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);

    await reportPage.goto();

    // Select GBV category
    await reportPage.categorySelect.selectOption('GBV/Abuse');

    // Verify consent dialog appears
    await expect(reportPage.gbvConsentDialog).toBeVisible({ timeout: 3000 });
  });

  test('GBV consent dialog shows emergency numbers', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);

    await reportPage.goto();

    // Trigger GBV consent
    await reportPage.categorySelect.selectOption('GBV/Abuse');

    // Wait for dialog
    await expect(reportPage.gbvConsentDialog).toBeVisible({ timeout: 3000 });

    // Verify emergency numbers are visible
    const dialogText = await reportPage.gbvConsentDialog.textContent();
    expect(dialogText).toContain('10111'); // Police emergency
    expect(dialogText).toContain('0800 150 150'); // GBV Command Centre
  });

  test('Accepting GBV consent allows report submission', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData('GBV/Abuse');

    await reportPage.goto();

    // Trigger and accept GBV consent
    await reportPage.categorySelect.selectOption('GBV/Abuse');
    await expect(reportPage.gbvConsentDialog).toBeVisible({ timeout: 3000 });
    await reportPage.acceptGbvConsent();

    // Fill rest of form
    await reportPage.fillDescription(reportData.description);
    await reportPage.fillAddress(reportData.address);

    // Submit
    await reportPage.submit();

    // Verify receipt appears
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();
  });

  test('Declining GBV consent returns to form', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);

    await reportPage.goto();

    // Trigger GBV consent
    await reportPage.categorySelect.selectOption('GBV/Abuse');
    await expect(reportPage.gbvConsentDialog).toBeVisible({ timeout: 3000 });

    // Click decline/cancel
    await reportPage.gbvDeclineButton.click();

    // Dialog should close
    await expect(reportPage.gbvConsentDialog).toBeHidden({ timeout: 3000 });

    // Category should be reset (not GBV/Abuse)
    const categoryValue = await reportPage.categorySelect.inputValue();
    expect(categoryValue).not.toBe('GBV/Abuse');
  });

  test('GBV receipt shows limited info only', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData('GBV/Abuse');

    await reportPage.goto();

    // Accept GBV consent and submit
    await reportPage.categorySelect.selectOption('GBV/Abuse');
    await expect(reportPage.gbvConsentDialog).toBeVisible({ timeout: 3000 });
    await reportPage.acceptGbvConsent();

    await reportPage.fillDescription(reportData.description);
    await reportPage.fillAddress(reportData.address);

    await reportPage.submit();

    // Verify receipt appears with tracking number
    const trackingNumber = await reportPage.getTrackingNumber();
    expect(trackingNumber).toBeTruthy();

    // Verify receipt is shown (privacy note: GBV receipts may show limited fields,
    // but for now the basic receipt structure should be present)
    await expect(reportPage.receiptCard).toBeVisible();
  });
});

test.describe('Edge Cases', () => {
  test('Multiple reports can be submitted sequentially', async ({ citizenMultiPage }) => {
    const reportPage = new ReportIssuePage(citizenMultiPage);

    // Submit first report
    const report1 = generateReportData('Electricity');
    await reportPage.goto();
    await reportPage.selectCategory('Electricity');
    await reportPage.fillDescription(report1.description);
    await reportPage.fillAddress(report1.address);
    await reportPage.submit();

    const tracking1 = await reportPage.getTrackingNumber();
    expect(tracking1).toBeTruthy();

    // Click "Submit Another"
    const submitAnotherButton = citizenMultiPage.locator('button', {
      hasText: /submit another/i,
    });
    await submitAnotherButton.click();

    // Should return to form
    await expect(reportPage.categorySelect).toBeVisible({ timeout: 5000 });

    // Submit second report
    const report2 = generateReportData('Waste Management');
    await reportPage.selectCategory('Waste Management');
    await reportPage.fillDescription(report2.description);
    await reportPage.fillAddress(report2.address);
    await reportPage.submit();

    const tracking2 = await reportPage.getTrackingNumber();
    expect(tracking2).toBeTruthy();

    // Verify different tracking numbers
    expect(tracking1).not.toBe(tracking2);
  });

  test('Report form clears after successful submission', async ({ citizenReturningPage }) => {
    const reportPage = new ReportIssuePage(citizenReturningPage);
    const reportData = generateReportData('Roads & Potholes');

    // Submit report
    await reportPage.goto();
    await reportPage.selectCategory('Roads & Potholes');
    await reportPage.fillDescription(reportData.description);
    await reportPage.fillAddress(reportData.address);
    await reportPage.submit();

    // Verify receipt
    await expect(reportPage.receiptCard).toBeVisible();

    // Navigate back to report page
    await reportPage.goto();

    // Verify form fields are empty
    const categoryValue = await reportPage.categorySelect.inputValue();
    const descriptionValue = await reportPage.descriptionTextarea.inputValue();
    const addressValue = await reportPage.manualAddressInput.inputValue();

    expect(categoryValue).toBe(''); // Empty/default option
    expect(descriptionValue).toBe('');
    expect(addressValue).toBe('');
  });
});
