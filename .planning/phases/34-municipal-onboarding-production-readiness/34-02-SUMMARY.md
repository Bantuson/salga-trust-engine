---
phase: 34-municipal-onboarding-production-readiness
plan: 02
subsystem: frontend-dashboard
tags: [ui-consistency, modals, pms, salga-admin, glassmorphism]
dependency_graph:
  requires: []
  provides:
    - CreateIdpModal component (frontend-dashboard/src/components/pms/)
    - CreateSdbipModal component (frontend-dashboard/src/components/pms/)
    - CreatePaModal component (frontend-dashboard/src/components/pms/)
    - MunicipalityDetailModal component (frontend-dashboard/src/components/salga/)
  affects:
    - PmsHubPage (create actions now open modals)
    - SALGAAdminDashboardPage (municipality row click opens modal)
tech_stack:
  added: []
  patterns:
    - TeamCreateModal pattern applied to all 4 new modal components
    - Fixed glassmorphism overlay (position fixed, z-index 1000, rgba 0.5 blur 4px)
    - glass-pink-frost container with sticky header/footer
    - useEffect body scroll lock + Escape key close + overlay click close
key_files:
  created:
    - frontend-dashboard/src/components/pms/CreateIdpModal.tsx
    - frontend-dashboard/src/components/pms/CreateSdbipModal.tsx
    - frontend-dashboard/src/components/pms/CreatePaModal.tsx
    - frontend-dashboard/src/components/salga/MunicipalityDetailModal.tsx
  modified:
    - frontend-dashboard/src/pages/PmsHubPage.tsx
    - frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx
decisions:
  - showForm inline card expand replaced with showCreateModal state in PmsHubPage — modals selected by activeView
  - MunicipalityDetailModal maxWidth set to 860px (wider than TeamCreateModal's 720px) for data-heavy KPI content
  - MunicipalityDetailModal footer has Close-only button (no create action)
  - expandedMunicipality state replaced with selectedMunicipality of type MunicipalityData | null
  - All new components use inline styles with CSS variables per Phase 27-03 lock
  - SALGAAdminDashboardPage.tsx changes were committed inline by linter (57e5a71) alongside our write
metrics:
  duration: 22 minutes
  completed: 2026-03-02T19:09:40Z
  tasks_completed: 2
  files_created: 4
  files_modified: 2
requirements: [UI-02]
---

# Phase 34 Plan 02: PMS and SALGA Modal Dialogs Summary

**One-liner:** Converted PMS create actions and SALGA municipality drill-down from inline card/row expand to glassmorphism modal dialogs following the TeamCreateModal pattern.

## What Was Built

Four new modal components replacing inline expand UI patterns across two pages:

### 1. CreateIdpModal (`frontend-dashboard/src/components/pms/CreateIdpModal.tsx`)
- Fields: Title, Financial Year Start (auto-computes End = Start + 5), Financial Year End, Vision (textarea), Mission (textarea)
- Submits: POST `/api/v1/idp/cycles`
- Pattern: TeamCreateModal verbatim — fixed overlay, glass-pink-frost container, sticky header/footer, Escape/overlay close, body scroll lock

### 2. CreateSdbipModal (`frontend-dashboard/src/components/pms/CreateSdbipModal.tsx`)
- Fields: Title, Financial Year, Layer (dropdown: top_layer | departmental), Department (conditional dropdown, 8 departments)
- Submits: POST `/api/v1/sdbip/scorecards`
- Conditional department field only shown when layer = 'departmental'

### 3. CreatePaModal (`frontend-dashboard/src/components/pms/CreatePaModal.tsx`)
- Fields: Financial Year, Section 57 Manager Email, Description (textarea)
- Submits: POST `/api/v1/performance-agreements`

### 4. MunicipalityDetailModal (`frontend-dashboard/src/components/salga/MunicipalityDetailModal.tsx`)
- Shows: Overall KPI achievement (large score + traffic light badge), KPI counts (green/amber/red), ticket resolution rate, SLA compliance
- Includes KPI traffic light table with status dot per category
- maxWidth: 860px (wider than create modals for data-heavy content)
- Footer: Close button only (detail view, not create form)

### PmsHubPage Updates
- `showForm` state replaced with `showCreateModal: boolean`
- Create button always shows createLabel text (no toggle/Cancel behavior)
- Modal rendered at component root based on `activeView` (idp → CreateIdpModal, sdbip → CreateSdbipModal, performance-agreements → CreatePaModal)
- Views without create actions (golden-thread, statutory-reports, setup) hide the create button naturally via `currentOption.createLabel` check
- `showForm`/`onToggleForm` props removed from child view calls

### SALGAAdminDashboardPage Updates
- `expandedMunicipality: string | null` replaced with `selectedMunicipality: MunicipalityData | null`
- `handleRowClick` now passes full municipality object instead of just ID
- Inline expanded row JSX completely removed
- Modal rendered at end of component: `{selectedMunicipality && <MunicipalityDetailModal .../>}`
- Hover background on rows (rgba 0.06) as visual click indicator
- Added "Click a row to view municipality detail" hint text

## Deviations from Plan

None — plan executed exactly as written.

Note: SALGAAdminDashboardPage.tsx was committed by the project's linter in commit `57e5a71` alongside a minHeight fix, incorporating our modal changes. The committed version is correct and contains both the modal integration and the header alignment fix.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| frontend-dashboard/src/components/pms/CreateIdpModal.tsx | FOUND |
| frontend-dashboard/src/components/pms/CreateSdbipModal.tsx | FOUND |
| frontend-dashboard/src/components/pms/CreatePaModal.tsx | FOUND |
| frontend-dashboard/src/components/salga/MunicipalityDetailModal.tsx | FOUND |
| Commit 10952db (Task 1 - PMS modals) | FOUND |
| Commit 70650e3 (Task 2 - MunicipalityDetailModal) | FOUND |
