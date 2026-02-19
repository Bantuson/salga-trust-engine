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
