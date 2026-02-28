/**
 * Mock supervisor data for field worker team management page.
 * Schedules, reviews, and ticket role assignments mapped to Water team members.
 */

import type { TeamSchedule, TeamReview, TicketRoleAssignment } from '../types/teams';

const now = Date.now();
const daysFromNow = (days: number) =>
  new Date(now + days * 86400000).toISOString().split('T')[0];
const daysAgo = (days: number) =>
  new Date(now - days * 86400000).toISOString().split('T')[0];

export const mockSchedules: TeamSchedule[] = [
  { id: 'sched-001', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', date: daysFromNow(0), shift: 'morning', status: 'scheduled' },
  { id: 'sched-002', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', date: daysFromNow(0), shift: 'morning', status: 'scheduled' },
  { id: 'sched-003', member_id: 'u-027-zodwa-ntuli', member_name: 'Zodwa Ntuli', date: daysFromNow(0), shift: 'afternoon', status: 'scheduled' },
  { id: 'sched-004', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', date: daysFromNow(1), shift: 'morning', status: 'scheduled' },
  { id: 'sched-005', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', date: daysFromNow(1), shift: 'afternoon', status: 'on_leave', notes: 'Family commitment' },
  { id: 'sched-006', member_id: 'u-027-zodwa-ntuli', member_name: 'Zodwa Ntuli', date: daysFromNow(1), shift: 'morning', status: 'scheduled' },
  { id: 'sched-007', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', date: daysFromNow(2), shift: 'afternoon', status: 'scheduled' },
  { id: 'sched-008', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', date: daysFromNow(2), shift: 'morning', status: 'scheduled' },
  { id: 'sched-009', member_id: 'u-027-zodwa-ntuli', member_name: 'Zodwa Ntuli', date: daysFromNow(3), shift: 'night', status: 'scheduled' },
  { id: 'sched-010', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', date: daysFromNow(3), shift: 'morning', status: 'absent', notes: 'Sick leave' },
];

export const mockReviews: TeamReview[] = [
  { id: 'rev-001', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', review_date: daysAgo(14), rating: 4, comments: 'Reliable and efficient. Handles pipe repairs with minimal supervision. Good communication with residents.', reviewer_id: 'u-019-thandi-dube', reviewer_name: 'Thandi Dube' },
  { id: 'rev-002', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', review_date: daysAgo(21), rating: 3, comments: 'Adequate performance. Needs improvement on completing field reports on time. Good technical skills.', reviewer_id: 'u-019-thandi-dube', reviewer_name: 'Thandi Dube' },
  { id: 'rev-003', member_id: 'u-027-zodwa-ntuli', member_name: 'Zodwa Ntuli', review_date: daysAgo(7), rating: 5, comments: 'Outstanding work ethic. Consistently completes tasks ahead of schedule. Mentors new team members effectively.', reviewer_id: 'u-019-thandi-dube', reviewer_name: 'Thandi Dube' },
  { id: 'rev-004', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', review_date: daysAgo(60), rating: 3, comments: 'Satisfactory quarter. Attendance issues early on but improved significantly in the last month.', reviewer_id: 'u-019-thandi-dube', reviewer_name: 'Thandi Dube' },
  { id: 'rev-005', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', review_date: daysAgo(45), rating: 4, comments: 'Strong improvement from previous review. Takes initiative on emergency callouts. Safety compliance excellent.', reviewer_id: 'u-019-thandi-dube', reviewer_name: 'Thandi Dube' },
];

export const mockRoleAssignments: TicketRoleAssignment[] = [
  { id: 'assign-001', ticket_id: 'tkt-water-001', tracking_number: 'EM-2026-001847', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', assigned_role: 'lead', assigned_at: daysAgo(2) },
  { id: 'assign-002', ticket_id: 'tkt-water-001', tracking_number: 'EM-2026-001847', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', assigned_role: 'support', assigned_at: daysAgo(2) },
  { id: 'assign-003', ticket_id: 'tkt-water-002', tracking_number: 'EM-2026-001923', member_id: 'u-027-zodwa-ntuli', member_name: 'Zodwa Ntuli', assigned_role: 'lead', assigned_at: daysAgo(1) },
  { id: 'assign-004', ticket_id: 'tkt-water-003', tracking_number: 'EM-2026-002015', member_id: 'u-025-lungelo-sithole', member_name: 'Lungelo Sithole', assigned_role: 'inspector', assigned_at: daysAgo(0) },
  { id: 'assign-005', ticket_id: 'tkt-water-004', tracking_number: 'EM-2026-002108', member_id: 'u-026-musa-hadebe', member_name: 'Musa Hadebe', assigned_role: 'lead', assigned_at: daysAgo(3) },
  { id: 'assign-006', ticket_id: 'tkt-water-005', tracking_number: 'EM-2026-002234', member_id: 'u-027-zodwa-ntuli', member_name: 'Zodwa Ntuli', assigned_role: 'support', assigned_at: daysAgo(1) },
];
