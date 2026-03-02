---
phase: 31-role-specific-dashboards
plan: "06"
subsystem: frontend-dashboard
tags: [navigation, rbac, pms-hub, sec-05, oversight-roles, ward-councillor, salga-admin]
dependency_graph:
  requires: [31-01, 31-02, 31-03, 31-04, 31-05]
  provides: [fixed-oversight-nav, pms-read-only-mode, municipalities-page, system-page]
  affects: [frontend-dashboard]
tech_stack:
  added: []
  patterns:
    - READ_ONLY_ROLES constant gates PMS Hub Create buttons for non-editor roles
    - Inline placeholder page components in App.tsx for deferred features
    - pmsNavItem reused across oversight and ward councillor nav entries
key_files:
  modified:
    - frontend-dashboard/src/hooks/useRoleBasedNav.ts
    - frontend-dashboard/src/pages/PmsHubPage.tsx
    - frontend-dashboard/src/App.tsx
decisions:
  - READ_ONLY_ROLES explicit allowlist in PmsHubPage — clearer intent than checking absence from ADMIN_ROLES
  - Placeholder pages as inline functions in App.tsx — small enough to not warrant separate files
  - Statutory Reports nav item links directly to /pms?view=statutory-reports — deeplink into PMS Hub
  - speaker retains /reports nav (pre-existing, not in scope for this plan's SEC-05 fix)
metrics:
  duration: 11 minutes
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_modified: 3
requirements: [DASH-07, DASH-08, DASH-09, DASH-10, DASH-11, DASH-12]
---

# Phase 31 Plan 06: Navigation Fixes, PMS Read-Only Mode, and Placeholder Pages Summary

**One-liner:** Fixed SEC-05 nav violation for 3 oversight roles, added PMS read-only mode for 8 non-editor roles, and replaced 2 "Coming Soon" placeholder routes with mock content pages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix sidebar nav for oversight roles and ward councillor | 23a7807 | frontend-dashboard/src/hooks/useRoleBasedNav.ts |
| 2 | PMS Hub read-only mode + replace "Coming Soon" placeholders | 4729303 | frontend-dashboard/src/pages/PmsHubPage.tsx, frontend-dashboard/src/App.tsx |

## What Was Built

### Task 1: Nav Fixes (useRoleBasedNav.ts)

**Oversight roles** (`audit_committee_member`, `internal_auditor`, `mpac_member`):
- Removed `/reports` (SAPSReportsPage = GBV cases — SEC-05 violation for non-saps_liaison)
- Removed `/audit` (no route exists for `/audit`)
- Added `pmsNavItem` (Performance, `/pms`) for read-only PMS Hub access
- Added `Statutory Reports` (`/pms?view=statutory-reports`) direct deeplink

**Ward councillor / chief_whip**:
- Kept `My Ward Tickets` (`/tickets`)
- Replaced `Ward Analytics` (`/analytics`, v1) with `pmsNavItem` + `Statutory Reports` (v2 pattern)

### Task 2: PMS Hub Read-Only Mode (PmsHubPage.tsx)

Added `READ_ONLY_ROLES` constant:
```typescript
const READ_ONLY_ROLES = [
  'salga_admin', 'audit_committee_member', 'internal_auditor', 'mpac_member',
  'ward_councillor', 'chief_whip', 'speaker', 'citizen',
];
```

Added `isReadOnly` boolean and gated Create button: `{currentOption.createLabel && !isReadOnly && (...)}`

### Task 2: Placeholder Pages (App.tsx)

**MunicipalitiesPlaceholderPage**: Table showing 6 SA municipalities (eThekwini, Tshwane, Mangaung, Nelson Mandela Bay, Buffalo City, Sol Plaatje) with province, category, status badge (teal/gold), and population. Glassmorphism table using CSS variables.

**SystemPlaceholderPage**: Health metrics grid (API Status, Database, Redis, Celery Workers, Storage, Last Backup) plus Configuration table (Platform Version, Tenant Mode, Auth Provider, AI Engine, Timezone, PMS Module). Uses CSS variables per Phase 27-03 lock.

Both routes updated: `/municipalities` and `/system` now render these pages instead of "Coming Soon" divs.

## Verification Results

1. `npm run build:check` (tsc --noEmit): PASS — no TypeScript errors
2. `npm run build`: PASS — production build succeeds (1449 modules, chunk size warning pre-existing)
3. useRoleBasedNav.ts oversight roles: no `/reports` or `/audit` nav items
4. useRoleBasedNav.ts ward_councillor/chief_whip: includes `pmsNavItem`
5. PmsHubPage.tsx: `READ_ONLY_ROLES` array exists, `!isReadOnly` gates Create button
6. App.tsx `/municipalities`: renders `MunicipalitiesPlaceholderPage`
7. App.tsx `/system`: renders `SystemPlaceholderPage`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- frontend-dashboard/src/hooks/useRoleBasedNav.ts: FOUND (modified)
- frontend-dashboard/src/pages/PmsHubPage.tsx: FOUND (modified)
- frontend-dashboard/src/App.tsx: FOUND (modified)

Commits exist:
- 23a7807: FOUND
- 4729303: FOUND
