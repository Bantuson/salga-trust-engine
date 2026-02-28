---
phase: 28-idp-sdbip-core-performance-monitoring
plan: 07
subsystem: frontend-pms
tags: [frontend, pms, idp, sdbip, golden-thread, traffic-light, react, typescript]
dependency_graph:
  requires: [28-01, 28-02, 28-03, 28-04, 28-05, 28-06]
  provides: [pms-frontend-pages, golden-thread-api, sidebar-pms-nav]
  affects: [frontend-dashboard, src/api/v1/idp.py, src/services/idp_service.py]
tech_stack:
  added: []
  patterns:
    - CSS variables + inline styles (no Tailwind) for all PMS pages
    - GlassCard/Button/Input @shared components
    - selectinload eager loading for golden thread (no N+1 queries)
    - Collapsible tree view with React state (no external tree library)
    - Drag-and-drop file upload with HTML5 DragEvent API
key_files:
  created:
    - frontend-dashboard/src/components/pms/TrafficLightBadge.tsx
    - frontend-dashboard/src/pages/IdpPage.tsx
    - frontend-dashboard/src/pages/IdpDetailPage.tsx
    - frontend-dashboard/src/pages/SdbipPage.tsx
    - frontend-dashboard/src/pages/SdbipKpiPage.tsx
    - frontend-dashboard/src/pages/ActualsPage.tsx
    - frontend-dashboard/src/pages/EvidencePage.tsx
    - frontend-dashboard/src/pages/GoldenThreadPage.tsx
  modified:
    - src/models/idp.py
    - src/services/idp_service.py
    - src/api/v1/idp.py
    - frontend-dashboard/src/hooks/useRoleBasedNav.ts
    - frontend-dashboard/src/components/layout/Sidebar.tsx
    - frontend-dashboard/src/App.tsx
decisions:
  - sdbip_kpis relationship added to IDPObjective in Plan 28-07 (Wave 5) after SDBIPKpi model confirmed stable from 28-04
  - Golden thread uses selectinload(IDPObjective.sdbip_kpis) for full eager loading without N+1 queries
  - Collapsible tree view with React state (no react-d3-tree) — read-only hierarchy needs no extra library
  - pmsNavItems array in useRoleBasedNav replaces placeholder /pms route for granular navigation
  - NavItem.section field for section header grouping rendered inline by Sidebar
metrics:
  duration: ~55 min
  completed_date: "2026-02-28"
  tasks_completed: 3
  tasks_total: 4
  files_created: 8
  files_modified: 6
---

# Phase 28 Plan 07: IDP SDBIP Frontend Pages and Golden Thread API Summary

PMS frontend interface complete — 7 React pages, 1 shared component, and the golden thread API endpoint that connects IDP strategic objectives to SDBIP KPIs using eager selectinload.

## Tasks Completed

### Task 1a: Golden Thread Backend API Endpoint

Added `sdbip_kpis` relationship to `IDPObjective` (safe now that `SDBIPKpi` model exists from plan 28-04). Updated `get_golden_thread()` to use `selectinload(IDPObjective.sdbip_kpis)` returning actual KPI data (id, kpi_number, description, unit_of_measurement, annual_target). Added `GET /cycles/{cycle_id}/golden-thread` endpoint to `idp.py` router.

All 21 IDP unit tests pass (3 golden thread + 18 other).

### Task 1b: PMS Frontend Pages and TrafficLightBadge Component

Created 8 files:

- **TrafficLightBadge**: green/amber/red badge with dot indicator and percentage. Colors from CSS variables (teal/gold/coral).
- **IdpPage**: IDP cycle list with GlassCards, inline create form, status badges. Auto-computes end_year from start_year + 5.
- **IdpDetailPage**: Cycle details, goals (with national KPA badges), objectives list, inline add forms, state transition buttons (Approve/Open Review/Re-Approve), golden thread link.
- **SdbipPage**: Scorecards grouped by financial year, create form with layer/department selector.
- **SdbipKpiPage**: KPI table with baseline/target/weight, add KPI form with quarterly targets (Q1-Q4), links to actuals.
- **ActualsPage**: Quarterly actuals table with TrafficLightBadge, validate button for PMS officers, evidence link, submit actual form.
- **EvidencePage**: Drag-and-drop upload zone, document list with scan status badges, download for clean files.
- **GoldenThreadPage**: Collapsible tree view IDP->Goals->Objectives->KPIs. Cycle selector dropdown. Summary counts at bottom.

All pages use CSS variables, @shared GlassCard/Button/Input, handle loading/error/empty states.

### Task 2: Sidebar Navigation, Routing, and PMS Section Integration

- `useRoleBasedNav`: added `pmsNavItems` (IDP Management, SDBIP Scorecards, Golden Thread) replacing the placeholder `/pms` route. Visible to executive_mayor, municipal_manager, cfo, section56_director, department_manager, pms_officer. Added `section` field to `NavItem` for "Performance Management" section header.
- `Sidebar`: added `target` and `link` SVG icons. Renders section headers inline for `item.section` values.
- `App.tsx`: added 7 PMS routes all wrapped in DashboardLayout.

TypeScript compiles without errors.

### Task 3: Visual Verification (Checkpoint — Pending Human Verification)

Human visual verification of all PMS pages required before plan completion.

## Commits

| Hash | Message |
|------|---------|
| 7ad2d93 | feat(28-07): golden thread backend API endpoint with SDBIP KPI loading |
| 1d0966f | feat(28-07): PMS frontend pages and TrafficLightBadge component |
| c698b44 | feat(28-07): sidebar navigation, routing, and PMS section integration |

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

All 8 created files exist on disk. All 3 task commits verified in git log.
