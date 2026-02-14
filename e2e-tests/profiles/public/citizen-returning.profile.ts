/**
 * Test profile: Returning citizen with existing reports
 */

export const profile = {
  name: 'Citizen Returning',
  role: 'citizen',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'citizen-return@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27602345678',
  metadata: {
    full_name: 'Returning Citizen',
    first_login: false,
    reports_count: 5,
    residence_verified: true,
  },
};
