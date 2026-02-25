---
phase: 06-public-transparency-rollout
plan: 01
subsystem: Public Transparency Backend
tags: [public-api, cross-tenant, gbv-firewall, k-anonymity, postgis, unauthenticated]
dependencies:
  requires: [05-05-municipal-operations-dashboard]
  provides: [public-metrics-api]
  affects: [tenant-middleware]
tech_stack:
  added: []
  patterns: [cross-tenant-aggregation, unauthenticated-endpoints, grid-based-heatmap]
key_files:
  created:
    - src/services/public_metrics_service.py
    - src/api/v1/public.py
    - tests/test_public_metrics_service.py
    - tests/test_public_api.py
  modified:
    - src/main.py
    - src/middleware/tenant_middleware.py
decisions:
  - id: D06-01-01
    summary: "Sensitive ticket count at system level only (never per-municipality)"
    rationale: "TRNS-05 compliance - GBV data must not be attributable to specific municipalities"
  - id: D06-01-02
    summary: "Heatmap k-anonymity threshold of 3 tickets per grid cell"
    rationale: "Balance between data utility and privacy protection (suppress cells with <3 tickets)"
  - id: D06-01-03
    summary: "Public endpoints exempt from tenant middleware"
    rationale: "Cross-tenant aggregation requires no X-Tenant-ID header (TRNS-04)"
  - id: D06-01-04
    summary: "PostGIS graceful degradation for SQLite tests"
    rationale: "Return empty heatmap when PostGIS unavailable (test environment compatibility)"
metrics:
  duration_seconds: 1470
  duration_minutes: 24.5
  tasks_completed: 2
  files_created: 4
  files_modified: 2
  commits: 5
  test_coverage: "Unit tests only (integration tests require PostgreSQL)"
  completed_at: "2026-02-10T15:14:42Z"
---

# Phase 6 Plan 1: Public Metrics Backend Summary

**One-liner:** Cross-tenant public metrics API with SQL-level GBV firewall and PostGIS grid aggregation for transparency dashboard.

## What Was Built

Implemented the backend foundation for the public transparency dashboard:

1. **PublicMetricsService** - Cross-tenant aggregation with mandatory GBV firewall:
   - `get_active_municipalities()` - Returns public municipality info only (no contact details)
   - `get_response_times()` - Average response hours per municipality (TRNS-01)
   - `get_resolution_rates()` - Resolution % with monthly trends (TRNS-02)
   - `get_heatmap_data()` - PostGIS ST_SnapToGrid with k-anonymity threshold (TRNS-03)
   - `get_system_summary()` - System-wide totals with sensitive count at system level only

2. **Public API Endpoints** - Unauthenticated access at `/api/v1/public/*`:
   - `GET /municipalities` - Active municipality list
   - `GET /response-times` - Average response times (accepts `municipality_id` filter)
   - `GET /resolution-rates` - Resolution rates with trends (accepts `municipality_id`, `months`)
   - `GET /heatmap` - Grid-aggregated location data (accepts `municipality_id`)
   - `GET /summary` - System-wide summary statistics

3. **Router Registration** - Integrated public router into main.py

4. **Tenant Middleware Exclusion** - Exempted `/api/v1/public` from tenant context requirement

## Key Technical Decisions

### Cross-Tenant Aggregation Pattern
All queries aggregate across ALL active municipalities (no tenant_id filter). JOIN with Municipality table to filter `is_active == True`. This provides system-wide transparency while excluding inactive/pilot municipalities.

### GBV Firewall at SQL Level
Every public query includes `Ticket.is_sensitive == False` in WHERE clause. This is the SEC-05 compliance boundary - GBV tickets NEVER appear in public data. Sensitive ticket count returned ONLY at system level (`get_system_summary`), never per-municipality.

### Heatmap K-Anonymity
PostGIS `ST_SnapToGrid(location, 0.01, 0.01)` for ~1km grid cells. HAVING `COUNT(*) >= 3` suppresses cells with fewer than 3 tickets. Limit 1000 cells ordered by intensity DESC. Returns empty list when PostGIS unavailable (SQLite test compatibility).

### Unauthenticated Access
Public endpoints do NOT use `Depends(get_current_user)`. Only `Depends(get_db)` for database access. Added `/api/v1/public` to tenant middleware EXCLUDED_PATH_PREFIXES to allow cross-tenant queries without X-Tenant-ID header.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] Exempted public endpoints from tenant middleware**
- **Found during:** Task 2 - public API testing
- **Issue:** TenantContextMiddleware was rejecting requests without X-Tenant-ID header (400 error)
- **Fix:** Added `/api/v1/public` to EXCLUDED_PATH_PREFIXES in tenant_middleware.py
- **Files modified:** src/middleware/tenant_middleware.py
- **Commit:** 3ee9211
- **Rationale:** Public endpoints are cross-tenant by design (TRNS-04). Requiring tenant header would break unauthenticated access requirement.

