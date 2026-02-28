---
phase: 28-idp-sdbip-core-performance-monitoring
plan: 01
subsystem: database
tags: [idp, pms, statemachine, sqlalchemy, pydantic, alembic, fastapi]

# Dependency graph
requires:
  - phase: 27-rbac-foundation-tenant-configuration
    provides: "TenantAwareModel base, require_pms_ready() gate, require_min_tier() deps, PMS officer role"
provides:
  - "IDPCycle, IDPGoal, IDPObjective, IDPVersion ORM models (TenantAwareModel, RLS)"
  - "IDPWorkflow state machine: draft -> approved -> under_review -> approved"
  - "IDPService CRUD + get_golden_thread() (nested cycle->goals->objectives dict)"
  - "IDP FastAPI router /api/v1/idp with 10 endpoints, PMS-gated, Tier 3+"
  - "Alembic migration 2026_02_28_0004 creating all 4 IDP tables with RLS"
affects:
  - 28-02-sdbip-kpi-backbone
  - 28-03-sdbip-scoring-engine
  - 28-04-golden-thread-linkage
  - 28-05-performance-monitoring-dashboard

# Tech tracking
tech-stack:
  added:
    - "python-statemachine==3.0.0 (approval workflow state machines)"
  patterns:
    - "IDPWorkflow(model=cycle, state_field='status', start_value=cycle.status) — model binding for non-initial states"
    - "TransitionNotAllowed caught and converted to HTTP 409 Conflict"
    - "forward relationship removed when referenced model (SDBIPKpi) doesn't exist yet in Wave 1"

key-files:
  created:
    - src/models/idp.py
    - src/schemas/idp.py
    - src/services/idp_service.py
    - src/api/v1/idp.py
    - alembic/versions/2026_02_28_0004-add_idp_models.py
    - tests/test_pms_idp.py
  modified:
    - src/models/__init__.py
    - src/main.py

key-decisions:
  - "SDBIPKpi forward relationship NOT declared on IDPObjective in Wave 1 — SQLAlchemy raises InvalidRequestError at startup when referenced class is missing; Plan 28-04 adds this after SDBIPKpi model exists"
  - "IDPWorkflow uses start_value parameter (python-statemachine 3.0.0) for model binding to non-initial states"
  - "IDP tests use real SQLite db_session + set_tenant_context/clear_tenant_context (not mocks) because IDPService.get_golden_thread uses selectinload which requires real ORM session"
  - "idp_versions uniqueness enforced via DB UniqueConstraint + exception catch in service layer (409)"

patterns-established:
  - "State machine model binding: IDPWorkflow(model=orm_obj, state_field='status', start_value=orm_obj.status)"
  - "Wave-staged relationships: omit forward FK until target model exists; add in plan that creates the target"
  - "Golden thread pattern: selectinload(IDPCycle.goals).selectinload(IDPGoal.objectives) for nested eager load"

requirements-completed: [IDP-01, IDP-02, IDP-03, IDP-05]

# Metrics
duration: 35min
completed: 2026-02-28
---

# Phase 28 Plan 01: IDP Data Backbone Summary

**IDP CRUD API with 4-table hierarchy (Cycle->Goal->Objective->Version), IDPWorkflow state machine (draft/approved/under_review), golden thread nested query, and 21 passing unit tests using python-statemachine 3.0.0 model binding**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-02-28T20:30:00Z
- **Completed:** 2026-02-28T21:05:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 4 SQLAlchemy ORM models inheriting TenantAwareModel with RLS (IDPCycle, IDPGoal, IDPObjective, IDPVersion)
- IDPWorkflow state machine with 3-state / 3-transition FSM preventing invalid transitions (409 Conflict)
- IDPService with full CRUD including `get_golden_thread()` returning nested cycle->goals->objectives->kpis dict
- FastAPI router with 10 endpoints all gated by `require_pms_ready()` + `require_min_tier(3)`
- Alembic migration with RLS policies for all 4 IDP tables
- 21 unit tests covering all 12 required scenarios plus edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: IDP models, schemas, Alembic migration, and state machine** - `619e77a` (feat)
2. **Task 2: IDP service, API routes, tests, and main.py registration** - `a7e4476` (feat)

