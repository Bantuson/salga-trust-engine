---
phase: 08-wire-web-portal-report-submission
plan: 02
subsystem: ui
tags: [react, typescript, supabase, fetch, api-integration, gps, gbv, media-upload]

# Dependency graph
requires:
  - phase: 08-01
    provides: Fixed POST /api/v1/reports/submit backend — PostGIS location, /my route ordering, ManagerCrew test mocks
  - phase: 03-04
    provides: Upload-first workflow with MediaAttachment and confirm endpoint at /api/v1/uploads/confirm

provides:
  - Real end-to-end web portal report submission — citizen fills form, backend creates ticket, receipt displays real tracking number
  - Category display string to backend enum mapping (CATEGORY_MAP)
  - GPS accuracy captured and sent in location payload
  - Upload confirm endpoint called after each Supabase Storage upload to create MediaAttachment DB records
  - is_gbv: true sent in payload for GBV category reports (triggers SAPS routing + encryption)
  - Supabase auth session token sent as Bearer header on all backend calls

affects:
  - E2E tests (e2e-tests/) — report submission flow now hits real backend, not mock
  - RPT-02, RPT-03, RPT-05, RPT-06 requirements fully met

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frontend API calls use import.meta.env.VITE_API_URL with http://localhost:8000 fallback"
    - "supabase.auth.getSession() for fresh auth token on every API call (not cached)"
    - "Upload confirm is non-fatal — photo in storage even if DB record creation fails"
    - "CATEGORY_MAP at module level maps display strings to backend enum values"

key-files:
  created: []
  modified:
    - frontend-public/src/pages/ReportIssuePage.tsx

key-decisions:
  - "VITE_API_URL env var with http://localhost:8000 fallback — no hardcoded URLs in component logic"
  - "Upload confirm endpoint called with purpose='evidence' for both GBV and regular uploads — MediaAttachment purpose distinguishes at DB level"
  - "Upload confirm failures are non-fatal (warn + continue) — photo persists in Supabase Storage even if DB record fails"
  - "backendCategory: isGbv check takes priority over CATEGORY_MAP — GBV/Abuse display always maps to 'gbv' enum regardless of map"
  - "supabase.auth.getSession() called fresh at submit time — prevents stale token issues on long form sessions"

patterns-established:
  - "CATEGORY_MAP: Record<string, string> at module level for frontend display-to-enum conversion"
  - "LocationData interface includes accuracy: number — maps to backend LocationData schema Field(gt=0)"

requirements-completed:
  - RPT-02
  - RPT-03
  - RPT-05
  - RPT-06

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 08 Plan 02: Wire Web Portal Report Submission Summary

**End-to-end web portal report submission wired — real POST /api/v1/reports/submit with Supabase auth, GPS accuracy, CATEGORY_MAP, media linking via upload confirm, GBV flag, and real tracking number on receipt**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T13:15:00Z
- **Completed:** 2026-02-22T13:19:28Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced mock setTimeout + fake tracking number with real `POST /api/v1/reports/submit` API call
- Added `CATEGORY_MAP` constant mapping display strings ("Water & Sanitation", "Roads & Potholes", etc.) to backend enum values ("water", "roads", etc.)
- Updated `LocationData` interface and `captureLocation` handler to capture and send `accuracy` field (required by backend Pydantic schema `Field(gt=0)`)
- Added upload confirm endpoint call after each Supabase Storage upload to create `MediaAttachment` DB records linking files to the future ticket
- Receipt now displays `data.tracking_number` from real backend response (format: TKT-YYYYMMDD-xxxxxx)
- Frontend production build succeeds with zero TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire handleSubmit and photo upload to real backend API** - `891e480` (feat)

**Plan metadata:** (created in this commit)

## Files Created/Modified
- `frontend-public/src/pages/ReportIssuePage.tsx` - Added CATEGORY_MAP, accuracy to LocationData, upload confirm call, replaced mock handleSubmit with real API call to POST /api/v1/reports/submit

## Decisions Made
- `VITE_API_URL` env var with `http://localhost:8000` fallback prevents hardcoded URLs
- Upload confirm failures are non-fatal — citizen's photo persists in Supabase Storage even if MediaAttachment DB record creation fails; non-blocking warn + continue pattern
- `isGbv ? 'gbv' : (CATEGORY_MAP[category] ?? 'other')` — GBV flag takes precedence over CATEGORY_MAP to prevent edge cases where display value might mismatch
- Fresh `supabase.auth.getSession()` call at submit time prevents stale token errors on long form completion sessions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v1.0 web portal requirements met: RPT-02, RPT-03, RPT-04 (from 08-01), RPT-05, RPT-06, RPT-08 (from 08-01)
- Phase 08 complete — end-to-end report submission flow works from citizen form to backend ticket creation to receipt display
- To test end-to-end: run backend (`uvicorn src.main:app --reload`), run frontend (`cd frontend-public && npm run dev`), login as citizen with `residence_verified: true` in user_metadata, submit a report

## Self-Check: PASSED

- FOUND: frontend-public/src/pages/ReportIssuePage.tsx
- FOUND: .planning/phases/08-wire-web-portal-report-submission/08-02-SUMMARY.md
- FOUND commit: 891e480 (Task 1)

---
*Phase: 08-wire-web-portal-report-submission*
*Completed: 2026-02-22*
