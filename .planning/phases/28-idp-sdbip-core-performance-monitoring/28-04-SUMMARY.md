---
phase: 28-idp-sdbip-core-performance-monitoring
plan: "04"
subsystem: pms-actuals
tags: [sdbip, actuals, performance-monitoring, immutability, traffic-light, correction-chain]
dependency_graph:
  requires: ["28-02"]
  provides: ["28-05"]
  affects: ["src/models/sdbip.py", "src/schemas/sdbip.py", "src/services/sdbip_service.py", "src/api/v1/sdbip.py"]
tech_stack:
  added: []
  patterns:
    - "TrafficLight StrEnum enum for green/amber/red performance status"
    - "compute_achievement(actual, target) -> (Decimal, str) pure function — no DB dependency"
    - "Self-referencing FK: SDBIPActual.corrects_actual_id -> sdbip_actuals.id for correction chain"
    - "Immutability enforced at API layer (not DB) — is_validated flag + 422 guard"
    - "Alembic migration with self-referencing FK and RLS policy"
key_files:
  created:
    - alembic/versions/2026_02_28_0006-add_sdbip_actuals.py
    - tests/test_pms_actuals.py
  modified:
    - src/models/sdbip.py
    - src/schemas/sdbip.py
    - src/services/sdbip_service.py
    - src/api/v1/sdbip.py
decisions:
  - "TrafficLight thresholds: green >= 80%, amber 50-79%, red < 50% — matches MFMA Section 52/72 reporting standards"
  - "Division by zero (target=0) returns (Decimal('0'), 'red') — graceful degradation, not exception"
  - "Correction chain stored as new SDBIPActual with corrects_actual_id FK (not soft-delete) — full audit trail"
  - "Immutability at API layer (not DB constraint) — PUT/PATCH return 422 when is_validated=True; DB stays mutable for PMS officer validation in 28-05"
  - "SDBIPActual.actuals relationship added to SDBIPKpi with explicit foreign_keys=[SDBIPActual.kpi_id] to avoid ambiguity with self-ref FK"
  - "Correction reason stored in source_query_ref field (reused for correction audit trail)"
metrics:
  duration: "21 minutes"
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_modified: 5
  tests_added: 30
---

# Phase 28 Plan 04: SDBIP Actuals Submission System Summary

**One-liner:** Quarterly actuals submission with auto-computed achievement percentage, traffic-light status (green/amber/red), immutability enforcement, and correction chain via self-referencing FK.

## What Was Built

### Task 1: SDBIPActual Model, TrafficLight Enum, compute_achievement, Migration

**TrafficLight enum** (`src/models/sdbip.py`):
```python
class TrafficLight(StrEnum):
    GREEN = "green"   # >= 80%
    AMBER = "amber"   # 50-79%
    RED = "red"       # < 50% (also division by zero)
```

**compute_achievement helper** — pure function, no DB dependency:
```python
def compute_achievement(actual: Decimal, target: Decimal) -> tuple[Decimal, str]:
    if target == Decimal("0"):
        return Decimal("0"), TrafficLight.RED
    pct = (actual / target) * Decimal("100")
    if pct >= Decimal("80"): return pct, TrafficLight.GREEN
    elif pct >= Decimal("50"): return pct, TrafficLight.AMBER
    else: return pct, TrafficLight.RED
```

**SDBIPActual model** — 17 columns including:
- `kpi_id` FK, `quarter`, `financial_year`, `actual_value`
- `achievement_pct` and `traffic_light_status` (auto-computed on write)
- `submitted_by/at`, `is_validated`, `validated_by/at` (immutability fields)
- `corrects_actual_id` (self-referencing FK for correction chain)
- `is_auto_populated`, `source_query_ref` (for 28-06 auto-population engine)

**Pydantic schemas**: `SDBIPActualCreate`, `SDBIPActualResponse`, `SDBIPActualCorrectionCreate`

**Migration**: `2026_02_28_0006-add_sdbip_actuals.py` — creates sdbip_actuals table with 3 indexes and RLS policy.

### Task 2: Service Methods, API Endpoints, 30 Tests

**SDBIPService new methods**:
- `submit_actual()` — loads KPI + quarterly target, calls compute_achievement, creates SDBIPActual
- `get_actual()` — single fetch by ID
- `list_actuals()` — all actuals for a KPI ordered by quarter
- `submit_correction()` — validates original is validated, creates new record with corrects_actual_id

**API endpoints** added to `/api/v1/sdbip`:
- `POST /actuals` — Tier 2+ submit
- `GET /kpis/{kpi_id}/actuals` — Tier 3+ list
- `GET /actuals/{actual_id}` — Tier 3+ get single
- `POST /actuals/{actual_id}/correct` — Tier 2+ correction (validated only)
- `PUT /actuals/{actual_id}` — 422 guard if is_validated=True
- `PATCH /actuals/{actual_id}` — 422 guard if is_validated=True

**tests/test_pms_actuals.py** — 797 lines, 30 tests:
1. `test_submit_actual_computes_pct` — 85/100 -> pct=85, green
2. `test_achievement_pct_formula` — verifies (actual/target)*100 formula
3. `test_traffic_light_green` — pct >= 80 -> green (4 variants)
4. `test_traffic_light_amber` — 50 <= pct < 80 -> amber (3 variants)
5. `test_traffic_light_red` — pct < 50 -> red (3 variants)
6. `test_traffic_light_zero_target` — target=0 -> pct=0, red, no exception (3 variants)
7. `test_validated_actual_immutable` — PUT returns 422
8. `test_validated_actual_patch_immutable` — PATCH returns 422
9. `test_correction_record_links_original` — corrects_actual_id FK set correctly
10. `test_correction_only_on_validated` — unvalidated actual rejects correction
11. `test_list_actuals_for_kpi` — all actuals returned (+ includes corrections, + empty case)
12. `test_submit_actual_no_target` — 422 when no quarterly target set

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Pre-existing Issues (Out of Scope)

**Pre-existing: test_pms_sdbip.py::TestMidYearAdjustment tests were uncommitted**
- Found during: general test run (checking baseline)
- Issue: `tests/test_pms_sdbip.py` had unstaged changes (TestMidYearAdjustment) from plan 28-03 that were committed by the user mid-execution as commit `228b0e8`
- These are pre-existing changes unrelated to plan 28-04
- All 32 test_pms_sdbip.py tests now pass

## Test Results

```
tests/test_pms_actuals.py: 30 passed
tests/test_pms_sdbip.py: 32 passed
```

## Self-Check: PASSED

Created files verified:
- `src/models/sdbip.py` — FOUND (TrafficLight, compute_achievement, SDBIPActual)
- `src/schemas/sdbip.py` — FOUND (SDBIPActualCreate, SDBIPActualResponse, SDBIPActualCorrectionCreate)
- `src/services/sdbip_service.py` — FOUND (submit_actual, submit_correction, list_actuals)
- `src/api/v1/sdbip.py` — FOUND (6 new actuals endpoints)
- `alembic/versions/2026_02_28_0006-add_sdbip_actuals.py` — FOUND
- `tests/test_pms_actuals.py` — FOUND (797 lines, 30 tests)

Commits verified:
- `de436f3` — Task 1: model, enum, schemas, migration
- `4da8807` — Task 2: service, API, tests
