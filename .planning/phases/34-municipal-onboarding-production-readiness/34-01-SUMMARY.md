---
phase: 34-municipal-onboarding-production-readiness
plan: "01"
subsystem: frontend-dashboard
tags: [ui, layout, header-alignment, settings, rbac, roles]
dependency_graph:
  requires: []
  provides:
    - DashboardLayout paddingTop fixed to 48px (inherited by all pages)
    - Consistent 48px header rows across all 14 dashboard pages
    - SettingsPage visible to 10 PMS roles (not just admin/manager)
    - SettingsPage error fallback banner
  affects:
    - frontend-dashboard/src/components/layout/DashboardLayout.tsx
    - All 14 pages that inherit DashboardLayout paddingTop
tech_stack:
  added: []
  patterns:
    - "minHeight: 48px + padding: var(--space-md) 0 for all page header rows"
    - "MANAGER_ROLES array pattern for role checks in SettingsPage"
    - "loadError banner: rgba(239,68,68,0.1) background, inline in sections container"
key_files:
  created: []
  modified:
    - frontend-dashboard/src/components/layout/DashboardLayout.tsx
    - frontend-dashboard/src/pages/DashboardPage.tsx
    - frontend-dashboard/src/pages/AnalyticsPage.tsx
    - frontend-dashboard/src/pages/TeamsPage.tsx
    - frontend-dashboard/src/pages/TicketListPage.tsx
    - frontend-dashboard/src/pages/DepartmentsPage.tsx
    - frontend-dashboard/src/pages/CFODashboardPage.tsx
    - frontend-dashboard/src/pages/MunicipalManagerDashboardPage.tsx
    - frontend-dashboard/src/pages/MayorDashboardPage.tsx
    - frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx
    - frontend-dashboard/src/pages/OversightDashboardPage.tsx
    - frontend-dashboard/src/pages/Section56DirectorDashboardPage.tsx
    - frontend-dashboard/src/pages/PmsHubPage.tsx
    - frontend-dashboard/src/pages/RoleApprovalsPage.tsx
    - frontend-dashboard/src/pages/SettingsPage.tsx
decisions:
  - "paddingTop changed from calc(48px + 32px) to 48px — removes 32px dead zone between notification bell header and page content"
  - "MANAGER_ROLES array in SettingsPage — 10 roles can now see settings sections (admin, salga_admin, manager, municipal_manager, executive_mayor, cfo, speaker, pms_officer, section56_director, department_manager)"
  - "Tier 4 oversight roles (audit_committee_member, internal_auditor, mpac_member) intentionally excluded from MANAGER_ROLES — they have no settings management responsibilities"
  - "SettingsPage header row added (h1 + flex) — Settings page now has an h1 title row aligning with the 48px bell bar"
  - "PmsHubPage uses toolbar pattern (not standard header) — minHeight 48px + paddingTop on toolbar element instead of dedicated header row"
  - "StatutoryReportsPage not updated — it is embedded inside PmsHubPage and has no top-level header row; PmsHubPage toolbar handles alignment"
  - "loadError banner is conditional on useSettings error state — currently always null (hook uses mocks on failure) but infrastructure in place for future error surfacing"
metrics:
  duration_minutes: 20
  completed_date: "2026-03-02"
  tasks_completed: 3
  files_modified: 15
---

# Phase 34 Plan 01: Header Alignment Fix and Settings Role Expansion Summary

**One-liner:** DashboardLayout 48px paddingTop fix propagated to all 14 pages, SettingsPage role check expanded from 2 roles to 10 using MANAGER_ROLES array with error fallback banner.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1a | Fix DashboardLayout paddingTop + 5 core page header rows | 476bd84 | DashboardLayout.tsx, DashboardPage.tsx, AnalyticsPage.tsx, TeamsPage.tsx, TicketListPage.tsx, DepartmentsPage.tsx |
| 1b | Update 9 PMS/role-dashboard page header rows | 29a68d8 | CFODashboardPage, MunicipalManagerDashboardPage, MayorDashboardPage, SALGAAdminDashboardPage, OversightDashboardPage, Section56DirectorDashboardPage, PmsHubPage, RoleApprovalsPage |
| 2 | Fix SettingsPage role check and add error fallback UI | b111836 | SettingsPage.tsx |

## What Was Built

### Task 1a: DashboardLayout paddingTop Fix
Changed `main` element `paddingTop` from `'calc(48px + var(--space-2xl, 32px))'` (80px) to `'48px'`. This removes the 32px dead zone that separated the notification bell header from page content. All 14 pages inherit this fix automatically.

Updated 5 core page header rows to use `display: 'flex', alignItems: 'center', minHeight: '48px', padding: 'var(--space-md) 0'`:
- DashboardPage (styles.header object)
- AnalyticsPage (styles.header object)
- TeamsPage (styles.header object)
- TicketListPage (inline header div)
- DepartmentsPage (inline header div)

### Task 1b: PMS/Role-Dashboard Header Rows
Applied the same `minHeight: '48px', padding: 'var(--space-md) 0'` pattern to all 9 remaining pages:
- CFODashboardPage, MunicipalManagerDashboardPage, MayorDashboardPage, SALGAAdminDashboardPage — each uses `styles.header` object
- OversightDashboardPage, Section56DirectorDashboardPage — `styles.header` object
- PmsHubPage — no standard header (uses toolbar dropdown); added `minHeight: '48px', paddingTop: 'var(--space-md)'` to `styles.toolbar`
- RoleApprovalsPage — inline header div converted to flex with `minHeight: '48px', padding: 'var(--space-md) 0'`

StatutoryReportsPage: not updated — it is an embedded component within PmsHubPage with no top-level page header of its own.

### Task 2: SettingsPage Role Check Fix + Error Fallback
**Role check expanded:**
```typescript
const ADMIN_ROLES = ['admin', 'salga_admin'];
const MANAGER_ROLES = [
  'admin', 'salga_admin', 'manager', 'municipal_manager',
  'executive_mayor', 'cfo', 'speaker', 'pms_officer',
  'section56_director', 'department_manager',
];
const isAdmin = ADMIN_ROLES.includes(role);
const isManager = MANAGER_ROLES.includes(role);
```

**Error fallback banner:**
```typescript
{loadError && (
  <div style={{ /* red 0.1 alpha bg, 0.3 alpha border */ }}>
    Some settings could not be loaded. Displaying available configuration.
  </div>
)}
```

**Page header row added** before the anchor nav, with `minHeight: '48px'` and h1 "Settings" title.

**Infrastructure:** `loadError = settingsError` from `useSettings()` hook — currently always null because hook falls back to mocks on API failure, but the banner infrastructure is wired for when errors surface.

## Deviations from Plan

None — plan executed exactly as written with one clarification:

- **StatutoryReportsPage:** Not updated as it has no standalone top-level header (embedded component). PmsHubPage toolbar handles the alignment at the container level. This is the correct interpretation per the plan note about PmsHubPage starting with a dropdown toolbar.

## Self-Check

### Files Exist
- [x] frontend-dashboard/src/components/layout/DashboardLayout.tsx — paddingTop: '48px'
- [x] frontend-dashboard/src/pages/SettingsPage.tsx — MANAGER_ROLES includes 10 roles

### Commits Exist
- [x] 476bd84 — feat(34-01): fix DashboardLayout paddingTop and 5 core page header rows
- [x] 29a68d8 — feat(34-01): update 9 PMS/role-dashboard page header rows to align with bell bar
- [x] b111836 — feat(34-01): fix SettingsPage role check and add error fallback UI

## Self-Check: PASSED
