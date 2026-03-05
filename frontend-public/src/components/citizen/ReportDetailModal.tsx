/**
 * ReportDetailModal — Read-only detail modal for citizen's own reports.
 * Adapted from dashboard TicketDetailModal but without action panels.
 * Uses the public portal's white glassmorphism aesthetic.
 */

import { useEffect } from 'react';
import type { CitizenTicket } from '../../hooks/useCitizenReports';

interface ReportDetailModalProps {
  ticket: CitizenTicket;
  onClose: () => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return '#22c55e';
    case 'in_progress': return '#f97316';
    case 'escalated': return '#ef4444';
    case 'resolved': return 'var(--color-teal, #00D9A6)';
    case 'closed': return '#9CA3AF';
    default: return '#9CA3AF';
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high': return '#FF6B4A';
    case 'medium': return '#FBBF24';
    case 'low': return '#00D9A6';
    default: return '#9CA3AF';
  }
}

function formatCategory(category: string | undefined): string {
  if (!category) return 'General';
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function ReportDetailModal({ ticket, onClose }: ReportDetailModalProps) {
  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Report ${ticket.tracking_number} details`}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.trackingNumber}>{ticket.tracking_number}</span>
            <span style={{ ...styles.badge, backgroundColor: getStatusColor(ticket.status) }}>
              {ticket.status.replace('_', ' ')}
            </span>
            {ticket.severity && (
              <span style={{ ...styles.badge, backgroundColor: getSeverityColor(ticket.severity) }}>
                {ticket.severity}
              </span>
            )}
            {ticket.category && (
              <span style={styles.categoryLabel}>{formatCategory(ticket.category)}</span>
            )}
          </div>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={styles.content}>
          {/* Description */}
          {ticket.description && (
            <div style={styles.innerCard}>
              <h3 style={styles.sectionTitle}>Description</h3>
              <p style={styles.description}>{ticket.description}</p>
            </div>
          )}

          {/* Details */}
          <div style={styles.innerCard}>
            <h3 style={styles.sectionTitle}>Details</h3>
            {ticket.address && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Address</span>
                <span style={styles.detailValue}>{ticket.address}</span>
              </div>
            )}
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Date Reported</span>
              <span style={styles.detailValue}>{formatDate(ticket.created_at)}</span>
            </div>
            {ticket.media_count !== undefined && ticket.media_count > 0 && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Attachments</span>
                <span style={styles.detailValue}>
                  {ticket.media_count} {ticket.media_count === 1 ? 'file' : 'files'}
                </span>
              </div>
            )}
          </div>

          {/* Assignment */}
          <div style={styles.innerCard}>
            <h3 style={styles.sectionTitle}>Assignment</h3>
            {ticket.is_sensitive ? (
              <>
                {ticket.assigned_officer_name && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Assigned Officer</span>
                    <span style={{ ...styles.detailValue, fontWeight: 600 }}>{ticket.assigned_officer_name}</span>
                  </div>
                )}
                {ticket.station_name && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Station</span>
                    <span style={styles.detailValue}>{ticket.station_name}</span>
                  </div>
                )}
                {ticket.station_phone && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Station Phone</span>
                    <span style={styles.detailValue}>{ticket.station_phone}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Assigned To</span>
                  <span style={{ ...styles.detailValue, fontWeight: ticket.assigned_to_name ? 600 : 400 }}>
                    {ticket.assigned_to_name || 'Unassigned'}
                  </span>
                </div>
                {ticket.assigned_team_name && (
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Team</span>
                    <span style={styles.detailValue}>{ticket.assigned_team_name}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    width: '100%',
    maxWidth: '700px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--glass-white-frost, rgba(255, 255, 255, 0.85))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 'var(--radius-xl, 16px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
    background: 'rgba(255, 255, 255, 0.5)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap' as const,
  },
  trackingNumber: {
    fontFamily: 'monospace',
    fontWeight: '700' as const,
    fontSize: '1.125rem',
    color: '#f0eced',
  },
  badge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600' as const,
    color: 'white',
    textTransform: 'capitalize' as const,
  },
  categoryLabel: {
    fontSize: '0.875rem',
    color: '#e0d4d8',
    fontWeight: '500' as const,
    textTransform: 'capitalize' as const,
  },
  closeBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    color: '#e0d4d8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm, 6px)',
    transition: 'color 0.15s ease',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto' as const,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  innerCard: {
    background: 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    borderRadius: 'var(--radius-lg, 12px)',
    padding: '1.25rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.8125rem',
    fontWeight: '600' as const,
    color: '#00bfa5',
    marginBottom: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
    margin: '0 0 0.75rem 0',
  },
  description: {
    fontSize: '0.9375rem',
    lineHeight: '1.6',
    color: '#f0eced',
    margin: 0,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
    gap: '1rem',
  },
  detailLabel: {
    fontSize: '0.8125rem',
    color: '#d0c4c8',
    fontWeight: '500' as const,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: '0.8125rem',
    color: '#f9f7f8',
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
};
