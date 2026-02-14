/**
 * Test profile: New citizen with no prior reports
 */

export const profile = {
  name: 'Citizen New',
  role: 'citizen',
  tenantId: 'test-jozi-001',
  email: 'citizen-new@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27601234567',
  metadata: {
    full_name: 'New Citizen',
    first_login: true,
    reports_count: 0,
  },
};
