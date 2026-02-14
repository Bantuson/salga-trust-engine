/**
 * Test profile: Municipal manager for ticket management
 */

export const profile = {
  name: 'Manager',
  role: 'manager',
  tenantId: 'test-jozi-001',
  email: 'manager@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27702345678',
  metadata: {
    full_name: 'Manager User',
    app_metadata: {
      role: 'manager',
      tenant_id: 'test-jozi-001',
    },
    department: 'Water & Sanitation',
  },
};
