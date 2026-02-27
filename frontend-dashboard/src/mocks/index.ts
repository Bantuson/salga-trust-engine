/**
 * Central re-export of all mock data for the municipal operations dashboard.
 *
 * Usage: import { mockTickets, mockTeams, ... } from '../mocks';
 *
 * SEC-05: mockTickets and mockSAPSTickets are STRICTLY separated.
 * - mockTickets: general service tickets (is_sensitive: false, no 'gbv' category)
 * - mockSAPSTickets: GBV cases (is_sensitive: true, category: 'gbv')
 *   — only import mockSAPSTickets in SAPSReportsPage
 */

// Users
export { mockUsers } from './mockUsers';
export type { MockUser } from './mockUsers';

// Tickets (general — SEC-05: no GBV data)
export { mockTickets } from './mockTickets';

// SAPS/GBV cases (SEC-05 isolated — import ONLY in SAPSReportsPage)
export { mockSAPSTickets } from './mockSAPSCases';

// Teams
export { mockTeams, mockTeamMembers } from './mockTeams';

// Analytics
export {
  mockAnalyticsData,
  mockDashboardMetrics,
  mockVolumeData,
  mockSLAData,
  mockWorkloadData,
  mockKPIMetrics,
} from './mockAnalytics';

// Settings
export { mockSLAConfigs, mockMunicipalityProfile } from './mockSettings';
