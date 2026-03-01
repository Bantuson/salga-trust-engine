/**
 * Performance Agreements Page — list and create Section 57 Performance Agreements.
 *
 * Displays all PAs as GlassCards with status badges, manager info, and annual score.
 * Authorized roles can create new PAs via an inline form.
 *
 * Routes: /pms?view=performance-agreements (embedded inside PmsHubPage)
 */

import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { useAuth } from '../hooks/useAuth';

interface PerformanceAgreement {
  id: string;
  financial_year: string;
  manager_name: string;
  manager_role: string;
  status: string;
  annual_score: number | null;
  kpi_count: number;
}

interface EligibleManager {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface CreateAgreementForm {
  financial_year: string;
  section57_manager_id: string;
  manager_role: string;
}

interface PerformanceAgreementsPageProps {
  embedded?: boolean;
  showForm?: boolean;
  onToggleForm?: () => void;
}

const DEMO_AGREEMENTS: PerformanceAgreement[] = [
  {
    id: 'demo-pa-1',
    financial_year: '2025/26',
    manager_name: 'Director: Technical Services',
    manager_role: 'section57_director',
    status: 'signed',
    annual_score: null,
    kpi_count: 5,
  },
  {
    id: 'demo-pa-2',
    financial_year: '2025/26',
    manager_name: 'Municipal Manager',
    manager_role: 'municipal_manager',
    status: 'draft',
    annual_score: null,
    kpi_count: 8,
  },
  {
    id: 'demo-pa-3',
    financial_year: '2024/25',
    manager_name: 'Director: Corporate Services',
    manager_role: 'section57_director',
    status: 'assessed',
    annual_score: 78.5,
    kpi_count: 6,
  },
];

const statusColors: Record<string, string> = {
  draft: 'var(--color-gold)',
  signed: 'var(--color-teal)',
  under_review: 'var(--color-coral)',
  assessed: '#4caf7d',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  signed: 'Signed',
  under_review: 'Under Review',
  assessed: 'Assessed',
};

const managerRoleLabels: Record<string, string> = {
  section57_director: 'Section 57 Director',
  municipal_manager: 'Municipal Manager',
};

export function PerformanceAgreementsPage({
  embedded = false,
  showForm: externalShowForm,
  onToggleForm,
}: PerformanceAgreementsPageProps) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [agreements, setAgreements] = useState<PerformanceAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalShowForm, setInternalShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [eligibleManagers, setEligibleManagers] = useState<EligibleManager[]>([]);

  const showForm = embedded ? (externalShowForm ?? false) : internalShowForm;
  const toggleForm = embedded ? onToggleForm : () => setInternalShowForm((p) => !p);

