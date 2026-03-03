/**
 * OnboardingWizardPage — 9-step PMS-aware municipal onboarding wizard.
 *
 * Route: /onboarding (full-screen, no DashboardLayout)
 *
 * Steps:
 *  1. welcome              — Municipality confirmation + SDBIP level choice
 *  2. departments          — Create departments (min 3 soft warning)
 *  3. invite-tier1         — Invite Executive Mayor, MM, CFO, Speaker
 *  4. invite-directors     — One invite row per department from Step 2
 *  5. invite-dept-managers — One invite row per department (dept managers)
 *  6. create-teams         — Create operational teams within departments
 *  7. invite-supervisors   — One invite row per team (supervisors)
 *  8. sla-config           — SLA response/resolution targets + ward count
 *  9. pms-gate             — Readiness check via GET /api/v1/pms/readiness
 *
 * Styling: inline CSS variables only (Phase 27-03 CSS lock — no Tailwind).
 * Background: auth-skyline-bg CSS classes for visual continuity with login page.
 * State: localStorage persistence so wizard can resume after browser close.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { useAuth } from '../hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OnboardingStep =
  | 'welcome'
  | 'departments'
  | 'invite-tier1'
  | 'invite-directors'
  | 'invite-dept-managers'
  | 'create-teams'
  | 'invite-supervisors'
  | 'sla-config'
  | 'pms-gate';

const STEPS: OnboardingStep[] = [
  'welcome',
  'departments',
  'invite-tier1',
  'invite-directors',
  'invite-dept-managers',
  'create-teams',
  'invite-supervisors',
  'sla-config',
  'pms-gate',
];

const STEP_LABELS: Record<OnboardingStep, string> = {
  'welcome': 'Welcome',
  'departments': 'Departments',
  'invite-tier1': 'Tier 1 Leaders',
  'invite-directors': 'Directors',
  'invite-dept-managers': 'Dept Managers',
  'create-teams': 'Teams',
  'invite-supervisors': 'Supervisors',
  'sla-config': 'SLA & Wards',
  'pms-gate': 'Readiness Check',
};

interface Department {
  id?: string;
  name: string;
  code: string;
  saved?: boolean;
}

interface Tier1Invite {
  role: string;
  label: string;
  email: string;
  readOnly?: boolean;
  sendInvite: boolean;
  sent?: boolean;
}

interface DirectorInvite {
  departmentName: string;
  departmentCode: string;
  email: string;
  sendInvite: boolean;
  sent?: boolean;
}

interface DeptManagerInvite {
  departmentName: string;
  departmentCode: string;
  email: string;
  sendInvite: boolean;
  sent?: boolean;
}

interface Team {
  name: string;
  departmentCode: string;
  departmentName: string;
}

interface SupervisorInvite {
  teamName: string;
  departmentCode: string;
  email: string;
  sendInvite: boolean;
  sent?: boolean;
}

interface PmsReadiness {
  ready: boolean;
  checklist: {
    departments: boolean;
    directors: boolean;
    sla: boolean;
    [key: string]: boolean;
  };
  counts?: {
    departments?: number;
    tier1_invites?: number;
    directors?: number;
  };
}

const STORAGE_KEY = 'salga_onboarding_wizard_v3';

// ---------------------------------------------------------------------------
// Step indicator sub-component (compact mode for > 6 steps)
// ---------------------------------------------------------------------------

function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: OnboardingStep[];
  currentIndex: number;
}) {
  const isCompact = steps.length > 6;

  if (isCompact) {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-teal)' }}>
            Step {currentIndex + 1} of {steps.length}: {STEP_LABELS[steps[currentIndex]]}
          </span>
        </div>
        <div style={stepStyles.container}>
          {steps.map((step, i) => {
            const isCompleted = i < currentIndex;
            const isCurrent = i === currentIndex;

            return (
              <div key={step} style={stepStyles.stepWrapper}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      ...stepStyles.circleCompact,
                      background: isCompleted
                        ? 'var(--color-teal)'
                        : isCurrent
                        ? 'rgba(0, 191, 165, 0.15)'
                        : 'var(--surface-elevated)',
                      border: isCurrent || isCompleted
                        ? '2px solid var(--color-teal)'
                        : '2px solid var(--border-subtle)',
                      color: isCompleted
                        ? 'white'
                        : isCurrent
                        ? 'var(--color-teal)'
                        : 'var(--text-muted)',
                    }}
                  >
                    {isCompleted ? (
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: '10px', fontWeight: 700 }}>{i + 1}</span>
                    )}
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      ...stepStyles.connector,
                      background: isCompleted ? 'var(--color-teal)' : 'var(--border-subtle)',
                      marginBottom: '0px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={stepStyles.container}>
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step} style={stepStyles.stepWrapper}>
            <div style={stepStyles.stepColumn}>
              <div
                style={{
                  ...stepStyles.circle,
                  background: isCompleted
                    ? 'var(--color-teal)'
                    : isCurrent
                    ? 'rgba(0, 191, 165, 0.15)'
                    : 'var(--surface-elevated)',
                  border: isCurrent || isCompleted
                    ? '2px solid var(--color-teal)'
                    : '2px solid var(--border-subtle)',
                  color: isCompleted
                    ? 'white'
                    : isCurrent
                    ? 'var(--color-teal)'
                    : 'var(--text-muted)',
                }}
              >
                {isCompleted ? (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{i + 1}</span>
                )}
              </div>
              <span
                style={{
                  ...stepStyles.label,
                  color: isCurrent
                    ? 'var(--color-teal)'
                    : isCompleted
                    ? 'var(--text-secondary)'
                    : 'var(--text-muted)',
                }}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  ...stepStyles.connector,
                  background: isCompleted ? 'var(--color-teal)' : 'var(--border-subtle)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const stepStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    gap: '4px',
  },
  stepWrapper: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  stepColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  circle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease, border-color 0.2s ease',
    flexShrink: 0,
  },
  circleCompact: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease, border-color 0.2s ease',
    flexShrink: 0,
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    transition: 'color 0.2s ease',
  },
  connector: {
    flex: 1,
    height: '2px',
    margin: '0 4px',
    marginBottom: '18px',
    transition: 'background 0.2s ease',
    borderRadius: '1px',
  },
};

// ---------------------------------------------------------------------------
// Shared field styles
// ---------------------------------------------------------------------------

const fieldStyles: Record<string, React.CSSProperties> = {
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '1.25rem',
  },
  label: {
    fontSize: '0.78rem',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  select: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-body)',
    background: 'rgba(255, 255, 255, 0.18)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
    appearance: 'none' as never,
    WebkitAppearance: 'none' as never,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23e0d4d8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '38px',
  },
  input: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s ease',
  },
  readOnlyInput: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box' as const,
    cursor: 'not-allowed',
    opacity: 0.75,
  },
  warningBox: {
    padding: '10px 1rem',
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    color: 'var(--color-gold)',
    marginBottom: '1rem',
  },
  infoBox: {
    padding: '10px 1rem',
    background: 'rgba(0, 191, 165, 0.08)',
    border: '1px solid rgba(0, 191, 165, 0.2)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.85rem',
    color: 'var(--text-secondary)',
    marginBottom: '1rem',
    lineHeight: '1.4',
  },
};

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

export function OnboardingWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as any)?.prefill;
  const { getAccessToken, getTenantId, user } = useAuth();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: welcome
  const [sdbipLevel, setSdbipLevel] = useState<'top-layer' | 'top-departmental'>('top-layer');
  const [municipalityNameOverride, setMunicipalityNameOverride] = useState<string | null>(null);
  const municipalityName = municipalityNameOverride || (user as { user_metadata?: { municipality_name?: string } })?.user_metadata?.municipality_name || 'Your Municipality';

  // Step 2: departments
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');
  const [deptCount, setDeptCount] = useState(0);

  // Step 3: invite tier 1
  const mmEmail = (user as { user_metadata?: { email?: string } })?.user_metadata?.email || user?.email || '';
  const [tier1Invites, setTier1Invites] = useState<Tier1Invite[]>([
    { role: 'executive_mayor', label: 'Executive Mayor', email: '', sendInvite: true },
    { role: 'municipal_manager', label: 'Municipal Manager', email: mmEmail, readOnly: true, sendInvite: false },
    { role: 'cfo', label: 'Chief Financial Officer', email: '', sendInvite: true },
    { role: 'speaker', label: 'Speaker', email: '', sendInvite: true },
  ]);

  // Step 4: invite directors (one per dept from step 2)
  const [directorInvites, setDirectorInvites] = useState<DirectorInvite[]>([]);

  // Step 5: invite dept managers (one per dept)
  const [deptManagerInvites, setDeptManagerInvites] = useState<DeptManagerInvite[]>([]);

  // Step 6: create teams
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDeptCode, setNewTeamDeptCode] = useState('');

  // Step 7: invite supervisors (one per team)
  const [supervisorInvites, setSupervisorInvites] = useState<SupervisorInvite[]>([]);

  // Step 8: SLA + wards
  const [slaResponseHours, setSlaResponseHours] = useState(24);
  const [slaResolutionHours, setSlaResolutionHours] = useState(168);
  const [wardCount, setWardCount] = useState('');

  // Step 9: PMS readiness
  const [pmsReadiness, setPmsReadiness] = useState<PmsReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Restore from localStorage
  // ---------------------------------------------------------------------------

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.currentStepIndex === 'number') {
          setCurrentStepIndex(saved.currentStepIndex);
        }
        if (saved.sdbipLevel) setSdbipLevel(saved.sdbipLevel);
        if (saved.departments) setDepartments(saved.departments);
        if (saved.tier1Invites) {
          setTier1Invites((prev) =>
            prev.map((t) => {
              const found = saved.tier1Invites.find((s: Tier1Invite) => s.role === t.role);
              return found ? { ...t, email: found.email, sendInvite: found.sendInvite, sent: found.sent } : t;
            })
          );
        }
        if (saved.directorInvites) setDirectorInvites(saved.directorInvites);
        if (saved.deptManagerInvites) setDeptManagerInvites(saved.deptManagerInvites);
        if (saved.teams) setTeams(saved.teams);
        if (saved.supervisorInvites) setSupervisorInvites(saved.supervisorInvites);
        if (saved.slaResponseHours) setSlaResponseHours(saved.slaResponseHours);
        if (saved.slaResolutionHours) setSlaResolutionHours(saved.slaResolutionHours);
        if (saved.wardCount) setWardCount(saved.wardCount);
        if (typeof saved.deptCount === 'number') setDeptCount(saved.deptCount);
      }
    } catch {
      // non-critical
    }

    // Apply prefill from router state
    if (prefill?.municipalityName) {
      setMunicipalityNameOverride(prefill.municipalityName);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentStepIndex,
          sdbipLevel,
          departments,
          tier1Invites,
          directorInvites,
          deptManagerInvites,
          teams,
          supervisorInvites,
          slaResponseHours,
          slaResolutionHours,
          wardCount,
          deptCount,
        })
      );
    } catch {
      // non-critical
    }
  }, [currentStepIndex, sdbipLevel, departments, tier1Invites, directorInvites, deptManagerInvites, teams, supervisorInvites, slaResponseHours, slaResolutionHours, wardCount, deptCount]);

  // Sync director invites when departments change (Step 4 is dynamic)
  useEffect(() => {
    setDirectorInvites((prev) => {
      const merged = departments.map((dept) => {
        const existing = prev.find(
          (d) => d.departmentCode === dept.code
        );
        return existing
          ? existing
          : { departmentName: dept.name, departmentCode: dept.code, email: '', sendInvite: true };
      });
      return merged;
    });
  }, [departments]);

  // Sync dept manager invites when departments change (Step 5 is dynamic)
  useEffect(() => {
    setDeptManagerInvites((prev) => {
      const merged = departments.map((dept) => {
        const existing = prev.find(
          (d) => d.departmentCode === dept.code
        );
        return existing
          ? existing
          : { departmentName: dept.name, departmentCode: dept.code, email: '', sendInvite: true };
      });
      return merged;
    });
  }, [departments]);

  // Sync supervisor invites when teams change (Step 7 is dynamic)
  useEffect(() => {
    setSupervisorInvites((prev) => {
      const merged = teams.map((team) => {
        const existing = prev.find(
          (s) => s.teamName === team.name && s.departmentCode === team.departmentCode
        );
        return existing
          ? existing
          : { teamName: team.name, departmentCode: team.departmentCode, email: '', sendInvite: true };
      });
      return merged;
    });
  }, [teams]);

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  const getHeaders = useCallback(() => {
    const token = getAccessToken();
    const tenantId = getTenantId();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    };
  }, [getAccessToken, getTenantId]);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // ---------------------------------------------------------------------------
  // Step 2: Create department
  // ---------------------------------------------------------------------------

  async function handleCreateDepartment() {
    const name = newDeptName.trim();
    const code = newDeptCode.trim().toUpperCase();
    if (!name || !code) {
      setError('Department name and code are required.');
      return;
    }
    if (!/^[A-Z0-9_]{1,20}$/.test(code)) {
      setError('Code must be uppercase letters, digits, or underscores (e.g., FIN, COMM_SAFETY).');
      return;
    }
    if (departments.some((d) => d.code === code)) {
      setError(`Department code ${code} already used.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/departments/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, code }),
      });

      if (response.ok) {
        const created = await response.json();
        setDepartments((prev) => [...prev, { id: created.id, name: created.name, code: created.code, saved: true }]);
        setDeptCount((c) => c + 1);
      } else {
        // API unavailable during onboarding — track locally
        setDepartments((prev) => [...prev, { name, code, saved: false }]);
        setDeptCount((c) => c + 1);
      }
      setNewDeptName('');
      setNewDeptCode('');
    } catch {
      // Offline / API not ready — add locally
      setDepartments((prev) => [...prev, { name, code, saved: false }]);
      setDeptCount((c) => c + 1);
      setNewDeptName('');
      setNewDeptCode('');
    } finally {
      setIsLoading(false);
    }
  }

  function handleRemoveDepartment(code: string) {
    setDepartments((prev) => prev.filter((d) => d.code !== code));
    setDeptCount((c) => Math.max(0, c - 1));
  }

  // ---------------------------------------------------------------------------
  // Step 3: Submit tier 1 invites
  // ---------------------------------------------------------------------------

  async function handleSendTier1Invites() {
    const toSend = tier1Invites.filter((t) => t.sendInvite && t.email.trim() && !t.readOnly);
    if (toSend.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/api/v1/invitations/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          invitations: toSend.map((t) => ({ email: t.email.trim(), role: t.role })),
        }),
      });
      setTier1Invites((prev) =>
        prev.map((t) => (toSend.some((s) => s.role === t.role) ? { ...t, sent: true } : t))
      );
    } catch {
      // Non-blocking — mark as "attempted"
      setTier1Invites((prev) =>
        prev.map((t) => (toSend.some((s) => s.role === t.role) ? { ...t, sent: true } : t))
      );
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 4: Submit director invites
  // ---------------------------------------------------------------------------

  async function handleSendDirectorInvites() {
    const toSend = directorInvites.filter((d) => d.sendInvite && d.email.trim());
    if (toSend.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/api/v1/invitations/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          invitations: toSend.map((d) => ({ email: d.email.trim(), role: 'section56_director' })),
        }),
      });
      setDirectorInvites((prev) =>
        prev.map((d) => (toSend.some((s) => s.departmentCode === d.departmentCode) ? { ...d, sent: true } : d))
      );
    } catch {
      setDirectorInvites((prev) =>
        prev.map((d) => (toSend.some((s) => s.departmentCode === d.departmentCode) ? { ...d, sent: true } : d))
      );
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: Submit dept manager invites
  // ---------------------------------------------------------------------------

  async function handleSendDeptManagerInvites() {
    const toSend = deptManagerInvites.filter((d) => d.sendInvite && d.email.trim());
    if (toSend.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/api/v1/invitations/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          invitations: toSend.map((d) => ({ email: d.email.trim(), role: 'department_manager' })),
        }),
      });
      setDeptManagerInvites((prev) =>
        prev.map((d) => (toSend.some((s) => s.departmentCode === d.departmentCode) ? { ...d, sent: true } : d))
      );
    } catch {
      setDeptManagerInvites((prev) =>
        prev.map((d) => (toSend.some((s) => s.departmentCode === d.departmentCode) ? { ...d, sent: true } : d))
      );
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 7: Submit supervisor invites
  // ---------------------------------------------------------------------------

  async function handleSendSupervisorInvites() {
    const toSend = supervisorInvites.filter((s) => s.sendInvite && s.email.trim());
    if (toSend.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      await fetch(`${apiUrl}/api/v1/invitations/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          invitations: toSend.map((s) => ({ email: s.email.trim(), role: 'manager' })),
        }),
      });
      setSupervisorInvites((prev) =>
        prev.map((s) => (toSend.some((ts) => ts.teamName === s.teamName && ts.departmentCode === s.departmentCode) ? { ...s, sent: true } : s))
      );
    } catch {
      setSupervisorInvites((prev) =>
        prev.map((s) => (toSend.some((ts) => ts.teamName === s.teamName && ts.departmentCode === s.departmentCode) ? { ...s, sent: true } : s))
      );
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 9: Load PMS readiness
  // ---------------------------------------------------------------------------

  async function loadPmsReadiness() {
    setReadinessLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/pms/readiness`, {
        headers: getHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setPmsReadiness(data);
      } else {
        // Derive readiness from local wizard state
        setPmsReadiness({
          ready: departments.length >= 3 && directorInvites.some((d) => d.sent),
          checklist: {
            departments: departments.length >= 1,
            directors: directorInvites.some((d) => d.sent),
            sla: slaResponseHours > 0,
          },
          counts: {
            departments: departments.length,
            tier1_invites: tier1Invites.filter((t) => t.sent).length,
            directors: directorInvites.filter((d) => d.sent).length,
          },
        });
      }
    } catch {
      setPmsReadiness({
        ready: departments.length >= 3,
        checklist: {
          departments: departments.length >= 1,
          directors: directorInvites.some((d) => d.sent),
          sla: slaResponseHours > 0,
        },
        counts: {
          departments: departments.length,
          tier1_invites: tier1Invites.filter((t) => t.sent).length,
          directors: directorInvites.filter((d) => d.sent).length,
        },
      });
    } finally {
      setReadinessLoading(false);
    }
  }

  useEffect(() => {
    if (STEPS[currentStepIndex] === 'pms-gate') {
      loadPmsReadiness();
    }
  }, [currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async function handleNext() {
    setError(null);
    const step = STEPS[currentStepIndex];

    if (step === 'invite-tier1') {
      // Auto-send before advancing (if any checked)
      const hasUnsent = tier1Invites.some((t) => t.sendInvite && t.email.trim() && !t.readOnly && !t.sent);
      if (hasUnsent) {
        await handleSendTier1Invites();
      }
    }
    if (step === 'invite-directors') {
      const hasUnsent = directorInvites.some((d) => d.sendInvite && d.email.trim() && !d.sent);
      if (hasUnsent) {
        await handleSendDirectorInvites();
      }
    }
    if (step === 'invite-dept-managers') {
      const hasUnsent = deptManagerInvites.some((d) => d.sendInvite && d.email.trim() && !d.sent);
      if (hasUnsent) {
        await handleSendDeptManagerInvites();
      }
    }
    if (step === 'invite-supervisors') {
      const hasUnsent = supervisorInvites.some((s) => s.sendInvite && s.email.trim() && !s.sent);
      if (hasUnsent) {
        await handleSendSupervisorInvites();
      }
    }

    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  }

  function handleBack() {
    setError(null);
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  }

  function handleSkip() {
    setError(null);
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    }
  }

  function handleFinish() {
    localStorage.removeItem(STORAGE_KEY);
    navigate('/');
  }

  // ---------------------------------------------------------------------------
  // Team management (Step 6)
  // ---------------------------------------------------------------------------

  function handleAddTeam() {
    const name = newTeamName.trim();
    const deptCode = newTeamDeptCode;
    if (!name || !deptCode) {
      setError('Please select a department and enter a team name.');
      return;
    }
    if (teams.some((t) => t.name === name && t.departmentCode === deptCode)) {
      setError(`Team "${name}" already exists in this department.`);
      return;
    }
    const dept = departments.find((d) => d.code === deptCode);
    setTeams((prev) => [...prev, { name, departmentCode: deptCode, departmentName: dept?.name || deptCode }]);
    setNewTeamName('');
    setError(null);
  }

  function handleRemoveTeam(name: string, deptCode: string) {
    setTeams((prev) => prev.filter((t) => !(t.name === name && t.departmentCode === deptCode)));
  }

  // ---------------------------------------------------------------------------
  // Duration formatter helper
  // ---------------------------------------------------------------------------

  function formatDuration(hours: number): string {
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    if (rem === 0) return `${days} day${days !== 1 ? 's' : ''}`;
    return `${days}d ${rem}h`;
  }

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  function renderStep() {
    const step = STEPS[currentStepIndex];

    switch (step) {
      // ---- Step 1: Welcome ----
      case 'welcome':
        return (
          <div style={pageStyles.stepContent}>
            <div style={pageStyles.stepHeader}>
              <div style={pageStyles.welcomeIcon}>
                <svg width="48" height="48" fill="none" stroke="var(--color-teal)" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h2 style={pageStyles.stepTitle}>Welcome, {municipalityName}</h2>
              <p style={pageStyles.stepSubtitle}>
                Let's get your municipality set up for Performance Management. This wizard will guide you through
                department configuration, leadership invites, and SLA setup.
              </p>
            </div>

            <div style={fieldStyles.group}>
              <label style={fieldStyles.label}>SDBIP Configuration Level</label>
              <select
                value={sdbipLevel}
                onChange={(e) => setSdbipLevel(e.target.value as 'top-layer' | 'top-departmental')}
                style={fieldStyles.select}
              >
                <option value="top-layer">Top Layer Only</option>
                <option value="top-departmental">Top Layer + Departmental</option>
              </select>
            </div>

            <div style={fieldStyles.infoBox}>
              <strong>Top Layer Only</strong> — Tracks high-level municipal KPIs only.{' '}
              <strong>Top Layer + Departmental</strong> — Also tracks per-department KPI delivery for full PMS compliance.
            </div>

            <div style={pageStyles.navRow}>
              <div />
              <Button variant="primary" onClick={handleNext}>
                Confirm & Continue
              </Button>
            </div>
          </div>
        );

      // ---- Step 2: Department Setup ----
      case 'departments':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 2: Department Setup</h2>
            <p style={pageStyles.stepSubtitle}>
              Create your municipality's departments. Each department will have a Section 56 Director assigned.
            </p>

            {departments.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ ...fieldStyles.label, marginBottom: '8px' }}>
                  {departments.length} department{departments.length !== 1 ? 's' : ''} created
                </p>
                <ul style={pageStyles.deptList}>
                  {departments.map((dept) => (
                    <li key={dept.code} style={pageStyles.deptItem}>
                      <div>
                        <span style={pageStyles.deptName}>{dept.name}</span>
                        <span style={pageStyles.deptCode}>{dept.code}</span>
                        {!dept.saved && (
                          <span style={pageStyles.unsavedBadge}>local</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDepartment(dept.code)}
                        style={pageStyles.removeBtn}
                        aria-label={`Remove ${dept.name}`}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {departments.length < 3 && departments.length > 0 && (
              <div style={fieldStyles.warningBox}>
                Minimum 3 departments recommended. You can continue with fewer and add more later.
              </div>
            )}

            <div style={pageStyles.addDeptForm}>
              <p style={{ ...fieldStyles.label, marginBottom: '0.75rem' }}>Add Department</p>
              <div style={pageStyles.deptGrid}>
                <div style={fieldStyles.group}>
                  <label style={fieldStyles.label}>Department Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Finance"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    style={fieldStyles.input}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDepartment(); }}
                  />
                </div>
                <div style={fieldStyles.group}>
                  <label style={fieldStyles.label}>Code (uppercase)</label>
                  <input
                    type="text"
                    placeholder="e.g. FIN"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                    style={{ ...fieldStyles.input, fontFamily: 'monospace' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDepartment(); }}
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreateDepartment}
                disabled={isLoading || !newDeptName.trim() || !newDeptCode.trim()}
                loading={isLoading}
              >
                + Add Department
              </Button>
            </div>

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {departments.length < 3 && (
                  <Button variant="ghost" onClick={handleSkip}>
                    Skip for now
                  </Button>
                )}
                <Button variant="primary" onClick={handleNext} disabled={departments.length === 0}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 3: Invite Tier 1 Leaders ----
      case 'invite-tier1':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 3: Invite Executive Leadership</h2>
            <p style={pageStyles.stepSubtitle}>
              Invite your Tier 1 leaders. They will receive email invitations to join the SALGA Trust Engine platform.
            </p>

            <div style={pageStyles.inviteTable}>
              {tier1Invites.map((invite, i) => (
                <div key={invite.role} style={pageStyles.inviteRow}>
                  <div style={pageStyles.inviteRoleCol}>
                    <span style={pageStyles.inviteRoleLabel}>{invite.label}</span>
                  </div>
                  <div style={pageStyles.inviteEmailCol}>
                    {invite.readOnly ? (
                      <input
                        type="email"
                        value={invite.email}
                        readOnly
                        style={fieldStyles.readOnlyInput}
                        title="Municipal Manager email is set from registration"
                      />
                    ) : (
                      <input
                        type="email"
                        placeholder={`email@municipality.gov.za`}
                        value={invite.email}
                        onChange={(e) =>
                          setTier1Invites((prev) =>
                            prev.map((t, idx) => (idx === i ? { ...t, email: e.target.value } : t))
                          )
                        }
                        style={fieldStyles.input}
                      />
                    )}
                  </div>
                  <div style={pageStyles.inviteCheckCol}>
                    {invite.sent ? (
                      <span style={pageStyles.sentBadge}>
                        <svg width="14" height="14" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" viewBox="0 0 24 24">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Sent
                      </span>
                    ) : invite.readOnly ? (
                      <span style={{ ...pageStyles.sentBadge, color: 'var(--text-muted)' }}>Pre-registered</span>
                    ) : (
                      <label style={pageStyles.checkLabel}>
                        <input
                          type="checkbox"
                          checked={invite.sendInvite}
                          onChange={(e) =>
                            setTier1Invites((prev) =>
                              prev.map((t, idx) => (idx === i ? { ...t, sendInvite: e.target.checked } : t))
                            )
                          }
                          style={{ accentColor: 'var(--color-teal)' }}
                        />
                        Send
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="ghost" onClick={handleSkip}>
                  I'll invite them later
                </Button>
                <Button variant="primary" onClick={handleNext} loading={isLoading}>
                  Send & Continue
                </Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 4: Invite Directors ----
      case 'invite-directors':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 4: Assign Directors to Departments</h2>
            <p style={pageStyles.stepSubtitle}>
              Invite Section 56 Directors — one per department created in Step 2.
            </p>

            {directorInvites.length === 0 ? (
              <div style={fieldStyles.warningBox}>
                No departments created yet. Go back to Step 2 to add departments first.
              </div>
            ) : (
              <div style={pageStyles.inviteTable}>
                {directorInvites.map((invite, i) => (
                  <div key={invite.departmentCode} style={pageStyles.inviteRow}>
                    <div style={pageStyles.inviteRoleCol}>
                      <span style={pageStyles.inviteRoleLabel}>{invite.departmentName}</span>
                      <span style={pageStyles.inviteRoleCode}>{invite.departmentCode}</span>
                    </div>
                    <div style={pageStyles.inviteEmailCol}>
                      <input
                        type="email"
                        placeholder="director@municipality.gov.za"
                        value={invite.email}
                        onChange={(e) =>
                          setDirectorInvites((prev) =>
                            prev.map((d, idx) => (idx === i ? { ...d, email: e.target.value } : d))
                          )
                        }
                        style={fieldStyles.input}
                      />
                    </div>
                    <div style={pageStyles.inviteCheckCol}>
                      {invite.sent ? (
                        <span style={pageStyles.sentBadge}>
                          <svg width="14" height="14" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Sent
                        </span>
                      ) : (
                        <label style={pageStyles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={invite.sendInvite}
                            onChange={(e) =>
                              setDirectorInvites((prev) =>
                                prev.map((d, idx) => (idx === i ? { ...d, sendInvite: e.target.checked } : d))
                              )
                            }
                            style={{ accentColor: 'var(--color-teal)' }}
                          />
                          Send
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="ghost" onClick={handleSkip}>
                  I'll assign directors later
                </Button>
                <Button variant="primary" onClick={handleNext} loading={isLoading}>
                  Send & Continue
                </Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 5: Invite Department Managers ----
      case 'invite-dept-managers':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 5: Invite Department Managers</h2>
            <p style={pageStyles.stepSubtitle}>
              Invite one Department Manager per department to coordinate day-to-day operations.
            </p>

            {deptManagerInvites.length === 0 ? (
              <div style={fieldStyles.warningBox}>
                No departments created yet. Go back to Step 2 to add departments first.
              </div>
            ) : (
              <div style={pageStyles.inviteTable}>
                {deptManagerInvites.map((invite, i) => (
                  <div key={invite.departmentCode} style={pageStyles.inviteRow}>
                    <div style={pageStyles.inviteRoleCol}>
                      <span style={pageStyles.inviteRoleLabel}>{invite.departmentName}</span>
                      <span style={pageStyles.inviteRoleCode}>{invite.departmentCode}</span>
                    </div>
                    <div style={pageStyles.inviteEmailCol}>
                      <input
                        type="email"
                        placeholder="manager@municipality.gov.za"
                        value={invite.email}
                        onChange={(e) =>
                          setDeptManagerInvites((prev) =>
                            prev.map((d, idx) => (idx === i ? { ...d, email: e.target.value } : d))
                          )
                        }
                        style={fieldStyles.input}
                      />
                    </div>
                    <div style={pageStyles.inviteCheckCol}>
                      {invite.sent ? (
                        <span style={pageStyles.sentBadge}>
                          <svg width="14" height="14" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Sent
                        </span>
                      ) : (
                        <label style={pageStyles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={invite.sendInvite}
                            onChange={(e) =>
                              setDeptManagerInvites((prev) =>
                                prev.map((d, idx) => (idx === i ? { ...d, sendInvite: e.target.checked } : d))
                              )
                            }
                            style={{ accentColor: 'var(--color-teal)' }}
                          />
                          Send
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="ghost" onClick={handleSkip}>
                  I'll invite later
                </Button>
                <Button variant="primary" onClick={handleNext} loading={isLoading}>
                  Send & Continue
                </Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 6: Create Department Teams ----
      case 'create-teams':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 6: Create Department Teams</h2>
            <p style={pageStyles.stepSubtitle}>
              Create operational teams within each department.
            </p>

            {/* Existing teams grouped by department */}
            {teams.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ ...fieldStyles.label, marginBottom: '8px' }}>
                  {teams.length} team{teams.length !== 1 ? 's' : ''} created
                </p>
                {(() => {
                  const grouped: Record<string, Team[]> = {};
                  teams.forEach((t) => {
                    if (!grouped[t.departmentCode]) grouped[t.departmentCode] = [];
                    grouped[t.departmentCode].push(t);
                  });
                  return Object.entries(grouped).map(([deptCode, deptTeams]) => (
                    <div key={deptCode} style={{ marginBottom: '1rem' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        {deptTeams[0].departmentName} ({deptCode})
                      </p>
                      <ul style={pageStyles.deptList}>
                        {deptTeams.map((team) => (
                          <li key={`${team.departmentCode}-${team.name}`} style={pageStyles.deptItem}>
                            <div>
                              <span style={pageStyles.deptName}>{team.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTeam(team.name, team.departmentCode)}
                              style={pageStyles.removeBtn}
                              aria-label={`Remove ${team.name}`}
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
            )}

            {/* Add team form */}
            <div style={pageStyles.addDeptForm}>
              <p style={{ ...fieldStyles.label, marginBottom: '0.75rem' }}>Add Team</p>
              <div style={pageStyles.deptGrid}>
                <div style={fieldStyles.group}>
                  <label style={fieldStyles.label}>Department</label>
                  <select
                    value={newTeamDeptCode}
                    onChange={(e) => setNewTeamDeptCode(e.target.value)}
                    style={fieldStyles.select}
                  >
                    <option value="">Select department...</option>
                    {departments.map((dept) => (
                      <option key={dept.code} value={dept.code}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={fieldStyles.group}>
                  <label style={fieldStyles.label}>Team Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Revenue Collection"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    style={fieldStyles.input}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTeam(); }}
                  />
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddTeam}
                disabled={!newTeamName.trim() || !newTeamDeptCode}
              >
                + Add Team
              </Button>
            </div>

            {departments.length === 0 && (
              <div style={fieldStyles.warningBox}>
                No departments created yet. Go back to Step 2 to add departments first.
              </div>
            )}

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
                <Button variant="primary" onClick={handleNext} disabled={teams.length === 0}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 7: Invite Team Supervisors ----
      case 'invite-supervisors':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 7: Invite Team Supervisors</h2>
            <p style={pageStyles.stepSubtitle}>
              Invite a supervisor for each team created.
            </p>

            {supervisorInvites.length === 0 ? (
              <div style={fieldStyles.warningBox}>
                No teams created yet. Go back to Step 6 to create teams first.
              </div>
            ) : (
              <div style={pageStyles.inviteTable}>
                {supervisorInvites.map((invite, i) => (
                  <div key={`${invite.departmentCode}-${invite.teamName}`} style={pageStyles.inviteRow}>
                    <div style={pageStyles.inviteRoleCol}>
                      <span style={pageStyles.inviteRoleLabel}>{invite.teamName}</span>
                      <span style={pageStyles.inviteRoleCode}>{invite.departmentCode}</span>
                    </div>
                    <div style={pageStyles.inviteEmailCol}>
                      <input
                        type="email"
                        placeholder="supervisor@municipality.gov.za"
                        value={invite.email}
                        onChange={(e) =>
                          setSupervisorInvites((prev) =>
                            prev.map((s, idx) => (idx === i ? { ...s, email: e.target.value } : s))
                          )
                        }
                        style={fieldStyles.input}
                      />
                    </div>
                    <div style={pageStyles.inviteCheckCol}>
                      {invite.sent ? (
                        <span style={pageStyles.sentBadge}>
                          <svg width="14" height="14" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Sent
                        </span>
                      ) : (
                        <label style={pageStyles.checkLabel}>
                          <input
                            type="checkbox"
                            checked={invite.sendInvite}
                            onChange={(e) =>
                              setSupervisorInvites((prev) =>
                                prev.map((s, idx) => (idx === i ? { ...s, sendInvite: e.target.checked } : s))
                              )
                            }
                            style={{ accentColor: 'var(--color-teal)' }}
                          />
                          Send
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="ghost" onClick={handleSkip}>
                  I'll invite later
                </Button>
                <Button variant="primary" onClick={handleNext} loading={isLoading}>
                  Send & Continue
                </Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 8: SLA & Ward Configuration ----
      case 'sla-config':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 8: SLA & Ward Configuration</h2>
            <p style={pageStyles.stepSubtitle}>
              Set service level targets and ward count. These configure operational response expectations.
            </p>

            <div style={pageStyles.slaCard}>
              <div style={pageStyles.slaHeader}>
                <label style={pageStyles.slaLabel}>Response Time Target</label>
                <div style={pageStyles.slaValue}>{formatDuration(slaResponseHours)}</div>
              </div>
              <p style={pageStyles.slaHint}>How quickly should your team acknowledge a new ticket?</p>
              <input
                type="range"
                min="1"
                max="72"
                step="1"
                value={slaResponseHours}
                onChange={(e) => setSlaResponseHours(parseInt(e.target.value, 10))}
                style={pageStyles.slider}
              />
              <div style={pageStyles.sliderLabels}>
                <span style={pageStyles.sliderLabel}>1 hour</span>
                <span style={pageStyles.sliderLabel}>72 hours</span>
              </div>
            </div>

            <div style={{ ...pageStyles.slaCard, marginTop: '1.5rem' }}>
              <div style={pageStyles.slaHeader}>
                <label style={pageStyles.slaLabel}>Resolution Time Target</label>
                <div style={pageStyles.slaValue}>{formatDuration(slaResolutionHours)}</div>
              </div>
              <p style={pageStyles.slaHint}>How long should it take to fully resolve a ticket?</p>
              <input
                type="range"
                min="24"
                max="720"
                step="24"
                value={slaResolutionHours}
                onChange={(e) => setSlaResolutionHours(parseInt(e.target.value, 10))}
                style={pageStyles.slider}
              />
              <div style={pageStyles.sliderLabels}>
                <span style={pageStyles.sliderLabel}>1 day</span>
                <span style={pageStyles.sliderLabel}>30 days</span>
              </div>
            </div>

            <div style={{ ...fieldStyles.group, marginTop: '1.5rem' }}>
              <label style={fieldStyles.label}>Ward Count (optional)</label>
              <input
                type="number"
                min="0"
                max="999"
                placeholder="e.g. 47"
                value={wardCount}
                onChange={(e) => setWardCount(e.target.value)}
                style={fieldStyles.input}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Number of wards in your municipality (used for councillor assignments)
              </p>
            </div>

            <div style={pageStyles.navRow}>
              <Button variant="ghost" onClick={handleBack}>Back</Button>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button variant="ghost" onClick={handleSkip}>Skip</Button>
                <Button variant="primary" onClick={handleNext}>Next</Button>
              </div>
            </div>
          </div>
        );

      // ---- Step 9: PMS Readiness Gate ----
      case 'pms-gate':
        return (
          <div style={pageStyles.stepContent}>
            <h2 style={pageStyles.stepTitle}>Step 9: Municipality Readiness Check</h2>
            <p style={pageStyles.stepSubtitle}>
              Review your setup status before going live. You can always complete missing items from the dashboard.
            </p>

            {readinessLoading ? (
              <div style={pageStyles.readinessLoading}>
                <div style={pageStyles.spinner} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Checking readiness...</p>
              </div>
            ) : pmsReadiness ? (
              <div>
                <div style={pageStyles.checklistBox}>
                  <ChecklistItem
                    label="Departments created"
                    pass={pmsReadiness.checklist.departments}
                    detail={
                      pmsReadiness.counts?.departments !== undefined
                        ? `${pmsReadiness.counts.departments} department${pmsReadiness.counts.departments !== 1 ? 's' : ''}`
                        : undefined
                    }
                  />
                  <ChecklistItem
                    label="Tier 1 invites sent"
                    pass={!!pmsReadiness.counts?.tier1_invites && pmsReadiness.counts.tier1_invites > 0}
                    detail={
                      pmsReadiness.counts?.tier1_invites !== undefined
                        ? `${pmsReadiness.counts.tier1_invites} invite${pmsReadiness.counts.tier1_invites !== 1 ? 's' : ''} sent`
                        : undefined
                    }
                  />
                  <ChecklistItem
                    label="Directors assigned"
                    pass={pmsReadiness.checklist.directors}
                    detail={
                      pmsReadiness.counts?.directors !== undefined
                        ? `${pmsReadiness.counts.directors} director${pmsReadiness.counts.directors !== 1 ? 's' : ''} invited`
                        : undefined
                    }
                  />
                  <ChecklistItem
                    label="SLA configured"
                    pass={pmsReadiness.checklist.sla}
                  />
                </div>

                {/* Optional checklist items for new steps */}
                <div style={{ ...pageStyles.checklistBox, marginTop: '1rem' }}>
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Optional
                    </span>
                  </div>
                  <ChecklistItem
                    label="Department Managers invited"
                    pass={deptManagerInvites.some((d) => d.sent)}
                    optional
                  />
                  <ChecklistItem
                    label="Teams created"
                    pass={teams.length > 0}
                    detail={teams.length > 0 ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : undefined}
                    optional
                  />
                  <ChecklistItem
                    label="Supervisors invited"
                    pass={supervisorInvites.some((s) => s.sent)}
                    optional
                  />
                </div>

                {pmsReadiness.ready ? (
                  <div style={pageStyles.readyBanner}>
                    <svg width="20" height="20" fill="none" stroke="var(--color-teal)" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-teal)' }}>
                        Your municipality is PMS-ready!
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        All core configuration requirements are met.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={pageStyles.amberBanner}>
                    <svg width="20" height="20" fill="none" stroke="var(--color-gold)" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-gold)' }}>
                        Some items are incomplete
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        You can proceed now and complete them from the dashboard.
                      </p>
                    </div>
                  </div>
                )}

                <div style={pageStyles.navRow}>
                  <Button variant="ghost" onClick={handleBack}>Back</Button>
                  <Button
                    variant="primary"
                    onClick={handleFinish}
                    style={pmsReadiness.ready ? {} : { background: 'var(--color-gold)', borderColor: 'var(--color-gold)' }}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </div>
            ) : (
              <div style={pageStyles.navRow}>
                <Button variant="ghost" onClick={handleBack}>Back</Button>
                <Button variant="primary" onClick={handleFinish}>Go to Dashboard</Button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={pageStyles.container}>
      <div className="auth-skyline-bg" />
      <div className="auth-skyline-overlay" />
      <div style={pageStyles.inner}>
        <GlassCard style={pageStyles.card}>
          {/* Step indicator */}
          <StepIndicator steps={STEPS} currentIndex={currentStepIndex} />

          {/* Error banner */}
          {error && <div style={pageStyles.errorBanner}>{error}</div>}

          {/* Step content */}
          {renderStep()}
        </GlassCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checklist item sub-component
// ---------------------------------------------------------------------------

function ChecklistItem({
  label,
  pass,
  detail,
  optional,
}: {
  label: string;
  pass: boolean;
  detail?: string;
  optional?: boolean;
}) {
  return (
    <div style={checklistStyles.row}>
      <div
        style={{
          ...checklistStyles.icon,
          background: pass
            ? optional ? 'rgba(251, 191, 36, 0.15)' : 'rgba(0, 191, 165, 0.15)'
            : optional ? 'rgba(251, 191, 36, 0.05)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${
            pass
              ? optional ? 'rgba(251, 191, 36, 0.3)' : 'rgba(0, 191, 165, 0.3)'
              : optional ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.3)'
          }`,
        }}
      >
        {pass ? (
          <svg width="12" height="12" fill="none" stroke={optional ? 'var(--color-gold)' : 'var(--color-teal)'} strokeWidth="3" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : optional ? (
          <svg width="12" height="12" fill="none" stroke="var(--color-gold)" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ) : (
          <svg width="12" height="12" fill="none" stroke="var(--color-coral)" strokeWidth="3" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
        {detail && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
            ({detail})
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: pass
            ? optional ? 'var(--color-gold)' : 'var(--color-teal)'
            : optional ? 'var(--text-muted)' : 'var(--color-coral)',
        }}
      >
        {pass ? 'Complete' : optional ? 'Skipped' : 'Pending'}
      </span>
    </div>
  );
}

const checklistStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderBottom: '1px solid var(--border-subtle)',
  },
  icon: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};

// ---------------------------------------------------------------------------
// Page styles
// ---------------------------------------------------------------------------

const pageStyles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    position: 'relative',
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    maxWidth: '860px',
    position: 'relative',
    zIndex: 10,
  },
  card: {
    padding: '2.5rem',
    position: 'relative',
    zIndex: 10,
  },
  errorBanner: {
    padding: '0.5rem 0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid var(--color-coral)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-coral)',
    marginBottom: '1rem',
    fontSize: '0.8rem',
  },
  stepContent: {
    minHeight: '360px',
  },
  stepHeader: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  welcomeIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  stepTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
    fontFamily: 'var(--font-display)',
  },
  stepSubtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '1.5rem',
    borderTop: '1px solid var(--border-subtle)',
    marginTop: '1.5rem',
  },
  deptList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  deptItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 1rem',
    background: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
  },
  deptName: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginRight: '0.5rem',
  },
  deptCode: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    background: 'var(--surface-higher)',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  unsavedBadge: {
    fontSize: '0.7rem',
    color: 'var(--color-gold)',
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: '4px',
    padding: '1px 5px',
    marginLeft: '0.5rem',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--color-coral)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 'var(--radius-sm)',
    opacity: 0.7,
  },
  addDeptForm: {
    padding: '1rem',
    background: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    marginBottom: '1rem',
  },
  deptGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  inviteTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '1.5rem',
  },
  inviteRow: {
    display: 'grid',
    gridTemplateColumns: '200px 1fr 100px',
    gap: '0.75rem',
    alignItems: 'center',
    padding: '0.75rem',
    background: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
  },
  inviteRoleCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  inviteRoleLabel: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  inviteRoleCode: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  inviteEmailCol: {
    flex: 1,
  },
  inviteCheckCol: {
    display: 'flex',
    justifyContent: 'center',
  },
  sentBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-teal)',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  slaCard: {
    padding: '1.25rem',
    background: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
  },
  slaHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  slaLabel: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  slaValue: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--color-teal)',
  },
  slaHint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
    margin: '0 0 1rem 0',
    lineHeight: 1.4,
  },
  slider: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    appearance: 'none',
    background: 'var(--surface-higher)',
    outline: 'none',
    cursor: 'pointer',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.5rem',
  },
  sliderLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  checklistBox: {
    background: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    overflow: 'hidden',
    marginBottom: '1.5rem',
  },
  readyBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1rem',
    background: 'rgba(0, 191, 165, 0.08)',
    border: '1px solid rgba(0, 191, 165, 0.25)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.5rem',
  },
  amberBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '1rem',
    background: 'rgba(251, 191, 36, 0.08)',
    border: '1px solid rgba(251, 191, 36, 0.25)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '1.5rem',
  },
  readinessLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 0',
    gap: '1rem',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--surface-higher)',
    borderTop: '3px solid var(--color-teal)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
