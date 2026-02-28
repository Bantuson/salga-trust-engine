---
phase: 28-idp-sdbip-core-performance-monitoring
plan: 02
subsystem: database
tags: [sdbip, mscoa, kpi, pydantic, sqlalchemy, fastapi, alembic, postgresql, rls]

# Dependency graph
requires:
  - phase: 28-01
    provides: "IDPObjective model (idp_objectives.id) as FK target for SDBIPKpi golden thread"
  - phase: 27-rbac-foundation-tenant-configuration
    provides: "TenantAwareModel, NonTenantModel, Department model, require_pms_ready(), require_min_tier()"

provides:
  - "MscoaReference NonTenantModel (mscoa_reference table, 30 seeded codes, IE/FX/IA segments)"
  - "SDBIPScorecard TenantAwareModel (sdbip_scorecards table, top-layer and departmental)"
  - "SDBIPKpi TenantAwareModel (sdbip_kpis table, links idp_objectives, departments, mscoa_reference, users)"
  - "SDBIPQuarterlyTarget TenantAwareModel (sdbip_quarterly_targets table, Q1-Q4 per KPI)"
  - "SDBIPService class with scorecard CRUD, KPI CRUD, quarterly target upsert, mSCOA search"
  - "9-endpoint SDBIP API router at /api/v1/sdbip (scorecards, KPIs, quarterly targets, mSCOA lookup)"
  - "Alembic migration 2026_02_28_0005-add_sdbip_mscoa_models.py with 30 seed rows"
  - "25 unit tests in tests/test_pms_sdbip.py"

affects:
  - "28-03: Performance actual recording (SDBIPKpi as FK target for actuals)"
  - "28-04: Golden thread completion (SDBIPKpi.idp_objective_id FK to IDPObjective)"
  - "28-05: SDBIP approval workflow (SDBIPScorecard.status state machine)"
  - "28-06: Statutory report generation (SDBIPKpi data for Section 72/46 reports)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NonTenantModel for global reference data: MscoaReference bypasses do_orm_execute tenant filter (no tenant_id column) — shared across all municipalities"
    - "QuarterlyTargetBulkCreate enforces 4-quarter invariant at Pydantic schema level (model_validator) + service layer delete-then-insert upsert"
    - "mSCOA FK validation at service layer (not DB constraint) so 422 is returned with meaningful error before DB INSERT attempt"
    - "mscoa-codes endpoint gated only by require_min_tier(3) — no PMS readiness gate on reference data endpoints"

key-files:
  created:
    - "src/models/mscoa_reference.py"
    - "src/models/sdbip.py"
    - "src/schemas/sdbip.py"
    - "src/services/sdbip_service.py"
    - "src/api/v1/sdbip.py"
    - "alembic/versions/2026_02_28_0005-add_sdbip_mscoa_models.py"
    - "tests/test_pms_sdbip.py"
  modified:
    - "src/models/__init__.py"
    - "src/main.py"

key-decisions:
  - "MscoaReference uses NonTenantModel (no tenant_id) — mSCOA v5.5 codes are National Treasury reference data shared by all municipalities; the do_orm_execute event listener skips filtering when hasattr(class, 'tenant_id') is False"
  - "QuarterlyTargetBulkCreate requires all 4 quarters at once (min_length=4, max_length=4 + model_validator) — enforces data completeness; no partial quarterly target sets allowed"
  - "Quarterly target upsert uses delete-then-insert (not ON CONFLICT) — SQLite-compatible, avoids UNIQUE violation edge cases, ensures exactly 4 records per KPI at all times"
  - "mSCOA code validation at service layer (422 with meaningful message) rather than relying on DB FK violation (opaque 500 IntegrityError in SQLite tests)"
  - "mscoa-codes endpoint has no PMS readiness gate — reference data accessible to any Tier 3+ user for budget code selection during KPI authoring (before PMS is fully configured)"
  - "SDBIPKpi.objective relationship uses string reference 'IDPObjective' (not direct import) to avoid circular import; IDPObjective.sdbip_kpis back-reference deferred to Plan 28-04 (as noted in idp.py TODO comment)"

patterns-established:
  - "NonTenantModel pattern: use for global reference/lookup tables that must bypass RLS tenant filter"
  - "Bulk constraint schema pattern: QuarterlyTargetBulkCreate with min_length/max_length + model_validator for multi-record invariants"
  - "Service-layer FK validation pattern: validate optional FK fields before INSERT to return 422 (not 500)"
  - "Reference endpoint auth pattern: require_min_tier(N) only (no PMS readiness) for lookup/reference data endpoints"

requirements-completed:
  - SDBIP-01
  - SDBIP-02
  - SDBIP-03
  - SDBIP-04
  - SDBIP-05
  - SDBIP-10

