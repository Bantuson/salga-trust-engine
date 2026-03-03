/**
 * SDBIP KPI Management Page — list and create KPIs for a scorecard.
 *
 * Shows all KPIs for a scorecard with quarterly targets.
 * Directors can add KPIs with full details.
 *
 * Routes: /pms/sdbip/:scorecardId/kpis
 */

import { useState, useEffect, useCallback, createElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { useAuth } from '../hooks/useAuth';
import { usePageHeader } from '../hooks/usePageHeader';
import { PmsDetailModal } from '../components/pms/PmsDetailModal';
import { DEMO_MODE } from '../lib/demoMode';

interface SDBIPKpi {
  id: string;
  kpi_number: string;
  description: string;
  unit_of_measurement: string;
  baseline: string;
  annual_target: string;
  weight: string;
  idp_objective_id?: string;
  mscoa_code_id?: string;
}

interface QuarterlyTarget {
  quarter: string;
  target_value: string;
}

interface CreateKpiForm {
  kpi_number: string;
  description: string;
  unit_of_measurement: string;
  baseline: string;
  annual_target: string;
  weight: string;
  idp_objective_id: string;
  mscoa_code_id: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

const UNIT_OPTIONS = ['percentage', 'number', 'rand', 'days', 'count', 'km', 'hours', 'ton'];

const DEMO_KPIS: SDBIPKpi[] = [
  { id: 'demo-kpi-1', kpi_number: 'KPI-BSD-001', description: 'Percentage reduction in non-revenue water', unit_of_measurement: 'percentage', baseline: '35', annual_target: '12', weight: '15' },
  { id: 'demo-kpi-2', kpi_number: 'KPI-BSD-002', description: 'Pipe bursts repaired within 48 hours', unit_of_measurement: 'count', baseline: '0', annual_target: '60', weight: '10' },
  { id: 'demo-kpi-3', kpi_number: 'KPI-LED-001', description: 'SMMEs supported through LED programmes', unit_of_measurement: 'count', baseline: '0', annual_target: '25', weight: '12' },
  { id: 'demo-kpi-4', kpi_number: 'KPI-MFV-001', description: 'Revenue collection rate', unit_of_measurement: 'percentage', baseline: '65', annual_target: '78', weight: '20' },
  { id: 'demo-kpi-5', kpi_number: 'KPI-BSD-010', description: 'Kilometres of road resurfaced', unit_of_measurement: 'km', baseline: '0', annual_target: '8', weight: '10' },
  { id: 'demo-kpi-6', kpi_number: 'KPI-GG-001', description: 'Ward committee meetings held per quarter', unit_of_measurement: 'number', baseline: '12', annual_target: '20', weight: '8' },
];

export function SdbipKpiPage() {
  const { scorecardId } = useParams<{ scorecardId: string }>();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState<SDBIPKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<SDBIPKpi | null>(null);

  usePageHeader(
    'KPI Management',
    createElement(Button, { variant: 'primary', size: 'sm', onClick: () => setShowForm((p: boolean) => !p) },
      showForm ? 'Cancel' : '+ Add KPI')
  );

  const [form, setForm] = useState<CreateKpiForm>({
    kpi_number: '',
    description: '',
    unit_of_measurement: 'number',
    baseline: '0',
    annual_target: '',
    weight: '',
    idp_objective_id: '',
    mscoa_code_id: '',
    q1: '',
    q2: '',
    q3: '',
    q4: '',
  });

  const fetchKpis = useCallback(async () => {
    if (!scorecardId) return;
    if (DEMO_MODE) {
      setKpis(DEMO_KPIS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/sdbip/scorecards/${scorecardId}/kpis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setKpis(data);
    } catch {
      // Fall back to demo KPIs when API is unavailable
      setKpis(DEMO_KPIS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [scorecardId, getAccessToken]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const token = getAccessToken();
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      // First create the KPI
      const kpiPayload: Record<string, unknown> = {
        kpi_number: form.kpi_number,
        description: form.description,
        unit_of_measurement: form.unit_of_measurement,
        baseline: parseFloat(form.baseline) || 0,
        annual_target: parseFloat(form.annual_target),
        weight: parseFloat(form.weight),
      };
      if (form.idp_objective_id) kpiPayload.idp_objective_id = form.idp_objective_id;
      if (form.mscoa_code_id) kpiPayload.mscoa_code_id = form.mscoa_code_id;

      const kpiRes = await fetch(`/api/v1/sdbip/scorecards/${scorecardId}/kpis`, {
        method: 'POST',
        headers,
        body: JSON.stringify(kpiPayload),
      });
      if (!kpiRes.ok) {
        const body = await kpiRes.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to create KPI (${kpiRes.status})`);
      }
      const newKpi = await kpiRes.json();

      // Then set quarterly targets
      const targets: QuarterlyTarget[] = [
        { quarter: 'Q1', target_value: form.q1 || '0' },
        { quarter: 'Q2', target_value: form.q2 || '0' },
        { quarter: 'Q3', target_value: form.q3 || '0' },
        { quarter: 'Q4', target_value: form.q4 || '0' },
      ];
      const targetsRes = await fetch(`/api/v1/sdbip/kpis/${newKpi.id}/quarterly-targets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targets }),
      });
      if (!targetsRes.ok) {
        // KPI created but targets failed — not fatal, reload and show warning
        setFormError('KPI created but quarterly targets failed. Set them manually.');
      } else {
        setShowForm(false);
        setForm({
          kpi_number: '',
          description: '',
          unit_of_measurement: 'number',
          baseline: '0',
          annual_target: '',
          weight: '',
          idp_objective_id: '',
          mscoa_code_id: '',
          q1: '',
          q2: '',
          q3: '',
          q4: '',
        });
      }
      await fetchKpis();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create KPI');
    } finally {
      setSubmitting(false);
    }
  };

  const pageStyles: React.CSSProperties = {
    padding: 'var(--space-xl)',
    maxWidth: '1000px',
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
    verticalAlign: 'top',
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

  const quarterGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr 1fr',
    gap: 'var(--space-sm)',
    marginBottom: 'var(--space-md)',
  };

  return (
    <div style={pageStyles}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        <button
          onClick={() => navigate('/pms/sdbip')}
          style={{ background: 'none', border: 'none', color: 'var(--color-teal)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
        >
          SDBIP Scorecards
        </button>
        {' / KPI Management'}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowForm(false)}>
          <div style={{ width: '90%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface-elevated)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0 }}>New KPI</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}>&times;</button>
            </div>
            {formError && <p style={errorStyles}>{formError}</p>}
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <Input label="KPI Number *" value={form.kpi_number} onChange={(e) => setForm((p) => ({ ...p, kpi_number: e.target.value }))} placeholder="KPI-001" required />
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>Unit of Measurement *</label>
                  <Select
                    value={form.unit_of_measurement}
                    onChange={(value) => setForm((p) => ({ ...p, unit_of_measurement: value }))}
                    options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
                    size="md"
                    required
                  />
                </div>
              </div>
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Input label="Description *" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Full description of what this KPI measures" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <Input label="Baseline" type="number" value={form.baseline} onChange={(e) => setForm((p) => ({ ...p, baseline: e.target.value }))} placeholder="Prior year baseline" />
                <Input label="Annual Target *" type="number" value={form.annual_target} onChange={(e) => setForm((p) => ({ ...p, annual_target: e.target.value }))} placeholder="Target for the year" required />
                <Input label="Weight % *" type="number" value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} placeholder="0-100" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <Input label="IDP Objective ID (optional)" value={form.idp_objective_id} onChange={(e) => setForm((p) => ({ ...p, idp_objective_id: e.target.value }))} placeholder="UUID to link golden thread" />
                <Input label="mSCOA Code ID (optional)" value={form.mscoa_code_id} onChange={(e) => setForm((p) => ({ ...p, mscoa_code_id: e.target.value }))} placeholder="UUID for budget alignment" />
              </div>
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, marginBottom: 'var(--space-sm)', fontWeight: 600 }}>Quarterly Targets *</p>
                <div style={quarterGridStyles}>
                  <Input label="Q1" type="number" value={form.q1} onChange={(e) => setForm((p) => ({ ...p, q1: e.target.value }))} placeholder="0" />
                  <Input label="Q2" type="number" value={form.q2} onChange={(e) => setForm((p) => ({ ...p, q2: e.target.value }))} placeholder="0" />
                  <Input label="Q3" type="number" value={form.q3} onChange={(e) => setForm((p) => ({ ...p, q3: e.target.value }))} placeholder="0" />
                  <Input label="Q4" type="number" value={form.q4} onChange={(e) => setForm((p) => ({ ...p, q4: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                <Button type="submit" variant="primary" loading={submitting}>Add KPI</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={emptyStyles}>Loading KPIs...</div>
      ) : error ? (
        <div style={emptyStyles}>
          <p style={{ color: 'var(--color-coral)', marginBottom: 'var(--space-md)' }}>{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchKpis}>Retry</Button>
        </div>
      ) : kpis.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>No KPIs yet</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Add the first KPI to start measuring performance.</p>
        </div>
      ) : (
        <GlassCard>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyles}>
              <thead>
                <tr>
                  <th style={thStyles}>KPI #</th>
                  <th style={thStyles}>Description</th>
                  <th style={thStyles}>Unit</th>
                  <th style={{ ...thStyles, textAlign: 'right' }}>Baseline</th>
                  <th style={{ ...thStyles, textAlign: 'right' }}>Annual Target</th>
                  <th style={{ ...thStyles, textAlign: 'right' }}>Weight</th>
                  <th style={thStyles}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr
                    key={kpi.id}
                    onClick={() => setSelectedKpi(kpi)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={tdStyles}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-teal)' }}>
                        {kpi.kpi_number}
                      </span>
                    </td>
                    <td style={{ ...tdStyles, maxWidth: '280px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                        {kpi.description}
                      </span>
                    </td>
                    <td style={tdStyles}>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{kpi.unit_of_measurement}</span>
                    </td>
                    <td style={{ ...tdStyles, textAlign: 'right' }}>{parseFloat(kpi.baseline).toLocaleString()}</td>
                    <td style={{ ...tdStyles, textAlign: 'right', fontWeight: 600 }}>{parseFloat(kpi.annual_target).toLocaleString()}</td>
                    <td style={{ ...tdStyles, textAlign: 'right' }}>{parseFloat(kpi.weight)}%</td>
                    <td style={tdStyles}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/pms/kpis/${kpi.id}/actuals`); }}
                      >
                        View Actuals
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* KPI Detail Modal */}
      {selectedKpi && (
        <PmsDetailModal
          title={`${selectedKpi.kpi_number} — ${selectedKpi.description}`}
          rows={[
            { label: 'KPI #', value: selectedKpi.kpi_number },
            { label: 'Description', value: selectedKpi.description },
            { label: 'Unit', value: selectedKpi.unit_of_measurement },
            { label: 'Baseline', value: parseFloat(selectedKpi.baseline).toLocaleString() },
            { label: 'Annual Target', value: parseFloat(selectedKpi.annual_target).toLocaleString() },
            { label: 'Weight', value: `${parseFloat(selectedKpi.weight)}%` },
            ...(selectedKpi.idp_objective_id ? [{ label: 'IDP Objective ID', value: selectedKpi.idp_objective_id }] : []),
            ...(selectedKpi.mscoa_code_id ? [{ label: 'mSCOA Code ID', value: selectedKpi.mscoa_code_id }] : []),
          ]}
          onClose={() => setSelectedKpi(null)}
        />
      )}
    </div>
  );
}
