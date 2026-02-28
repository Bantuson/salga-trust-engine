/**
 * Golden Thread Page — read-only tree view of IDP -> Goals -> Objectives -> KPIs.
 *
 * Shows the full statutory traceability hierarchy using a hierarchical
 * indented list with different background shades per level.
 * Includes a cycle selector dropdown if multiple cycles exist.
 *
 * Routes: /pms/golden-thread
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { useAuth } from '../hooks/useAuth';

interface GoldenThreadKpi {
  id: string;
  kpi_number: string;
  description: string;
  unit_of_measurement: string;
  annual_target: string;
}

interface GoldenThreadObjective {
  id: string;
  title: string;
  kpis: GoldenThreadKpi[];
}

interface GoldenThreadGoal {
  id: string;
  title: string;
  national_kpa: string;
  objectives: GoldenThreadObjective[];
}

interface GoldenThread {
  id: string;
  title: string;
  status: string;
  goals: GoldenThreadGoal[];
}

interface IDPCycle {
  id: string;
  title: string;
  start_year: number;
  end_year: number;
  status: string;
}

const KPA_LABELS: Record<string, string> = {
  basic_service_delivery: 'Basic Service Delivery',
  local_economic_development: 'Local Economic Development',
  municipal_financial_viability: 'Municipal Financial Viability',
  good_governance: 'Good Governance',
  municipal_transformation: 'Municipal Transformation',
};

const KPA_COLORS: Record<string, string> = {
  basic_service_delivery: 'var(--color-teal)',
  local_economic_development: 'var(--color-gold)',
  municipal_financial_viability: 'var(--color-coral)',
  good_governance: 'var(--color-rose)',
  municipal_transformation: '#7c4dff',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--color-gold)',
  approved: 'var(--color-teal)',
  under_review: 'var(--color-coral)',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  under_review: 'Under Review',
};

export function GoldenThreadPage() {
  const { getAccessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCycleId = searchParams.get('cycle') || '';

  const [cycles, setCycles] = useState<IDPCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>(initialCycleId);
  const [thread, setThread] = useState<GoldenThread | null>(null);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

  // Fetch all cycles for the selector
  const fetchCycles = useCallback(async () => {
    setLoadingCycles(true);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/v1/idp/cycles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load cycles (${res.status})`);
      const data: IDPCycle[] = await res.json();
      setCycles(data);
      // Auto-select first cycle if none specified
      if (!selectedCycleId && data.length > 0) {
        setSelectedCycleId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IDP cycles');
    } finally {
      setLoadingCycles(false);
    }
  }, [getAccessToken, selectedCycleId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // Fetch golden thread when cycle changes
  const fetchThread = useCallback(async () => {
    if (!selectedCycleId) return;
    setLoadingThread(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/idp/cycles/${selectedCycleId}/golden-thread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data: GoldenThread = await res.json();
      setThread(data);
      // Expand all goals by default
      setExpandedGoals(new Set(data.goals.map((g) => g.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load golden thread');
    } finally {
      setLoadingThread(false);
    }
  }, [selectedCycleId, getAccessToken]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    setSearchParams(cycleId ? { cycle: cycleId } : {});
    setThread(null);
    setExpandedGoals(new Set());
    setExpandedObjectives(new Set());
  };

  const toggleGoal = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) next.delete(goalId);
      else next.add(goalId);
      return next;
    });
  };

  const toggleObjective = (objId: string) => {
    setExpandedObjectives((prev) => {
      const next = new Set(prev);
      if (next.has(objId)) next.delete(objId);
      else next.add(objId);
      return next;
    });
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
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color,
      background: `${color}22`,
      border: `1px solid ${color}66`,
    };
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
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h4)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
          Golden Thread
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 0 }}>
          Statutory traceability: IDP Cycle → Strategic Goals → Objectives → SDBIP KPIs
        </p>
      </div>

      {/* Cycle Selector */}
      {!loadingCycles && cycles.length > 0 && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <label style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              IDP Cycle:
            </label>
            <select
              value={selectedCycleId}
              onChange={(e) => handleCycleChange(e.target.value)}
              style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)' }}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.start_year}–{c.end_year})
                </option>
              ))}
            </select>
          </div>
        </GlassCard>
      )}

      {error && <p style={errorStyles}>{error}</p>}

      {loadingCycles || loadingThread ? (
        <div style={emptyStyles}>Loading golden thread...</div>
      ) : !selectedCycleId ? (
        <div style={emptyStyles}>
          <p>No IDP cycles found. Create an IDP cycle to view the golden thread.</p>
        </div>
      ) : !thread ? null : thread.goals.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>No goals in this cycle</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Add strategic goals to the IDP cycle to build the golden thread.</p>
        </div>
      ) : (
        <>
          {/* Cycle Header */}
          <GlassCard variant="elevated" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    IDP Cycle
                  </span>
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0 }}>
                  {thread.title}
                </h2>
              </div>
              <span style={statusBadgeStyles(thread.status)}>
                {STATUS_LABELS[thread.status] || thread.status}
              </span>
            </div>
          </GlassCard>

          {/* Goals */}
          {thread.goals.map((goal, gi) => (
            <div key={goal.id} style={{ marginBottom: 'var(--space-md)', marginLeft: 'var(--space-md)' }}>
              {/* Goal Level */}
              <div
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleGoal(goal.id)}
              >
                <GlassCard style={{ padding: 'var(--space-md) var(--space-lg)', background: 'rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', width: '16px', textAlign: 'center' }}>
                      {expandedGoals.has(goal.id) ? '▼' : '▶'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Goal {gi + 1}
                    </span>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0, flex: 1 }}>
                      {goal.title}
                    </h3>
                    <span style={kpaBadgeStyles(goal.national_kpa)}>
                      {KPA_LABELS[goal.national_kpa] || goal.national_kpa}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {goal.objectives.length} objective{goal.objectives.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </GlassCard>
              </div>

              {/* Objectives */}
              {expandedGoals.has(goal.id) && goal.objectives.map((obj, oi) => (
                <div key={obj.id} style={{ marginLeft: 'var(--space-xl)', marginTop: 'var(--space-xs)' }}>
                  <div
                    style={{ cursor: obj.kpis.length > 0 ? 'pointer' : 'default', userSelect: 'none' }}
                    onClick={() => obj.kpis.length > 0 && toggleObjective(obj.id)}
                  >
                    <GlassCard style={{ padding: 'var(--space-sm) var(--space-lg)', background: 'rgba(255,255,255,0.05)', marginBottom: 'var(--space-xs)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                        {obj.kpis.length > 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', width: '16px', textAlign: 'center' }}>
                            {expandedObjectives.has(obj.id) ? '▼' : '▶'}
                          </span>
                        ) : (
                          <span style={{ width: '16px' }} />
                        )}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>
                          {gi + 1}.{oi + 1}
                        </span>
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, flex: 1 }}>
                          {obj.title}
                        </p>
                        {obj.kpis.length > 0 && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--color-teal)' }}>
                            {obj.kpis.length} KPI{obj.kpis.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </GlassCard>
                  </div>

                  {/* KPIs */}
                  {expandedObjectives.has(obj.id) && obj.kpis.map((kpi, ki) => (
                    <div key={kpi.id} style={{ marginLeft: 'var(--space-xl)', marginBottom: 'var(--space-xs)' }}>
                      <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'rgba(0, 191, 165, 0.05)', border: '1px solid rgba(0, 191, 165, 0.15)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-teal)', whiteSpace: 'nowrap' }}>
                            {kpi.kpi_number}
                          </span>
                          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, flex: 1, minWidth: '200px' }}>
                            {kpi.description}
                          </p>
                          <div style={{ display: 'flex', gap: 'var(--space-md)', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              Target: <strong style={{ color: 'var(--text-primary)' }}>{parseFloat(kpi.annual_target).toLocaleString()}</strong> {kpi.unit_of_measurement}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          {/* Summary */}
          <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-md) var(--space-lg)', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{thread.goals.length}</strong> strategic goals
              </span>
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {thread.goals.reduce((sum, g) => sum + g.objectives.length, 0)}
                </strong> objectives
              </span>
              <span>
                <strong style={{ color: 'var(--color-teal)' }}>
                  {thread.goals.reduce((sum, g) => sum + g.objectives.reduce((s, o) => s + o.kpis.length, 0), 0)}
                </strong> SDBIP KPIs
              </span>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={fetchThread}>
              Refresh
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
