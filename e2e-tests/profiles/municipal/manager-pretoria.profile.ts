/**
 * Test profile: Municipal manager for Pretoria (multi-tenant testing)
 */

export const profile = {
  name: 'Manager Pretoria',
  role: 'manager',
  tenantId: '00000000-0000-0000-0000-000000000002',
  email: 'manager@test-pretoria-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27712345678',
  metadata: {
    full_name: 'Manager Pretoria User',
    app_metadata: {
      role: 'manager',
      tenant_id: '00000000-0000-0000-0000-000000000002',
    },
    department: 'Water & Sanitation',
  },
};