# Metrics
duration: 45min
completed: 2026-02-28
---

# Phase 28 Plan 02: SDBIP KPI Backbone Summary

**SDBIP scorecard/KPI/quarterly-target CRUD API with mSCOA budget code lookup — 4 tables, 30 seeded National Treasury reference codes, 25 tests, 9 API endpoints**

## Performance

- **Duration:** 45 min
- **Started:** 2026-02-28T20:38:00Z
- **Completed:** 2026-02-28T21:23:50Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- MscoaReference NonTenantModel seeded with 30 stub mSCOA v5.5 codes (IE x15, FX x10, IA x5) as National Treasury reference data bypassing tenant filter
- SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget models with full FK chain to IDP objectives, departments, users, and mSCOA reference table
- 9-endpoint SDBIP API at `/api/v1/sdbip` with PMS readiness gate on all endpoints except mSCOA lookup
- 25 unit tests covering all plan-specified test cases plus boundary tests

## Task Commits

Each task was committed atomically:

1. **Task 1: SDBIP and mSCOA models, schemas, Alembic migration with seed data** - `c820420` (feat)
2. **Task 2: SDBIP service layer, API routes with mSCOA lookup, and tests** - `e056e97` (feat)

**Plan metadata:** (committed after summary)

## Files Created/Modified

- `src/models/mscoa_reference.py` - MscoaReference NonTenantModel with segment, code, description, is_active
- `src/models/sdbip.py` - SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget TenantAwareModels + SDBIPLayer, SDBIPStatus, Quarter enums
- `src/schemas/sdbip.py` - Pydantic schemas with YYYY/YY validation, weight 0-100 constraint, QuarterlyTargetBulkCreate 4-quarter invariant
- `src/services/sdbip_service.py` - SDBIPService class (8 methods: scorecard CRUD, KPI CRUD, quarterly target upsert, mSCOA search)
- `src/api/v1/sdbip.py` - FastAPI router: 9 endpoints at /api/v1/sdbip
- `alembic/versions/2026_02_28_0005-add_sdbip_mscoa_models.py` - Migration: 4 tables + 30 mSCOA seed rows
- `tests/test_pms_sdbip.py` - 25 unit tests (all passing)
- `src/models/__init__.py` - Added MscoaReference, SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget, SDBIPStatus, SDBIPLayer, Quarter
- `src/main.py` - Added sdbip import + app.include_router(sdbip.router) after idp.router

## Decisions Made

- **NonTenantModel for mSCOA**: mSCOA v5.5 codes are National Treasury reference data shared globally — using NonTenantModel bypasses the do_orm_execute tenant filter (the filter checks `hasattr(class, 'tenant_id')` and returns early for NonTenantModel)
- **4-quarter bulk create**: QuarterlyTargetBulkCreate enforces all 4 quarters at once at the Pydantic schema level (model_validator), preventing partial sets that would corrupt quarterly reporting
- **Delete-then-insert upsert**: Quarterly target replacement uses DELETE + INSERT (not UPSERT/ON CONFLICT) for SQLite compatibility in unit tests
- **Service-layer FK validation**: mSCOA code and IDP objective FK validation done at service layer (SELECT then 422) rather than relying on DB FK violation (which produces opaque errors in SQLite unit tests)
- **No PMS readiness gate on mSCOA endpoint**: Reference data must be accessible before PMS is fully configured so users can browse budget codes while setting up the system

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SDBIP KPI backbone complete; Plan 28-03 (performance actuals recording) can now add SDBIPActual records FK-linked to SDBIPKpi.id
- Plan 28-04 (golden thread) can add `IDPObjective.sdbip_kpis` back-reference relationship (currently deferred with TODO comment in idp.py)
- Plan 28-05 (SDBIP approval workflow) can add python-statemachine state machine to SDBIPScorecard.status using same IDPWorkflow pattern from 28-01
- mSCOA seed data uses stub codes; production deployment should replace with official mSCOA v5.5 Excel import

---
*Phase: 28-idp-sdbip-core-performance-monitoring*
*Completed: 2026-02-28*

## Self-Check: PASSED

All created files verified present. All task commits verified in git history.

| Check | Result |
|-------|--------|
| src/models/mscoa_reference.py | FOUND |
| src/models/sdbip.py | FOUND |
| src/schemas/sdbip.py | FOUND |
| src/services/sdbip_service.py | FOUND |
| src/api/v1/sdbip.py | FOUND |
| tests/test_pms_sdbip.py | FOUND |
| SUMMARY.md | FOUND |
| Commit c820420 (Task 1) | FOUND |
| Commit e056e97 (Task 2) | FOUND |
