/**
 * Test profile: New citizen with no prior reports
 */

export const profile = {
  name: 'Citizen New',
  role: 'citizen',
  tenantId: '00000000-0000-0000-0000-000000000001', // Johannesburg test tenant
  email: 'citizen-new@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27601234567',
  metadata: {
    full_name: 'New Citizen',
    first_login: true,
    reports_count: 0,
  },
};
