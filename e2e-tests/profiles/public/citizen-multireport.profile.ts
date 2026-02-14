/**
 * Test profile: Citizen for multi-report scenarios
 */

export const profile = {
  name: 'Citizen MultiReport',
  role: 'citizen',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'citizen-multi@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27604567890',
  metadata: {
    full_name: 'Multi Report Citizen',
    first_login: false,
    reports_count: 10,
  },
};
