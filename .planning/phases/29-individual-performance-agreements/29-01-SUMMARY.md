---
phase: 29
plan: 29-01
subsystem: backend-pms-pa
tags: [performance-agreements, section57, state-machine, popia, role-gated-signing]
dependency_graph:
  requires: [28-01-SUMMARY, 28-02-SUMMARY]  # Depends on SDBIP KPI models
  provides: [PA-models, PA-API, PA-state-machine]
  affects: [pa_kpis, performance_agreements, pa_quarterly_scores]
tech_stack:
  added: []
  patterns:
    - python-statemachine 3.0.0 start_value= binding for non-initial PA states
    - PAWorkflow assessed state marked final=True (required by statemachine validator)
    - Service-layer weight sum enforcement (not DB constraint) for SQLite compatibility
    - SELECT-then-422 FK validation (not DB FK violation) for SQLite compatibility
key_files:
  created:
    - src/models/pa.py
    - src/schemas/pa.py
    - src/services/pa_service.py
    - src/api/v1/pa.py
    - alembic/versions/2026_03_01_0001-add_performance_agreements.py
    - tests/test_pms_pa.py
  modified:
    - src/models/__init__.py
    - src/main.py
decisions:
  - "PAWorkflow assessed state uses final=True — python-statemachine 3.0.0 requires all non-final states have outgoing transitions; without final=True the class definition raises InvalidDefinition"
  - "_create_sdbip_kpi test helper uses uuid suffix for IDP cycle titles — IDPCycle has (title, tenant_id) unique constraint that would fail if called twice in same test"
  - "Alembic migration down_revision uses f4g5h6i7j8k9 (evidence_documents) — the 0007 aggregation rules file has a branching issue with 0006; evidence_documents is the cleaner head"
metrics:
  duration: "13 minutes"
  completed_date: "2026-03-01"
  tasks_completed: 6
  files_created: 6
  files_modified: 2
---

# Phase 29 Plan 01: Performance Agreement Data Models, CRUD API, State Machine, and Signing Summary

Performance Agreement backend for Section 57 managers: SQLAlchemy models with state machine, Pydantic schemas, service layer with role-gated signing, FastAPI router, Alembic migration, and 15 unit tests — all passing.

## Tasks Completed

| Task | Title | Commit | Key Files |
|------|-------|--------|-----------|
| 29-01-1 | PA Models, Enums, and State Machine | 902610f | src/models/pa.py |
| 29-01-2 | PA Pydantic Schemas | 84b00e1 | src/schemas/pa.py |
| 29-01-3 | PA Service Layer | 13bcf27 | src/services/pa_service.py |
| 29-01-4 | PA API Router and Application Registration | cd5194e | src/api/v1/pa.py, src/models/__init__.py, src/main.py |
| 29-01-5 | Alembic Migration for PA Tables | 91f9516 | alembic/versions/2026_03_01_0001-add_performance_agreements.py |
| 29-01-6 | Unit Tests for PA-01, PA-02, PA-05, PA-06 | 35f79a0 | tests/test_pms_pa.py |

## What Was Built

**Models (src/models/pa.py):**
- `PAStatus` StrEnum: draft, signed, under_review, assessed
- `ManagerRole` StrEnum: section57_director, municipal_manager
- `PAWorkflow(StateMachine)` with 4 states, 3 transitions (sign, open_review, assess); assessed state marked `final=True`
- `PerformanceAgreement(TenantAwareModel)` — financial_year, section57_manager_id FK, manager_role, status, annual_score, POPIA fields; UniqueConstraint(manager_id, FY, tenant)
- `PAKpi(TenantAwareModel)` — agreement_id FK, sdbip_kpi_id FK, individual_target, weight, description; UniqueConstraint(agreement_id, sdbip_kpi_id)
- `PAQuarterlyScore(TenantAwareModel)` — pa_kpi_id FK, quarter, score, scored_by, scored_at, notes; UniqueConstraint(pa_kpi_id, quarter)

