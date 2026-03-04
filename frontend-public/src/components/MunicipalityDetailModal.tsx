import { useEffect, useRef, useCallback } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { CategoryDonutChart } from './CategoryDonutChart';
import { ResolutionTrendChart } from './ResolutionTrendChart';
import { SdbipGaugeChart } from './SdbipGaugeChart';
import type {
  LeaderboardEntry,
  ResolutionRateData,
  CategoryBreakdownData,
  SdbipAchievementData,
} from '../types/public';

interface MunicipalityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LeaderboardEntry | null;
  resolutionRates: ResolutionRateData[];
  categoryBreakdown: CategoryBreakdownData[];
  sdbipData: SdbipAchievementData[];
}

function getResponseColor(hours: number): string {
  if (hours < 24) return '#10b981';
  if (hours < 72) return '#f59e0b';
  return '#ef4444';
}

function getRateColor(rate: number): string {
  if (rate >= 80) return '#10b981';
  if (rate >= 50) return '#f59e0b';
  return '#ef4444';
}

function getLabel(hours: number): string {
  if (hours < 24) return 'Excellent';
  if (hours < 72) return 'Acceptable';
  return 'Needs Improvement';
}

function getRateLabel(rate: number): string {
  if (rate >= 80) return 'Excellent';
  if (rate >= 60) return 'Acceptable';
  return 'Needs Improvement';
}

export function MunicipalityDetailModal({
  isOpen,
  onClose,
  entry,
  resolutionRates,
  categoryBreakdown,
  sdbipData,
}: MunicipalityDetailModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  if (!isOpen || !entry) return null;

  // Find matching resolution rate data for trend
  const rr = resolutionRates.find(r => r.municipality_id === entry.municipality_id);
  // Find matching SDBIP data
  const sdbip = sdbipData.find(s => s.municipality_id === entry.municipality_id);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--surface-base, #1a1a2e)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.15))',
          borderRadius: 'var(--radius-xl, 16px)',
          padding: '2rem',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '1.25rem',
            transition: 'background 0.15s',
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {entry.municipality_name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '2px 10px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: '#fff',
              background: entry.current_rank <= 3 ? '#10b981' : 'var(--text-secondary)',
            }}>
              Rank #{entry.current_rank}
            </span>
            {entry.rank_delta !== null && entry.rank_delta !== 0 && (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: entry.rank_delta > 0 ? '#10b981' : '#ef4444',
              }}>
                {entry.rank_delta > 0 ? `▲ ${entry.rank_delta}` : `▼ ${Math.abs(entry.rank_delta)}`} from last quarter
              </span>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
          {/* Response Time */}
          <GlassCard variant="elevated" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Avg Response
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: getResponseColor(entry.avg_response_hours), lineHeight: 1.1 }}>
              {entry.avg_response_hours.toFixed(1)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>hours</div>
            <div style={{
              display: 'inline-block', marginTop: '6px', padding: '1px 8px',
              borderRadius: '10px', fontSize: '0.65rem', fontWeight: 600, color: '#fff',
              background: getResponseColor(entry.avg_response_hours),
            }}>
              {getLabel(entry.avg_response_hours)}
            </div>
          </GlassCard>

          {/* Resolution Rate */}
          <GlassCard variant="elevated" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Resolution Rate
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: getRateColor(entry.resolution_rate), lineHeight: 1.1 }}>
              {entry.resolution_rate.toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {rr ? `${rr.resolved_tickets.toLocaleString()}/${rr.total_tickets.toLocaleString()}` : '—'}
            </div>
            <div style={{
              display: 'inline-block', marginTop: '6px', padding: '1px 8px',
              borderRadius: '10px', fontSize: '0.65rem', fontWeight: 600, color: '#fff',
              background: getRateColor(entry.resolution_rate),
            }}>
              {getRateLabel(entry.resolution_rate)}
            </div>
          </GlassCard>

          {/* SDBIP Achievement */}
          <GlassCard variant="elevated" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              SDBIP Achievement
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: getRateColor(entry.sdbip_achievement_pct), lineHeight: 1.1 }}>
              {entry.sdbip_achievement_pct.toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {sdbip ? `${sdbip.total_kpis} KPIs` : '—'}
            </div>
          </GlassCard>

          {/* Total Tickets */}
          <GlassCard variant="elevated" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Total Tickets
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {entry.total_tickets.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>this period</div>
          </GlassCard>
        </div>

        {/* SDBIP Gauge + Traffic Light */}
        {sdbip && (
          <GlassCard variant="elevated" style={{ padding: '20px', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              SDBIP Performance ({sdbip.financial_year})
            </h3>
            <SdbipGaugeChart achievementPct={sdbip.overall_achievement_pct} municipalityName={sdbip.municipality_name} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{sdbip.green}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>On Track</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>{sdbip.amber}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>At Risk</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>{sdbip.red}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Critical</div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Category Donut */}
        {categoryBreakdown.length > 0 && (
          <GlassCard variant="elevated" style={{ padding: '20px', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Report Distribution by Category
            </h3>
            <CategoryDonutChart data={categoryBreakdown} />
          </GlassCard>
        )}

        {/* Resolution Trend */}
        {rr && rr.trend && rr.trend.length > 0 && (
          <GlassCard variant="elevated" style={{ padding: '20px' }}>
            <ResolutionTrendChart trend={rr.trend} municipalityName={entry.municipality_name} />
          </GlassCard>
        )}
      </div>
    </div>
  );
}