## Testing Approach

**TDD Protocol Followed:**
- RED phase: Wrote failing tests first (commits 0080b52, cc00772)
- GREEN phase: Implemented service and API to pass tests (commits 1796ff9, a99b0af)
- REFACTOR phase: Fixed tenant middleware blocking issue (commit 3ee9211)

**Test Coverage:**
- Unit tests for PublicMetricsService (test_public_metrics_service.py)
- Unit tests for public API endpoints (test_public_api.py)
- Manual verification of unauthenticated access
- Verification of query parameter handling (municipality_id, months filters)
- Verification of GBV exclusion via service layer delegation

**Not Tested:**
- Integration tests with PostgreSQL (require database setup)
- PostGIS heatmap queries (mocked to return empty list in SQLite mode)

## TRNS Requirements Satisfied

- **TRNS-01**: Average response times per municipality via `/api/v1/public/response-times`
- **TRNS-02**: Resolution rates with monthly trends via `/api/v1/public/resolution-rates`
- **TRNS-03**: Heatmap data with PostGIS grid aggregation via `/api/v1/public/heatmap`
- **TRNS-04**: All endpoints accessible without authentication (no login required)
- **TRNS-05**: GBV exclusion at SQL level (`is_sensitive == False` in all queries)

## SEC-05 Compliance

**GBV Firewall Verified:**
- All public queries filter `is_sensitive == False` at SQL level (4 occurrences in service)
- Sensitive ticket count query uses `is_sensitive == True` (1 occurrence in get_system_summary)
- Sensitive count returned ONLY at system level (never per-municipality)
- Code inspection confirms no per-municipality GBV data leakage

## Files Changed

**Created:**
- `src/services/public_metrics_service.py` (352 lines) - Cross-tenant metrics aggregation service
- `src/api/v1/public.py` (155 lines) - Unauthenticated public API endpoints
- `tests/test_public_metrics_service.py` (338 lines) - Service unit tests
- `tests/test_public_api.py` (230 lines) - API endpoint tests

**Modified:**
- `src/main.py` (+2 lines) - Imported and registered public router
- `src/middleware/tenant_middleware.py` (+1 line) - Exempted public prefix from tenant requirement

## Commits

1. **0080b52** - test(06-01): add failing tests for PublicMetricsService (TDD RED)
2. **1796ff9** - feat(06-01): implement PublicMetricsService with cross-tenant aggregation (TDD GREEN)
3. **cc00772** - test(06-01): add failing tests for public API endpoints (TDD RED)
4. **a99b0af** - feat(06-01): implement public API endpoints and register router (TDD GREEN)
5. **3ee9211** - fix(06-01): exempt public endpoints from tenant middleware (Deviation Rule 3)

## Next Steps

**For Plan 06-02 (Public Dashboard Frontend):**
- React components for municipality selector, metric cards, trend charts
- Leaflet heatmap integration for geographic visualization
- SSE or polling for real-time updates (optional - public data may not need real-time)
- Hash-based routing for public dashboard (no auth required)

**For Plan 06-03 (Pilot Onboarding & Final Testing):**
- Seed script for 3-5 pilot municipalities
- Integration tests for public API endpoints with PostgreSQL
- End-to-end GBV firewall verification
- Full regression suite (310+ tests)

## Self-Check: PASSED

**Files created:**
- [x] src/services/public_metrics_service.py exists (352 lines)
- [x] src/api/v1/public.py exists (155 lines)
- [x] tests/test_public_metrics_service.py exists (338 lines)
- [x] tests/test_public_api.py exists (230 lines)

**Files modified:**
- [x] src/main.py modified (public router registered)
- [x] src/middleware/tenant_middleware.py modified (public prefix excluded)

**Commits exist:**
- [x] 0080b52 (test RED - service)
- [x] 1796ff9 (feat GREEN - service)
- [x] cc00772 (test RED - API)
- [x] a99b0af (feat GREEN - API)
- [x] 3ee9211 (fix - tenant middleware)

**Verification:**
- [x] All 5 public endpoints accessible without authentication (verified manually)
- [x] Query parameters work (municipality_id, months filters)
- [x] GBV firewall at SQL level (is_sensitive == False in all queries)
- [x] Sensitive count at system level only (no per-municipality breakdown)
- [x] PostGIS graceful degradation for SQLite tests

**All checks passed.**
