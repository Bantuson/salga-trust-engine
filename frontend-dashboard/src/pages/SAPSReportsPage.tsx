/**
 * SAPSReportsPage — GBV analytics and case management for SAPS liaison officers.
 *
 * Layout (follows AnalyticsPage pattern):
 * - 4 KPI cards: Open GBV Cases, In Progress, Resolved (30d), Avg Response Time
 * - Status distribution donut chart (SVG)
 * - Recent GBV cases table (reuses TicketTable with row click)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SortingState, PaginationState } from '@tanstack/react-table';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';
import { fetchTickets } from '../services/api';
import { TicketTable } from '../components/dashboard/TicketTable';
import { TicketDetailModal } from '../components/dashboard/TicketDetailModal';
import type { Ticket } from '../types/dashboard';
// SEC-05: Import ONLY from mockSAPSCases — NEVER from mockTickets
import { mockSAPSTickets } from '../mocks/mockSAPSCases';

export function SAPSReportsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      // Backend auto-filters to GBV for SAPS role
      const response = await fetchTickets({
        page: pagination.pageIndex,
        page_size: pagination.pageSize,
        sort_by: sorting[0]?.id,
        sort_order: sorting[0]?.desc ? 'desc' : 'asc',
      });
      setTickets(response.tickets);
      setPageCount(response.page_count);
    } catch (err) {
      // SEC-05: Rich mock fallback uses ONLY mockSAPSTickets (GBV cases) — never general tickets
      setTickets(mockSAPSTickets);
      setPageCount(1);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, sorting]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // KPI calculations
  const kpis = useMemo(() => {
    const open = tickets.filter(t => t.status === 'open').length;
    const inProgress = tickets.filter(t => t.status === 'in_progress').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    const escalated = tickets.filter(t => t.status === 'escalated').length;

    // Avg response time (hours) — from created_at to first_responded_at
    const responded = tickets.filter(t => t.first_responded_at);
    const avgHours = responded.length > 0
      ? responded.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const responded = new Date(t.first_responded_at!).getTime();
          return sum + (responded - created) / (1000 * 60 * 60);
        }, 0) / responded.length
      : 0;

    return { open, inProgress, resolved, escalated, avgResponseHours: Math.round(avgHours * 10) / 10 };
  }, [tickets]);

  // Donut chart data
  const donutSegments = useMemo(() => {
    const total = tickets.length || 1;
    const segments = [
      { label: 'Open', count: kpis.open, color: 'var(--color-teal)' },
      { label: 'In Progress', count: kpis.inProgress, color: '#FBBF24' },
      { label: 'Escalated', count: kpis.escalated, color: 'var(--color-coral)' },
      { label: 'Resolved', count: kpis.resolved, color: '#60a5fa' },
    ];

    let accumulated = 0;
    return segments.map(s => {
      const pct = (s.count / total) * 100;
      const start = accumulated;
      accumulated += pct;
      return { ...s, pct, start };
    });
  }, [tickets.length, kpis]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>SAPS Reports</h1>
      </header>

      {isLoading ? (
        <SkeletonTheme>
          <div style={styles.kpiGrid}>
            {[0, 1, 2, 3].map(i => (
              <GlassCard key={i} variant="default" style={{ padding: '1.25rem' }}>
                <Skeleton height={12} width="60%" style={{ marginBottom: '0.75rem' }} />
                <Skeleton height={36} width="70%" />
              </GlassCard>
            ))}
          </div>
        </SkeletonTheme>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={styles.kpiGrid}>
            <KPISimple label="Open GBV Cases" value={kpis.open} color="var(--color-teal)" />
            <KPISimple label="In Progress" value={kpis.inProgress} color="#FBBF24" />
            <KPISimple label="Resolved" value={kpis.resolved} color="#60a5fa" />
            <KPISimple label="Avg Response (hrs)" value={kpis.avgResponseHours} color="var(--color-coral)" />
          </div>

          {/* Two-column: Donut + Table */}
          <div style={styles.twoCol}>
            <GlassCard variant="default" style={{ padding: '1.5rem' }}>
              <h2 style={styles.sectionTitle}>Status Distribution</h2>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                <DonutChart segments={donutSegments} total={tickets.length} />
              </div>
              <div style={styles.legend}>
                {donutSegments.map(s => (
                  <div key={s.label} style={styles.legendItem}>
                    <span style={{ ...styles.legendDot, backgroundColor: s.color }} />
                    <span style={styles.legendLabel}>{s.label}: {s.count}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Cases Table */}
          <GlassCard variant="default" style={{ padding: '1.5rem' }}>
            <h2 style={styles.sectionTitle}>Recent GBV Cases</h2>
            <TicketTable
              tickets={tickets}
              pageCount={pageCount}
              pagination={pagination}
              sorting={sorting}
              onPaginationChange={setPagination}
              onSortingChange={setSorting}
              isLoading={false}
              onRowClick={(ticket) => setSelectedTicket(ticket)}
            />
          </GlassCard>

          {selectedTicket && (
            <TicketDetailModal
              ticket={selectedTicket}
              onClose={() => setSelectedTicket(null)}
              onUpdated={loadTickets}
            />
          )}
        </>
      )}
    </div>
  );
}

// Simple KPI card
function KPISimple({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <GlassCard variant="default" style={{ padding: '1.25rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '700', color }}>{value}</div>
    </GlassCard>
  );
}

// SVG Donut chart
function DonutChart({ segments, total }: { segments: { label: string; pct: number; start: number; color: string }[]; total: number }) {
  const size = 160;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--glass-border)"
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {segments.map(seg => {
        if (seg.pct <= 0) return null;
        const dashLength = (seg.pct / 100) * circumference;
        const dashOffset = -((seg.start / 100) * circumference);
        return (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="round"
          />
        );
      })}
      <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="var(--text-primary)" fontSize="1.5rem" fontWeight="700">
        {total}
      </text>
    </svg>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  } as React.CSSProperties,
  header: {
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
  } as React.CSSProperties,
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1rem',
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '1rem',
  } as React.CSSProperties,
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1.25rem',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  } as React.CSSProperties,
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  } as React.CSSProperties,
  legendLabel: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
};
