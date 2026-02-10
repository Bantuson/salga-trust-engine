import { create } from 'zustand';
import type { DashboardMetrics, CategoryVolume, SLACompliance, TeamWorkload } from '../types/dashboard';

interface DashboardState {
  // User context
  userRole: string | null;
  wardId: string | null;

  // Metrics data
  metrics: DashboardMetrics | null;
  volumeData: CategoryVolume[];
  slaData: SLACompliance | null;
  workloadData: TeamWorkload[];

  // UI state
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  setUserContext: (role: string, wardId?: string) => void;
  setMetrics: (metrics: DashboardMetrics) => void;
  setVolumeData: (data: CategoryVolume[]) => void;
  setSlaData: (data: SLACompliance) => void;
  setWorkloadData: (data: TeamWorkload[]) => void;
  setLoading: (loading: boolean) => void;
  setLastUpdated: (date: Date) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  userRole: null,
  wardId: null,
  metrics: null,
  volumeData: [],
  slaData: null,
  workloadData: [],
  isLoading: false,
  lastUpdated: null,

  setUserContext: (role, wardId) => set({ userRole: role, wardId: wardId ?? null }),
  setMetrics: (metrics) => set({ metrics }),
  setVolumeData: (data) => set({ volumeData: data }),
  setSlaData: (data) => set({ slaData: data }),
  setWorkloadData: (data) => set({ workloadData: data }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLastUpdated: (date) => set({ lastUpdated: date }),
}));
