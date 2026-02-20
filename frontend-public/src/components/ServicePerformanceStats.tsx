import { GlassCard } from '@shared/components/ui/GlassCard';
import type { ResponseTimeData, ResolutionRateData, CategoryBreakdownData } from '../types/public';

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

function formatCategory(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
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

  // "All Municipalities" view — table
  if (!selectedMunicipality) {
    return (
      <GlassCard variant="default">
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#1a1a1a' }}>
          Service Performance by Municipality
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.1)' }}>
                <th style={thStyle}>Municipality</th>
                <th style={thStyle}>Avg Response Time</th>
                <th style={thStyle}>Resolution Rate</th>
                <th style={thStyle}>Total Tickets</th>
              </tr>
            </thead>
            <tbody>
              {responseTimes.map((rt) => {
                const rr = resolutionRates.find(r => r.municipality_id === rt.municipality_id);
                return (
                  <tr key={rt.municipality_id} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <td style={tdStyle}>{rt.municipality_name}</td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getResponseColor(rt.avg_response_hours), display: 'inline-block' }} />
                        {rt.avg_response_hours.toFixed(1)} hrs
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getRateColor(rr?.resolution_rate ?? 0), display: 'inline-block' }} />
                        {rr ? `${rr.resolution_rate.toFixed(0)}%` : 'N/A'}
                      </span>
                    </td>
                    <td style={tdStyle}>{rt.ticket_count.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Legend */}
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#555', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span><span style={{ color: '#10b981' }}>●</span> Excellent (&lt;24h / ≥80%)</span>
          <span><span style={{ color: '#f59e0b' }}>●</span> Acceptable (24-72h / ≥60%)</span>
          <span><span style={{ color: '#ef4444' }}>●</span> Needs Improvement (&gt;72h / &lt;60%)</span>
        </div>
      </GlassCard>
    );
  }

  // Single municipality view — stat cards + category breakdown
  const rt = responseTimes[0];
  const rr = resolutionRates[0];

  if (!rt && !rr) {
    return (
      <GlassCard variant="default" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
        No data available for this municipality
      </GlassCard>
    );
  }

  const maxCount = categoryBreakdown.length > 0
    ? Math.max(...categoryBreakdown.map(c => c.count))
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Response Time Card */}
        {rt && (
          <GlassCard variant="elevated" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555', marginBottom: '8px' }}>
              Avg Response Time
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1 }}>
              {rt.avg_response_hours.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400 }}>hrs</span>
            </div>
            <div style={{
              display: 'inline-block', marginTop: '8px', padding: '2px 10px',
              borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#fff',
              background: getResponseColor(rt.avg_response_hours),
            }}>
              {rt.avg_response_hours < 24 ? 'Excellent' : rt.avg_response_hours < 72 ? 'Acceptable' : 'Needs Improvement'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
              Based on {rt.ticket_count.toLocaleString()} tickets
            </div>
          </GlassCard>
        )}

        {/* Resolution Rate Card */}
        {rr && (
          <GlassCard variant="elevated" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555', marginBottom: '8px' }}>
              Resolution Rate
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1 }}>
              {rr.resolution_rate.toFixed(0)}<span style={{ fontSize: '1.2rem', fontWeight: 400 }}>%</span>
            </div>
            <div style={{
              display: 'inline-block', marginTop: '8px', padding: '2px 10px',
              borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#fff',
              background: getRateColor(rr.resolution_rate),
            }}>
              {rr.resolution_rate >= 80 ? 'Excellent' : rr.resolution_rate >= 60 ? 'Acceptable' : 'Needs Improvement'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#888' }}>
              {rr.resolved_tickets.toLocaleString()}/{rr.total_tickets.toLocaleString()} resolved
            </div>
          </GlassCard>
        )}
      </div>

      {/* Report Distribution */}
      {categoryBreakdown.length > 0 && (
        <GlassCard variant="default">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1a1a1a' }}>
            Report Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categoryBreakdown.map((cat) => (
              <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '90px', fontSize: '0.85rem', color: '#555', flexShrink: 0 }}>
                  {formatCategory(cat.category)}
                </div>
                <div style={{ flex: 1, height: '20px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(cat.count / maxCount) * 100}%`,
                    background: 'var(--color-teal)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ width: '40px', fontSize: '0.8rem', color: '#555', textAlign: 'right' }}>
                  {cat.count}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontWeight: 600,
  color: '#1a1a1a',
  fontSize: '0.85rem',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: '#333',
};