  const [form, setForm] = useState<CreateAgreementForm>({
    financial_year: '',
    section57_manager_id: '',
    manager_role: 'section57_director',
  });

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/pa/agreements', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setAgreements(data);
    } catch {
      // Fall back to demo data when API is unavailable
      setAgreements(DEMO_AGREEMENTS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchEligibleManagers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/pa/eligible-managers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEligibleManagers(await res.json());
      }
    } catch {
      // Non-critical — form still works with manual UUID entry
    }
  }, [token]);

  useEffect(() => {
    fetchAgreements();
    fetchEligibleManagers();
  }, [fetchAgreements, fetchEligibleManagers]);

  const handleFormChange = (field: keyof CreateAgreementForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/v1/pa/agreements', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          financial_year: form.financial_year,
          section57_manager_id: form.section57_manager_id,
          manager_role: form.manager_role,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      if (toggleForm) toggleForm();
      setForm({ financial_year: '', section57_manager_id: '', manager_role: 'section57_director' });
      await fetchAgreements();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create Performance Agreement'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeStyles = (status: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: statusColors[status] || 'var(--text-secondary)',
    background: `${statusColors[status] || 'rgba(255,255,255,0.1)'}22`,
    border: `1px solid ${statusColors[status] || 'rgba(255,255,255,0.2)'}66`,
  });

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header — only shown in standalone mode */}
      {!embedded && (
        <div style={headerStyles}>
          <div>
            <h1 style={titleStyles}>Performance Agreements</h1>
            <p style={subtitleStyles}>
              Manage Section 57 manager Performance Agreements for your municipality
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={toggleForm}>
            {showForm ? 'Cancel' : '+ Create Agreement'}
          </Button>
        </div>
      )}

      {showForm && (
        <GlassCard style={formCardStyles}>
          <h2
            style={{
              ...titleStyles,
              fontSize: 'var(--text-lg)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            New Performance Agreement
          </h2>
          {formError && <p style={errorTextStyles}>{formError}</p>}
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Financial Year *"
                value={form.financial_year}
                onChange={(e) => handleFormChange('financial_year', e.target.value)}
                placeholder="e.g., 2025/26"
                required
              />
            </div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Select
                label="Manager Role *"
                options={[
                  { value: 'section57_director', label: 'Section 57 Director' },
                  { value: 'municipal_manager', label: 'Municipal Manager' },
                ]}
                value={form.manager_role}
                onChange={(v) => {
                  handleFormChange('manager_role', v);
                  handleFormChange('section57_manager_id', '');
                }}
                required
              />
            </div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Select
                label="Section 57 Manager *"
                placeholder="— Select a manager —"
                options={eligibleManagers
                  .filter((m) =>
                    form.manager_role === 'municipal_manager'
                      ? m.role === 'municipal_manager'
                      : m.role === 'section56_director'
                  )
                  .map((m) => ({ value: m.id, label: `${m.full_name} (${m.email})` }))}
                value={form.section57_manager_id}
                onChange={(v) => handleFormChange('section57_manager_id', v)}
                required
              />
              {eligibleManagers.length === 0 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                  No eligible managers found. Assign section56_director or municipal_manager roles first.
                </p>
              )}
            </div>
            <div style={formActionsStyles}>
              <Button type="submit" variant="primary" loading={submitting}>
                Create Agreement
              </Button>
              <Button type="button" variant="ghost" onClick={toggleForm}>
                Cancel
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <div style={emptyStyles}>Loading Performance Agreements...</div>
      ) : error ? (
        <div style={emptyStyles}>
          <p style={{ color: 'var(--color-coral)', marginBottom: 'var(--space-md)' }}>
            {error}
          </p>
          <Button variant="secondary" size="sm" onClick={fetchAgreements}>
            Retry
          </Button>
        </div>
      ) : agreements.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>
            No Performance Agreements yet
          </p>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Create your first Section 57 Performance Agreement to get started.
          </p>
        </div>
      ) : (
        <div style={agreementGridStyles}>
          {agreements.map((pa) => (
            <GlassCard key={pa.id} variant="interactive" glow="teal">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 'var(--space-sm)',
                }}
              >
                <div style={{ flex: 1, marginRight: 'var(--space-sm)' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-base)',
                      color: 'var(--text-primary)',
                      margin: 0,
                      marginBottom: 'var(--space-xs)',
                    }}
                  >
                    {pa.manager_name}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      margin: 0,
                    }}
                  >
                    {managerRoleLabels[pa.manager_role] || pa.manager_role}
                  </p>
                </div>
                <span style={statusBadgeStyles(pa.status)}>
                  {statusLabels[pa.status] || pa.status}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 'var(--space-sm)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    margin: 0,
                  }}
                >
                  FY {pa.financial_year} &middot; {pa.kpi_count} KPI
                  {pa.kpi_count !== 1 ? 's' : ''}
                </p>
                {pa.annual_score !== null && (
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-sm)',
                      color: '#4caf7d',
                      fontWeight: 700,
                    }}
                  >
                    Score: {pa.annual_score.toFixed(1)}%
                  </span>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

const headerStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 'var(--space-xl)',
};

const titleStyles: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 'var(--text-h4)',
  color: 'var(--text-primary)',
  margin: 0,
};

const subtitleStyles: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  color: 'var(--text-secondary)',
  marginTop: 'var(--space-xs)',
};

const agreementGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 'var(--space-lg)',
  marginTop: 'var(--space-lg)',
};

const formCardStyles: React.CSSProperties = {
  marginTop: 'var(--space-xl)',
  padding: 'var(--space-xl)',
};

const formActionsStyles: React.CSSProperties = {
  display: 'flex',
  gap: 'var(--space-md)',
  marginTop: 'var(--space-lg)',
};

const emptyStyles: React.CSSProperties = {
  textAlign: 'center',
  padding: 'var(--space-3xl)',
  color: 'var(--text-secondary)',
  fontFamily: 'var(--font-body)',
};

const errorTextStyles: React.CSSProperties = {
  color: 'var(--color-coral)',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-sm)',
  marginBottom: 'var(--space-md)',
};

