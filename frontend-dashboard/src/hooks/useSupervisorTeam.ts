/**
 * useSupervisorTeam — Data hook for Field Worker (Supervisor) Team page.
 *
 * Fetches supervisor's team, members, schedules, reviews, and role assignments.
 * Falls back to mock data when backend is unavailable.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchTeams,
  fetchTeamMembers,
  fetchTeamSchedules,
  fetchTeamReviews,
  fetchTicketRoleAssignments,
} from '../services/api';
import type { Team, TeamMember, TeamSchedule, TeamReview, TicketRoleAssignment } from '../types/teams';
import { mockTeams, mockTeamMembers } from '../mocks/mockTeams';
import { mockSchedules, mockReviews, mockRoleAssignments } from '../mocks/mockSupervisorData';

interface UseSupervisorTeamReturn {
  team: Team | null;
  members: TeamMember[];
  schedules: TeamSchedule[];
  reviews: TeamReview[];
  roleAssignments: TicketRoleAssignment[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSupervisorTeam(): UseSupervisorTeamReturn {
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [reviews, setReviews] = useState<TeamReview[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<TicketRoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all teams and find the one where current user is supervisor
      const teams = await fetchTeams();
      // For now, use first team (backend will filter by current user's manager_id)
      const myTeam = teams.length > 0 ? teams[0] : null;

      if (myTeam) {
        setTeam(myTeam);
        // Fetch related data in parallel
        const [membersData, schedulesData, reviewsData, assignmentsData] = await Promise.all([
          fetchTeamMembers(myTeam.id).catch(() => []),
          fetchTeamSchedules(myTeam.id).catch(() => []),
          fetchTeamReviews(myTeam.id).catch(() => []),
          fetchTicketRoleAssignments(myTeam.id).catch(() => []),
        ]);

        setMembers(membersData.length > 0 ? membersData : mockTeamMembers[mockTeams[0].id] || []);
        setSchedules(schedulesData.length > 0 ? schedulesData : mockSchedules);
        setReviews(reviewsData.length > 0 ? reviewsData : mockReviews);
        setRoleAssignments(assignmentsData.length > 0 ? assignmentsData : mockRoleAssignments);
      } else {
        // Full mock fallback
        setTeam(mockTeams[0]);
        setMembers(mockTeamMembers[mockTeams[0].id] || []);
        setSchedules(mockSchedules);
        setReviews(mockReviews);
        setRoleAssignments(mockRoleAssignments);
      }
    } catch {
      // Full mock fallback on network error
      setTeam(mockTeams[0]);
      setMembers(mockTeamMembers[mockTeams[0].id] || []);
      setSchedules(mockSchedules);
      setReviews(mockReviews);
      setRoleAssignments(mockRoleAssignments);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { team, members, schedules, reviews, roleAssignments, isLoading, error, refresh: loadData };
}
