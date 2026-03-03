/**
 * PmsSetupWizardPage — 5-step department setup wizard for PMS configuration.
 *
 * Route: /pms-setup (admin only)
 *
 * Steps:
 *  1. Municipality Settings  — category, demarcation code, SDBIP layers, scoring method
 *  2. Create Departments     — add departments (name + code) to the municipality
 *  3. Assign Directors       — select a section56_director for each department
 *  4. Map Ticket Categories  — route ticket categories to departments
 *  5. Review Organogram      — interactive tree + PMS readiness checklist
 *
 * Styling: uses CSS variables from @shared/design-tokens.css (no Tailwind).
 * Components: GlassCard, Button, Input from @shared.
 * Background: inherits skyline from DashboardLayout (no AnimatedGradientBg).
 *
 * State is saved to localStorage on each step. API submission only on final step.
 * API calls use Supabase session token (getAccessToken).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { useAuth } from '../hooks/useAuth';
import { usePageHeader } from '../hooks/usePageHeader';
import { OrganogramTree } from '../components/organogram/OrganogramTree';
import { PmsReadinessGate } from '../components/rbac/PmsReadinessGate';
import type { PmsChecklist } from '../components/rbac/PmsReadinessGate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Legacy OrgNode shape for D3-tree API data (OrganogramTree no longer exports this) */
interface OrgNode {
  name: string;
  attributes?: Record<string, string>;
  children?: OrgNode[];
}

interface Department {
  id: string;
  name: string;
  code: string;
  assigned_director_id: string | null;
  assigned_director_name: string | null;
  is_valid: boolean;
}

interface WizardStep {
  id: string;
  label: string;
}

const STEPS: WizardStep[] = [
  { id: 'settings', label: 'Municipality Settings' },
  { id: 'departments', label: 'Create Departments' },
  { id: 'directors', label: 'Assign Directors' },
  { id: 'categories', label: 'Map Categories' },
  { id: 'review', label: 'Review Organogram' },
];

const TICKET_CATEGORIES = [
  'water_supply',
  'electricity',
  'roads',
  'sanitation',
  'waste_collection',
  'community_safety',
  'housing',
  'public_spaces',
  'health_services',
  'other',
];

const SCORING_METHODS = ['percentage', 'absolute', 'binary', 'composite'];

const SDBIP_LAYER_OPTIONS = [1, 2, 3, 4, 5];

// ---------------------------------------------------------------------------
// StepIndicator sub-component
// ---------------------------------------------------------------------------

/** Horizontal stepper indicator shown at the top of the wizard. */
function StepIndicator({
  steps,
  currentIndex,
}: {
  steps: WizardStep[];
  currentIndex: number;
}) {
  return (
    <div style={stepStyles.container}>
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.id} style={stepStyles.stepWrapper}>
            {/* Circle + label */}
            <div style={stepStyles.stepColumn}>
              <div
                style={{
                  ...stepStyles.circle,
                  background: isCompleted
                    ? 'var(--color-teal)'
                    : isCurrent
                    ? 'rgba(0, 191, 165, 0.15)'
                    : 'var(--surface-elevated)',
                  border: isCurrent
                    ? '2px solid var(--color-teal)'
                    : isCompleted
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
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
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
    marginBottom: 'var(--space-xl)',
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
    transition: 'var(--transition-base)',
    flexShrink: 0,
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    transition: 'var(--transition-base)',
  },
  connector: {
    flex: 1,
    height: '2px',
    margin: '0 4px',
    marginBottom: '18px',
    transition: 'var(--transition-base)',
    borderRadius: '1px',
  },
};

// ---------------------------------------------------------------------------
// Shared form field styles
// ---------------------------------------------------------------------------

const fieldStyles: Record<string, React.CSSProperties> = {
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: 'var(--space-md)',
  },
  label: {
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  required: {
    color: 'var(--color-coral)',
    marginLeft: '4px',
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-body)',
    background: 'rgba(255, 255, 255, 0.18)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    outline: 'none',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    WebkitAppearance: 'none' as never,
    MozAppearance: 'none' as never,
    appearance: 'none' as never,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23e0d4d8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '38px',
  },
  selectOption: {
    background: 'rgba(255, 255, 255, 0.92)',
    color: '#1a1a2e',
    padding: '8px',
  },
  successMsg: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-teal)',
    fontWeight: 500,
    margin: '8px 0',
  },
  saveButton: {
    marginTop: '4px',
  },
  subSection: {
    padding: 'var(--space-md)',
    background: 'var(--surface-higher)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    marginTop: 'var(--space-md)',
  },
  subSectionTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    margin: '0 0 var(--space-sm) 0',
  },
  deptGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-sm)',
    marginBottom: 'var(--space-sm)',
  },
  deptList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 var(--space-md) 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  deptItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px var(--space-md)',
    background: 'var(--surface-elevated)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
  },
  deptName: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  deptCode: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  infoText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    margin: '0 0 var(--space-md) 0',
    lineHeight: 'var(--leading-relaxed)',
  },
  warningBox: {
    padding: '10px var(--space-md)',
    background: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.25)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-gold)',
  },
  categoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: '10px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  categoryLabel: {
    flex: 1,
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    fontWeight: 500,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 var(--space-sm) 0',
    fontFamily: 'var(--font-display)',
  },
  readyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-md)',
    background: 'rgba(0, 191, 165, 0.1)',
    border: '1px solid rgba(0, 191, 165, 0.25)',
    borderRadius: 'var(--radius-md)',
  },
  readyIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(0, 191, 165, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readyTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    color: 'var(--color-teal)',
    margin: '0 0 2px 0',
  },
  readySubtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-secondary)',
    margin: 0,
  },
};

