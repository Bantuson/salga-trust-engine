import type { CitizenTicket, CitizenStats } from '../hooks/useCitizenReports';

const now = Date.now();
const daysAgo = (days: number, hoursOffset = 0) =>
  new Date(now - days * 86400000 - hoursOffset * 3600000).toISOString();

/**
 * Demo tickets shown when a citizen visits the portal without logging in.
 * These demonstrate the full ticket lifecycle with SA-authentic names and addresses.
 *
 * Location: Colesberg, Emthanjeni Local Municipality, Northern Cape.
 *
 * SEC-05 NOTE: Ticket 5 is a GBV/sensitive ticket. This is correct — citizens CAN
 * see their OWN sensitive cases in their personal portal view. The SEC-05 firewall
 * prevents OTHER users and the public dashboard from seeing sensitive data.
 * Only this citizen's personal view (demo mode) shows this ticket.
 */
export const DEMO_TICKETS: CitizenTicket[] = [
  {
    // Resolved ticket (oldest) — water outage in Kuyasa, Colesberg
    tracking_number: 'TKT-20260221-COL001',
    category: 'water',
    status: 'resolved',
    created_at: daysAgo(6),
    address: '14 Murray St, Ward 2, Kuyasa, Colesberg',
    severity: 'high',
    assigned_to_name: 'Bongani Nkosi',
    assigned_team_name: 'Water & Sanitation Team',
    media_count: 2,
    is_sensitive: false,
  },
  {
    // In-progress ticket — pothole on major intersection, Colesberg
    tracking_number: 'TKT-20260224-COL002',
    category: 'roads',
    status: 'in_progress',
    created_at: daysAgo(3),
    address: 'cnr Church St & Joubert St, Ward 1, Colesberg Central',
    severity: 'medium',
    assigned_to_name: 'Johan du Plessis',
    assigned_team_name: 'Roads & Infrastructure',
    media_count: 3,
    is_sensitive: false,
  },
  {
    // Open ticket (recent) — electricity outage, Lowryville
    tracking_number: 'TKT-20260226-COL003',
    category: 'electricity',
    status: 'open',
    created_at: daysAgo(1, 4),
    address: '22 Voortrekker St, Ward 3, Lowryville, Colesberg',
    severity: 'high',
    assigned_to_name: null,
    assigned_team_name: 'Electricity Services',
    media_count: 1,
    is_sensitive: false,
  },
  {
    // Closed ticket — illegal dumping near Koleshoogte, Colesberg
    tracking_number: 'TKT-20260218-COL004',
    category: 'waste',
    status: 'closed',
    created_at: daysAgo(9),
    address: 'Norvalspont Rd near Koleshoogte, Ward 4',
    severity: 'low',
    assigned_to_name: 'Sipho Ndlovu',
    assigned_team_name: 'Waste Management',
    media_count: 0,
    is_sensitive: false,
  },
  {
    // Sensitive ticket — citizen's own GBV case handled by SAPS (SEC-05 compliant)
    // Citizens CAN see their own sensitive cases. This ticket is only visible here
    // in the citizen's personal view. Public dashboard never exposes this data.
    tracking_number: 'TKT-20260225-COL-SAP001',
    status: 'in_progress',
    is_sensitive: true,
    assigned_officer_name: 'Capt. T. Moyo',
    station_name: 'Colesberg SAPS',
    station_phone: '051-753-1011',
  },
];

export const DEMO_STATS: CitizenStats = {
  total_reports: 5,
  resolved_count: 2,
  avg_resolution_days: 3.4,
  municipality_avg_resolution_days: 4.1,
};
