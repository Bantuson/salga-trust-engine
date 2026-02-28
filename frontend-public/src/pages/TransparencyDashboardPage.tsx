import { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { MunicipalitySelector } from '../components/MunicipalitySelector';
import { ServicePerformanceStats } from '../components/ServicePerformanceStats';
import {
  useResponseTimes,
  useResolutionRates,
  useCategoryBreakdown,
} from '../hooks/usePublicStats';

export function TransparencyDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);

  // Load metrics based on selected municipality
  const { data: responseTimes, isLoading: isLoadingResponse } = useResponseTimes(selectedMunicipality || undefined);
  const { data: resolutionRates, isLoading: isLoadingResolution } = useResolutionRates(selectedMunicipality || undefined, 6);
  const { data: categoryBreakdown, isLoading: isLoadingCategories } = useCategoryBreakdown(selectedMunicipality || undefined);

  return (
    <div className="transparency-dashboard-page">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-header-content">
          <h1 className="dashboard-title">Municipal Transparency Dashboard</h1>
          <p className="dashboard-subtitle">
            Real-time service delivery metrics across South African municipalities
          </p>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Municipality Selector */}
        <MunicipalitySelector
          selectedId={selectedMunicipality}
          onChange={setSelectedMunicipality}
        />

        {/* Service Performance Stats */}
        <ServicePerformanceStats
          responseTimes={responseTimes}
          resolutionRates={resolutionRates}
          categoryBreakdown={categoryBreakdown}
          selectedMunicipality={selectedMunicipality}
          isLoading={isLoadingResponse || isLoadingResolution || isLoadingCategories}
        />

        {/* Privacy Notice */}
        <GlassCard variant="elevated" style={{ marginTop: '48px' }}>
          <div className="privacy-notice">
            <strong>Privacy Notice:</strong> GBV and sensitive report statistics are included in aggregate figures on this dashboard.
            However, all personal case data, victim identities, and individual report details are kept strictly
            private and protected. Individual addresses are not displayed; the heatmap shows aggregated density
            only (k-anonymity threshold ≥3).
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
