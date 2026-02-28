/**
 * IDP Management Page — list and create IDP cycles.
 *
 * Displays all IDP cycles as GlassCards.
 * Authorized roles (pms_officer, section56_director, director, executive) can
 * create new cycles via an inline form.
 *
 * Routes: /pms/idp
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { useAuth } from '../hooks/useAuth';

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

export function IdpPage() {
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  const [cycles, setCycles] = useState<IDPCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateCycleForm>({
    title: '',
    vision: '',
    mission: '',
    start_year: '',
    end_year: '',
  });

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/v1/idp/cycles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      setCycles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IDP cycles');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

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
      const token = getAccessToken();
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
      setShowForm(false);
      setForm({ title: '', vision: '', mission: '', start_year: '', end_year: '' });
      await fetchCycles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create IDP cycle');
    } finally {
      setSubmitting(false);
    }
  };

  const pageStyles: React.CSSProperties = {
    padding: 'var(--space-xl)',
    maxWidth: '900px',
  };

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

  const formCardStyles: React.CSSProperties = {
    marginTop: 'var(--space-xl)',
    padding: 'var(--space-xl)',
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

  const errorStyles: React.CSSProperties = {
    color: 'var(--color-coral)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    marginBottom: 'var(--space-md)',
  };

  return (
    <div style={pageStyles}>
      <div style={headerStyles}>
        <div>
          <h1 style={titleStyles}>IDP Management</h1>
          <p style={subtitleStyles}>Manage Integrated Development Plan cycles for your municipality</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm((p) => !p)}>
          {showForm ? 'Cancel' : '+ Create IDP Cycle'}
        </Button>
      </div>

      {showForm && (
        <GlassCard style={formCardStyles}>
          <h2 style={{ ...titleStyles, fontSize: 'var(--text-lg)', marginBottom: 'var(--space-lg)' }}>
            New IDP Cycle
          </h2>
          {formError && <p style={errorStyles}>{formError}</p>}
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Title *"
                value={form.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="e.g., IDP 2022-2027"
                required
              />
            </div>
            <div style={formGridStyles}>
              <Input
                label="Start Year *"
                type="number"
                value={form.start_year}
                onChange={(e) => handleFormChange('start_year', e.target.value)}
                placeholder="2022"
                required
              />
              <Input
                label="End Year *"
                type="number"
                value={form.end_year}
                onChange={(e) => handleFormChange('end_year', e.target.value)}
                placeholder="2027"
                required
              />
            </div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Vision Statement"
                value={form.vision}
                onChange={(e) => handleFormChange('vision', e.target.value)}
                placeholder="Municipal vision for the cycle period"
              />
            </div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Mission Statement"
                value={form.mission}
                onChange={(e) => handleFormChange('mission', e.target.value)}
                placeholder="Municipal mission and mandate"
              />
            </div>
            <div style={formActionsStyles}>
              <Button type="submit" variant="primary" loading={submitting}>
                Create Cycle
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </GlassCard>
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
