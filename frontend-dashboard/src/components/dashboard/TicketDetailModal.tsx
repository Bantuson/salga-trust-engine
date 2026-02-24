/**
 * TicketDetailModal — Fullscreen modal for viewing ticket details and taking actions.
 *
 * Role-dependent action panels:
 * - Manager/Admin: Assign (team + user), Status update, Escalate
 * - Field Worker: Status update (In Progress / Resolved), Add Note, Escalate
 * - SAPS Liaison: Status update, Add Note
 * - Ward Councillor: Read-only view
 */

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchTicketDetail,
  assignTicket,
  updateTicketStatus,
  escalateTicket,
  addTicketNote,
  fetchTicketHistory,
  fetchTeams,
} from '../../services/api';
import type { Ticket, TicketDetailResponse, HistoryEntry } from '../../types/dashboard';
import type { Team } from '../../types/teams';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdated?: () => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'open': return 'var(--color-teal)';
    case 'in_progress': return '#FBBF24';
    case 'escalated': return 'var(--color-coral)';
    case 'resolved': return 'var(--color-teal)';
    case 'closed': return 'var(--text-muted)';
    default: return 'var(--text-muted)';
  }
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high': return 'var(--color-coral)';
    case 'medium': return '#FBBF24';
    case 'low': return 'var(--color-teal)';
    default: return 'var(--text-muted)';
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    return format(new Date(dateString), 'yyyy-MM-dd HH:mm');
  } catch {
    return dateString;
  }
}

