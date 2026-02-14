/**
 * Test profile: Field worker for on-site ticket resolution
 */

export const profile = {
  name: 'Field Worker',
  role: 'field_worker',
  tenantId: 'test-jozi-001',
  email: 'fieldworker@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27703456789',
  metadata: {
    full_name: 'Field Worker User',
    app_metadata: {
      role: 'field_worker',
      tenant_id: 'test-jozi-001',
    },
    department: 'Roads & Potholes',
    team_id: 'team-roads-001',
  },
};
