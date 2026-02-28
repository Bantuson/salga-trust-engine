/**
 * MemberScheduleModal — Weekly schedule for a single team member with CRUD.
 *
 * Shows the member's schedule entries, inline add form, edit and delete.
 * Glassmorphic overlay, Escape/overlay close, max-width 560px.
 */

import { useEffect, useState } from 'react';
import type { TeamSchedule } from '../../types/teams';

interface MemberScheduleModalProps {
  memberName: string;
  memberId: string;
  schedules: TeamSchedule[];
  onClose: () => void;
  onAdd?: (entry: Omit<TeamSchedule, 'id'>) => void;
  onUpdate?: (id: string, data: Partial<TeamSchedule>) => void;
  onDelete?: (id: string) => void;
}

type ShiftType = 'morning' | 'afternoon' | 'night';
type StatusType = 'scheduled' | 'on_leave' | 'absent';

function getShiftColor(shift: string): string {
  switch (shift) {
    case 'morning': return '#00bfa5';
    case 'afternoon': return '#FBBF24';
    case 'night': return '#a78bfa';
    default: return 'var(--text-muted)';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return '#22c55e';
    case 'on_leave': return '#FBBF24';
    case 'absent': return '#ef4444';
    default: return 'var(--text-muted)';
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function MemberScheduleModal({
  memberName, memberId, schedules, onClose, onAdd, onUpdate, onDelete,
}: MemberScheduleModalProps) {
  const [localSchedules, setLocalSchedules] = useState<TeamSchedule[]>(schedules);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<TeamSchedule>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New entry form state
  const [newDate, setNewDate] = useState('');
  const [newShift, setNewShift] = useState<ShiftType>('morning');
  const [newStatus, setNewStatus] = useState<StatusType>('scheduled');
  const [newNotes, setNewNotes] = useState('');

  // Body scroll lock
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Keyboard close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) { setEditingId(null); return; }
        if (showAddForm) { setShowAddForm(false); return; }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, editingId, showAddForm]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const memberSchedules = localSchedules
    .filter((s) => s.member_id === memberId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleAdd = () => {
    if (!newDate) return;
    const entry: TeamSchedule = {
      id: `sched-local-${Date.now()}`,
      member_id: memberId,
      member_name: memberName,
      date: newDate,
      shift: newShift,
      status: newStatus,
      notes: newNotes || undefined,
    };
    if (onAdd) {
      onAdd(entry);
    }
    setLocalSchedules((prev) => [...prev, entry]);
    setToast('Schedule entry added');
    setShowAddForm(false);
    setNewDate('');
    setNewShift('morning');
    setNewStatus('scheduled');
    setNewNotes('');
  };

  const handleEdit = (s: TeamSchedule) => {
    setEditingId(s.id);
    setEditData({ shift: s.shift, status: s.status, notes: s.notes || '' });
  };

  const handleSaveEdit = (id: string) => {
    if (onUpdate) {
      onUpdate(id, editData);
    }
    setLocalSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...editData } as TeamSchedule : s))
    );
    setEditingId(null);
    setToast('Schedule updated');
  };

  const handleDelete = (id: string) => {
    if (onDelete) {
      onDelete(id);
    }
    setLocalSchedules((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirmId(null);
    setToast('Schedule entry removed');
  };

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${memberName} schedule`}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div style={styles.headerSection}>
          <h2 style={styles.title}>{memberName}</h2>
          <span style={styles.subtitle}>Weekly Schedule</span>
        </div>

        {/* Schedule entries */}
        <div style={styles.section}>
          {memberSchedules.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>No schedule entries found.</p>
          ) : (
            memberSchedules.map((s) => (
              <div key={s.id} style={styles.entryRow}>
                {editingId === s.id ? (
                  /* Edit mode */
                  <div style={styles.editForm}>
                    <span style={styles.entryDate}>{formatDate(s.date)}</span>
                    <select
                      value={editData.shift || s.shift}
                      onChange={(e) => setEditData({ ...editData, shift: e.target.value as ShiftType })}
                      style={styles.select}
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="night">Night</option>
                    </select>
                    <select
                      value={editData.status || s.status}
                      onChange={(e) => setEditData({ ...editData, status: e.target.value as StatusType })}
                      style={styles.select}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="on_leave">On Leave</option>
                      <option value="absent">Absent</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Notes"
                      value={editData.notes ?? s.notes ?? ''}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      style={styles.input}
                    />
                    <div style={styles.editActions}>
                      <button style={styles.saveBtn} onClick={() => handleSaveEdit(s.id)}>Save</button>
                      <button style={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <span style={styles.entryDate}>{formatDate(s.date)}</span>
                    <span style={{ ...styles.pill, background: `${getShiftColor(s.shift)}22`, color: getShiftColor(s.shift) }}>
                      {s.shift}
                    </span>
                    <span style={{ ...styles.pill, background: `${getStatusColor(s.status)}22`, color: getStatusColor(s.status) }}>
                      {s.status.replace('_', ' ')}
                    </span>
                    {s.notes && <span style={styles.notes}>{s.notes}</span>}
                    <div style={styles.rowActions}>
                      <button style={styles.editBtn} onClick={() => handleEdit(s)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      {deleteConfirmId === s.id ? (
                        <>
                          <button style={styles.deleteConfirmBtn} onClick={() => handleDelete(s.id)}>Confirm</button>
                          <button style={styles.cancelBtn} onClick={() => setDeleteConfirmId(null)}>No</button>
                        </>
                      ) : (
                        <button style={styles.deleteBtn} onClick={() => setDeleteConfirmId(s.id)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add schedule form */}
        {showAddForm ? (
          <div style={styles.addForm}>
            <h4 style={styles.addFormTitle}>Add Schedule Entry</h4>
            <div style={styles.formGrid}>
              <label style={styles.formLabel}>
                Date
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={styles.input} />
              </label>
              <label style={styles.formLabel}>
                Shift
                <select value={newShift} onChange={(e) => setNewShift(e.target.value as ShiftType)} style={styles.select}>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                </select>
              </label>
              <label style={styles.formLabel}>
                Status
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as StatusType)} style={styles.select}>
                  <option value="scheduled">Scheduled</option>
                  <option value="on_leave">On Leave</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
              <label style={{ ...styles.formLabel, gridColumn: '1 / -1' }}>
                Notes
                <input type="text" placeholder="Optional notes..." value={newNotes} onChange={(e) => setNewNotes(e.target.value)} style={styles.input} />
              </label>
            </div>
            <div style={styles.addFormActions}>
              <button style={styles.saveBtn} onClick={handleAdd} disabled={!newDate}>Add Entry</button>
              <button style={styles.cancelBtn} onClick={() => setShowAddForm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button style={styles.addButton} onClick={() => setShowAddForm(true)}>
            + Add Schedule Entry
          </button>
        )}

        {/* Toast */}
        {toast && <div style={styles.toast}>{toast}</div>}
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
    maxWidth: '560px',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto' as const,
    padding: 'var(--glass-card-padding)',
    position: 'relative' as const,
  } as React.CSSProperties,
  closeButton: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  headerSection: {
    marginBottom: '1.25rem',
    paddingTop: '0.25rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.875rem',
  } as React.CSSProperties,
  section: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.5rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  entryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  entryDate: {
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    minWidth: '90px',
    fontWeight: 500,
  } as React.CSSProperties,
  pill: {
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
    display: 'inline-block',
  } as React.CSSProperties,
  notes: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    fontStyle: 'italic' as const,
    flex: 1,
  } as React.CSSProperties,
  rowActions: {
    display: 'flex',
    gap: '0.25rem',
    marginLeft: 'auto',
    alignItems: 'center',
  } as React.CSSProperties,
  editBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  deleteConfirmBtn: {
    background: 'rgba(239,68,68,0.15)',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.7rem',
    fontWeight: 600,
  } as React.CSSProperties,
  editForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    width: '100%',
  } as React.CSSProperties,
  editActions: {
    display: 'flex',
    gap: '0.5rem',
  } as React.CSSProperties,
  select: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    width: '100%',
  } as React.CSSProperties,
  saveBtn: {
    background: 'rgba(0,191,165,0.15)',
    border: '1px solid rgba(0,191,165,0.3)',
    color: '#00bfa5',
    cursor: 'pointer',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  cancelBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '0.375rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  addButton: {
    width: '100%',
    background: 'rgba(0,191,165,0.08)',
    border: '1px dashed rgba(0,191,165,0.3)',
    color: 'var(--color-teal)',
    cursor: 'pointer',
    padding: '0.75rem',
    borderRadius: 'var(--radius-lg)',
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  addForm: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 'var(--radius-lg)',
    padding: '1rem',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  addFormTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 0.75rem 0',
  } as React.CSSProperties,
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  formLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  addFormActions: {
    display: 'flex',
    gap: '0.5rem',
  } as React.CSSProperties,
  toast: {
    position: 'absolute' as const,
    bottom: '1rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,191,165,0.9)',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    zIndex: 10,
  } as React.CSSProperties,
};
