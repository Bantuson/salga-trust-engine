import { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { MunicipalitySelector } from '../components/MunicipalitySelector';
import { ServicePerformanceStats } from '../components/ServicePerformanceStats';
import {
  useResponseTimes,
  useResolutionRates,
  useCategoryBreakdown,
  useSdbipAchievement,
} from '../hooks/usePublicStats';

export function TransparencyDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);

  // Load metrics based on selected municipality
  const { data: responseTimes, isLoading: isLoadingResponse } = useResponseTimes(selectedMunicipality || undefined);
  const { data: resolutionRates, isLoading: isLoadingResolution } = useResolutionRates(selectedMunicipality || undefined, 6);
  const { data: categoryBreakdown, isLoading: isLoadingCategories } = useCategoryBreakdown(selectedMunicipality || undefined);
  const { data: sdbipData, isLoading: isLoadingSdbip } = useSdbipAchievement(selectedMunicipality || undefined);

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

        {/* SDBIP Achievement Section */}
        <div style={{ marginTop: '48px' }}>
          <h2 className="section-title" style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '1.5rem',
          }}>
            Municipal Performance (SDBIP Achievement)
          </h2>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}>
            Key Performance Indicator achievement by municipality — based on the Service Delivery and Budget Implementation Plan.
          </p>

          {isLoadingSdbip ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading performance data...
            </div>
          ) : sdbipData.length === 0 ? (
            <GlassCard variant="elevated">
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No SDBIP performance data available yet.
              </p>
            </GlassCard>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}>
              {sdbipData.map((mun) => (
                <GlassCard key={mun.municipality_id} variant="elevated" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                    {mun.municipality_name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    {mun.financial_year} — {mun.total_kpis} KPIs tracked
                  </p>

                  {/* Overall achievement bar */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Overall Achievement</span>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: mun.overall_achievement_pct >= 80 ? '#10b981' : mun.overall_achievement_pct >= 50 ? '#f59e0b' : '#ef4444',
                      }}>
                        {mun.overall_achievement_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{
                      height: '8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(mun.overall_achievement_pct, 100)}%`,
                        borderRadius: '4px',
                        backgroundColor: mun.overall_achievement_pct >= 80 ? '#10b981' : mun.overall_achievement_pct >= 50 ? '#f59e0b' : '#ef4444',
                        transition: 'width 0.5s ease-out',
                      }} />
                    </div>
                  </div>

                  {/* Traffic light breakdown */}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{mun.green}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>On Track</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>{mun.amber}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>At Risk</div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>{mun.red}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Critical</div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

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
