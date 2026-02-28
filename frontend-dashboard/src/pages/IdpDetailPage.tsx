/**
 * IDP Cycle Detail Page — view cycle details, manage goals and objectives.
 *
 * Shows cycle details at top, lists goals with national KPA badges, and allows
 * adding goals and objectives via inline forms.
 *
 * Routes: /pms/idp/:cycleId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

interface IDPGoal {
  id: string;
  title: string;
  description?: string;
  national_kpa: string;
}

interface IDPObjective {
  id: string;
  title: string;
  description?: string;
  goal_id: string;
}

const KPA_LABELS: Record<string, string> = {
  basic_service_delivery: 'Basic Services',
  local_economic_development: 'LED',
  municipal_financial_viability: 'Financial Viability',
  good_governance: 'Good Governance',
  municipal_transformation: 'Transformation',
};

const KPA_COLORS: Record<string, string> = {
  basic_service_delivery: 'var(--color-teal)',
  local_economic_development: 'var(--color-gold)',
  municipal_financial_viability: 'var(--color-coral)',
  good_governance: 'var(--color-rose)',
  municipal_transformation: '#7c4dff',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  under_review: 'Under Review',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--color-gold)',
  approved: 'var(--color-teal)',
  under_review: 'var(--color-coral)',
};

export function IdpDetailPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<IDPCycle | null>(null);
  const [goals, setGoals] = useState<IDPGoal[]>([]);
  const [objectivesByGoal, setObjectivesByGoal] = useState<Record<string, IDPObjective[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // Goal form state
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', description: '', national_kpa: 'basic_service_delivery' });
  const [goalError, setGoalError] = useState<string | null>(null);
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  // Objective form state
  const [addObjForGoal, setAddObjForGoal] = useState<string | null>(null);
  const [objForm, setObjForm] = useState({ title: '', description: '' });
  const [objError, setObjError] = useState<string | null>(null);
  const [objSubmitting, setObjSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [cycleRes, goalsRes] = await Promise.all([
        fetch(`/api/v1/idp/cycles/${cycleId}`, { headers }),
        fetch(`/api/v1/idp/cycles/${cycleId}/goals`, { headers }),
      ]);

      if (!cycleRes.ok) throw new Error(`Cycle not found (${cycleRes.status})`);
      if (!goalsRes.ok) throw new Error(`Failed to load goals (${goalsRes.status})`);

      const cycleData = await cycleRes.json();
      const goalsData: IDPGoal[] = await goalsRes.json();

      setCycle(cycleData);
      setGoals(goalsData);

      // Fetch objectives for each goal
      const objResults = await Promise.all(
        goalsData.map((g) =>
          fetch(`/api/v1/idp/goals/${g.id}/objectives`, { headers }).then((r) => r.json())
        )
      );
      const objMap: Record<string, IDPObjective[]> = {};
      goalsData.forEach((g, i) => {
        objMap[g.id] = objResults[i] || [];
      });
      setObjectivesByGoal(objMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IDP data');
    } finally {
      setLoading(false);
    }
  }, [cycleId, getAccessToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleTransition = async (event: string) => {
    if (!cycleId) return;
    setTransitioning(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/idp/cycles/${cycleId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Transition failed (${res.status})`);
      }
      await fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transition failed');
    } finally {
      setTransitioning(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleId) return;
    setGoalSubmitting(true);
    setGoalError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/idp/cycles/${cycleId}/goals`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: goalForm.title,
          description: goalForm.description || undefined,
          national_kpa: goalForm.national_kpa,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to add goal (${res.status})`);
      }
      setShowGoalForm(false);
      setGoalForm({ title: '', description: '', national_kpa: 'basic_service_delivery' });
      await fetchAll();
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : 'Failed to add goal');
    } finally {
      setGoalSubmitting(false);
    }
  };

  const handleAddObjective = async (e: React.FormEvent, goalId: string) => {
    e.preventDefault();
    setObjSubmitting(true);
    setObjError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/idp/goals/${goalId}/objectives`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: objForm.title,
          description: objForm.description || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to add objective (${res.status})`);
      }
      setAddObjForGoal(null);
      setObjForm({ title: '', description: '' });
      await fetchAll();
    } catch (err) {
      setObjError(err instanceof Error ? err.message : 'Failed to add objective');
    } finally {
      setObjSubmitting(false);
    }
  };

  const pageStyles: React.CSSProperties = {
    padding: 'var(--space-xl)',
    maxWidth: '900px',
  };

  const kpaBadgeStyles = (kpa: string): React.CSSProperties => {
    const color = KPA_COLORS[kpa] || 'var(--text-secondary)';
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color,
      background: `${color}22`,
      border: `1px solid ${color}66`,
    };
  };

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

  const errorStyles: React.CSSProperties = {
    color: 'var(--color-coral)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    marginBottom: 'var(--space-md)',
  };

  if (loading) {
    return (
      <div style={{ ...pageStyles, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
        Loading IDP cycle...
      </div>
    );
  }

  if (error && !cycle) {
    return (
      <div style={{ ...pageStyles, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
        <p style={{ color: 'var(--color-coral)', marginBottom: 'var(--space-md)' }}>{error}</p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/pms/idp')}>
          Back to IDP Cycles
        </Button>
      </div>
    );
  }

  return (
    <div style={pageStyles}>
      {/* Breadcrumb */}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        <button
          onClick={() => navigate('/pms/idp')}
          style={{ background: 'none', border: 'none', color: 'var(--color-teal)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
        >
          IDP Cycles
        </button>
        {' / '}
        <span style={{ color: 'var(--text-primary)' }}>{cycle?.title}</span>
      </div>

      {/* Cycle Header */}
      {cycle && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h4)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
                {cycle.title}
              </h1>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                {cycle.start_year} – {cycle.end_year}
              </p>
              {cycle.vision && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, marginTop: 'var(--space-sm)' }}>
                  <strong>Vision:</strong> {cycle.vision}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-sm)' }}>
              <span style={statusBadgeStyles(cycle.status)}>
                {STATUS_LABELS[cycle.status] || cycle.status}
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {cycle.status === 'draft' && (
                  <Button size="sm" variant="primary" onClick={() => handleTransition('submit')} loading={transitioning}>
                    Approve IDP
                  </Button>
                )}
                {cycle.status === 'approved' && (
                  <Button size="sm" variant="secondary" onClick={() => handleTransition('open_review')} loading={transitioning}>
                    Open Review
                  </Button>
                )}
                {cycle.status === 'under_review' && (
                  <Button size="sm" variant="primary" onClick={() => handleTransition('re_approve')} loading={transitioning}>
                    Re-Approve
                  </Button>
                )}
                <Link to={`/pms/golden-thread?cycle=${cycle.id}`} style={{ textDecoration: 'none' }}>
                  <Button size="sm" variant="ghost">
                    Golden Thread
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          {error && <p style={{ ...errorStyles, marginTop: 'var(--space-md)', marginBottom: 0 }}>{error}</p>}
        </GlassCard>
      )}

      {/* Goals Section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0 }}>
          Strategic Goals
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setShowGoalForm((p) => !p)}>
          {showGoalForm ? 'Cancel' : '+ Add Goal'}
        </Button>
      </div>

      {showGoalForm && (
        <GlassCard style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-lg)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-md)' }}>
            New Strategic Goal
          </h3>
          {goalError && <p style={errorStyles}>{goalError}</p>}
          <form onSubmit={handleAddGoal}>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Goal Title *"
                value={goalForm.title}
                onChange={(e) => setGoalForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g., Improve basic service delivery"
                required
              />
            </div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
                National KPA *
              </label>
              <select
                value={goalForm.national_kpa}
                onChange={(e) => setGoalForm((p) => ({ ...p, national_kpa: e.target.value }))}
                required
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}
              >
                <option value="basic_service_delivery">Basic Service Delivery</option>
                <option value="local_economic_development">Local Economic Development</option>
                <option value="municipal_financial_viability">Municipal Financial Viability</option>
                <option value="good_governance">Good Governance</option>
                <option value="municipal_transformation">Municipal Transformation</option>
              </select>
            </div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Description"
                value={goalForm.description}
                onChange={(e) => setGoalForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description of this goal"
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Button type="submit" size="sm" variant="primary" loading={goalSubmitting}>Add Goal</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowGoalForm(false)}>Cancel</Button>
            </div>
          </form>
        </GlassCard>
      )}

      {goals.length === 0 ? (
        <GlassCard>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center', margin: 0, padding: 'var(--space-xl) 0' }}>
            No strategic goals yet. Add the first goal to build the golden thread.
          </p>
        </GlassCard>
      ) : (
        goals.map((goal) => (
          <GlassCard key={goal.id} style={{ marginBottom: 'var(--space-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
                  {goal.title}
                </h3>
                <span style={kpaBadgeStyles(goal.national_kpa)}>
                  {KPA_LABELS[goal.national_kpa] || goal.national_kpa}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAddObjForGoal(addObjForGoal === goal.id ? null : goal.id)}>
                + Add Objective
              </Button>
            </div>

            {/* Objectives */}
            {(objectivesByGoal[goal.id] || []).length > 0 && (
              <div style={{ marginTop: 'var(--space-md)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-md)' }}>
                {(objectivesByGoal[goal.id] || []).map((obj) => (
                  <div key={obj.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)', paddingLeft: 'var(--space-md)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-teal)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      {obj.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add Objective Form */}
            {addObjForGoal === goal.id && (
              <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {objError && <p style={errorStyles}>{objError}</p>}
                <form onSubmit={(e) => handleAddObjective(e, goal.id)}>
                  <div style={{ marginBottom: 'var(--space-sm)' }}>
                    <Input
                      label="Objective *"
                      value={objForm.title}
                      onChange={(e) => setObjForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g., Provide clean water to 95% of households"
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <Button type="submit" size="sm" variant="primary" loading={objSubmitting}>Add</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAddObjForGoal(null)}>Cancel</Button>
                  </div>
                </form>
              </div>
            )}
          </GlassCard>
        ))
      )}
    </div>
  );
}
