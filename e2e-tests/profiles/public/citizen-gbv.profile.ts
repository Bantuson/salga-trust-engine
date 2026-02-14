/**
 * Test profile: Citizen for GBV privacy testing
 */

export const profile = {
  name: 'Citizen GBV',
  role: 'citizen',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'citizen-gbv@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27603456789',
  metadata: {
    full_name: 'GBV Test Citizen',
    first_login: false,
    reports_count: 1,
    has_gbv_report: true,
    residence_verified: true,
  },
};
