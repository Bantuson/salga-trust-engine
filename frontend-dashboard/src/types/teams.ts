/**
 * TypeScript type definitions for Teams management.
 *
 * Matches backend API schemas from:
 * - src/api/v1/teams.py
 * - src/models/team.py
 */

export interface Team {
  id: string;
  name: string;
  category: string;
  manager_id: string | null;
  manager_name: string | null;
  is_active: boolean;
  is_saps: boolean;
  member_count: number;
  active_ticket_count: number;
  created_at: string;
}

export interface TeamCreate {
  name: string;
  category: string;
  manager_id?: string;
  is_saps?: boolean;
}

export interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  joined_at: string | null;
}

export interface TeamInvitation {
  id: string;
  municipality_id: string;
  team_id: string | null;
  email: string;
  role: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired' | 'removed';
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface InvitationCreate {
  email: string;
  role: string;
  team_id?: string;
}

export interface BulkInvitationCreate {
  invitations: InvitationCreate[];
}

export interface TeamSchedule {
  id: string;
  member_id: string;
  member_name: string;
  date: string;
  shift: 'morning' | 'afternoon' | 'night';
  status: 'scheduled' | 'on_leave' | 'absent';
  notes?: string;
}

export interface TeamReview {
  id: string;
  member_id: string;
  member_name: string;
  review_date: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comments: string;
  reviewer_id: string;
  reviewer_name: string;
}

export interface TicketRoleAssignment {
  id: string;
  ticket_id: string;
  tracking_number: string;
  member_id: string;
  member_name: string;
  assigned_role: string;
  assigned_at: string;
}
