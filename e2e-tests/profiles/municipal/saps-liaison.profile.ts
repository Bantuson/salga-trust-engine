/**
 * Test profile: SAPS liaison for GBV case handling
 */

export const profile = {
  name: 'SAPS Liaison',
  role: 'saps_liaison',
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'saps@test-jozi-001.test',
  password: process.env.TEST_PASSWORD || 'Test123!@#',
  phone: '+27704567890',
  metadata: {
    full_name: 'SAPS Liaison User',
    app_metadata: {
      role: 'saps_liaison',
      tenant_id: '00000000-0000-0000-0000-000000000001',
    },
    station: 'Johannesburg Central SAPS',
    badge_number: 'SAPS-12345',
  },
};