export function TicketDetailModal({ ticket, onClose, onUpdated }: TicketDetailModalProps) {
  const { getUserRole } = useAuth();
  const role = getUserRole();

  const [detail, setDetail] = useState<TicketDetailResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Assignment form
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  // Escalation form
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  // Note form
  const [noteContent, setNoteContent] = useState('');

  const canManage = role === 'manager' || role === 'admin';
  const canFieldWork = role === 'field_worker';
  const canSAPS = role === 'saps_liaison';
  const canAct = canManage || canFieldWork || canSAPS;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailRes, historyRes] = await Promise.all([
        fetchTicketDetail(ticket.id),
        fetchTicketHistory(ticket.id).catch(() => [] as HistoryEntry[]),
      ]);
      setDetail(detailRes);
      setHistory(historyRes);

      if (canManage) {
        const teamsRes = await fetchTeams().catch(() => [] as Team[]);
        setTeams(teamsRes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  }, [ticket.id, canManage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleStatusUpdate = async (newStatus: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await updateTicketStatus(ticket.id, newStatus);
      await loadData();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTeamId) return;
    setActionLoading(true);
    setError(null);
    try {
      await assignTicket(ticket.id, {
        team_id: selectedTeamId || undefined,
        assigned_to: selectedUserId || undefined,
      });
      await loadData();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (escalateReason.length < 10) return;
    setActionLoading(true);
    setError(null);
    try {
      await escalateTicket(ticket.id, escalateReason);
      setShowEscalate(false);
      setEscalateReason('');
      await loadData();
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to escalate ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setActionLoading(true);
    setError(null);
    try {
      await addTicketNote(ticket.id, noteContent);
      setNoteContent('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setActionLoading(false);
    }
  };

  const currentStatus = detail?.status ?? ticket.status;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <span style={styles.trackingNumber}>{ticket.tracking_number}</span>
            <span style={{ ...styles.badge, backgroundColor: getStatusColor(currentStatus) }}>
              {currentStatus.replace('_', ' ')}
            </span>
            <span style={{ ...styles.badge, backgroundColor: getSeverityColor(detail?.severity ?? ticket.severity) }}>
              {(detail?.severity ?? ticket.severity)}
            </span>
            <span style={styles.categoryLabel}>{ticket.category}</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>X</button>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={activeTab === 'details' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            style={activeTab === 'history' ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
        </div>

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Content */}
        <div style={styles.content}>
          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <p>Loading ticket details...</p>
            </div>
          ) : activeTab === 'details' ? (
            <div style={styles.detailsGrid}>
              {/* Left: Info */}
              <div style={styles.infoSection}>
                <GlassCard variant="default" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                  <h3 style={styles.sectionTitle}>Description</h3>
                  <p style={styles.description}>{detail?.description ?? ticket.description}</p>
                </GlassCard>

                <GlassCard variant="default" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                  <h3 style={styles.sectionTitle}>Details</h3>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Address</span>
                    <span style={styles.detailValue}>{detail?.address ?? ticket.address ?? '-'}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>Created</span>
                    <span style={styles.detailValue}>{formatDate(detail?.created_at ?? ticket.created_at)}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>SLA Response</span>
                    <span style={styles.detailValue}>{formatDate(detail?.sla_response_deadline ?? null)}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>SLA Resolution</span>
                    <span style={styles.detailValue}>{formatDate(detail?.sla_resolution_deadline ?? null)}</span>
                  </div>
                  <div style={styles.detailRow}>
                    <span style={styles.detailLabel}>SLA Status</span>
                    <span style={styles.detailValue}>{detail?.sla_status ?? '-'}</span>
                  </div>
                  {detail?.escalation_reason && (
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Escalation Reason</span>
                      <span style={styles.detailValue}>{detail.escalation_reason}</span>
                    </div>
                  )}
                </GlassCard>
              </div>

              {/* Right: Actions */}
              {canAct && (
                <div style={styles.actionsSection}>
                  {/* Manager/Admin: Assignment */}
                  {canManage && (
                    <GlassCard variant="default" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                      <h3 style={styles.sectionTitle}>Assign Ticket</h3>
                      <div style={styles.formGroup}>
                        <label style={styles.formLabel}>Team</label>
                        <select
                          style={styles.select}
                          value={selectedTeamId}
                          onChange={(e) => setSelectedTeamId(e.target.value)}
                        >
                          <option value="">Select team...</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        style={styles.actionBtn}
                        onClick={handleAssign}
                        disabled={actionLoading || !selectedTeamId}
                      >
                        {actionLoading ? 'Assigning...' : 'Assign'}
                      </button>
                    </GlassCard>
                  )}

                  {/* Status Update */}
                  <GlassCard variant="default" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                    <h3 style={styles.sectionTitle}>Update Status</h3>
                    <div style={styles.statusButtons}>
                      {canFieldWork ? (
                        <>
                          {currentStatus === 'open' && (
                            <button
                              style={styles.statusBtn}
                              onClick={() => handleStatusUpdate('in_progress')}
                              disabled={actionLoading}
                            >
                              Start Work
                            </button>
                          )}
                          {currentStatus === 'in_progress' && (
                            <button
                              style={{ ...styles.statusBtn, backgroundColor: 'var(--color-teal)' }}
                              onClick={() => handleStatusUpdate('resolved')}
                              disabled={actionLoading}
                            >
                              Mark Resolved
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {currentStatus !== 'in_progress' && (
                            <button
                              style={styles.statusBtn}
                              onClick={() => handleStatusUpdate('in_progress')}
                              disabled={actionLoading}
                            >
                              In Progress
                            </button>
                          )}
                          {currentStatus !== 'resolved' && (
                            <button
                              style={{ ...styles.statusBtn, backgroundColor: 'var(--color-teal)' }}
                              onClick={() => handleStatusUpdate('resolved')}
                              disabled={actionLoading}
                            >
                              Resolved
                            </button>
                          )}
                          {currentStatus !== 'closed' && (
                            <button
                              style={{ ...styles.statusBtn, backgroundColor: 'var(--text-muted)' }}
                              onClick={() => handleStatusUpdate('closed')}
                              disabled={actionLoading}
                            >
                              Close
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </GlassCard>

                  {/* Escalate */}
                  {currentStatus !== 'escalated' && currentStatus !== 'resolved' && currentStatus !== 'closed' && (
                    <GlassCard variant="default" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                      {!showEscalate ? (
                        <button
                          style={{ ...styles.actionBtn, backgroundColor: 'var(--color-coral)' }}
                          onClick={() => setShowEscalate(true)}
                        >
                          Escalate Ticket
                        </button>
                      ) : (
                        <>
                          <h3 style={styles.sectionTitle}>Escalate</h3>
                          <textarea
                            style={styles.textarea}
                            placeholder="Reason for escalation (min 10 chars)..."
                            value={escalateReason}
                            onChange={(e) => setEscalateReason(e.target.value)}
                            rows={3}
                          />
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              style={{ ...styles.actionBtn, backgroundColor: 'var(--color-coral)', flex: 1 }}
                              onClick={handleEscalate}
                              disabled={actionLoading || escalateReason.length < 10}
                            >
                              {actionLoading ? 'Escalating...' : 'Confirm Escalate'}
                            </button>
                            <button
                              style={{ ...styles.actionBtn, backgroundColor: 'var(--text-muted)', flex: 1 }}
                              onClick={() => { setShowEscalate(false); setEscalateReason(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </GlassCard>
                  )}

                  {/* Add Note */}
                  {(canFieldWork || canSAPS || canManage) && (
                    <GlassCard variant="default" style={{ padding: '1.25rem' }}>
                      <h3 style={styles.sectionTitle}>Add Note</h3>
                      <textarea
                        style={styles.textarea}
                        placeholder="Write a note..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        rows={3}
                      />
                      <button
                        style={{ ...styles.actionBtn, marginTop: '0.5rem' }}
                        onClick={handleAddNote}
                        disabled={actionLoading || !noteContent.trim()}
                      >
                        {actionLoading ? 'Saving...' : 'Save Note'}
                      </button>
                    </GlassCard>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* History Tab */
            <div style={styles.historyList}>
              {history.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                  No history available
                </p>
              ) : (
                history.map((entry, i) => (
                  <GlassCard key={i} variant="default" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={styles.historyHeader}>
                      <span style={{
                        ...styles.badge,
                        backgroundColor: entry.type === 'assignment' ? 'var(--color-teal)' : '#FBBF24',
                        fontSize: '0.7rem',
                      }}>
                        {entry.type === 'assignment' ? 'Assignment' : entry.operation ?? 'Update'}
                      </span>
                      <span style={styles.historyDate}>{formatDate(entry.timestamp)}</span>
                    </div>
                    {entry.type === 'assignment' ? (
                      <p style={styles.historyContent}>
                        {entry.reason ?? 'Assigned'}
                        {entry.is_current && <span style={styles.currentBadge}>Current</span>}
                      </p>
                    ) : (
                      <p style={styles.historyContent}>{entry.changes ?? '-'}</p>
                    )}
                  </GlassCard>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--surface-base)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--glass-border)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--glass-border)',
    background: 'var(--surface-elevated)',
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
    color: 'var(--text-primary)',
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
    color: 'var(--text-secondary)',
    textTransform: 'capitalize' as const,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    fontWeight: '600' as const,
    padding: '0.25rem 0.5rem',
    fontFamily: 'inherit',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--glass-border)',
    background: 'var(--surface-elevated)',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500' as const,
    fontFamily: 'inherit',
  },
  tabActive: {
    padding: '0.75rem 1.5rem',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid var(--color-teal)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    fontFamily: 'inherit',
  },
  error: {
    padding: '0.75rem 1.5rem',
    color: 'var(--color-coral)',
    background: 'rgba(239, 68, 68, 0.1)',
    fontSize: '0.875rem',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1.5rem',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    gap: '1rem',
    color: 'var(--text-secondary)',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--surface-higher)',
    borderTop: '3px solid var(--color-teal)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: '1.5rem',
  } as React.CSSProperties,
  infoSection: {} as React.CSSProperties,
  actionsSection: {} as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  description: {
    fontSize: '0.9375rem',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--glass-border)',
  },
  detailLabel: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '500' as const,
  },
  detailValue: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    fontWeight: '500' as const,
    textAlign: 'right' as const,
  },
  formGroup: {
    marginBottom: '0.75rem',
  },
  formLabel: {
    display: 'block',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    marginBottom: '0.375rem',
    fontWeight: '500' as const,
  },
  select: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--glass-border)',
    background: 'var(--surface-base)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
  },
  actionBtn: {
    width: '100%',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-teal)',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s ease',
  },
  textarea: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--glass-border)',
    background: 'var(--surface-base)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    resize: 'vertical' as const,
  },
  statusButtons: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  statusBtn: {
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: '#FBBF24',
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  historyList: {
    maxHeight: '60vh',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  historyDate: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  historyContent: {
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    margin: 0,
  },
  currentBadge: {
    display: 'inline-block',
    marginLeft: '0.5rem',
    padding: '0.1rem 0.4rem',
    borderRadius: '9999px',
    fontSize: '0.625rem',
    fontWeight: '600' as const,
    background: 'var(--color-teal)',
    color: 'white',
  },
};
