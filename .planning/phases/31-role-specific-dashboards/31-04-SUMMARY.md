---
phase: 31-role-specific-dashboards
plan: 4
subsystem: frontend-dashboard
tags: [dashboard, salga-admin, section56-director, benchmarking, kpi, typescript]
dependency_graph:
  requires: ["31-02"]
  provides: ["DASH-11", "DASH-12"]
  affects: ["frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx", "frontend-dashboard/src/pages/Section56DirectorDashboardPage.tsx", "frontend-dashboard/src/services/api.ts"]
tech_stack:
  added: []
  patterns:
    - "fetch-blob download pattern for authenticated CSV export"
    - "Inline collapsible detail panel per municipality row (click to expand)"
    - "Traffic light color coding on achievement cells (green/amber/red)"
    - "Sort by achievement ascending to surface worst-performing KPIs first"
key_files:
  created: []
  modified:
    - "frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx"
    - "frontend-dashboard/src/pages/Section56DirectorDashboardPage.tsx"
    - "frontend-dashboard/src/services/api.ts"
decisions:
  - "CSV export uses fetch-blob with Authorization header (same fetch-then-blob pattern from StatutoryReportsPage)"
  - "Municipality detail panel expands inline below clicked row (same collapsible pattern as Internal Auditor KPI groups)"
  - "Section 56 Director empty state replaces normal content entirely, not a banner"
  - "KPI detail table sorted ascending by achievement_pct so worst-performing KPIs appear first"
  - "Click KPI row navigates to /pms/kpis/{kpiId}/actuals per Phase 31 locked decision"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_modified: 3
---

# Phase 31 Plan 4: SALGA Admin and Section 56 Director Dashboards Summary

**One-liner:** SALGA Admin cross-municipality benchmarking dashboard with ranked table, inline drill-down panels, and CSV export; Section 56 Director department-scoped KPI dashboard with traffic light summary and empty state.

## What Was Built

### Task 1: SALGAAdminDashboardPage + API functions (commit: cb0f9a4)

Full implementation of `SALGAAdminDashboardPage.tsx` replacing the stub from Plan 31-02, plus three new API functions in `api.ts`.

**Page layout:**
- Page header with Refresh and Export CSV buttons
- 4 summary cards: Total Municipalities, Avg KPI Achievement %, Avg Ticket Resolution %, Avg SLA Compliance %
- Municipality Performance Ranking table (8 columns: Rank, Municipality, Category, Province, KPI Achievement %, Ticket Resolution %, SLA Compliance %, KPIs)
- KPI achievement cell has traffic light background (green >= 80%, amber 50-79%, red < 50%)
- KPI column shows compact "12G 5A 2R" style counts with colored text
- Click row expands inline detail panel (same collapsible pattern as Internal Auditor page from Plan 31-03)
- Detail panel shows: municipality name + badges, KPI Performance Summary (left), Service Delivery Summary (right), Close button

**API functions added to api.ts:**
- `fetchSALGAAdminDashboard(token)` — GET /api/v1/role-dashboards/salga-admin
- `exportSALGABenchmarkingCSV(token)` — GET /api/v1/role-dashboards/salga-admin/export-csv with fetch-blob download
- `fetchSection56DirectorDashboard(token)` — GET /api/v1/role-dashboards/section56-director

### Task 2: Section56DirectorDashboardPage (commit: 1c01a11)

Full implementation of `Section56DirectorDashboardPage.tsx` replacing the stub from Plan 31-02.

**Page layout:**
- Page header: "{Department Name} — Director Dashboard"
- Empty state (full-page replacement when `data.empty_state === true`): SVG building icon, "No Department Assigned" title, message from API, "Go to PMS Hub" button
- 4 traffic light summary cards: Green (On Track >= 80%), Amber (Needs Attention 50-79%), Red (At Risk < 50%), Overall Achievement % (colored by threshold)
- KPI Detail Table sorted ascending by achievement_pct (worst-performing KPIs first)
  - Columns: KPI Description | Annual Target | Latest Actual | Achievement % | Quarter | Status
  - TrafficLightBadge in Status column
  - Click row navigates to `/pms/kpis/{kpiId}/actuals`
- Action links GlassCard: Upload Evidence, Submit Quarterly Actuals, View Full PMS Hub

## Artifacts

| File | Lines | Purpose |
|------|-------|---------|
| `frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx` | 648 | SALGA Admin cross-municipality benchmarking (DASH-11) |
| `frontend-dashboard/src/pages/Section56DirectorDashboardPage.tsx` | 449 | Section 56 Director department KPI view (DASH-12) |
| `frontend-dashboard/src/services/api.ts` | ~1000 | +3 role-dashboard API functions |

## Verification

1. TypeScript compiles clean: `npx tsc --noEmit` — PASSED
2. Production build succeeds: `npm run build` — PASSED (46.76s)
3. SALGAAdminDashboardPage: ranked municipality table with CSV export button — IMPLEMENTED
4. SALGAAdminDashboardPage: click row expands inline detail panel — IMPLEMENTED
5. Section56DirectorDashboardPage: department KPIs with traffic light cards and detail table — IMPLEMENTED
6. Section56DirectorDashboardPage: full empty state when no department assigned — IMPLEMENTED
7. Both pages: Skeleton loading states and error states with retry — IMPLEMENTED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx` — FOUND (648 lines)
- `frontend-dashboard/src/pages/Section56DirectorDashboardPage.tsx` — FOUND (449 lines)

Commits verified:
- cb0f9a4 (Task 1: SALGAAdminDashboardPage + api.ts) — FOUND
- 1c01a11 (Task 2: Section56DirectorDashboardPage) — FOUND
