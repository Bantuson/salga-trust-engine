---
phase: 32-risk-register-public-transparency
plan: 02
subsystem: ui
tags: [react, vite, typescript, css-variables, glassmorphism, risk-register, sdbip, public-dashboard]

# Dependency graph
requires:
  - phase: 32-01
    provides: "GET /api/v1/risk-register/ backend endpoint and GET /api/v1/public/sdbip-performance endpoint"
  - phase: 31-role-specific-dashboards
    provides: "CFODashboardPage, MunicipalManagerDashboardPage, TransparencyDashboardPage, GlassCard, api.ts patterns, mockRoleDashboards.ts"
provides:
  - "Risk Register GlassCard section on CFODashboardPage (rating badges, L x I scores, auto-flagged indicator)"
  - "Risk Register GlassCard section on MunicipalManagerDashboardPage (identical to CFO)"
  - "fetchRiskRegister() API function in api.ts with optional department_id filter"
  - "mockRiskRegister array (4 items: critical/high/high/medium) in mockRoleDashboards.ts"
  - "SDBIP Achievement section on TransparencyDashboardPage (municipality cards, progress bars, traffic-light counts)"
  - "useSdbipAchievement() hook in usePublicStats.ts with mock fallback"
  - "SdbipAchievementData interface in public.ts"
affects: [phase-33, e2e-tests, public-transparency]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-blocking risk register load: fetchRiskRegister called after main dashboard data, falling back to mockRiskRegister on error — no loading state added, risk section shows after loading=false"
    - "CSS variables throughout: var(--text-primary), var(--color-coral), var(--color-teal), var(--color-gold), var(--text-sm), var(--text-xs) — no Tailwind"
    - "riskRatingColor helper: switch on 'critical'|'high'|'medium'|'low' returns CSS variable or hex color"
    - "SDBIP hook uses fetch (not Supabase) since endpoint is FastAPI — consistent with existing fetchCFODashboard pattern"

key-files:
  created: []
  modified:
    - "frontend-dashboard/src/services/api.ts"
    - "frontend-dashboard/src/mocks/mockRoleDashboards.ts"
    - "frontend-dashboard/src/pages/CFODashboardPage.tsx"
    - "frontend-dashboard/src/pages/MunicipalManagerDashboardPage.tsx"
    - "frontend-public/src/types/public.ts"
    - "frontend-public/src/hooks/usePublicStats.ts"
    - "frontend-public/src/pages/TransparencyDashboardPage.tsx"

key-decisions:
  - "Non-blocking risk register fetch: risk data loads in parallel after main dashboard data, so main dashboard never blocks on risk register availability"
  - "riskRatingColor helper placed as module-level function (not inline) in both CFO and MM pages — consistent with existing achievementStatus and statusColor helpers"
  - "useSdbipAchievement uses direct fetch() against FastAPI (not Supabase) — public SDBIP endpoint is a FastAPI route with cross-tenant aggregation, not a Supabase RLS view"
  - "Risk Register section shown only when !loading — avoids flash of empty state during initial load"

patterns-established:
  - "Pattern: Non-blocking secondary data fetch — load after primary data with independent catch block, set mock on error"
  - "Pattern: Risk rating color map — critical=coral, high=#e67e22, medium=gold, low=teal"

requirements-completed: [RISK-01, RISK-02, RISK-03, RISK-04]

# Metrics
duration: 25min
completed: 2026-03-02
---

# Phase 32 Plan 02: Risk Register & SDBIP Achievement Frontend Summary

**Risk Register widget (rating badges, L x I, auto-flagged) on CFO and MM dashboards, plus SDBIP Achievement section with municipality performance cards on public transparency dashboard**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-02T15:30:00Z
- **Completed:** 2026-03-02T15:55:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added fetchRiskRegister() API function and mockRiskRegister fallback (4 items covering critical/high/high/medium ratings)
- Added Risk Register GlassCard sections to both CFODashboardPage and MunicipalManagerDashboardPage — loads non-blocking, falls back to mock when backend unavailable
- Added SdbipAchievementData interface, useSdbipAchievement() hook, and SDBIP Achievement section to public transparency dashboard — 3 municipality cards with progress bars and green/amber/red breakdowns
- Both frontend-dashboard and frontend-public TypeScript clean and production builds pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Risk register widget on CFO and MM dashboard pages + API function + mock data** - `e385207` (feat)
2. **Task 2: Public SDBIP achievement section on transparency dashboard** - `5272c5f` (feat)

## Files Created/Modified
- `frontend-dashboard/src/services/api.ts` - Added fetchRiskRegister() function following fetchCFODashboard pattern
- `frontend-dashboard/src/mocks/mockRoleDashboards.ts` - Added mockRiskRegister array (4 risk items with mitigations)
- `frontend-dashboard/src/pages/CFODashboardPage.tsx` - Added riskData state, fetchRiskRegister import, riskRatingColor helper, Risk Register GlassCard section
- `frontend-dashboard/src/pages/MunicipalManagerDashboardPage.tsx` - Same as CFO: riskData state, imports, helper, Risk Register GlassCard
- `frontend-public/src/types/public.ts` - Added SdbipAchievementData interface
- `frontend-public/src/hooks/usePublicStats.ts` - Added mockSdbipAchievement constant and useSdbipAchievement() hook
- `frontend-public/src/pages/TransparencyDashboardPage.tsx` - Added useSdbipAchievement hook call and SDBIP Achievement section

## Decisions Made
- Non-blocking risk register fetch: risk data loads after main dashboard data completes, in a separate try/catch — main dashboard rendering never waits on risk register
- riskRatingColor helper as module-level function matching the existing achievementStatus/statusColor pattern in the file
- useSdbipAchievement uses direct fetch() against FastAPI rather than Supabase — the endpoint is a FastAPI route (cross-tenant raw SQL), not a Supabase RLS view
- Risk Register section guarded by `!loading` condition — ensures the section only appears after the main dashboard data has finished loading

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 RISK requirements (RISK-01 through RISK-04) are complete
- Phase 32 is complete: risk register backend (32-01) + frontend surface (32-02)
- Frontend components ready for E2E test coverage
- Public SDBIP transparency data visible on the public dashboard

## Self-Check: PASSED

All 7 files verified present. Both task commits (e385207, 5272c5f) confirmed in git log.

---
*Phase: 32-risk-register-public-transparency*
*Completed: 2026-03-02*
