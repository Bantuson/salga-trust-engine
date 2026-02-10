import { useEffect, useState } from 'react';
import { MunicipalitySelector } from '../components/public/MunicipalitySelector';
import { ResponseTimeChart } from '../components/public/ResponseTimeChart';
import { ResolutionRateChart } from '../components/public/ResolutionRateChart';
import { HeatmapViewer } from '../components/public/HeatmapViewer';
import {
  getSystemSummary,
  getResponseTimes,
  getResolutionRates
} from '../services/publicApi';
import type {
  SystemSummary,
  ResponseTimeData,
  ResolutionRateData
} from '../types/public';

export function PublicDashboardPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [summary, setSummary] = useState<SystemSummary>({
    total_municipalities: 0,
    total_tickets: 0,
    total_sensitive_tickets: 0
  });
  const [responseTimes, setResponseTimes] = useState<ResponseTimeData[]>([]);
  const [resolutionRates, setResolutionRates] = useState<ResolutionRateData[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(true);
  const [isLoadingResolution, setIsLoadingResolution] = useState(true);

  // Load system summary on mount
  useEffect(() => {
    async function loadSummary() {
      const data = await getSystemSummary();
      setSummary(data);
    }
    loadSummary();
  }, []);

  // Load initial metrics on mount
  useEffect(() => {
    async function loadInitialMetrics() {
      setIsLoadingResponse(true);
      setIsLoadingResolution(true);

      const [responseData, resolutionData] = await Promise.all([
        getResponseTimes(),
        getResolutionRates(undefined, 6) // 6 months for trend
      ]);

      setResponseTimes(responseData);
      setResolutionRates(resolutionData);
      setIsLoadingResponse(false);
      setIsLoadingResolution(false);
    }
    loadInitialMetrics();
  }, []);

  // Re-fetch metrics when municipality selection changes
  useEffect(() => {
    async function loadFilteredMetrics() {
      setIsLoadingResponse(true);
      setIsLoadingResolution(true);

      const [responseData, resolutionData] = await Promise.all([
        getResponseTimes(selectedMunicipality || undefined),
        getResolutionRates(selectedMunicipality || undefined, 6)
      ]);

      setResponseTimes(responseData);
      setResolutionRates(resolutionData);
      setIsLoadingResponse(false);
      setIsLoadingResolution(false);
    }

    // Only reload if we've already loaded initial data
    if (!isLoadingResponse && !isLoadingResolution) {
      loadFilteredMetrics();
    }
  }, [selectedMunicipality]);

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
          density only.
        </div>
      </div>
    </div>
  );
}