// ---------------------------------------------------------------------------
// LocalStorage persistence key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pms-setup-wizard-draft';

interface WizardDraft {
  currentStep: number;
  settings: {
    category: 'A' | 'B' | 'C' | '';
    demarcation_code: string;
    sdbip_layers: number;
    scoring_method: string;
  };
  departments: Department[];
  directorMap: Record<string, string>;
  categoryMap: Record<string, string>;
}

function loadDraft(): WizardDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WizardDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: WizardDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Non-critical
  }
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

export function PmsSetupWizardPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  usePageHeader('PMS Department Setup');

  // Restore draft from localStorage on mount
  const draft = loadDraft();

  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state — municipality settings
  const [settings, setSettings] = useState(draft?.settings ?? {
    category: '' as 'A' | 'B' | 'C' | '',
    demarcation_code: '',
    sdbip_layers: 2,
    scoring_method: 'percentage',
  });

  // Step 2 state — departments
  const [departments, setDepartments] = useState<Department[]>(draft?.departments ?? []);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  // Step 3 state — director assignments
  const [directorMap, setDirectorMap] = useState<Record<string, string>>(draft?.directorMap ?? {});
  const [availableDirectors, setAvailableDirectors] = useState<{ id: string; full_name: string }[]>([]);

  // Step 4 state — ticket category mapping
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(draft?.categoryMap ?? {});

  // Step 5 state — organogram + readiness
  const [organogramData, setOrganogramData] = useState<OrgNode | null>(null);
  const [readiness, setReadiness] = useState<PmsChecklist | null>(null);

  // ---------------------------------------------------------------------------
  // Auto-save to localStorage whenever wizard state changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    saveDraft({ currentStep, settings, departments, directorMap, categoryMap });
  }, [currentStep, settings, departments, directorMap, categoryMap]);

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------

  const apiHeaders = useCallback((): Record<string, string> => {
    const token = getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getAccessToken]);

  const apiCall = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`/api/v1${path}`, {
        ...options,
        headers: { ...apiHeaders(), ...(options.headers as Record<string, string> | undefined) },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail));
      }
      return response.json();
    },
    [apiHeaders],
  );

  // ---------------------------------------------------------------------------
  // Step 2: Create department (live API call — departments need server IDs)
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

    setIsLoading(true);
    setError(null);
    try {
      const created: Department = await apiCall('/departments/', {
        method: 'POST',
        body: JSON.stringify({ name, code }),
      });
      setDepartments((prev) => [...prev, created]);
      setNewDeptName('');
      setNewDeptCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3: Load available directors
  // ---------------------------------------------------------------------------

  async function loadDirectors() {
    try {
      const data = await apiCall('/departments/');
      setAvailableDirectors([]);
      const map: Record<string, string> = {};
      (data as Department[]).forEach((dept: Department) => {
        if (dept.assigned_director_id) {
          map[dept.id] = dept.assigned_director_id;
        }
      });
      setDirectorMap((prev) => ({ ...map, ...prev }));
    } catch {
      // Non-critical
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: Load organogram and readiness
  // ---------------------------------------------------------------------------

  async function loadOrganogramAndReadiness() {
    setIsLoading(true);
    setError(null);
    try {
      const [orgData, readinessData] = await Promise.all([
        apiCall('/departments/organogram'),
        apiCall('/departments/pms-readiness'),
      ]);

      function toD3Node(node: {
        name: string;
        director_name?: string | null;
        director_role?: string | null;
        children?: unknown[];
      }): OrgNode {
        return {
          name: node.name,
          attributes: {
            ...(node.director_name ? { director: node.director_name } : {}),
            ...(node.director_role ? { role: node.director_role } : {}),
          },
          children: node.children
            ? (node.children as Parameters<typeof toD3Node>[0][]).map(toD3Node)
            : [],
        };
      }

      const roots = Array.isArray(orgData) ? orgData : [orgData];
      const d3Root: OrgNode =
        roots.length === 1
          ? toD3Node(roots[0])
          : {
              name: 'Municipality',
              attributes: {},
              children: roots.map(toD3Node),
            };

      setOrganogramData(d3Root);
      setReadiness(readinessData as PmsChecklist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organogram data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (currentStep === 4) {
      loadOrganogramAndReadiness();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentStep === 2) {
      loadDirectors();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Final submission — all API calls happen here
  // ---------------------------------------------------------------------------

  async function handleCompleteSetup() {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Save municipality settings & lock
      await apiCall('/municipalities/settings', {
        method: 'PUT',
        body: JSON.stringify({
          category: settings.category,
          demarcation_code: settings.demarcation_code || null,
          sdbip_layers: settings.sdbip_layers,
          scoring_method: settings.scoring_method,
        }),
      });
      await apiCall('/municipalities/settings/lock', { method: 'POST' });

      // 2. Assign directors
      const directorUpdates = Object.entries(directorMap).filter(([, dirId]) => dirId);
      await Promise.all(
        directorUpdates.map(([deptId, dirId]) =>
          apiCall(`/departments/${deptId}`, {
            method: 'PUT',
            body: JSON.stringify({ assigned_director_id: dirId }),
          }),
        ),
      );

      // 3. Save category mappings
      const mappings = Object.entries(categoryMap).filter(([, deptId]) => deptId);
      await Promise.all(
        mappings.map(([category, departmentId]) =>
          apiCall('/departments/ticket-category-map', {
            method: 'POST',
            body: JSON.stringify({ ticket_category: category, department_id: departmentId }),
          }).catch(() => {
            // Ignore 409 conflicts (already mapped)
          }),
        ),
      );

      // Clear draft on successful submission
      clearDraft();
      navigate('/settings');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation — saves to localStorage only, no API calls
  // ---------------------------------------------------------------------------

  function handleNext() {
    setError(null);

    // Step-specific validation (local only)
    if (currentStep === 0 && !settings.category) {
      setError('Please select a municipality category (A, B, or C).');
      return;
    }
    if (currentStep === 1 && departments.length === 0) {
      setError('Please create at least one department before proceeding.');
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function handleBack() {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  // ---------------------------------------------------------------------------
  // Render steps
  // ---------------------------------------------------------------------------

  function renderStep() {
    switch (currentStep) {

      // Step 1: Municipality Settings
      case 0:
        return (
          <div>
            <div style={fieldStyles.group}>
              <label style={fieldStyles.label}>
                Municipality Category
                <span style={fieldStyles.required}>*</span>
              </label>
              <Select
                value={settings.category}
                onChange={(value) => setSettings((s) => ({ ...s, category: value as 'A' | 'B' | 'C' }))}
                options={[
                  { value: '', label: 'Select category...' },
                  { value: 'A', label: 'A — Metro Municipality' },
                  { value: 'B', label: 'B — Local Municipality' },
                  { value: 'C', label: 'C — District Municipality' },
                ]}
                size="md"
              />
            </div>

            <div style={fieldStyles.group}>
              <Input
                label="Demarcation Code"
                type="text"
                placeholder="e.g. WC011"
                value={settings.demarcation_code}
                onChange={(e) => setSettings((s) => ({ ...s, demarcation_code: e.target.value }))}
              />
            </div>

            <div style={fieldStyles.group}>
              <label style={fieldStyles.label}>SDBIP Layers</label>
              <Select
                value={String(settings.sdbip_layers)}
                onChange={(value) => setSettings((s) => ({ ...s, sdbip_layers: parseInt(value, 10) }))}
                options={SDBIP_LAYER_OPTIONS.map((n) => ({ value: String(n), label: `${n} layer${n !== 1 ? 's' : ''}` }))}
                size="md"
              />
            </div>

            <div style={fieldStyles.group}>
              <label style={fieldStyles.label}>Scoring Method</label>
              <Select
                value={settings.scoring_method}
                onChange={(value) => setSettings((s) => ({ ...s, scoring_method: value }))}
                options={SCORING_METHODS.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) }))}
                size="md"
              />
            </div>
          </div>
        );

      // Step 2: Create Departments
      case 1:
        return (
          <div>
            {/* Existing departments list */}
            {departments.length > 0 && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <p style={{ ...fieldStyles.label, marginBottom: '8px' }}>
                  Departments added ({departments.length}):
                </p>
                <ul style={fieldStyles.deptList}>
                  {departments.map((dept) => (
                    <li key={dept.id} style={fieldStyles.deptItem}>
                      <span style={fieldStyles.deptName}>{dept.name}</span>
                      <span style={fieldStyles.deptCode}>{dept.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add department form */}
            <div style={fieldStyles.subSection}>
              <p style={fieldStyles.subSectionTitle}>Add Department</p>
              <div style={fieldStyles.deptGrid}>
                <Input
                  label="Department Name"
                  type="text"
                  placeholder="e.g. Finance"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                />
                <Input
                  label="Code (uppercase)"
                  type="text"
                  placeholder="e.g. FIN"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace' }}
                />
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
          </div>
        );

      // Step 3: Assign Directors
      case 2:
        return (
          <div>
            <p style={fieldStyles.infoText}>
              Assign a Section 56 Director to each department. Enter the user ID of the director.
              {availableDirectors.length > 0 && ' Or select from the list below.'}
            </p>

            {departments.length === 0 ? (
              <div style={fieldStyles.warningBox}>
                No departments found. Go back and create departments first.
              </div>
            ) : (
              <ul style={fieldStyles.deptList}>
                {departments.map((dept) => (
                  <li key={dept.id} style={{ ...fieldStyles.deptItem, flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                      <p style={fieldStyles.deptName}>{dept.name}</p>
                      <p style={fieldStyles.deptCode}>{dept.code}</p>
                    </div>
                    {availableDirectors.length > 0 ? (
                      <Select
                        value={directorMap[dept.id] ?? ''}
                        onChange={(value) =>
                          setDirectorMap((prev) => ({ ...prev, [dept.id]: value }))
                        }
                        options={[
                          { value: '', label: 'No director assigned' },
                          ...availableDirectors.map((dir) => ({ value: dir.id, label: dir.full_name })),
                        ]}
                        size="md"
                      />
                    ) : (
                      <Input
                        type="text"
                        placeholder="Director User ID (UUID)"
                        value={directorMap[dept.id] ?? ''}
                        onChange={(e) =>
                          setDirectorMap((prev) => ({ ...prev, [dept.id]: e.target.value }))
                        }
                        style={{ fontFamily: 'monospace', minWidth: '260px' }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      // Step 4: Map Ticket Categories
      case 3:
        return (
          <div>
            <p style={fieldStyles.infoText}>
              Map each ticket category to a department. Unmapped categories will be routed to the default queue.
            </p>

            {departments.length === 0 ? (
              <div style={fieldStyles.warningBox}>
                No departments found. Go back and create departments first.
              </div>
            ) : (
              <div>
                {TICKET_CATEGORIES.map((cat) => (
                  <div key={cat} style={fieldStyles.categoryRow}>
                    <span style={fieldStyles.categoryLabel}>
                      {cat.replace(/_/g, ' ')}
                    </span>
                    <Select
                      value={categoryMap[cat] ?? ''}
                      onChange={(value) =>
                        setCategoryMap((prev) => ({ ...prev, [cat]: value }))
                      }
                      options={[
                        { value: '', label: 'Not mapped' },
                        ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
                      ]}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // Step 5: Review Organogram
      case 4:
        return (
          <div>
            {/* Organogram */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 style={fieldStyles.sectionTitle}>Department Organogram</h3>
              {isLoading ? (
                <div style={{
                  height: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                  background: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  Loading organogram...
                </div>
              ) : organogramData ? (
                <OrganogramTree data={organogramData} />
              ) : (
                <div style={{
                  height: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                  background: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  No departments to display.
                </div>
              )}
            </div>

            {/* PMS Readiness */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <h3 style={fieldStyles.sectionTitle}>PMS Readiness</h3>
              {readiness ? (
                readiness.is_ready ? (
                  <div style={fieldStyles.readyBox}>
                    <div style={fieldStyles.readyIcon}>
                      <svg width="18" height="18" fill="none" stroke="var(--color-teal)" strokeWidth={2.5} viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <p style={fieldStyles.readyTitle}>PMS Ready</p>
                      <p style={fieldStyles.readySubtitle}>All configuration requirements are met.</p>
                    </div>
                  </div>
                ) : (
                  <PmsReadinessGate
                    checklist={readiness}
                    onConfigureClick={() => setCurrentStep(0)}
                  />
                )
              ) : (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Loading readiness status...
                </div>
              )}
            </div>

            {/* Complete Setup button — final submission */}
            <Button
              variant="primary"
              onClick={handleCompleteSetup}
              disabled={isLoading}
              loading={isLoading}
              style={{ width: '100%' }}
            >
              {isLoading ? 'Submitting...' : 'Complete Setup'}
            </Button>
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
      <div style={pageStyles.content}>
        {/* Stepper */}
        <StepIndicator steps={STEPS} currentIndex={currentStep} />

        {/* Wizard card */}
        <GlassCard style={pageStyles.card}>
          {/* Step header */}
          <div style={pageStyles.stepHeader}>
            <h2 style={pageStyles.stepTitle}>
              Step {currentStep + 1}: {STEPS[currentStep].label}
            </h2>
          </div>

          {/* Step content */}
          <div style={pageStyles.stepContent}>
            {renderStep()}
          </div>

          {/* Error message */}
          {error && (
            <div style={pageStyles.errorBox}>
              <p style={pageStyles.errorText}>{error}</p>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={pageStyles.navigation}>
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>

            {currentStep < STEPS.length - 1 && (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={isLoading}
                loading={isLoading}
              >
                Next
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

const pageStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 'var(--space-xl) var(--space-lg)',
  },
  content: {
    width: '100%',
    maxWidth: '720px',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    marginBottom: 'var(--space-xl)',
    textAlign: 'center',
  },
  title: {
    fontSize: 'var(--text-h3)',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  card: {
    padding: 'var(--space-xl) var(--space-2xl)',
  },
  stepHeader: {
    marginBottom: 'var(--space-lg)',
    paddingBottom: 'var(--space-md)',
    borderBottom: '1px solid var(--border-subtle)',
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: 'var(--text-h4)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  stepContent: {
    minHeight: '300px',
    marginBottom: 'var(--space-lg)',
  },
  errorBox: {
    padding: '10px var(--space-md)',
    background: 'rgba(255, 107, 74, 0.1)',
    border: '1px solid rgba(255, 107, 74, 0.25)',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 'var(--space-md)',
  },
  errorText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-coral)',
    margin: 0,
  },
  navigation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 'var(--space-lg)',
    borderTop: '1px solid var(--border-subtle)',
  },
};
