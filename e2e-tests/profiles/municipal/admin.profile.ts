/**
 * Test profile: Municipal admin with full system access
 */

export const profile = {
  name: 'Admin',
  role: 'admin',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27701234567',
  metadata: {
    full_name: 'Admin User',
    app_metadata: {
      role: 'admin',
      tenant_id: '00000000-0000-0000-0000-000000000001',
    },
  },
};
