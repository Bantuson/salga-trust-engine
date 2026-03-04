import { GlassCard } from '@shared/components/ui/GlassCard';
import type { ResponseTimeData, ResolutionRateData, CategoryBreakdownData } from '../types/public';
import { CategoryDonutChart } from './CategoryDonutChart';
import { ResolutionTrendChart } from './ResolutionTrendChart';

interface ServicePerformanceStatsProps {
  responseTimes: ResponseTimeData[];
  resolutionRates: ResolutionRateData[];
  categoryBreakdown: CategoryBreakdownData[];
  selectedMunicipality: string | null;
  isLoading: boolean;
}

function getResponseColor(hours: number): string {
  if (hours < 24) return '#10b981'; // green
  if (hours < 72) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

function getRateColor(rate: number): string {
  if (rate >= 80) return '#10b981';
  if (rate >= 60) return '#f59e0b';
  return '#ef4444';
}

export function ServicePerformanceStats({
  responseTimes,
  resolutionRates,
  categoryBreakdown,
  selectedMunicipality,
  isLoading,
}: ServicePerformanceStatsProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px', gap: '12px' }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid rgba(0,0,0,0.1)',
          borderTopColor: 'var(--color-teal)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ color: '#555', fontSize: '0.875rem' }}>Loading service data...</p>
      </div>
    );
  }

  // "All Municipalities" view — leaderboard rendered directly by TransparencyDashboardPage
  if (!selectedMunicipality) {
    return null;
  }

  // Single municipality view — stat cards + donut chart + trend chart
  const rt = responseTimes[0];
  const rr = resolutionRates[0];

  if (!rt && !rr) {
    return (
      <GlassCard variant="default" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        No data available for this municipality
      </GlassCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Response Time Card */}
        {rt && (
          <GlassCard variant="elevated" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Avg Response Time
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {rt.avg_response_hours.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>hrs</span>
            </div>
            <div style={{
              display: 'inline-block', marginTop: '8px', padding: '2px 10px',
              borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#fff',
              background: getResponseColor(rt.avg_response_hours),
            }}>
              {rt.avg_response_hours < 24 ? 'Excellent' : rt.avg_response_hours < 72 ? 'Acceptable' : 'Needs Improvement'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Based on {rt.ticket_count.toLocaleString()} tickets
            </div>
          </GlassCard>
        )}

        {/* Resolution Rate Card */}
        {rr && (
          <GlassCard variant="elevated" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Resolution Rate
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {rr.resolution_rate.toFixed(0)}<span style={{ fontSize: '1.2rem', fontWeight: 400 }}>%</span>
            </div>
            <div style={{
              display: 'inline-block', marginTop: '8px', padding: '2px 10px',
              borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#fff',
              background: getRateColor(rr.resolution_rate),
            }}>
              {rr.resolution_rate >= 80 ? 'Excellent' : rr.resolution_rate >= 60 ? 'Acceptable' : 'Needs Improvement'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {rr.resolved_tickets.toLocaleString()}/{rr.total_tickets.toLocaleString()} resolved
            </div>
          </GlassCard>
        )}
      </div>

      {/* Category Donut Chart — replaces horizontal bar chart */}
      {categoryBreakdown.length > 0 && (
        <GlassCard variant="default" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Report Distribution by Category
          </h3>
          <CategoryDonutChart data={categoryBreakdown} />
        </GlassCard>
      )}

      {/* Resolution Rate Trend Chart */}
      {rr && (
        <GlassCard variant="default" style={{ padding: '24px' }}>
          <ResolutionTrendChart
            trend={rr.trend ?? []}
            municipalityName={rr.municipality_name}
          />
        </GlassCard>
      )}
    </div>
  );
}
