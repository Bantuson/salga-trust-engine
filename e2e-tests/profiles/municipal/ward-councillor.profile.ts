/**
 * Test profile: Ward councillor with ward-specific access
 */

export const profile = {
  name: 'Ward Councillor',
  role: 'ward_councillor',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'councillor@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27705678901',
  metadata: {
    full_name: 'Ward Councillor User',
    app_metadata: {
      role: 'ward_councillor',
      tenant_id: '00000000-0000-0000-0000-000000000001',
    },
    ward_id: 'ward-123',
    ward_name: 'Ward 123 - Sandton',
  },
};
