/**
 * MunicipalityDetailModal — Modal dialog showing municipality performance detail.
 *
 * Follows the TeamCreateModal pattern exactly:
 * - Overlay at z-1000, rgba(0,0,0,0.5) blur 4px
 * - glass-pink-frost container, blur medium
 * - Sticky header, body scroll lock, Escape handler, overlay click closes
 *
 * Replaces the inline expanded row in SALGAAdminDashboardPage.
 */

import { useEffect } from 'react';

export interface MunicipalityData {
  id: string;
  name: string;
  category?: string;
  province?: string;
  kpi_achievement_avg?: number;
  ticket_resolution_rate?: number;
  sla_compliance?: number;
  total_kpis?: number;
  green_count?: number;
  amber_count?: number;
  red_count?: number;
  // allow any additional fields from API
  [key: string]: unknown;
}

interface MunicipalityDetailModalProps {
  municipality: MunicipalityData;
  onClose: () => void;
}

function achievementStatus(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function trafficLightColor(status: 'green' | 'amber' | 'red'): string {
  if (status === 'green') return 'var(--color-teal)';
  if (status === 'amber') return 'var(--color-gold)';
  return 'var(--color-coral)';
}

export function MunicipalityDetailModal({ municipality: m, onClose }: MunicipalityDetailModalProps) {
  const kpiPct = Number(m.kpi_achievement_avg ?? 0);
  const kpiStatus = achievementStatus(kpiPct);
  const kpiColor = trafficLightColor(kpiStatus);

  // Body scroll lock while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${m.name} performance detail`}
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.headerTitle}>{m.name}</h2>
            <div style={styles.badgeRow}>
              {m.category && <span style={styles.badge}>{m.category}</span>}
              {m.province && <span style={styles.badge}>{m.province}</span>}
            </div>
          </div>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div data-lenis-prevent style={styles.body}>
          {/* Overall Performance Score */}
          <div style={styles.scoreSection}>
            <div style={styles.scoreLeft}>
              <span
                style={{
                  ...styles.bigScore,
                  color: kpiColor,
                }}
              >
                {kpiPct.toFixed(1)}%
              </span>
              <span style={styles.scoreLabel}>Overall KPI Achievement</span>
            </div>
            <div style={styles.scoreRight}>
              <span
                style={{
                  ...styles.trafficBadge,
                  background: `${kpiColor}22`,
                  border: `1px solid ${kpiColor}66`,
                  color: kpiColor,
                }}
              >
                {kpiStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Two-column layout */}
          <div style={styles.twoCol}>
            {/* KPI Performance Summary */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>KPI Performance Summary</h3>

              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Total KPIs</span>
                <span style={styles.detailValue}>{m.total_kpis ?? 0}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>On Track (Green)</span>
                <span style={{ ...styles.detailValue, color: 'var(--color-teal)', fontWeight: 700 }}>
                  {m.green_count ?? 0}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>At Risk (Amber)</span>
                <span style={{ ...styles.detailValue, color: 'var(--color-gold)', fontWeight: 700 }}>
                  {m.amber_count ?? 0}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Off Track (Red)</span>
                <span style={{ ...styles.detailValue, color: 'var(--color-coral)', fontWeight: 700 }}>
                  {m.red_count ?? 0}
                </span>
              </div>
            </div>

            {/* Service Delivery Summary */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Service Delivery Summary</h3>

              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Ticket Resolution Rate</span>
                <span style={styles.detailValue}>
                  {Number(m.ticket_resolution_rate ?? 0).toFixed(1)}%
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>SLA Compliance</span>
                <span style={styles.detailValue}>
                  {Number(m.sla_compliance ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* KPI Breakdown table (traffic light status per category) */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>KPI Traffic Light Overview</h3>
            <table style={styles.kpiTable}>
              <thead>
                <tr>
                  <th style={styles.kpiTh}>Category</th>
                  <th style={{ ...styles.kpiTh, textAlign: 'center' }}>Count</th>
                  <th style={{ ...styles.kpiTh, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.kpiTd}>On Track (Green)</td>
                  <td style={{ ...styles.kpiTd, textAlign: 'center', fontWeight: 700, color: 'var(--color-teal)' }}>
                    {m.green_count ?? 0}
                  </td>
                  <td style={{ ...styles.kpiTd, textAlign: 'center' }}>
                    <span style={{ ...styles.statusDot, background: 'var(--color-teal)' }} />
                  </td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>At Risk (Amber)</td>
                  <td style={{ ...styles.kpiTd, textAlign: 'center', fontWeight: 700, color: 'var(--color-gold)' }}>
                    {m.amber_count ?? 0}
                  </td>
                  <td style={{ ...styles.kpiTd, textAlign: 'center' }}>
                    <span style={{ ...styles.statusDot, background: 'var(--color-gold)' }} />
                  </td>
                </tr>
                <tr>
                  <td style={styles.kpiTd}>Off Track (Red)</td>
                  <td style={{ ...styles.kpiTd, textAlign: 'center', fontWeight: 700, color: 'var(--color-coral)' }}>
                    {m.red_count ?? 0}
                  </td>
                  <td style={{ ...styles.kpiTd, textAlign: 'center' }}>
                    <span style={{ ...styles.statusDot, background: 'var(--color-coral)' }} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            type="button"
            style={styles.closeFooterButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  } as React.CSSProperties,
  modal: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '860px',
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 'var(--glass-card-padding)',
    paddingBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    top: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    zIndex: 1,
  } as React.CSSProperties,
  headerLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.3,
  } as React.CSSProperties,
  badgeRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
  } as React.CSSProperties,
  closeButton: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s ease',
    marginLeft: '1rem',
  } as React.CSSProperties,
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 'var(--glass-card-padding)',
  } as React.CSSProperties,
  scoreSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--glass-card-padding)',
    marginBottom: 'var(--space-lg)',
  } as React.CSSProperties,
  scoreLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  } as React.CSSProperties,
  bigScore: {
    fontSize: '3rem',
    fontWeight: 700,
    lineHeight: 1,
    fontFamily: 'var(--font-display)',
  } as React.CSSProperties,
  scoreLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,
  scoreRight: {
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  trafficBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 700,
    fontSize: '0.875rem',
    letterSpacing: '0.06em',
  } as React.CSSProperties,
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-lg)',
    marginBottom: 'var(--space-lg)',
  } as React.CSSProperties,
  section: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--glass-card-padding)',
    marginBottom: 'var(--space-lg)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginTop: 0,
    marginBottom: 'var(--space-md)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.35rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  } as React.CSSProperties,
  detailLabel: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  detailValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  } as React.CSSProperties,
  kpiTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.875rem',
  } as React.CSSProperties,
  kpiTh: {
    padding: '0.5rem 0.75rem',
    textAlign: 'left' as const,
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  } as React.CSSProperties,
  kpiTd: {
    padding: '0.6rem 0.75rem',
    color: 'var(--text-primary)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  statusDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 'var(--glass-card-padding)',
    borderTop: '1px solid var(--glass-border)',
    position: 'sticky' as const,
    bottom: 0,
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
  } as React.CSSProperties,
  closeFooterButton: {
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 1.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  } as React.CSSProperties,
};
