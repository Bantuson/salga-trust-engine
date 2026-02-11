import { useState } from 'react';
import { MunicipalitySelector } from '../components/MunicipalitySelector';
import { ResponseTimeChart } from '../components/ResponseTimeChart';
import { ResolutionRateChart } from '../components/ResolutionRateChart';
import { HeatmapViewer } from '../components/HeatmapViewer';
import {
  useSystemSummary,
  useResponseTimes,
  useResolutionRates
} from '../hooks/usePublicStats';

export function PublicDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);

  // Load system summary
  const { summary } = useSystemSummary();

  // Load metrics based on selected municipality
  const { data: responseTimes, isLoading: isLoadingResponse } = useResponseTimes(selectedMunicipality || undefined);
  const { data: resolutionRates, isLoading: isLoadingResolution } = useResolutionRates(selectedMunicipality || undefined, 6);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb'
    }}>
      {/* Header Banner */}
      <header style={{
        backgroundColor: '#1e3a8a',
        color: 'white',
        padding: '32px 24px',
        marginBottom: '32px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          margin: '0 0 8px 0'
        }}>
          Municipal Transparency Dashboard
        </h1>
        <p style={{
          fontSize: '16px',
          margin: 0,
          opacity: 0.9
        }}>
          Public performance metrics for South African municipalities
        </p>
      </header>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px 48px'
      }}>
        {/* System Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              Total Municipalities
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
              {summary.total_municipalities}
            </div>
          </div>

          <div style={{
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              Total Service Requests
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
              {summary.total_tickets.toLocaleString()}
            </div>
          </div>

          <div style={{
            padding: '24px',
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
              Sensitive Reports (System-wide)
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#111827' }}>
              {summary.total_sensitive_tickets.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
              GBV reports excluded from location data
            </div>
          </div>
        </div>

        {/* Municipality Selector */}
        <MunicipalitySelector
          selectedId={selectedMunicipality}
          onChange={setSelectedMunicipality}
        />

        {/* Charts Grid */}
        <div style={{
          display: 'grid',
          gap: '24px',
          marginTop: '24px'
        }}>
          <ResponseTimeChart data={responseTimes} isLoading={isLoadingResponse} />
          <ResolutionRateChart data={resolutionRates} isLoading={isLoadingResolution} />
          <HeatmapViewer municipalityId={selectedMunicipality || undefined} />
        </div>

        {/* Privacy Notice Footer */}
        <div style={{
          marginTop: '32px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#78350f'
        }}>
          <strong>Privacy Notice:</strong> GBV and sensitive reports are excluded from this public dashboard
          to protect victims' privacy. Individual addresses are not displayed; heatmap shows aggregated
          density only (k-anonymity threshold ≥3).
        </div>

        {/* Powered by footer */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          Powered by Supabase · Data queried directly from PostgreSQL RLS views
        </div>
      </div>
    </div>
  );
}
