/**
 * IDP Management Page — list and create IDP cycles.
 *
 * Displays all IDP cycles as GlassCards.
 * Authorized roles (pms_officer, section56_director, director, executive) can
 * create new cycles via an inline form.
 *
 * Routes: /pms/idp (standalone) or embedded inside PmsHubPage
 */

import { useState, useEffect, useCallback, createElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { usePageHeader } from '../hooks/usePageHeader';
import { DEMO_MODE } from '../lib/demoMode';

interface IDPCycle {
  id: string;
  title: string;
  vision?: string;
  mission?: string;
  start_year: number;
  end_year: number;
  status: string;
}

interface CreateCycleForm {
  title: string;
  vision: string;
  mission: string;
  start_year: string;
  end_year: string;
}

interface IdpPageProps {
  embedded?: boolean;
  showForm?: boolean;
  onToggleForm?: () => void;
}

const DEMO_CYCLES: IDPCycle[] = [
  { id: 'demo-1', title: 'Umsobomvu IDP 2022–2027', vision: 'A prosperous and united Umsobomvu', mission: 'Deliver sustainable basic services to all communities in Colesburg, Norvalspont and Hanover', start_year: 2022, end_year: 2027, status: 'approved' },
  { id: 'demo-2', title: 'Umsobomvu IDP 2027–2032', vision: 'A resilient Northern Cape gateway town', mission: 'Improve quality of life through reliable infrastructure and local economic growth', start_year: 2027, end_year: 2032, status: 'draft' },
];

const statusColors: Record<string, string> = {
  draft: 'var(--color-gold)',
  approved: 'var(--color-teal)',
  under_review: 'var(--color-coral)',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  under_review: 'Under Review',
};

export function IdpPage({ embedded = false, showForm: externalShowForm, onToggleForm }: IdpPageProps) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const navigate = useNavigate();

  const [cycles, setCycles] = useState<IDPCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalShowForm, setInternalShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showForm = embedded ? (externalShowForm ?? false) : internalShowForm;
  const toggleForm = embedded ? onToggleForm : () => setInternalShowForm(p => !p);

  usePageHeader(
    embedded ? '' : 'IDP Management',
    !embedded ? createElement(Button, { variant: 'primary', size: 'sm', onClick: toggleForm },
      showForm ? 'Cancel' : '+ Create IDP Cycle') : undefined
  );

  const [form, setForm] = useState<CreateCycleForm>({
    title: '',
    vision: '',
    mission: '',
    start_year: '',
    end_year: '',
  });

  const fetchCycles = useCallback(async () => {
    if (DEMO_MODE) {
      setCycles(DEMO_CYCLES);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/idp/cycles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setCycles(data);
    } catch {
      // Fall back to demo data when API is unavailable
      setCycles(DEMO_CYCLES);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const handleFormChange = (field: keyof CreateCycleForm, value: string) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-compute end_year = start_year + 5
      if (field === 'start_year' && value) {
        const sy = parseInt(value, 10);
        if (!isNaN(sy)) updated.end_year = String(sy + 5);
      }
      return updated;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/v1/idp/cycles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title,
          vision: form.vision || undefined,
          mission: form.mission || undefined,
          start_year: parseInt(form.start_year, 10),
          end_year: parseInt(form.end_year, 10),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      if (toggleForm) toggleForm();
      setForm({ title: '', vision: '', mission: '', start_year: '', end_year: '' });
      await fetchCycles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create IDP cycle');
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
      {showForm && (
        <div style={modalOverlayStyles} onClick={() => toggleForm?.()}>
          <div style={modalCardStyles} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
              <h2 style={{ ...titleStyles, fontSize: 'var(--text-lg)', margin: 0 }}>New IDP Cycle</h2>
              <button onClick={() => toggleForm?.()} style={modalCloseStyles}>&times;</button>
            </div>
            {formError && <p style={errorTextStyles}>{formError}</p>}
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Input label="Title *" value={form.title} onChange={(e) => handleFormChange('title', e.target.value)} placeholder="e.g., IDP 2022-2027" required />
              </div>
              <div style={formGridStyles}>
                <Input label="Start Year *" type="number" value={form.start_year} onChange={(e) => handleFormChange('start_year', e.target.value)} placeholder="2022" required />
                <Input label="End Year *" type="number" value={form.end_year} onChange={(e) => handleFormChange('end_year', e.target.value)} placeholder="2027" required />
              </div>
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Input label="Vision Statement" value={form.vision} onChange={(e) => handleFormChange('vision', e.target.value)} placeholder="Municipal vision for the cycle period" />
              </div>
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Input label="Mission Statement" value={form.mission} onChange={(e) => handleFormChange('mission', e.target.value)} placeholder="Municipal mission and mandate" />
              </div>
              <div style={formActionsStyles}>
                <Button type="submit" variant="primary" loading={submitting}>Create Cycle</Button>
                <Button type="button" variant="ghost" onClick={toggleForm}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div style={emptyStyles}>Loading IDP cycles...</div>
      ) : error ? (
        <div style={emptyStyles}>
          <p style={{ color: 'var(--color-coral)', marginBottom: 'var(--space-md)' }}>{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchCycles}>
            Retry
          </Button>
        </div>
      ) : cycles.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>No IDP cycles yet</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Create your first 5-year IDP cycle to get started.</p>
        </div>
      ) : (
        <div style={cycleGridStyles}>
          {cycles.map((cycle) => (
            <GlassCard
              key={cycle.id}
              variant="interactive"
              glow="teal"
              onClick={() => navigate(`/pms/idp/${cycle.id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0, flex: 1, marginRight: 'var(--space-sm)' }}>
                  {cycle.title}
                </h3>
                <span style={statusBadgeStyles(cycle.status)}>
                  {statusLabels[cycle.status] || cycle.status}
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {cycle.start_year} – {cycle.end_year}
              </p>
              {cycle.vision && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-sm)', marginBottom: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                  {cycle.vision}
                </p>
              )}
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

const cycleGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 'var(--space-lg)',
  marginTop: 'var(--space-lg)',
};

const modalOverlayStyles: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
};

const modalCardStyles: React.CSSProperties = {
  width: '90%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
  background: 'var(--surface-elevated)', border: '1px solid var(--glass-border)',
  borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)',
  boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
};

const modalCloseStyles: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem',
  cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
};

const formGridStyles: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-md)',
  marginBottom: 'var(--space-md)',
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
