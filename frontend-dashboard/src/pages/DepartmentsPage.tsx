/**
 * DepartmentsPage — lists all departments for the current tenant.
 *
 * Fetches GET /api/v1/departments with the user's auth token.
 * Renders a glass card table with Name, Code, Director, Created columns.
 * Links to /departments/organogram for organisational chart view.
 *
 * Styling: CSS variables only (var(--glass-bg), var(--text-primary), etc.)
 * Auth: useAuth hook provides session with access_token for API requests.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Department {
  id: string;
  name: string;
  code: string;
  director_id: string | null;
  is_active: boolean;
  created_at: string;
}

export function DepartmentsPage() {
  const { session, getUserRole } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = ['admin', 'salga_admin', 'municipal_manager'].includes(getUserRole());

  useEffect(() => {
    if (!session?.access_token) return;

    const fetchDepartments = async () => {
      try {
        const res = await fetch('/api/v1/departments', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Error ${res.status}`);
        }
        const data = await res.json();
        // API may return { departments: [...] } or a plain array
        setDepartments(Array.isArray(data) ? data : (data.departments ?? []));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load departments');
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [session]);

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-lg)', color: 'var(--text-secondary)' }}>
        Loading departments...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--space-lg)' }}>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-md)',
          color: 'var(--color-coral)',
        }}>
          Failed to load departments: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-lg)', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: '48px',
        padding: 'var(--space-md) 0',
        marginBottom: 'var(--space-lg)',
      }}>
        <div>
          <h1 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Departments
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            marginTop: 'var(--space-xs)',
          }}>
            {departments.length} department{departments.length !== 1 ? 's' : ''} in your municipality
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
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
              onClick={() => alert('Use the PMS Setup Wizard to create departments')}
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

      {/* Departments table */}
      <div style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {departments.length === 0 ? (
          <div style={{
            padding: 'var(--space-xl)',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}>
            No departments found. Use the PMS Setup Wizard to create departments.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                {['Name', 'Code', 'Director', 'Status', 'Created'].map((h) => (
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
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => (
                <tr
                  key={dept.id}
                  style={{ borderBottom: '1px solid var(--glass-border)' }}
                >
                  <td style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}>
                    {dept.name}
                  </td>
                  <td style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    fontSize: 'var(--text-sm)',
                  }}>
                    {dept.code}
                  </td>
                  <td style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    color: dept.director_id ? 'var(--text-secondary)' : 'var(--text-muted)',
                  }}>
                    {dept.director_id ? 'Assigned' : 'Unassigned'}
                  </td>
                  <td style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      background: dept.is_active ? 'rgba(45, 212, 191, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                      color: dept.is_active ? 'var(--color-teal)' : 'var(--text-muted)',
                      border: `1px solid ${dept.is_active ? 'rgba(45, 212, 191, 0.3)' : 'rgba(107, 114, 128, 0.3)'}`,
                    }}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}>
                    {dept.created_at
                      ? new Date(dept.created_at).toLocaleDateString('en-ZA')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
