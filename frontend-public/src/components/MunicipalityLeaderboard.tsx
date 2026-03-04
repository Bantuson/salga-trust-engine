import { useMemo, useState } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import type {
  ResponseTimeData,
  ResolutionRateData,
  SdbipAchievementData,
  LeaderboardEntry,
} from '../types/public';
import { mockLeaderboard } from '../data/mockDashboardData';

interface MunicipalityLeaderboardProps {
  responseTimes: ResponseTimeData[];
  resolutionRates: ResolutionRateData[];
  sdbipData: SdbipAchievementData[];
  onSelectMunicipality?: (entry: LeaderboardEntry) => void;
}

type SortKey = 'resolution_rate' | 'avg_response_hours' | 'sdbip_achievement_pct' | 'total_tickets';

function getRateColor(rate: number): string {
  if (rate >= 80) return '#10b981';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}

function getResponseColor(hours: number): string {
  if (hours < 24) return '#10b981';
  if (hours < 72) return '#f59e0b';
  return '#ef4444';
}

function computeLeaderboard(
  responseTimes: ResponseTimeData[],
  resolutionRates: ResolutionRateData[],
  sdbipData: SdbipAchievementData[],
  sortKey: SortKey,
): LeaderboardEntry[] {
  // Collect all unique municipality IDs across all datasets
  const allIds = new Set<string>([
    ...responseTimes.map(r => r.municipality_id),
    ...resolutionRates.map(r => r.municipality_id),
    ...sdbipData.map(r => r.municipality_id),
  ]);

  if (allIds.size === 0) {
    // Fallback to mock data
    return [...mockLeaderboard].sort((a, b) =>
      sortKey === 'avg_response_hours'
        ? a.avg_response_hours - b.avg_response_hours
        : b[sortKey] - a[sortKey],
    );
  }

  // Merge data by municipality ID
  const merged: Omit<LeaderboardEntry, 'current_rank' | 'previous_rank' | 'rank_delta'>[] =
    Array.from(allIds).map(id => {
      const rt = responseTimes.find(r => r.municipality_id === id);
      const rr = resolutionRates.find(r => r.municipality_id === id);
      const sd = sdbipData.find(r => r.municipality_id === id);

      const name =
        rt?.municipality_name ?? rr?.municipality_name ?? sd?.municipality_name ?? id;

      return {
        municipality_id: id,
        municipality_name: name,
        resolution_rate: rr?.resolution_rate ?? 0,
        avg_response_hours: rt?.avg_response_hours ?? 0,
        sdbip_achievement_pct: sd?.overall_achievement_pct ?? 0,
        total_tickets: rr?.total_tickets ?? rt?.ticket_count ?? 0,
      };
    });

  // Sort: ascending for response_hours (lower is better), descending for everything else
  const sorted = merged.sort((a, b) =>
    sortKey === 'avg_response_hours'
      ? a.avg_response_hours - b.avg_response_hours
      : b[sortKey] - a[sortKey],
  );

  // Assign ranks and look up previous rank from mockLeaderboard
  return sorted.map((entry, index) => {
    const mockEntry = mockLeaderboard.find(m => m.municipality_id === entry.municipality_id);
    return {
      ...entry,
      current_rank: index + 1,
      previous_rank: mockEntry?.previous_rank ?? null,
      rank_delta: mockEntry?.rank_delta ?? null,
    };
  });
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>;
  }
  if (delta === 0) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>;
  }
  if (delta > 0) {
    return (
      <span
        style={{
          color: '#10b981',
          fontSize: '0.8rem',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        ▲ {delta}
      </span>
    );
  }
  return (
    <span
      style={{
        color: '#ef4444',
        fontSize: '0.8rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      ▼ {Math.abs(delta)}
    </span>
  );
}

const colHeaders: { key: SortKey; label: string }[] = [
  { key: 'resolution_rate', label: 'Resolution Rate' },
  { key: 'avg_response_hours', label: 'Response Time' },
  { key: 'sdbip_achievement_pct', label: 'SDBIP Achievement' },
  { key: 'total_tickets', label: 'Total Tickets' },
];

export function MunicipalityLeaderboard({
  responseTimes,
  resolutionRates,
  sdbipData,
  onSelectMunicipality,
}: MunicipalityLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('resolution_rate');

  const leaderboard = useMemo(
    () => computeLeaderboard(responseTimes, resolutionRates, sdbipData, sortKey),
    [responseTimes, resolutionRates, sdbipData, sortKey],
  );

  const total = leaderboard.length;

  function getRowStyle(rank: number): React.CSSProperties {
    if (rank <= 3) {
      return {
        background: 'rgba(16, 185, 129, 0.12)',
        borderLeft: '3px solid #10b981',
      };
    }
    if (total > 5 && rank > total - 3) {
      return {
        background: 'rgba(239, 68, 68, 0.12)',
        borderLeft: '3px solid #ef4444',
      };
    }
    return { borderLeft: '3px solid transparent' };
  }

  return (
    <GlassCard variant="elevated">
      <h3
        style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
        }}
      >
        Municipality Rankings
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <th
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  width: '60px',
                }}
              >
                Rank
              </th>
              <th
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                }}
              >
                Municipality
              </th>
              {colHeaders.map(col => (
                <th
                  key={col.key}
                  onClick={() => setSortKey(col.key)}
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: sortKey === col.key ? 'var(--color-teal, #00bfa5)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    textDecoration: sortKey === col.key ? 'underline' : 'none',
                    transition: 'color 0.15s ease',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(entry => (
              <tr
                key={entry.municipality_id}
                onClick={() => onSelectMunicipality?.(entry)}
                style={{
                  ...getRowStyle(entry.current_rank),
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  transition: 'background 0.15s ease',
                  cursor: onSelectMunicipality ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (onSelectMunicipality) {
                    e.currentTarget.style.background = 'rgba(0, 191, 165, 0.12)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onSelectMunicipality) {
                    const style = getRowStyle(entry.current_rank);
                    e.currentTarget.style.background = style.background as string || '';
                  }
                }}
              >
                {/* Rank + delta */}
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        lineHeight: 1,
                      }}
                    >
                      #{entry.current_rank}
                    </span>
                    <DeltaBadge delta={entry.rank_delta} />
                  </div>
                </td>

                {/* Municipality name */}
                <td
                  style={{
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {entry.municipality_name}
                </td>

                {/* Resolution Rate */}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{ color: getRateColor(entry.resolution_rate), fontWeight: 600 }}>
                    {entry.resolution_rate.toFixed(0)}%
                  </span>
                </td>

                {/* Response Time */}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{ color: getResponseColor(entry.avg_response_hours), fontWeight: 600 }}>
                    {entry.avg_response_hours.toFixed(1)} hrs
                  </span>
                </td>

                {/* SDBIP Achievement */}
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  <span style={{ color: getRateColor(entry.sdbip_achievement_pct), fontWeight: 600 }}>
                    {entry.sdbip_achievement_pct.toFixed(1)}%
                  </span>
                </td>

                {/* Total Tickets */}
                <td
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {entry.total_tickets.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
