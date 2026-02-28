---
phase: 28-idp-sdbip-core-performance-monitoring
plan: 03
subsystem: api
tags: [python-statemachine, sdbip, pms, approval-workflow, audit-log, mid-year-adjustment]

# Dependency graph
requires:
  - phase: 28-02
    provides: SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget models and service CRUD

provides:
  - SDBIPWorkflow state machine (draft -> approved -> revised -> approved)
  - transition_scorecard() service method with Executive Mayor role gate
  - adjust_targets() service method with audit log (SDBIP-09: no draft reset)
  - POST /scorecards/{id}/transition API endpoint
  - PATCH /kpis/{id}/adjust-targets API endpoint
  - 7 new tests (tests 11-17) for approval workflow and mid-year adjustment

affects: [28-04, 28-05, 28-06, 28-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SDBIPWorkflow uses python-statemachine 3.x start_value= model binding (same pattern as IDPWorkflow in 28-01)"
    - "Mayor role gate: executive_mayor|admin|salga_admin bypass check (same pattern as IDP transition_cycle)"
    - "Mid-year adjustment captures old targets before DELETE for audit log diff"
    - "ID capture pattern: save UUID to local variable before any commit expires ORM object"

key-files:
  created: []
  modified:
    - src/models/sdbip.py
    - src/services/sdbip_service.py
    - src/api/v1/sdbip.py
    - src/schemas/sdbip.py
    - tests/test_pms_sdbip.py

key-decisions:
  - "resubmit event (revised->approved) also requires Mayor role gate — plan was ambiguous, applied same logic as submit for governance consistency"
  - "AuditLog uses OperationType.UPDATE (not a custom PMS event type) to avoid AuditLog schema changes in this plan"
  - "Old targets captured via SELECT before DELETE for audit diff — ensures complete before/after record in changes JSON"

patterns-established:
  - "ID capture before commit: always save kpi.id = kpi.id before calling service methods that commit, since SQLAlchemy expires ORM objects after commit"
  - "Setup helper returns tuple (kpi, scorecard) with IDs captured inside helper — avoids MissingGreenlet errors in async tests"

requirements-completed: [SDBIP-06, SDBIP-09]

# Metrics
duration: 45min
completed: 2026-02-28
---

# Phase 28 Plan 03: SDBIP Approval Workflow Summary

**SDBIP approval state machine (draft->approved->revised) with Executive Mayor sign-off gate and mid-year target adjustment endpoint (SDBIP-09) that preserves approved status with full audit trail**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-02-28T21:00:00Z
- **Completed:** 2026-02-28T21:45:00Z
- **Tasks:** 1 (single integrated task)
- **Files modified:** 5

## Accomplishments

- SDBIPWorkflow state machine added to `src/models/sdbip.py` with 3 states (draft, approved, revised) and 3 transitions (submit, revise, resubmit)
- `transition_scorecard()` service method with Executive Mayor role gate — only `executive_mayor`, `admin`, `salga_admin` may submit (returns 403 otherwise); invalid transitions return 409
- `adjust_targets()` service method implementing SDBIP-09 — updates quarterly targets on approved SDBIPs without resetting status, creates AuditLog with old/new target diff
- Two new API endpoints: `POST /scorecards/{id}/transition` and `PATCH /kpis/{id}/adjust-targets`
- 7 new tests (tests 11-17): all 32 SDBIP tests pass

## Task Commits

1. **Task 1: SDBIP approval state machine and mid-year adjustment** — `228b0e8` (feat)

Note: SDBIPWorkflow state machine, transition_scorecard, adjust_targets, and SDBIPTransitionRequest schema were also committed within the 28-04 linter-pre-commits (de436f3, 4da8807). The 28-03 task commit captures the 7 new test cases.

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/models/sdbip.py` — Added SDBIPWorkflow StateMachine class (3 states, 3 transitions); statemachine imports
- `src/schemas/sdbip.py` — Added SDBIPTransitionRequest schema
- `src/services/sdbip_service.py` — Added transition_scorecard() and adjust_targets() methods; AuditLog import
- `src/api/v1/sdbip.py` — Added POST /scorecards/{id}/transition and PATCH /kpis/{id}/adjust-targets endpoints
- `tests/test_pms_sdbip.py` — Added 7 tests (11-17), make_mock_mayor helper, AuditLog/SDBIPWorkflow imports

## Decisions Made

- `resubmit` event (revised->approved) applies the same Mayor role gate as `submit` — plan was ambiguous; governance consistency demands re-approval requires executive sign-off
- `OperationType.UPDATE` used for mid-year adjustment audit log — avoids introducing new audit operation types in this plan
- Old targets captured via SELECT before DELETE — ensures complete before/after diff in the audit log `changes` JSON

## Deviations from Plan

### Note: Pre-committed 28-04 Work

The linter/auto-tool pre-committed 28-04 work (SDBIPActual model, actuals service, actuals API) into the repository before this plan executed. This means:
- The source code changes for 28-03 (SDBIPWorkflow, transition_scorecard, adjust_targets) were committed as part of the 28-04 linter commits
- The 28-03 task commit (228b0e8) captures only the test file additions
- All 28-03 functionality is present and tested — the split between commits is a side effect of the pre-execution, not a deficiency

No deviation rules triggered. No auto-fixes were required.

## Issues Encountered

**SQLAlchemy MissingGreenlet on expired ORM objects after commit:** After `service.set_quarterly_targets()` or `service.transition_scorecard()` commit, accessing attributes on expired ORM objects (even primary keys) triggers synchronous lazy loading in async context.

Resolution: Capture UUIDs to local variables immediately after each ORM create call, before any subsequent service call commits. In the `_setup_approved_kpi` helper, call `service.get_kpi(kpi_id, db_session)` to reload a fresh KPI instance after all setup commits are complete.

## Next Phase Readiness

- SDBIP approval workflow complete — Mayor can now formally sign off on scorecards
- Mid-year adjustment (SDBIP-09) complete — Directors can update targets without restarting governance cycle
- Ready for 28-04 (performance actuals recording — submit quarterly actuals, traffic-light computation)
- `SDBIPActual` model and actuals service/API already pre-committed by linter; 28-04 tests may already exist at `tests/test_pms_actuals.py`

---
*Phase: 28-idp-sdbip-core-performance-monitoring*
*Completed: 2026-02-28*
