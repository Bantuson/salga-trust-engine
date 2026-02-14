/**
 * Test profile: Municipal manager for Pretoria (multi-tenant testing)
 */

export const profile = {
  name: 'Manager Pretoria',
  role: 'manager',
  tenantId: 'test-pretoria-001',
  email: 'manager@test-pretoria-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27712345678',
  metadata: {
    full_name: 'Manager Pretoria User',
    app_metadata: {
      role: 'manager',
      tenant_id: 'test-pretoria-001',
    },
    department: 'Water & Sanitation',
  },
};
