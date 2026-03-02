/**
 * DepartmentsPage — Department management interface.
 *
 * Unique purpose: CRUD for departments, activation gates, director assignment.
 *   - Create Department button → CreateDepartmentModal
 *   - Per-row Invite Director button → InviteUserModal (filtered to section56_director)
 *   - Per-row Edit button → CreateDepartmentModal in edit mode
 *   - Per-row Deactivate button → DELETE /api/v1/departments/{id}
 *   - Activation status: GREEN (director + KPIs), AMBER (director, no KPIs), RED (no director)
 *
 * Error fallback: shows mock data with banner when API unavailable.
 * Empty state: shown when no departments exist.
 * Loading state: skeleton cards.
 *
 * Styling: CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CreateDepartmentModal, type DepartmentOption } from '../components/departments/CreateDepartmentModal';
import { InviteUserModal } from '../components/onboarding/InviteUserModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Department {
  id: string;
  name: string;
  code: string;
  director_id: string | null;
  director_name?: string | null;
  is_active: boolean;
  has_kpis?: boolean;
  parent_department_id?: string | null;
  created_at: string;
}

type ActivationStatus = 'active' | 'pending_kpis' | 'pending_director';

// ---------------------------------------------------------------------------
// Mock fallback data (shown when API is unavailable)
// ---------------------------------------------------------------------------

const MOCK_DEPARTMENTS: Department[] = [
  {
    id: 'mock-1',
    name: 'Corporate Services',
    code: 'CORP',
    director_id: 'dir-1',
    director_name: 'Thabo Nkosi',
    is_active: true,
    has_kpis: true,
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    id: 'mock-2',
    name: 'Finance',
    code: 'FIN',
    director_id: 'dir-2',
    director_name: 'Zanele Dlamini',
    is_active: true,
    has_kpis: false,
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    id: 'mock-3',
    name: 'Technical Services',
    code: 'TECH',
    director_id: null,
    director_name: null,
    is_active: false,
    has_kpis: false,
    created_at: '2026-01-15T08:00:00Z',
  },
  {
    id: 'mock-4',
    name: 'Community Services',
    code: 'COMM',
    director_id: 'dir-3',
    director_name: 'Sipho Mokoena',
    is_active: true,
    has_kpis: true,
    created_at: '2026-02-01T08:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getActivationStatus(dept: Department): ActivationStatus {
  if (!dept.director_id) return 'pending_director';
  if (!dept.has_kpis) return 'pending_kpis';
  return 'active';
}

function ActivationBadge({ status }: { status: ActivationStatus }) {
  const config = {
    active: {
      dot: '#22c55e',
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.3)',
      color: '#22c55e',
      label: 'Active',
    },
    pending_kpis: {
      dot: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      color: 'var(--color-gold)',
      label: 'Pending KPIs',
    },
    pending_director: {
      dot: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.3)',
      color: 'var(--color-coral)',
      label: 'Pending Director',
    },
  }[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: config.dot,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[200, 80, 140, 120, 120, 160].map((w, i) => (
        <td key={i} style={{ padding: 'var(--space-sm) var(--space-md)' }}>
          <div
            style={{
              height: '14px',
              width: `${w}px`,
              maxWidth: '100%',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: '4px',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepartmentsPage() {
  const { session, getUserRole, getTenantId } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Department | null>(null);

  const role = getUserRole();
  const isAdmin = ['admin', 'salga_admin', 'municipal_manager', 'pms_officer'].includes(role);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchDepartments = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    setUsingMockData(false);

    try {
      const tenantId = getTenantId();
      const res = await fetch(`${apiUrl}/api/v1/departments`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      const list: Department[] = Array.isArray(data) ? data : (data.departments ?? []);
      setDepartments(list);
    } catch (err) {
      // Error fallback — show mock data with banner
      setError(err instanceof Error ? err.message : 'Failed to load departments');
      setDepartments(MOCK_DEPARTMENTS);
      setUsingMockData(true);
    } finally {
      setLoading(false);
    }
  }, [session, apiUrl, getTenantId]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // ---------------------------------------------------------------------------
  // Deactivate
  // ---------------------------------------------------------------------------

  const handleDeactivate = async (dept: Department) => {
    if (!session?.access_token) return;
    if (!window.confirm(`Deactivate "${dept.name}"? This will soft-delete the department.`)) return;

    try {
      const tenantId = getTenantId();
      const res = await fetch(`${apiUrl}/api/v1/departments/${dept.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      await fetchDepartments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate department');
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const departmentOptions: DepartmentOption[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ padding: 'var(--space-lg)', maxWidth: '1100px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          minHeight: '48px',
          padding: 'var(--space-md) 0',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Department Management
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              marginTop: 'var(--space-xs)',
              marginBottom: 0,
            }}
          >
            {loading
              ? 'Loading...'
              : `${departments.length} department${departments.length !== 1 ? 's' : ''} — CRUD, activation gates, director assignment`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <Link
            to="/departments/organogram"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--space-xs) var(--space-md)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            View Organogram
          </Link>
          {isAdmin && (
            <button
              onClick={() => {
                setEditTarget(null);
                setShowCreateModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: 'var(--space-xs) var(--space-md)',
                background: 'var(--color-teal)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Create Department
            </button>
          )}
        </div>
      </div>

      {/* Mock data warning banner */}
      {usingMockData && (
        <div
          style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm) var(--space-md)',
            marginBottom: 'var(--space-lg)',
            color: 'var(--color-gold)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>API unavailable</strong> — Displaying sample data. Connect to backend for live data.
            {error && <span style={{ marginLeft: '0.5rem', opacity: 0.8 }}>({error})</span>}
          </span>
        </div>
      )}

      {/* Department table */}
      <div
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Empty state */}
        {!loading && departments.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-2xl)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-md)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(45, 212, 191, 0.1)',
                border: '1px solid rgba(45, 212, 191, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" fill="none" stroke="var(--color-teal)" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M3 21h18M9 21V7l6-4v18M3 21V11l6-4" />
              </svg>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: '400px', lineHeight: 1.6 }}>
              No departments configured. Create your first department to get started.
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditTarget(null);
                  setShowCreateModal(true);
                }}
                style={{
                  padding: 'var(--space-sm) var(--space-lg)',
                  background: 'var(--color-teal)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Create Department
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  {['Department', 'Code', 'Activation Status', 'Director', 'Created', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: 'var(--space-sm) var(--space-md)',
                        textAlign: 'left' as const,
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3].map((i) => <SkeletonRow key={i} />)
                  : departments.map((dept) => {
                      const activationStatus = getActivationStatus(dept);
                      return (
                        <tr
                          key={dept.id}
                          style={{ borderBottom: '1px solid var(--glass-border)' }}
                        >
                          {/* Name */}
                          <td
                            style={{
                              padding: 'var(--space-sm) var(--space-md)',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {dept.name}
                          </td>

                          {/* Code */}
                          <td
                            style={{
                              padding: 'var(--space-sm) var(--space-md)',
                              color: 'var(--text-secondary)',
                              fontFamily: 'monospace',
                              fontSize: 'var(--text-sm)',
                            }}
                          >
                            {dept.code}
                          </td>

                          {/* Activation status badge */}
                          <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                            <ActivationBadge status={activationStatus} />
                          </td>

                          {/* Director */}
                          <td
                            style={{
                              padding: 'var(--space-sm) var(--space-md)',
                              color: dept.director_name
                                ? 'var(--text-secondary)'
                                : 'var(--text-muted)',
                              fontSize: 'var(--text-sm)',
                              fontStyle: dept.director_name ? 'normal' : 'italic',
                            }}
                          >
                            {dept.director_name ?? 'No Director Assigned'}
                          </td>

                          {/* Created */}
                          <td
                            style={{
                              padding: 'var(--space-sm) var(--space-md)',
                              color: 'var(--text-muted)',
                              fontSize: 'var(--text-sm)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {dept.created_at
                              ? new Date(dept.created_at).toLocaleDateString('en-ZA')
                              : '—'}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                            <div
                              style={{
                                display: 'flex',
                                gap: 'var(--space-xs)',
                                flexWrap: 'wrap',
                              }}
                            >
                              {/* Invite Director — only when no director assigned */}
                              {isAdmin && !dept.director_id && (
                                <button
                                  onClick={() => setInviteTarget(dept)}
                                  style={{
                                    padding: '3px 10px',
                                    background: 'rgba(45, 212, 191, 0.12)',
                                    border: '1px solid rgba(45, 212, 191, 0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--color-teal)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Invite Director
                                </button>
                              )}

                              {/* Edit */}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setEditTarget(dept);
                                    setShowCreateModal(true);
                                  }}
                                  style={{
                                    padding: '3px 10px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-secondary)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>
                              )}

                              {/* Deactivate */}
                              {isAdmin && dept.is_active && (
                                <button
                                  onClick={() => handleDeactivate(dept)}
                                  style={{
                                    padding: '3px 10px',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--color-coral)',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activation gate legend */}
      {!loading && departments.length > 0 && (
        <div
          style={{
            marginTop: 'var(--space-md)',
            display: 'flex',
            gap: 'var(--space-lg)',
            flexWrap: 'wrap',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Active — director assigned + has KPIs
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Pending KPIs — director assigned, no KPIs yet
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            Pending Director — no director assigned
          </span>
        </div>
      )}

      {/* Create / Edit Department Modal */}
      {showCreateModal && (
        <CreateDepartmentModal
          onClose={() => {
            setShowCreateModal(false);
            setEditTarget(null);
          }}
          onCreated={async () => {
            setShowCreateModal(false);
            setEditTarget(null);
            await fetchDepartments();
          }}
          editDepartment={
            editTarget
              ? {
                  id: editTarget.id,
                  name: editTarget.name,
                  code: editTarget.code,
                  parent_department_id: editTarget.parent_department_id,
                }
              : undefined
          }
          existingDepartments={departmentOptions}
        />
      )}

      {/* Invite Director Modal */}
      {inviteTarget && (
        <InviteUserModal
          onClose={() => setInviteTarget(null)}
          onInvited={async () => {
            setInviteTarget(null);
            await fetchDepartments();
          }}
          allowedRoles={['section56_director']}
          defaultRole="section56_director"
          departmentId={inviteTarget.id}
          departmentName={inviteTarget.name}
        />
      )}
    </div>
  );
}
