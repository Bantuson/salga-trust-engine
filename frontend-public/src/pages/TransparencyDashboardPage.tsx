import { useState, Suspense, lazy } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { NdebelePattern } from '@shared/components/NdebelePattern';
import { MunicipalitySelector } from '../components/MunicipalitySelector';
import { ResponseTimeChart } from '../components/ResponseTimeChart';
import { ResolutionRateChart } from '../components/ResolutionRateChart';
import { HeatmapViewer } from '../components/HeatmapViewer';
import { GlobeLoadingSkeleton } from '../components/GlobeLoadingSkeleton';
import {
  useSystemSummary,
  useResponseTimes,
  useResolutionRates
} from '../hooks/usePublicStats';

const Globe3D = lazy(() => import('../components/Globe3D'));

export function TransparencyDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);

  // Load system summary
  const { summary } = useSystemSummary();

  // Load metrics based on selected municipality
  const { data: responseTimes, isLoading: isLoadingResponse } = useResponseTimes(selectedMunicipality || undefined);
  const { data: resolutionRates, isLoading: isLoadingResolution } = useResolutionRates(selectedMunicipality || undefined, 6);

  return (
    <div className="transparency-dashboard-page">
      {/* Header with 3D Globe */}
      <div className="dashboard-header">
        <div className="dashboard-header-globe">
          <Suspense fallback={<GlobeLoadingSkeleton />}>
            <Globe3D />
          </Suspense>
        </div>
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">Municipal Transparency Dashboard</h1>
          <p className="dashboard-subtitle">
            Public performance metrics for South African municipalities
          </p>
        </div>
      </div>

      <div className="dashboard-content">
        {/* System Summary Cards */}
        <div className="dashboard-summary-grid">
          <GlassCard variant="default">
            <div className="metric-label">Total Municipalities</div>
            <div className="metric-value">{summary.total_municipalities}</div>
          </GlassCard>

          <GlassCard variant="default">
            <div className="metric-label">Total Service Requests</div>
            <div className="metric-value">{summary.total_tickets.toLocaleString()}</div>
          </GlassCard>

          <GlassCard variant="default">
            <div className="metric-label">Sensitive Reports (System-wide)</div>
            <div className="metric-value">{summary.total_sensitive_tickets.toLocaleString()}</div>
            <div className="metric-note">GBV reports excluded from location data</div>
          </GlassCard>
        </div>

        <NdebelePattern variant="border" />

        {/* Municipality Selector */}
        <MunicipalitySelector
          selectedId={selectedMunicipality}
          onChange={setSelectedMunicipality}
        />

        {/* Charts Grid */}
        <div className="dashboard-charts-grid">
          {isLoadingResponse || isLoadingResolution ? (
            <SkeletonTheme>
              <GlassCard variant="default">
                <Skeleton height={30} width="50%" style={{ marginBottom: '1rem' }} />
                <Skeleton height={300} />
              </GlassCard>
              <GlassCard variant="default">
                <Skeleton height={30} width="50%" style={{ marginBottom: '1rem' }} />
                <Skeleton height={300} />
              </GlassCard>
              <GlassCard variant="default">
                <Skeleton height={30} width="50%" style={{ marginBottom: '1rem' }} />
                <Skeleton height={400} />
              </GlassCard>
            </SkeletonTheme>
          ) : (
            <>
              <ResponseTimeChart data={responseTimes} isLoading={false} />
              <ResolutionRateChart data={resolutionRates} isLoading={false} />
              <HeatmapViewer municipalityId={selectedMunicipality || undefined} />
            </>
          )}
        </div>

        <NdebelePattern variant="border" />

        {/* Privacy Notice */}
        <GlassCard variant="elevated">
          <div className="privacy-notice">
            <strong>Privacy Notice:</strong> GBV and sensitive reports are excluded from this public dashboard
            to protect victims' privacy. Individual addresses are not displayed; heatmap shows aggregated
            density only (k-anonymity threshold ≥3).
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