**Schemas (src/schemas/pa.py):**
- `PACreate` with financial_year YYYY/YY validation and manager_role validation
- `PAKpiCreate` with individual_target >= 0 and weight 0-100
- `PAScoreCreate` with Q1-Q4 quarter validation
- `PATransitionRequest` validating sign/open_review/assess events
- `PAResponse`, `PAKpiResponse`, `PAScoreResponse` with `from_attributes=True`
- `PAKpiBulkCreate` for batch operations

**Service (src/services/pa_service.py):**
- `create_agreement`: validates manager FK via SELECT, catches IntegrityError for 409
- `list_agreements` / `get_agreement`: list and single retrieval
- `add_kpi`: validates sdbip_kpi_id FK, enforces weight sum <= 100 at service layer
- `list_kpis` / `get_kpi`: KPI retrieval
- `transition_agreement`: PA-06 role gate (MM/admin/salga for directors, ExecMayor/admin/salga for MM), PAWorkflow with `start_value=`, POPIA flag on assess, ID captured before commit
- `add_score`: quarterly score submission with duplicate IntegrityError guard

**API Router (src/api/v1/pa.py):**
- Prefix: `/api/v1/pa`, Tags: `[Performance Agreements]`
- `POST /agreements` (201, require_pms_ready + Tier 3+)
- `GET /agreements` (200, optional financial_year filter)
- `GET /agreements/{id}` (200, 404 if not found)
- `POST /agreements/{id}/kpis` (201, Tier 3+)
- `GET /agreements/{id}/kpis` (200)
- `POST /agreements/{id}/transitions` (200, Tier 1+ — signers are Tier 1; role check inside service)

**Migration (alembic/versions/2026_03_01_0001):**
- Creates `performance_agreements`, `pa_kpis`, `pa_quarterly_scores` with all TenantAwareModel columns
- Unique constraints: uq_pa_manager_fy_tenant, uq_pa_kpi_agreement_sdbip, uq_pa_score_kpi_quarter
- Indexes on all FK columns and tenant_id
- RLS policies for PostgreSQL tenant isolation
- downgrade() drops in reverse order

**Tests (tests/test_pms_pa.py): 15 tests, all passing**
- Agreement creation in draft, unique constraint 409, KPI addition, weight >100 rejection
- MM signs director PA, PMS officer 403, ExecMayor signs MM PA, sign-twice 409
- Full lifecycle draft→signed→under_review→assessed, POPIA flag on assess
- Schema validation (financial_year format, manager_role, PA transition event)

## Verification Results

```
pytest tests/test_pms_pa.py -x -v
15 passed, 5 warnings in 21.44s

pytest tests/test_pms_sdbip.py tests/test_pms_idp.py tests/test_pms_actuals.py -x
87 passed, 37 warnings in 38.45s

python -c "from src.models import PerformanceAgreement, PAKpi, PAQuarterlyScore; from src.api.v1.pa import router; from src.services.pa_service import PAService; print('All PA components imported OK')"
All PA components imported OK
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PAWorkflow assessed state requires final=True**
- **Found during:** Task 1 verification
- **Issue:** python-statemachine 3.0.0 raises `InvalidDefinition: All non-final states should have at least one outgoing transition` for `assessed` state which has no outgoing transitions
- **Fix:** Added `final=True` to the `assessed = State(final=True, value="assessed")` definition
- **Files modified:** src/models/pa.py
- **Commit:** 902610f (included in original commit)

**2. [Rule 1 - Bug] _create_sdbip_kpi test helper used duplicate IDP cycle titles**
- **Found during:** Task 6 test run
- **Issue:** IDPCycle has UniqueConstraint on (title, tenant_id); calling _create_sdbip_kpi twice in the same test with same tenant_id caused IntegrityError
- **Fix:** Added `suffix` parameter (defaults to `uuid4().hex[:8]`) to generate unique titles per call
- **Files modified:** tests/test_pms_pa.py
- **Commit:** 35f79a0 (included in test commit)

## Self-Check: PASSED

All 6 files created and all 6 commits verified present.
