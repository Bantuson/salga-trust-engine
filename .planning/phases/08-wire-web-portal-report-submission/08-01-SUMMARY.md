---
phase: 08-wire-web-portal-report-submission
plan: 01
subsystem: api
tags: [postgis, geoalchemy2, shapely, reports, fastapi, crewai, testing]

# Dependency graph
requires:
  - phase: 07-fix-whatsapp-ai-agent-integration
    provides: ManagerCrew.kickoff() pattern replacing IntakeFlow — reports.py references this
  - phase: 04-ticket-management-routing
    provides: PostGIS Ticket.location field (WKBElement), from_shape import pattern
provides:
  - PostGIS location assignment via from_shape(Point(lng, lat), srid=4326) in submit_report
  - USE_POSTGIS guard matching routing_service.py/ticket.py pattern
  - Route /my before /{tracking_number} — prevents FastAPI path parameter interception
  - ManagerCrew mock pattern for test_reports_api.py
affects:
  - 08-02-PLAN.md (frontend wiring depends on working backend submit endpoint)
  - Any test that creates Ticket() directly (latitude=/longitude= kwargs removed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "USE_POSTGIS guard: os.getenv('USE_SQLITE_TESTS') != '1' with try/except ImportError fallback"
    - "from_shape(Point(lng, lat), srid=4326) for GPS-to-PostGIS conversion (longitude first)"
    - "ManagerCrew AsyncMock pattern: mock_crew.kickoff = AsyncMock(return_value={'routing_phase': 'municipal'})"

key-files:
  created: []
  modified:
    - src/api/v1/reports.py
    - tests/test_reports_api.py

key-decisions:
  - "USE_POSTGIS guard matches routing_service.py and ticket.py pattern exactly (os.getenv USE_SQLITE_TESTS != 1)"
  - "from_shape takes Point(longitude, latitude) — longitude first per WGS84/GeoJSON convention"
  - "Route /my moved before /{tracking_number} — FastAPI matches routes in registration order"
  - "SAPS notification location uses address variable, falls back to 'Location not provided' (not raw f-string with lat/lng)"
  - "test_submit_report_gbv_encrypted patches src.agents.tools.saps_tool.notify_saps (source module) not reports.py namespace (imported inside function)"
  - "test_submit_report_without_category category assertion changed from 'water' to 'other' — ManagerCrew returns routing_phase 'municipal' which maps to 'other' via _PHASE_TO_CATEGORY"
  - "LocationData test fixtures include accuracy=10.0 and source='gps' — required by schema Field(gt=0) validator"

patterns-established:
  - "Ticket constructor never takes latitude= or longitude= kwargs — location= takes WKBElement from from_shape (or None in test mode)"

requirements-completed:
  - RPT-04
  - RPT-08

# Metrics
duration: 7min
completed: 2026-02-22
---

# Phase 08 Plan 01: Fix Backend Report Submission Bugs Summary

**PostGIS location fix (from_shape Point), /my route ordering fix, and ManagerCrew test mock migration in reports.py**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-22T16:02:29Z
- **Completed:** 2026-02-22T16:09:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed PostGIS location bug: replaced stale `latitude=`/`longitude=` Ticket constructor kwargs with `location=from_shape(Point(lng, lat), srid=4326)` under `USE_POSTGIS` guard
- Fixed route ordering: `/my` endpoint now defined before `/{tracking_number}` preventing FastAPI from matching "my" as a path parameter and returning 404
- Updated all stale `IntakeFlow` test mocks to `ManagerCrew` pattern with `AsyncMock(kickoff)` returning routing_phase dict
- Fixed `LocationData` test fixtures to include required `accuracy` and `source` fields per Pydantic schema validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PostGIS location bug and route ordering in reports.py** - `d812f52` (fix)
2. **Task 2: Update test mocks from IntakeFlow to ManagerCrew** - `730a11b` (fix)

**Plan metadata:** (created in this commit)

## Files Created/Modified
- `src/api/v1/reports.py` - Added USE_POSTGIS guard + from_shape import, fixed Ticket constructor location arg, moved /my before /{tracking_number}, fixed SAPS notification location fallback
- `tests/test_reports_api.py` - Replaced IntakeFlow patches with ManagerCrew, updated mock setup and category assertion, removed lat/lng kwargs from Ticket constructors, added accuracy/source to LocationData test data

## Decisions Made
- `USE_POSTGIS` guard uses exact same pattern as `routing_service.py` and `ticket.py` for consistency
- `from_shape(Point(lng, lat))` — Point takes longitude first per WGS84/GeoJSON convention
- SAPS notification location falls back to `"Location not provided"` instead of broken f-string referencing undefined variables
- GBV test patches `src.agents.tools.saps_tool.notify_saps` at source (imported inside function body, not at module level)
- `test_submit_report_without_category` category assertion updated to `"other"` — `"municipal"` routing_phase maps to `"other"` via `_PHASE_TO_CATEGORY`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend `POST /api/v1/reports/submit` correctly writes GPS coordinates as PostGIS location field
- `GET /reports/my` resolves correctly (no longer intercepted by `/{tracking_number}`)
- GBV encryption path (encrypted_description + is_sensitive) activates on is_gbv=True
- All test mocks reference ManagerCrew (not IntakeFlow), 12 tests collect cleanly
- Ready for Phase 08-02: frontend wiring of ReportIssuePage to the submit endpoint

## Self-Check: PASSED

- FOUND: src/api/v1/reports.py
- FOUND: tests/test_reports_api.py
- FOUND: .planning/phases/08-wire-web-portal-report-submission/08-01-SUMMARY.md
- FOUND commit: d812f52 (Task 1)
- FOUND commit: 730a11b (Task 2)

---
*Phase: 08-wire-web-portal-report-submission*
*Completed: 2026-02-22*
