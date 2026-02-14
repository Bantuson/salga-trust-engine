/**
 * Test profile: Citizen for status tracking tests
 */

export const profile = {
  name: 'Citizen Tracking',
  role: 'citizen',
  tenantId: 'test-jozi-001',
  email: 'citizen-track@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27605678901',
  metadata: {
    full_name: 'Tracking Citizen',
    first_login: false,
    reports_count: 3,
    active_tickets: 2,
  },
};
