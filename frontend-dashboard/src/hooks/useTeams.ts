/**
 * useTeams hook — Teams data fetching and state management.
 *
 * Local hook state per page (no Zustand store) per anti-pattern guidance:
 * "Don't pollute the existing dashboard store with teams state."
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchTeams, createTeam as apiCreateTeam, updateTeam as apiUpdateTeam } from '../services/api';
import type { Team, TeamCreate } from '../types/teams';
import { mockTeams } from '../mocks/mockTeams';

interface UseTeamsReturn {
  teams: Team[];
  isLoading: boolean;
  error: string | null;
  selectedTeam: Team | null;
  setSelectedTeam: (team: Team | null) => void;
  refreshTeams: () => Promise<void>;
  createTeam: (data: TeamCreate) => Promise<Team>;
  updateTeam: (teamId: string, data: Partial<TeamCreate>) => Promise<Team>;
}

export function useTeams(): UseTeamsReturn {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const refreshTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTeams();
      if (data.length === 0) {
        setTeams(mockTeams);
      } else {
        setTeams(data);
      }
    } catch (err) {
      // Rich mock fallback — no empty states
      setTeams(mockTeams);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refreshTeams();
  }, [refreshTeams]);

  const createTeam = useCallback(async (data: TeamCreate): Promise<Team> => {
    const newTeam = await apiCreateTeam(data);
    setTeams((prev) => [...prev, newTeam]);
    return newTeam;
  }, []);

  const updateTeam = useCallback(async (teamId: string, data: Partial<TeamCreate>): Promise<Team> => {
    const updated = await apiUpdateTeam(teamId, data);
    setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
    // Update selectedTeam if it's the one being edited
    setSelectedTeam((prev) => (prev?.id === teamId ? updated : prev));
    return updated;
  }, []);

  return {
    teams,
    isLoading,
    error,
    selectedTeam,
    setSelectedTeam,
    refreshTeams,
    createTeam,
    updateTeam,
  };
}
