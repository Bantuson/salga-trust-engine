/**
 * Municipal Operations Dashboard Page.
 *
 * Real-time dashboard showing:
 * - Key metrics (open tickets, resolved, SLA compliance, breaches)
 * - Ticket volume by category
 * - SLA compliance gauge
 * - Team workload distribution
 *
 * Updates in real-time via SSE. Ward councillors see filtered data.
 */

import { useEffect, useCallback, useState } from 'react';
import { MetricsCards } from '../components/dashboard/MetricsCards';
import { VolumeChart } from '../components/dashboard/VolumeChart';
import { SLAComplianceChart } from '../components/dashboard/SLAComplianceChart';
import { TeamWorkloadChart } from '../components/dashboard/TeamWorkloadChart';
import { RealtimeIndicator } from '../components/dashboard/RealtimeIndicator';
import { useSSE } from '../hooks/useSSE';
import { useDashboardStore } from '../stores/dashboardStore';
import {
  fetchDashboardMetrics,
  fetchVolumeByCategory,
  fetchSLACompliance,
  fetchTeamWorkload,
} from '../services/api';

interface DashboardPageProps {
  wardId?: string;
}

export function DashboardPage({ wardId }: DashboardPageProps) {
  const {
    metrics,
    volumeData,
    slaData,
    workloadData,
    isLoading,
    lastUpdated,
    setMetrics,
    setVolumeData,
    setSlaData,
    setWorkloadData,
    setLoading,
    setLastUpdated,
  } = useDashboardStore();

  const [isTabActive, setIsTabActive] = useState(true);

  // Fetch all dashboard data
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, volumeRes, slaRes, workloadRes] = await Promise.all([
        fetchDashboardMetrics(wardId),
        fetchVolumeByCategory(wardId),
        fetchSLACompliance(wardId),
        fetchTeamWorkload(wardId),
      ]);

      setMetrics(metricsRes);
      setVolumeData(volumeRes);
      setSlaData(slaRes);
      setWorkloadData(workloadRes);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[Dashboard] Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [wardId, setMetrics, setVolumeData, setSlaData, setWorkloadData, setLoading, setLastUpdated]);

  // SSE event handler - re-fetch all data on any ticket update
  const handleSSEEvent = useCallback((type: string, data: Record<string, unknown>) => {
    console.log('[Dashboard] SSE event received:', type, data);
    // Simple approach: re-fetch all data on any event
    // More sophisticated approach would be to update specific data based on event type
    fetchAllData();
  }, [fetchAllData]);

  // Use SSE hook (disabled when tab inactive)
  const { isConnected, error } = useSSE({
    wardId,
    enabled: isTabActive,
    onEvent: handleSSEEvent,
  });

  // Tab visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
      // Re-fetch data when tab becomes active
      if (!document.hidden) {
        fetchAllData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAllData]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Backup: re-fetch every 60 seconds in case SSE misses events
  useEffect(() => {
    const interval = setInterval(() => {
      if (isTabActive) {
        fetchAllData();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [fetchAllData, isTabActive]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Municipal Operations Dashboard</h1>
        <RealtimeIndicator isConnected={isConnected} error={error} lastUpdated={lastUpdated} />
      </header>

      <MetricsCards metrics={metrics} isLoading={isLoading} />

      <div style={styles.chartsGrid}>
        <VolumeChart data={volumeData} isLoading={isLoading} />
        <SLAComplianceChart data={slaData} isLoading={isLoading} />
      </div>

      <TeamWorkloadChart data={workloadData} isLoading={isLoading} />

      <nav style={styles.nav}>
        <a href="#tickets" style={styles.navLink}>
          View All Tickets →
        </a>
      </nav>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: '#111827',
  } as React.CSSProperties,
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  nav: {
    marginTop: '2rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  navLink: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: '500',
  } as React.CSSProperties,
};
