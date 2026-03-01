/**
 * SDBIP Scorecards Page — list and create SDBIP scorecards.
 *
 * Lists scorecards grouped by financial year. Directors can create new scorecards.
 * Clicking a scorecard navigates to the KPI management page.
 *
 * Routes: /pms/sdbip (standalone) or embedded inside PmsHubPage
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { useAuth } from '../hooks/useAuth';

interface SDBIPScorecard {
  id: string;
  financial_year: string;
  layer: string;
  status: string;
  title?: string;
  department_id?: string;
}

interface CreateScorecardForm {
  financial_year: string;
  layer: 'top' | 'departmental';
  department_id: string;
  title: string;
}

interface SdbipPageProps {
  embedded?: boolean;
  showForm?: boolean;
  onToggleForm?: () => void;
}

const DEMO_SCORECARDS: SDBIPScorecard[] = [
  { id: 'demo-1', financial_year: '2025/26', layer: 'top', status: 'approved', title: 'Umsobomvu Top Layer Scorecard 2025/26' },
  { id: 'demo-2', financial_year: '2025/26', layer: 'departmental', status: 'draft', title: 'Technical Services SDBIP' },
  { id: 'demo-3', financial_year: '2025/26', layer: 'departmental', status: 'approved', title: 'Community Services SDBIP' },
  { id: 'demo-4', financial_year: '2024/25', layer: 'top', status: 'approved', title: 'Umsobomvu Top Layer Scorecard 2024/25' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--color-gold)',
  approved: 'var(--color-teal)',
  revised: 'var(--color-coral)',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  revised: 'Under Revision',
};

const LAYER_LABELS: Record<string, string> = {
  top: 'Top Layer (Municipal)',
  departmental: 'Departmental',
};

export function SdbipPage({ embedded = false, showForm: externalShowForm, onToggleForm }: SdbipPageProps) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const navigate = useNavigate();

  const [scorecards, setScorecards] = useState<SDBIPScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalShowForm, setInternalShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showForm = embedded ? (externalShowForm ?? false) : internalShowForm;
  const toggleForm = embedded ? onToggleForm : () => setInternalShowForm(p => !p);

  const [form, setForm] = useState<CreateScorecardForm>({
    financial_year: '',
    layer: 'top',
    department_id: '',
    title: '',
  });

  const fetchScorecards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/sdbip/scorecards', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setScorecards(data);
    } catch {
      // Fall back to demo data when API is unavailable
      setScorecards(DEMO_SCORECARDS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchScorecards();
  }, [fetchScorecards]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        financial_year: form.financial_year,
        layer: form.layer,
        title: form.title || undefined,
      };
      if (form.layer === 'departmental' && form.department_id) {
        payload.department_id = form.department_id;
      }
      const res = await fetch('/api/v1/sdbip/scorecards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      if (toggleForm) toggleForm();
      setForm({ financial_year: '', layer: 'top', department_id: '', title: '' });
      await fetchScorecards();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create scorecard');
    } finally {
      setSubmitting(false);
    }
  };

  // Group scorecards by financial year
  const grouped = scorecards.reduce<Record<string, SDBIPScorecard[]>>((acc, sc) => {
    const fy = sc.financial_year;
    if (!acc[fy]) acc[fy] = [];
    acc[fy].push(sc);
    return acc;
  }, {});

  const sortedYears = Object.keys(grouped).sort().reverse();

  const statusBadgeStyles = (status: string): React.CSSProperties => {
    const color = STATUS_COLORS[status] || 'var(--text-secondary)';
    return {
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color,
      background: `${color}22`,
      border: `1px solid ${color}66`,
    };
  };

  const layerBadgeStyles = (layer: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: layer === 'top' ? 'var(--color-teal)' : 'var(--color-gold)',
    background: layer === 'top' ? 'rgba(0, 191, 165, 0.1)' : 'rgba(251, 191, 36, 0.1)',
    border: `1px solid ${layer === 'top' ? 'rgba(0, 191, 165, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`,
  });

  const emptyStyles: React.CSSProperties = {
    textAlign: 'center',
    padding: 'var(--space-3xl)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  };

  const errorStyles: React.CSSProperties = {
    color: 'var(--color-coral)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    marginBottom: 'var(--space-md)',
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header — only shown in standalone mode */}
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-xl)' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h4)', color: 'var(--text-primary)', margin: 0 }}>
              SDBIP Scorecards
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
              Service Delivery and Budget Implementation Plan scorecards
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={toggleForm}>
            {showForm ? 'Cancel' : '+ Create Scorecard'}
          </Button>
        </div>
      )}

      {showForm && (
        <GlassCard style={{ marginTop: 'var(--space-xl)', marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-lg)' }}>
            New SDBIP Scorecard
          </h2>
          {formError && <p style={errorStyles}>{formError}</p>}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <Input
                label="Financial Year *"
                value={form.financial_year}
                onChange={(e) => setForm((p) => ({ ...p, financial_year: e.target.value }))}
                placeholder="e.g., 2025/26"
                required
              />
              <Select
                label="Layer *"
                options={[
                  { value: 'top', label: 'Top Layer (Municipal)' },
                  { value: 'departmental', label: 'Departmental' },
                ]}
                value={form.layer}
                onChange={(v) => setForm((p) => ({ ...p, layer: v as 'top' | 'departmental' }))}
                required
              />
            </div>
            {form.layer === 'departmental' && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Input
                  label="Department ID"
                  value={form.department_id}
                  onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))}
                  placeholder="UUID of the responsible department"
                />
              </div>
            )}
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Title (optional)"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g., Infrastructure Services SDBIP 2025/26"
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button type="submit" variant="primary" loading={submitting}>Create Scorecard</Button>
              <Button type="button" variant="ghost" onClick={toggleForm}>Cancel</Button>
            </div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <div style={emptyStyles}>Loading SDBIP scorecards...</div>
      ) : error ? (
        <div style={emptyStyles}>
          <p style={{ color: 'var(--color-coral)', marginBottom: 'var(--space-md)' }}>{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchScorecards}>Retry</Button>
        </div>
      ) : scorecards.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>No SDBIP scorecards yet</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Create your first scorecard to begin tracking KPIs.</p>
        </div>
      ) : (
        sortedYears.map((fy) => (
          <div key={fy} style={{ marginBottom: 'var(--space-xl)' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {fy}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
              {grouped[fy].map((sc) => (
                <GlassCard
                  key={sc.id}
                  variant="interactive"
                  glow="teal"
                  onClick={() => navigate(`/pms/sdbip/${sc.id}/kpis`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                    <span style={layerBadgeStyles(sc.layer)}>{LAYER_LABELS[sc.layer] || sc.layer}</span>
                    <span style={statusBadgeStyles(sc.status)}>{STATUS_LABELS[sc.status] || sc.status}</span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: 0, marginTop: 'var(--space-xs)' }}>
                    {sc.title || `${LAYER_LABELS[sc.layer]} Scorecard`}
                  </h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: 'var(--space-xs)' }}>
                    FY {sc.financial_year}
                  </p>
                </GlassCard>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
