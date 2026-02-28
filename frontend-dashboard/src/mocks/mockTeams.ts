/**
 * Mock teams data for municipal dashboard fallback rendering.
 * 6 teams matching CATEGORY_CONFIG categories.
 *
 * SEC-05: SAPS Liaison Unit is included here with is_saps: true.
 * Team members include saps_liaison-role users for that team only.
 */

import type { Team, TeamMember } from '../types/teams';

const now = Date.now();
const weeksAgo = (weeks: number) =>
  new Date(now - weeks * 7 * 86400000).toISOString();

export const mockTeams: Team[] = [
  {
    id: 'team-001-water',
    name: 'Water & Sanitation',
    category: 'water',
    manager_id: 'u-019-thandi-dube',
    manager_name: 'Thandi Dube',
    is_active: true,
    is_saps: false,
    member_count: 6,
    active_ticket_count: 5,
    created_at: weeksAgo(24),
  },
  {
    id: 'team-002-electricity',
    name: 'Electricity Services',
    category: 'electricity',
    manager_id: 'u-020-johan-du-plessis',
    manager_name: 'Johan du Plessis',
    is_active: true,
    is_saps: false,
    member_count: 5,
    active_ticket_count: 4,
    created_at: weeksAgo(22),
  },
  {
    id: 'team-003-roads',
    name: 'Roads & Infrastructure',
    category: 'roads',
    manager_id: 'u-021-riana-venter',
    manager_name: 'Riana Venter',
    is_active: true,
    is_saps: false,
    member_count: 7,
    active_ticket_count: 6,
    created_at: weeksAgo(20),
  },
  {
    id: 'team-004-waste',
    name: 'Waste Management',
    category: 'waste',
    manager_id: 'u-022-nkosinathi-gumede',
    manager_name: 'Nkosinathi Gumede',
    is_active: true,
    is_saps: false,
    member_count: 4,
    active_ticket_count: 3,
    created_at: weeksAgo(18),
  },
  {
    id: 'team-005-general',
    name: 'General Services',
    category: 'other',
    manager_id: 'u-019-thandi-dube',
    manager_name: 'Thandi Dube',
    is_active: true,
    is_saps: false,
    member_count: 3,
    active_ticket_count: 2,
    created_at: weeksAgo(16),
  },
  {
    id: 'team-006-saps',
    name: 'SAPS Liaison Unit',
    category: 'gbv',
    manager_id: 'u-033-colonel-bhengu',
    manager_name: 'Colonel Nozipho Bhengu',
    is_active: true,
    is_saps: true,
    member_count: 3,
    active_ticket_count: 2,
    created_at: weeksAgo(14),
  },
];

const memberJoinedAt = (weeks: number) =>
  new Date(now - weeks * 7 * 86400000).toISOString();

export const mockTeamMembers: Record<string, TeamMember[]> = {
  'team-001-water': [
    { id: 'u-025-lungelo-sithole', email: 'lungelo.sithole@emthanjeni.gov.za', full_name: 'Lungelo Sithole', role: 'field_worker', joined_at: memberJoinedAt(20) },
    { id: 'u-026-musa-hadebe', email: 'musa.hadebe@emthanjeni.gov.za', full_name: 'Musa Hadebe', role: 'field_worker', joined_at: memberJoinedAt(18) },
    { id: 'u-027-zodwa-ntuli', email: 'zodwa.ntuli@emthanjeni.gov.za', full_name: 'Zodwa Ntuli', role: 'field_worker', joined_at: memberJoinedAt(16) },
    { id: 'u-019-thandi-dube', email: 'thandi.dube@emthanjeni.gov.za', full_name: 'Thandi Dube', role: 'manager', joined_at: memberJoinedAt(24) },
  ],
  'team-002-electricity': [
    { id: 'u-028-siphamandla-zungu', email: 'siphamandla.zungu@emthanjeni.gov.za', full_name: 'Siphamandla Zungu', role: 'field_worker', joined_at: memberJoinedAt(19) },
    { id: 'u-029-jabulani-shabalala', email: 'jabulani.shabalala@emthanjeni.gov.za', full_name: 'Jabulani Shabalala', role: 'field_worker', joined_at: memberJoinedAt(17) },
    { id: 'u-020-johan-du-plessis', email: 'johan.duplessis@emthanjeni.gov.za', full_name: 'Johan du Plessis', role: 'manager', joined_at: memberJoinedAt(22) },
  ],
  'team-003-roads': [
    { id: 'u-030-andile-dlamini', email: 'andile.dlamini@emthanjeni.gov.za', full_name: 'Andile Dlamini', role: 'field_worker', joined_at: memberJoinedAt(18) },
    { id: 'u-031-nomvula-ngcobo', email: 'nomvula.ngcobo@emthanjeni.gov.za', full_name: 'Nomvula Ngcobo', role: 'field_worker', joined_at: memberJoinedAt(15) },
    { id: 'u-032-sifiso-mthethwa', email: 'sifiso.mthethwa@emthanjeni.gov.za', full_name: 'Sifiso Mthethwa', role: 'field_worker', joined_at: memberJoinedAt(12) },
    { id: 'u-021-riana-venter', email: 'riana.venter@emthanjeni.gov.za', full_name: 'Riana Venter', role: 'manager', joined_at: memberJoinedAt(20) },
  ],
  'team-004-waste': [
    { id: 'u-025-lungelo-sithole', email: 'lungelo.sithole@emthanjeni.gov.za', full_name: 'Lungelo Sithole', role: 'field_worker', joined_at: memberJoinedAt(16) },
    { id: 'u-026-musa-hadebe', email: 'musa.hadebe@emthanjeni.gov.za', full_name: 'Musa Hadebe', role: 'field_worker', joined_at: memberJoinedAt(14) },
    { id: 'u-022-nkosinathi-gumede', email: 'nkosinathi.gumede@emthanjeni.gov.za', full_name: 'Nkosinathi Gumede', role: 'manager', joined_at: memberJoinedAt(18) },
  ],
  'team-005-general': [
    { id: 'u-027-zodwa-ntuli', email: 'zodwa.ntuli@emthanjeni.gov.za', full_name: 'Zodwa Ntuli', role: 'field_worker', joined_at: memberJoinedAt(14) },
    { id: 'u-019-thandi-dube', email: 'thandi.dube@emthanjeni.gov.za', full_name: 'Thandi Dube', role: 'manager', joined_at: memberJoinedAt(16) },
  ],
  'team-006-saps': [
    { id: 'u-033-colonel-bhengu', email: 'n.bhengu@saps.gov.za', full_name: 'Colonel Nozipho Bhengu', role: 'saps_liaison', joined_at: memberJoinedAt(14) },
    { id: 'u-034-captain-moyo', email: 't.moyo@saps.gov.za', full_name: 'Captain Thandeka Moyo', role: 'saps_liaison', joined_at: memberJoinedAt(12) },
    { id: 'u-035-sergeant-jacobs', email: 'd.jacobs@saps.gov.za', full_name: 'Sergeant Desiree Jacobs', role: 'saps_liaison', joined_at: memberJoinedAt(10) },
  ],
};
