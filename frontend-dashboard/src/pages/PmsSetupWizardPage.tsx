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
 * State is local (useState). Each step validates before "Next" is enabled.
 * API calls use Supabase session token (getAccessToken).
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { OrganogramTree } from '../components/organogram/OrganogramTree';
import type { OrgNode } from '../components/organogram/OrganogramTree';
import { PmsReadinessGate } from '../components/rbac/PmsReadinessGate';
import type { PmsChecklist } from '../components/rbac/PmsReadinessGate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Sub-components
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
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div key={step.id} className="flex items-center flex-1">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-300
                  ${isCompleted
                    ? 'bg-teal-600 text-white'
                    : isCurrent
                    ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-600'
                    : 'bg-gray-100 text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={`
                  mt-1.5 text-xs font-medium text-center whitespace-nowrap
                  ${isCurrent ? 'text-teal-700' : isCompleted ? 'text-teal-600' : 'text-gray-400'}
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`
                  flex-1 h-0.5 mx-2 transition-all duration-300
                  ${isCompleted ? 'bg-teal-600' : 'bg-gray-200'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard page
// ---------------------------------------------------------------------------

export function PmsSetupWizardPage() {
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 state — municipality settings
  const [settings, setSettings] = useState({
    category: '' as 'A' | 'B' | 'C' | '',
    demarcation_code: '',
    sdbip_layers: 2,
    scoring_method: 'percentage',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Step 2 state — departments
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCode, setNewDeptCode] = useState('');

  // Step 3 state — director assignments
  // directorMap: { [departmentId]: userId }
  const [directorMap, setDirectorMap] = useState<Record<string, string>>({});
  // Available directors (users with section56_director or higher)
  const [availableDirectors, setAvailableDirectors] = useState<{ id: string; full_name: string }[]>([]);

  // Step 4 state — ticket category mapping
  // categoryMap: { [category]: departmentId }
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

  // Step 5 state — organogram + readiness
  const [organogramData, setOrganogramData] = useState<OrgNode | null>(null);
  const [readiness, setReadiness] = useState<PmsChecklist | null>(null);

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
  // Step 1: Save municipality settings
  // ---------------------------------------------------------------------------

  async function handleSaveSettings() {
    if (!settings.category) {
      setError('Please select a municipality category (A, B, or C).');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Update settings
      await apiCall('/municipalities/settings', {
        method: 'PUT',
        body: JSON.stringify({
          category: settings.category,
          demarcation_code: settings.demarcation_code || null,
          sdbip_layers: settings.sdbip_layers,
          scoring_method: settings.scoring_method,
        }),
      });
      // Lock settings
      await apiCall('/municipalities/settings/lock', { method: 'POST' });
      setSettingsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  }

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
  // Step 3: Load available directors and save assignments
  // ---------------------------------------------------------------------------

  async function loadDirectors() {
    try {
      // Fetch users — in a real implementation this would filter by Tier 2+ roles.
      // For the wizard we simply use the members endpoint as a source of users.
      const data = await apiCall('/departments/');
      // We only need existing departments list for the map; directors come from a separate endpoint.
      // Since there is no dedicated "list users by role" endpoint yet, we use empty list as default
      // and let admins type an ID. This is a Phase 27 placeholder.
      setAvailableDirectors([]);
      // Populate directorMap from already-assigned directors
      const map: Record<string, string> = {};
      (data as Department[]).forEach((dept: Department) => {
        if (dept.assigned_director_id) {
          map[dept.id] = dept.assigned_director_id;
        }
      });
      setDirectorMap(map);
    } catch {
      // Non-critical: wizard still usable without director list
    }
  }

  async function handleAssignDirectors() {
    setIsLoading(true);
    setError(null);
    try {
      // Update each department that has a director selection
      const updates = Object.entries(directorMap).filter(([, dirId]) => dirId);
      await Promise.all(
        updates.map(([deptId, dirId]) =>
          apiCall(`/departments/${deptId}`, {
            method: 'PUT',
            body: JSON.stringify({ assigned_director_id: dirId }),
          }),
        ),
      );
      // Refresh departments list
      const refreshed: Department[] = await apiCall('/departments/');
      setDepartments(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign directors');
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 4: Save category-to-department mappings
  // ---------------------------------------------------------------------------

  async function handleSaveCategoryMappings() {
    setIsLoading(true);
    setError(null);
    try {
      const mappings = Object.entries(categoryMap).filter(([, deptId]) => deptId);
      // Save each mapping individually (endpoint enforces 1:1 per tenant)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category mappings');
    } finally {
      setIsLoading(false);
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

      // Convert backend OrganogramNode to react-d3-tree OrgNode
      // Backend: [{id, name, code, director_name, director_role, children:[...]}]
      // react-d3-tree: {name, attributes:{...}, children:[...]}
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

      // Wrap multiple roots in a virtual "Municipality" root for the tree
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

  // Load organogram when reaching Step 5
  useEffect(() => {
    if (currentStep === 4) {
      loadOrganogramAndReadiness();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load directors list when reaching Step 3
  useEffect(() => {
    if (currentStep === 2) {
      loadDirectors();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  async function handleNext() {
    setError(null);

    if (currentStep === 0) {
      // Must save settings before advancing
      if (!settingsSaved) {
        await handleSaveSettings();
        if (error) return;
      }
    } else if (currentStep === 1) {
      // Must have at least 1 department
      if (departments.length === 0) {
        setError('Please create at least one department before proceeding.');
        return;
      }
    } else if (currentStep === 2) {
      // Save director assignments (non-blocking — partial saves are ok)
      await handleAssignDirectors();
    } else if (currentStep === 3) {
      // Save category mappings (best-effort)
      await handleSaveCategoryMappings();
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
      // -----------------------------------------------------------------------
      // Step 1: Municipality Settings
      // -----------------------------------------------------------------------
      case 0:
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Municipality Category <span className="text-red-500">*</span>
              </label>
              <select
                value={settings.category}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, category: e.target.value as 'A' | 'B' | 'C' }));
                  setSettingsSaved(false);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select category...</option>
                <option value="A">A — Metro Municipality</option>
                <option value="B">B — Local Municipality</option>
                <option value="C">C — District Municipality</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Demarcation Code
              </label>
              <input
                type="text"
                placeholder="e.g. WC011"
                value={settings.demarcation_code}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, demarcation_code: e.target.value }));
                  setSettingsSaved(false);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SDBIP Layers
              </label>
              <select
                value={settings.sdbip_layers}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, sdbip_layers: parseInt(e.target.value, 10) }));
                  setSettingsSaved(false);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {SDBIP_LAYER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} layer{n !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scoring Method
              </label>
              <select
                value={settings.scoring_method}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, scoring_method: e.target.value }));
                  setSettingsSaved(false);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {SCORING_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {settingsSaved && (
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Settings saved and locked
              </div>
            )}

            <button
              onClick={handleSaveSettings}
              disabled={isLoading || !settings.category}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : settingsSaved ? 'Saved' : 'Save Settings'}
            </button>
          </div>
        );

      // -----------------------------------------------------------------------
      // Step 2: Create Departments
      // -----------------------------------------------------------------------
      case 1:
        return (
          <div className="space-y-5">
            {/* Existing departments list */}
            {departments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Departments added ({departments.length}):
                </p>
                <ul className="space-y-1">
                  {departments.map((dept) => (
                    <li
                      key={dept.id}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <span className="font-medium text-gray-800">{dept.name}</span>
                      <span className="text-xs text-gray-500 font-mono">{dept.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add department form */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Add Department</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Department Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Finance"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Code (uppercase)</label>
                  <input
                    type="text"
                    placeholder="e.g. FIN"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateDepartment}
                disabled={isLoading || !newDeptName.trim() || !newDeptCode.trim()}
                className="px-4 py-1.5 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : '+ Add Department'}
              </button>
            </div>
          </div>
        );

      // -----------------------------------------------------------------------
      // Step 3: Assign Directors
      // -----------------------------------------------------------------------
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Assign a Section 56 Director to each department. Enter the user ID of the director.
              {availableDirectors.length > 0 && ' Or select from the list below.'}
            </p>

            {departments.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                No departments found. Go back and create departments first.
              </p>
            ) : (
              <ul className="space-y-3">
                {departments.map((dept) => (
                  <li key={dept.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{dept.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{dept.code}</p>
                    </div>
                    {availableDirectors.length > 0 ? (
                      <select
                        value={directorMap[dept.id] ?? ''}
                        onChange={(e) =>
                          setDirectorMap((prev) => ({ ...prev, [dept.id]: e.target.value }))
                        }
                        className="text-sm rounded-md border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">No director assigned</option>
                        {availableDirectors.map((dir) => (
                          <option key={dir.id} value={dir.id}>
                            {dir.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Director User ID (UUID)"
                        value={directorMap[dept.id] ?? ''}
                        onChange={(e) =>
                          setDirectorMap((prev) => ({ ...prev, [dept.id]: e.target.value }))
                        }
                        className="text-sm rounded-md border border-gray-300 px-2 py-1.5 w-64 font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      // -----------------------------------------------------------------------
      // Step 4: Map Ticket Categories
      // -----------------------------------------------------------------------
      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Map each ticket category to a department. Unmapped categories will be routed to
              the default queue.
            </p>

            {departments.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                No departments found. Go back and create departments first.
              </p>
            ) : (
              <ul className="space-y-2">
                {TICKET_CATEGORIES.map((cat) => (
                  <li key={cat} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                    <span className="flex-1 text-sm text-gray-800 font-medium capitalize">
                      {cat.replace(/_/g, ' ')}
                    </span>
                    <select
                      value={categoryMap[cat] ?? ''}
                      onChange={(e) =>
                        setCategoryMap((prev) => ({ ...prev, [cat]: e.target.value }))
                      }
                      className="text-sm rounded-md border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Not mapped</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      // -----------------------------------------------------------------------
      // Step 5: Review Organogram
      // -----------------------------------------------------------------------
      case 4:
        return (
          <div className="space-y-6">
            {/* Organogram */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">
                Department Organogram
              </h3>
              {isLoading ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  Loading organogram...
                </div>
              ) : organogramData ? (
                <OrganogramTree data={organogramData} />
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  No departments to display.
                </div>
              )}
            </div>

            {/* PMS Readiness */}
            <div>
              <h3 className="text-base font-semibold text-gray-800 mb-3">
                PMS Readiness
              </h3>
              {readiness ? (
                readiness.is_ready ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">PMS Ready</p>
                      <p className="text-xs text-green-600">All configuration requirements are met.</p>
                    </div>
                  </div>
                ) : (
                  <PmsReadinessGate
                    checklist={readiness}
                    onConfigureClick={() => setCurrentStep(0)}
                  />
                )
              ) : (
                <div className="text-sm text-gray-400">Loading readiness status...</div>
              )}
            </div>

            {/* Complete Setup button */}
            {readiness?.is_ready && (
              <button
                onClick={() => navigate('/settings')}
                className="w-full py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 font-semibold text-sm transition-colors"
              >
                Complete Setup
              </button>
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
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">PMS Department Setup</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure your municipality's department structure for Performance Management.
        </p>
      </div>

      {/* Stepper */}
      <StepIndicator steps={STEPS} currentIndex={currentStep} />

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Step header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Step {currentStep + 1}: {STEPS[currentStep].label}
          </h2>
        </div>

        {/* Step content */}
        {renderStep()}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={isLoading}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold disabled:opacity-50"
            >
              {isLoading ? 'Please wait...' : 'Next'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