**Plan metadata:** (created with this SUMMARY commit)

## Files Created/Modified
- `src/models/idp.py` - IDPCycle, IDPGoal, IDPObjective, IDPVersion ORM models + IDPStatus/NationalKPA enums + IDPWorkflow FSM
- `src/schemas/idp.py` - Pydantic v2 schemas with validators (5-year span, KPA enum, YYYY/YY pattern)
- `src/services/idp_service.py` - IDPService CRUD + state machine transitions + get_golden_thread
- `src/api/v1/idp.py` - FastAPI router with 10 endpoints, PMS gate + Tier 3+ deps
- `alembic/versions/2026_02_28_0004-add_idp_models.py` - Migration creating 4 IDP tables with RLS
- `tests/test_pms_idp.py` - 21 unit tests (db_session + set_tenant_context pattern)
- `src/models/__init__.py` - Added IDP model imports and __all__ entries
- `src/main.py` - Registered idp.router under Phase 28 section

## Decisions Made
- **SDBIPKpi forward relationship deferred:** IDPObjective cannot declare `sdbip_kpis` relationship in Wave 1 because `SDBIPKpi` model doesn't exist yet — SQLAlchemy raises `InvalidRequestError` at startup. The relationship will be added in Plan 28-04 once `SDBIPKpi` is created.
- **State machine model binding:** Used `IDPWorkflow(model=cycle, state_field="status", start_value=cycle.status)` with python-statemachine 3.0.0. The `start_value` parameter is critical for non-initial states (approved, under_review); without it the FSM always starts from `draft`.
- **Test strategy:** Used real SQLite `db_session` + `set_tenant_context()/clear_tenant_context()` instead of mocks, because `get_golden_thread()` uses `selectinload` which requires a real ORM session with proper relationship loading.
- **Version uniqueness:** DB-level `UniqueConstraint("cycle_id", "version_number")` + service-layer exception catch converting IntegrityError to HTTP 409.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed SDBIPKpi forward relationship from IDPObjective**
- **Found during:** Task 2 (first test run)
- **Issue:** IDPObjective declared `sdbip_kpis = relationship("SDBIPKpi", ...)` but `SDBIPKpi` model doesn't exist in Wave 1. SQLAlchemy raises `InvalidRequestError: expression 'SDBIPKpi' failed to locate a name` at mapper initialization (startup crash).
- **Fix:** Replaced forward relationship with a comment directing Plan 28-04 to add it after `SDBIPKpi` model is created. The `get_golden_thread()` service uses `kpis: []` (empty list placeholder) consistent with plan specification.
- **Files modified:** `src/models/idp.py`
- **Verification:** All 21 tests pass without the relationship; placeholder `kpis: []` returned in golden thread as expected.
- **Committed in:** `a7e4476` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Auto-fix was necessary for correctness — the relationship would cause startup crash on Wave 1. Wave 3 plan (28-04) must add the relationship after SDBIPKpi model exists.

## Issues Encountered
- python-statemachine was not installed — installed 3.0.0 (plan called for >=2.0.0). API differs from 2.x: uses `configuration` property instead of `current_state`, uses `start_value` parameter for non-initial state initialization.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IDP backbone complete. Plan 28-02 can reference `IDPObjective.id` as FK target for SDBIP KPI anchor points.
- `get_golden_thread()` returns `kpis: []` placeholder — Plan 28-04 populates this after SDBIPKpi is created.
- All 4 IDP tables have RLS policies — multi-tenant isolation enforced at both application and DB level.

---
*Phase: 28-idp-sdbip-core-performance-monitoring*
*Completed: 2026-02-28*

## Self-Check: PASSED

All created files verified present on disk. All task commits (619e77a, a7e4476) verified in git log.
