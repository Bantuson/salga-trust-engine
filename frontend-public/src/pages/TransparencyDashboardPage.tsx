import { useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { MunicipalitySelector } from '../components/MunicipalitySelector';
import { ServicePerformanceStats } from '../components/ServicePerformanceStats';
import { TimePeriodControls } from '../components/TimePeriodControls';
import { MunicipalityLeaderboard } from '../components/MunicipalityLeaderboard';
import { MunicipalityDetailModal } from '../components/MunicipalityDetailModal';
import { SdbipGaugeChart } from '../components/SdbipGaugeChart';
import type { LeaderboardEntry } from '../types/public';
import {
  useResponseTimes,
  useResolutionRates,
  useCategoryBreakdown,
  useSdbipAchievement,
} from '../hooks/usePublicStats';
import { getSAFinancialYear, getCurrentSAQuarter } from '../utils/saFinancialYear';

export function TransparencyDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);

  // Time period state — defaults to current SA financial year and quarter
  const [financialYear, setFinancialYear] = useState<string>(() => getSAFinancialYear(new Date()));
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(() => getCurrentSAQuarter(new Date()));

  // Municipality detail modal state
  const [modalEntry, setModalEntry] = useState<LeaderboardEntry | null>(null);

  // Load metrics based on selected municipality and time period
  // NOTE: useSdbipAchievement does NOT receive quarter/year — annual data (locked decision)
  const { data: responseTimes, isLoading: isLoadingResponse } = useResponseTimes(
    selectedMunicipality || undefined,
    financialYear,
    quarter,
  );
  const { data: resolutionRates, isLoading: isLoadingResolution } = useResolutionRates(
    selectedMunicipality || undefined,
    6,
    financialYear,
    quarter,
  );
  const { data: categoryBreakdown, isLoading: isLoadingCategories } = useCategoryBreakdown(
    selectedMunicipality || undefined,
    financialYear,
    quarter,
  );
  const { data: sdbipData, isLoading: isLoadingSdbip } = useSdbipAchievement(
    selectedMunicipality || undefined,
  );

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

        {/* Time Period Controls */}
        <div style={{ marginTop: '16px' }}>
          <TimePeriodControls
            financialYear={financialYear}
            quarter={quarter}
            onYearChange={setFinancialYear}
            onQuarterChange={setQuarter}
          />
        </div>

        {/* Main content — Leaderboard (all municipalities) OR ServicePerformanceStats (single municipality) */}
        <div style={{ marginTop: '24px' }}>
          {!selectedMunicipality ? (
            <MunicipalityLeaderboard
              responseTimes={responseTimes}
              resolutionRates={resolutionRates}
              sdbipData={sdbipData}
              onSelectMunicipality={setModalEntry}
            />
          ) : (
            <ServicePerformanceStats
              responseTimes={responseTimes}
              resolutionRates={resolutionRates}
              categoryBreakdown={categoryBreakdown}
              selectedMunicipality={selectedMunicipality}
              isLoading={isLoadingResponse || isLoadingResolution || isLoadingCategories}
            />
          )}
        </div>

        {/* SDBIP Achievement Section — radial gauges, annual data only */}
        <div style={{ marginTop: '48px' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Municipal Performance (SDBIP Achievement)
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
            }}
          >
            Key Performance Indicator achievement by municipality — based on the Service Delivery and Budget Implementation Plan.
          </p>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem',
              fontSize: '0.8rem',
              fontStyle: 'italic',
            }}
          >
            Annual performance data — not affected by quarter filter
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {sdbipData.map((mun) => (
                <GlassCard key={mun.municipality_id} variant="elevated" style={{ padding: '1.5rem' }}>
                  <h3
                    style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    {mun.municipality_name}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '1rem',
                    }}
                  >
                    {mun.financial_year} — {mun.total_kpis} KPIs tracked
                  </p>

                  {/* Radial gauge chart — replaces linear progress bar */}
                  <SdbipGaugeChart
                    achievementPct={mun.overall_achievement_pct}
                    municipalityName={mun.municipality_name}
                  />

                  {/* Traffic light breakdown */}
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
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

      </div>

      {/* Municipality Detail Modal */}
      <MunicipalityDetailModal
        isOpen={modalEntry !== null}
        onClose={() => setModalEntry(null)}
        entry={modalEntry}
        resolutionRates={resolutionRates}
        categoryBreakdown={categoryBreakdown}
        sdbipData={sdbipData}
      />
    </div>
  );
}
