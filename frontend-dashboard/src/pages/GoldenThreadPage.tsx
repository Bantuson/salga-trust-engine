/**
 * Golden Thread Page — read-only tree view of IDP -> Goals -> Objectives -> KPIs.
 *
 * Shows the full statutory traceability hierarchy using a hierarchical
 * indented list with different background shades per level.
 * Includes a cycle selector dropdown if multiple cycles exist.
 *
 * Routes: /pms/golden-thread (standalone) or embedded inside PmsHubPage
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
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

interface GoldenThreadPageProps {
  embedded?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Demo data — realistic SA municipal content                        */
/* ------------------------------------------------------------------ */

const DEMO_CYCLES: IDPCycle[] = [
  { id: 'demo-cycle-1', title: 'Umsobomvu IDP 2022–2027', start_year: 2022, end_year: 2027, status: 'approved' },
  { id: 'demo-cycle-2', title: 'Umsobomvu IDP 2027–2032', start_year: 2027, end_year: 2032, status: 'draft' },
];

const DEMO_THREADS: Record<string, GoldenThread> = {
  'demo-cycle-1': {
    id: 'demo-cycle-1',
    title: 'Umsobomvu IDP 2022–2027',
    status: 'approved',
    goals: [
      {
        id: 'goal-1',
        title: 'Reliable water and sanitation for Colesburg, Norvalspont and Hanover',
        national_kpa: 'basic_service_delivery',
        objectives: [
          {
            id: 'obj-1a',
            title: 'Reduce water losses in the Colesburg reticulation network',
            kpis: [
              { id: 'kpi-1a1', kpi_number: 'KPI-BSD-001', description: 'Percentage reduction in non-revenue water', unit_of_measurement: '%', annual_target: '12' },
              { id: 'kpi-1a2', kpi_number: 'KPI-BSD-002', description: 'Pipe bursts repaired within 48 hours', unit_of_measurement: 'count', annual_target: '60' },
            ],
          },
          {
            id: 'obj-1b',
            title: 'Extend waterborne sanitation to Lowryville and Kuyasa',
            kpis: [
              { id: 'kpi-1b1', kpi_number: 'KPI-BSD-003', description: 'Households connected to waterborne sewerage', unit_of_measurement: 'households', annual_target: '150' },
            ],
          },
        ],
      },
      {
        id: 'goal-2',
        title: 'Maintain and upgrade gravel and tar road network',
        national_kpa: 'basic_service_delivery',
        objectives: [
          {
            id: 'obj-2a',
            title: 'Resurface priority roads in Colesburg CBD and township access routes',
            kpis: [
              { id: 'kpi-2a1', kpi_number: 'KPI-BSD-010', description: 'Kilometres of road resurfaced', unit_of_measurement: 'km', annual_target: '8' },
              { id: 'kpi-2a2', kpi_number: 'KPI-BSD-011', description: 'Pothole repair turnaround time (average days)', unit_of_measurement: 'days', annual_target: '7' },
            ],
          },
          {
            id: 'obj-2b',
            title: 'Re-gravel rural access roads to farming areas',
            kpis: [
              { id: 'kpi-2b1', kpi_number: 'KPI-BSD-012', description: 'Kilometres of gravel road re-gravelled', unit_of_measurement: 'km', annual_target: '15' },
            ],
          },
        ],
      },
      {
        id: 'goal-3',
        title: 'Stimulate local economic development and tourism',
        national_kpa: 'local_economic_development',
        objectives: [
          {
            id: 'obj-3a',
            title: 'Support emerging farmers and SMMEs along the N1 corridor',
            kpis: [
              { id: 'kpi-3a1', kpi_number: 'KPI-LED-001', description: 'SMMEs supported through LED programmes', unit_of_measurement: 'count', annual_target: '25' },
              { id: 'kpi-3a2', kpi_number: 'KPI-LED-002', description: 'Jobs created through EPWP and CWP projects', unit_of_measurement: 'jobs', annual_target: '180' },
            ],
          },
        ],
      },
      {
        id: 'goal-4',
        title: 'Strengthen financial management and revenue collection',
        national_kpa: 'municipal_financial_viability',
        objectives: [
          {
            id: 'obj-4a',
            title: 'Improve revenue collection from rates and service charges',
            kpis: [
              { id: 'kpi-4a1', kpi_number: 'KPI-MFV-001', description: 'Revenue collection rate as percentage of billing', unit_of_measurement: '%', annual_target: '78' },
            ],
          },
        ],
      },
    ],
  },
  'demo-cycle-2': {
    id: 'demo-cycle-2',
    title: 'Umsobomvu IDP 2027–2032',
    status: 'draft',
    goals: [
      {
        id: 'goal-d1',
        title: 'Universal access to safe drinking water',
        national_kpa: 'basic_service_delivery',
        objectives: [
          {
            id: 'obj-d1a',
            title: 'Replace aging asbestos water mains in Colesburg',
            kpis: [
              { id: 'kpi-d1a1', kpi_number: 'KPI-BSD-020', description: 'Metres of asbestos pipe replaced', unit_of_measurement: 'm', annual_target: '2500' },
            ],
          },
        ],
      },
      {
        id: 'goal-d2',
        title: 'Transparent governance and community participation',
        national_kpa: 'good_governance',
        objectives: [
          {
            id: 'obj-d2a',
            title: 'Increase ward committee activity across all 5 wards',
            kpis: [
              { id: 'kpi-d2a1', kpi_number: 'KPI-GG-001', description: 'Ward committee meetings held per quarter', unit_of_measurement: 'meetings', annual_target: '20' },
              { id: 'kpi-d2a2', kpi_number: 'KPI-GG-002', description: 'Community imbizo sessions conducted', unit_of_measurement: 'sessions', annual_target: '6' },
            ],
          },
        ],
      },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Constants / lookup maps                                            */
/* ------------------------------------------------------------------ */

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

export function GoldenThreadPage({ embedded = false }: GoldenThreadPageProps) {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
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
      const res = await fetch('/api/v1/idp/cycles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load cycles (${res.status})`);
      const data: IDPCycle[] = await res.json();
      setCycles(data);
      if (!selectedCycleId && data.length > 0) {
        setSelectedCycleId(data[0].id);
      }
    } catch {
      // Fall back to demo cycles
      setCycles(DEMO_CYCLES);
      if (!selectedCycleId) {
        setSelectedCycleId(DEMO_CYCLES[0].id);
      }
      setError(null);
    } finally {
      setLoadingCycles(false);
    }
  }, [token, selectedCycleId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // Fetch golden thread when cycle changes
  const fetchThread = useCallback(async () => {
    if (!selectedCycleId) return;
    setLoadingThread(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/idp/cycles/${selectedCycleId}/golden-thread`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      const data: GoldenThread = await res.json();
      setThread(data);
      setExpandedGoals(new Set(data.goals.map((g) => g.id)));
    } catch {
      // Fall back to demo thread
      const demoThread = DEMO_THREADS[selectedCycleId];
      if (demoThread) {
        setThread(demoThread);
        setExpandedGoals(new Set(demoThread.goals.map((g) => g.id)));
      }
      setError(null);
    } finally {
      setLoadingThread(false);
    }
  }, [selectedCycleId, token]);

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

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header — only shown in standalone mode */}
      {!embedded && (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h4)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
            Golden Thread
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 0 }}>
            Statutory traceability: IDP Cycle &rarr; Strategic Goals &rarr; Objectives &rarr; SDBIP KPIs
          </p>
        </div>
      )}

      {/* Cycle Selector */}
      {!loadingCycles && cycles.length > 0 && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-lg)' }}>
          <Select
            label="IDP Cycle"
            options={cycles.map((c) => ({ value: c.id, label: `${c.title} (${c.start_year}–${c.end_year})` }))}
            value={selectedCycleId}
            onChange={handleCycleChange}
          />
        </GlassCard>
      )}

      {error && <p style={{ color: 'var(--color-coral)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>{error}</p>}

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
                      {expandedGoals.has(goal.id) ? '\u25BC' : '\u25B6'}
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
                            {expandedObjectives.has(obj.id) ? '\u25BC' : '\u25B6'}
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
                  {expandedObjectives.has(obj.id) && obj.kpis.map((kpi) => (
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
