/**
 * Quarterly Actuals Submission Page — submit actuals with traffic-light status.
 *
 * Shows KPI info at top, table of quarterly actuals with TrafficLightBadge,
 * submit actual form, and validation controls for PMS officers.
 *
 * Routes: /pms/kpis/:kpiId/actuals
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { TrafficLightBadge } from '../components/pms/TrafficLightBadge';

interface SDBIPKpi {
  id: string;
  kpi_number: string;
  description: string;
  unit_of_measurement: string;
  annual_target: string;
}

interface SDBIPActual {
  id: string;
  quarter: string;
  financial_year: string;
  actual_value: string;
  achievement_pct?: string;
  traffic_light_status?: string;
  is_validated: boolean;
  validated_by?: string;
  submitted_by?: string;
  submitted_at?: string;
  is_auto_populated: boolean;
}

const QUARTER_OPTIONS = ['Q1', 'Q2', 'Q3', 'Q4'];

const QUARTER_LABELS: Record<string, string> = {
  Q1: 'Q1 (Jul-Sep)',
  Q2: 'Q2 (Oct-Dec)',
  Q3: 'Q3 (Jan-Mar)',
  Q4: 'Q4 (Apr-Jun)',
};

const PMS_ROLES = ['pms_officer', 'admin', 'salga_admin'];

export function ActualsPage() {
  const { kpiId } = useParams<{ kpiId: string }>();
  const { getAccessToken, getUserRole } = useAuth();
  const navigate = useNavigate();
  const currentRole = getUserRole();

  const [kpi, setKpi] = useState<SDBIPKpi | null>(null);
  const [actuals, setActuals] = useState<SDBIPActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);

  const [form, setForm] = useState({
    quarter: 'Q1',
    financial_year: '',
    actual_value: '',
  });

  const canValidate = PMS_ROLES.includes(currentRole);

  const fetchAll = useCallback(async () => {
    if (!kpiId) return;
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [kpiRes, actualsRes] = await Promise.all([
        fetch(`/api/v1/sdbip/kpis/${kpiId}`, { headers }),
        fetch(`/api/v1/sdbip/kpis/${kpiId}/actuals`, { headers }),
      ]);

      if (!kpiRes.ok) throw new Error(`KPI not found (${kpiRes.status})`);
      if (!actualsRes.ok) throw new Error(`Failed to load actuals (${actualsRes.status})`);

      const kpiData = await kpiRes.json();
      const actualsData = await actualsRes.json();

      setKpi(kpiData);
      setActuals(actualsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [kpiId, getAccessToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSubmitActual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/v1/sdbip/actuals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kpi_id: kpiId,
          quarter: form.quarter,
          financial_year: form.financial_year,
          actual_value: parseFloat(form.actual_value),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      setShowForm(false);
      setForm({ quarter: 'Q1', financial_year: '', actual_value: '' });
      await fetchAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit actual');
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (actualId: string) => {
    setValidating(actualId);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/sdbip/actuals/${actualId}/validate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Validation failed (${res.status})`);
      }
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(null);
    }
  };

  const pageStyles: React.CSSProperties = {
    padding: 'var(--space-xl)',
    maxWidth: '900px',
  };

  const tableStyles: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyles: React.CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-sm) var(--space-md)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  };

  const tdStyles: React.CSSProperties = {
    padding: 'var(--space-sm) var(--space-md)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  };

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

  const validatedBadgeStyles: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    color: 'var(--color-teal)',
    background: 'rgba(0, 191, 165, 0.1)',
    border: '1px solid rgba(0, 191, 165, 0.3)',
  };

  const autoBadgeStyles: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  if (loading) {
    return <div style={{ ...pageStyles, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Loading actuals...</div>;
  }

  if (error && !kpi) {
    return (
      <div style={{ ...pageStyles, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
        <p style={{ color: 'var(--color-coral)' }}>{error}</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div style={pageStyles}>
      {/* Breadcrumb */}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        <button onClick={() => navigate('/pms/sdbip')} style={{ background: 'none', border: 'none', color: 'var(--color-teal)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>
          SDBIP Scorecards
        </button>
        {' / Actuals'}
      </div>

      {/* KPI Info */}
      {kpi && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-teal)', textTransform: 'uppercase' }}>
                  {kpi.kpi_number}
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-sm)' }}>
                {kpi.description}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                Annual Target: <strong style={{ color: 'var(--text-primary)' }}>{parseFloat(kpi.annual_target).toLocaleString()}</strong>
                {' '}{kpi.unit_of_measurement}
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowForm((p) => !p)}>
              {showForm ? 'Cancel' : '+ Submit Actual'}
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Submit Form */}
      {showForm && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-lg)' }}>
            Submit Quarterly Actual
          </h2>
          {formError && <p style={errorStyles}>{formError}</p>}
          <form onSubmit={handleSubmitActual}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
                  Quarter *
                </label>
                <select
                  value={form.quarter}
                  onChange={(e) => setForm((p) => ({ ...p, quarter: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}
                >
                  {QUARTER_OPTIONS.map((q) => <option key={q} value={q}>{QUARTER_LABELS[q]}</option>)}
                </select>
              </div>
              <Input
                label="Financial Year *"
                value={form.financial_year}
                onChange={(e) => setForm((p) => ({ ...p, financial_year: e.target.value }))}
                placeholder="e.g., 2025/26"
                required
              />
              <Input
                label={`Actual Value (${kpi?.unit_of_measurement || 'unit'}) *`}
                type="number"
                value={form.actual_value}
                onChange={(e) => setForm((p) => ({ ...p, actual_value: e.target.value }))}
                placeholder="0"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button type="submit" variant="primary" loading={submitting}>Submit</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </GlassCard>
      )}

      {error && <p style={{ ...errorStyles, marginBottom: 'var(--space-md)' }}>{error}</p>}

      {/* Actuals Table */}
      {actuals.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>No actuals submitted yet</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Submit the first quarterly actual to begin tracking performance.</p>
        </div>
      ) : (
        <GlassCard>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyles}>
              <thead>
                <tr>
                  <th style={thStyles}>Quarter</th>
                  <th style={thStyles}>Financial Year</th>
                  <th style={{ ...thStyles, textAlign: 'right' }}>Actual</th>
                  <th style={thStyles}>Achievement</th>
                  <th style={thStyles}>Status</th>
                  <th style={thStyles}>Submitted</th>
                  <th style={thStyles}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {actuals.map((actual) => {
                  const pct = actual.achievement_pct ? parseFloat(actual.achievement_pct) : 0;
                  const tl = (actual.traffic_light_status || 'red') as 'green' | 'amber' | 'red';
                  return (
                    <tr key={actual.id}>
                      <td style={tdStyles}>
                        <strong>{QUARTER_LABELS[actual.quarter] || actual.quarter}</strong>
                      </td>
                      <td style={tdStyles}>{actual.financial_year}</td>
                      <td style={{ ...tdStyles, textAlign: 'right', fontWeight: 600 }}>
                        {parseFloat(actual.actual_value).toLocaleString()}
                      </td>
                      <td style={tdStyles}>
                        {actual.achievement_pct !== null && actual.achievement_pct !== undefined ? (
                          <TrafficLightBadge status={tl} pct={pct} />
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyles}>
                        {actual.is_validated ? (
                          <span style={validatedBadgeStyles}>Validated</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Pending</span>
                        )}
                        {actual.is_auto_populated && (
                          <span style={{ ...autoBadgeStyles, marginLeft: 'var(--space-xs)' }}>Auto</span>
                        )}
                      </td>
                      <td style={tdStyles}>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {actual.submitted_at
                            ? new Date(actual.submitted_at).toLocaleDateString('en-ZA')
                            : '—'}
                        </span>
                      </td>
                      <td style={tdStyles}>
                        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                          {canValidate && !actual.is_validated && (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={validating === actual.id}
                              onClick={() => handleValidate(actual.id)}
                            >
                              Validate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/pms/actuals/${actual.id}/evidence`)}
                          >
                            Evidence
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
