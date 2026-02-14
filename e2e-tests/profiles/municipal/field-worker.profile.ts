/**
 * Test profile: Field worker for on-site ticket resolution
 */

export const profile = {
  name: 'Field Worker',
  role: 'field_worker',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'fieldworker@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27703456789',
  metadata: {
    full_name: 'Field Worker User',
    app_metadata: {
      role: 'field_worker',
      tenant_id: '00000000-0000-0000-0000-000000000001',
    },
    department: 'Roads & Potholes',
    team_id: 'team-roads-001',
  },
};
