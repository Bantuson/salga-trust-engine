/**
 * Test profile: Municipal manager for ticket management
 */

export const profile = {
  name: 'Manager',
  role: 'manager',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'manager@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27702345678',
  metadata: {
    full_name: 'Manager User',
    app_metadata: {
      role: 'manager',
      tenant_id: '00000000-0000-0000-0000-000000000001',
    },
    department: 'Water & Sanitation',
  },
};
