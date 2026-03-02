---
phase: 31-role-specific-dashboards
plan: 05
subsystem: frontend-dashboard
tags: [mock-data, role-dashboards, dx, demo-mode]
dependency_graph:
  requires: [31-01, 31-02, 31-03, 31-04]
  provides: [mock-fallback-for-all-role-dashboards]
  affects: [CFODashboardPage, MunicipalManagerDashboardPage, MayorDashboardPage, OversightDashboardPage, SALGAAdminDashboardPage, Section56DirectorDashboardPage]
tech_stack:
  added: []
  patterns: [catch-block-mock-fallback, named-exports-per-role]
key_files:
  created:
    - frontend-dashboard/src/mocks/mockRoleDashboards.ts
  modified:
    - frontend-dashboard/src/pages/CFODashboardPage.tsx
    - frontend-dashboard/src/pages/MunicipalManagerDashboardPage.tsx
    - frontend-dashboard/src/pages/MayorDashboardPage.tsx
    - frontend-dashboard/src/pages/OversightDashboardPage.tsx
    - frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx
    - frontend-dashboard/src/pages/Section56DirectorDashboardPage.tsx
decisions:
  - "catch block sets mock data instead of error string — error banner UI kept but never triggered by API failures"
  - "catch (err: any) rewritten to catch (bare) — TypeScript noUnusedLocals compliance since err not read"
  - "mockOversightData convenience map keyed by OversightRole string — OversightDashboardPage uses mockOversightData[role] fallback"
  - "eThekwini 2025/2026 as demo context — real SA municipality names (eThekwini, Tshwane, Mangaung, NMB, Buffalo City)"
metrics:
  duration_minutes: 11
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_modified: 7
---

# Phase 31 Plan 05: Mock Data Fallbacks for Role-Specific Dashboards Summary

**One-liner:** Catch-block mock fallbacks added to all 6 role dashboard pages using 861-line mockRoleDashboards.ts with realistic eThekwini 2025/2026 SA municipal data.

## What Was Built

All 9 role-specific dashboard pages now show realistic South African municipal data when the FastAPI backend is unavailable, matching the same pattern used by the generic DashboardPage (mockAnalytics fallback).

### New File: mockRoleDashboards.ts (861 lines)

9 named exports covering all role dashboard data shapes:

| Export | Role | Key Data |
|--------|------|----------|
| `mockCFODashboard` | CFO | 7 budget votes, 5 correlation rows, 5 statutory deadlines, SDBIP summary |
| `mockMMDashboard` | Municipal Manager | 6 departments sorted by achievement |
| `mockMayorDashboard` | Executive Mayor | Organizational scorecard + 3 SDBIP scorecards (1 draft) |
| `mockCouncillorDashboard` | Ward Councillor | 10 KPIs + 4 statutory reports |
| `mockAuditCommitteeDashboard` | Audit Committee | 5 performance reports + 8 audit trail entries |
| `mockInternalAuditorDashboard` | Internal Auditor | 6 KPIs with evidence items (mixed verification status) |
| `mockMPACDashboard` | MPAC | 5 statutory reports + 3 investigation flags |
| `mockSALGAAdminDashboard` | SALGA Admin | 5 real SA municipalities with drill-down detail |
| `mockSection56Dashboard` | Section 56 Director | Water & Sanitation — 8 water KPIs |

Plus `mockOversightData` convenience map (councillor/audit_committee/internal_auditor/mpac).

### Modified: 6 Dashboard Pages

Each page received:
1. Import: `import { mockXXX } from '../mocks/mockRoleDashboards';`
2. Catch block replacement: `setData(mockXXX)` instead of `setError(err.message)`

| Page | Import | Fallback call |
|------|--------|---------------|
| CFODashboardPage.tsx | `mockCFODashboard` | `setData(mockCFODashboard)` |
| MunicipalManagerDashboardPage.tsx | `mockMMDashboard` | `setData(mockMMDashboard)` |
| MayorDashboardPage.tsx | `mockMayorDashboard` | `setData(mockMayorDashboard)` |
| OversightDashboardPage.tsx | `mockOversightData` | `setData(mockOversightData[role] \|\| null)` |
| SALGAAdminDashboardPage.tsx | `mockSALGAAdminDashboard` | `setData(mockSALGAAdminDashboard)` |
| Section56DirectorDashboardPage.tsx | `mockSection56Dashboard` | `setData(mockSection56Dashboard)` |

## Decisions Made

1. **catch (bare) instead of catch (err: any):** The `err` variable was unused after removing `setError(err.message)`. Using bare catch avoids TypeScript `noUnusedLocals` lint errors.

2. **Error banner UI kept intact:** The `if (error)` render path and error banner JSX are preserved. The catch block no longer sets `error`, so the banner never shows on API failure — but the code path remains for future use if needed.

3. **mockOversightData[role] || null:** OversightDashboardPage serves 4 roles with a single component. The convenience map routes to the correct mock by `role` string. If `role` is somehow unknown, `null` triggers the existing empty state render rather than crashing.

4. **eThekwini context:** Demo data uses eThekwini Metropolitan Municipality as primary tenant context, with KwaZulu-Natal financial year 2025/2026. SALGA Admin benchmarking uses 5 real SA metropolitan municipalities: eThekwini, City of Tshwane, Mangaung, Nelson Mandela Bay, Buffalo City.

5. **Data shape fidelity:** Mock data structures match what each page component reads from `data.*` — verified by reviewing all 6 page components before writing the mock file.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `mockRoleDashboards.ts` exists: FOUND (861 lines, exceeds 200-line minimum)
- All 6 pages import from `mockRoleDashboards`: VERIFIED
- All 6 catch blocks call `setData(mock*)`: VERIFIED
- 9 named exports in mock file: VERIFIED (mockCFODashboard, mockMMDashboard, mockMayorDashboard, mockCouncillorDashboard, mockAuditCommitteeDashboard, mockInternalAuditorDashboard, mockMPACDashboard, mockSALGAAdminDashboard, mockSection56Dashboard + mockOversightData map)
- TypeScript: no errors in frontend-dashboard source (pre-existing shared/ errors unaffected)
- Production build: PASSED (1449 modules, built in 2m 3s)

## Self-Check: PASSED

All created/modified files exist, both commits verified in git log:
- b8201ed: feat(31-05): create mockRoleDashboards.ts with realistic SA municipal mock data
- dc2e60b: feat(31-05): add mock data fallbacks to all 6 role dashboard pages
