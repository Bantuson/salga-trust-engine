/**
 * Municipal Operations Dashboard Page.
 *
 * Real-time dashboard showing:
 * - Key metrics (open tickets, resolved, SLA compliance, breaches)
 * - Ticket volume by category
 * - SLA compliance gauge
 * - Team workload distribution
 *
 * Updates in real-time via Supabase Realtime. Ward councillors see filtered data.
 */

import { useEffect, useCallback, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeTickets } from '../hooks/useRealtimeTickets';
import { useDashboardStore } from '../stores/dashboardStore';
import { MetricsCards } from '../components/dashboard/MetricsCards';
import { VolumeChart } from '../components/dashboard/VolumeChart';
import { SLAComplianceChart } from '../components/dashboard/SLAComplianceChart';
import { TeamWorkloadChart } from '../components/dashboard/TeamWorkloadChart';
import { RealtimeIndicator } from '../components/dashboard/RealtimeIndicator';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
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
  const { getTenantId } = useAuth();
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
  const municipalityId = getTenantId() || '';

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
    } finally {
      setLoading(false);
    }
  }, [wardId, setMetrics, setVolumeData, setSlaData, setWorkloadData, setLoading, setLastUpdated]);

  // Use Supabase Realtime hook (disabled when tab inactive)
  const { connected } = useRealtimeTickets({
    municipalityId,
    enabled: isTabActive && !!municipalityId,
    onUpdate: fetchAllData,
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

  // Backup: re-fetch every 60 seconds in case Realtime misses events
  useEffect(() => {
    const interval = setInterval(() => {
      if (isTabActive) {
        fetchAllData();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [fetchAllData, isTabActive]);

  return (
    <div className="page-container-responsive" style={styles.container}>
      <header className="dashboard-page-header" style={styles.header}>
        <h1 className="dashboard-page-title" style={styles.title}>Municipal Operations Dashboard</h1>
        <RealtimeIndicator isConnected={connected} lastUpdated={lastUpdated} />
      </header>

      <MetricsCards metrics={metrics} isLoading={isLoading} />

      {isLoading ? (
        <SkeletonTheme>
          <div style={styles.chartsGrid}>
            <div style={styles.chartSkeleton}>
              <Skeleton height={30} width="50%" style={{ marginBottom: '1rem' }} />
              <Skeleton height={300} />
            </div>
            <div style={styles.chartSkeleton}>
              <Skeleton height={30} width="50%" style={{ marginBottom: '1rem' }} />
              <Skeleton height={300} />
            </div>
          </div>
          <div style={styles.chartSkeleton}>
            <Skeleton height={30} width="50%" style={{ marginBottom: '1rem' }} />
            <Skeleton height={400} />
          </div>
        </SkeletonTheme>
      ) : (
        <>
          <div style={styles.chartsGrid}>
            <VolumeChart data={volumeData} isLoading={false} />
            <SLAComplianceChart data={slaData} isLoading={false} />
          </div>
          <TeamWorkloadChart data={workloadData} isLoading={false} />
        </>
      )}

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
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  } as React.CSSProperties,
  nav: {
    marginTop: '2rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  navLink: {
    color: 'var(--color-teal)',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: '500',
  } as React.CSSProperties,
  chartSkeleton: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-lg)',
  } as React.CSSProperties,
};
