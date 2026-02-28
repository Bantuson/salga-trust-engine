---
phase: 28-idp-sdbip-core-performance-monitoring
plan: "06"
subsystem: pms-auto-population
tags: [celery, beat, auto-population, sdbip, sec-05, gbv-exclusion, aggregation-rules]
requires: ["28-04"]
provides: ["populate_sdbip_actuals Celery task", "SDBIPTicketAggregationRule model", "AutoPopulationEngine service"]
affects: ["src/models/sdbip.py", "src/services/pms_auto_populate.py", "src/tasks/celery_app.py", "src/api/v1/sdbip.py"]
tech-stack:
  added: ["crontab (celery.schedules)"]
  patterns: ["asyncio.run() Celery wrapper", "per-tenant context iteration", "idempotent upsert with pre-check"]
key-files:
  created:
    - src/services/pms_auto_populate.py
    - src/tasks/pms_auto_populate_task.py
    - alembic/versions/2026_02_28_0007_add_aggregation_rules.py
    - tests/test_pms_auto_populate.py
  modified:
    - src/models/sdbip.py
    - src/tasks/celery_app.py
    - src/api/v1/sdbip.py
    - src/schemas/sdbip.py
decisions:
  - "SEC-05 filter is_sensitive==False applied at query level not rule level — cannot be disabled per-rule"
  - "Raw SQL text() for tenant_id discovery bypasses ORM do_orm_execute tenant filter — required since no tenant context set for cross-tenant discovery"
  - "Idempotency via pre-check SELECT before INSERT (not UPSERT) — SQLite compatible"
  - "source_query_ref auto-generated at engine run-time (not stored on rule) — records actual boundaries used"
  - "populate_quarter() clears tenant context in finally — callers must re-set if continuing to use ORM post-call"
metrics:
  duration_minutes: 12
  completed_date: "2026-02-28"
  tasks_completed: 2
  files_created: 4
  files_modified: 4
  tests_added: 10
---

# Phase 28 Plan 06: SDBIP Auto-Population Engine Summary

Auto-population engine that fills SDBIP actuals from resolved ticket data, with SEC-05 GBV exclusion, configurable aggregation rules, and Celery beat scheduling.

## What Was Built

### SDBIPTicketAggregationRule model (`src/models/sdbip.py`)

Added to the existing SDBIP models file:
- `AggregationType(StrEnum)` enum: COUNT, SUM, AVG
- `SDBIPTicketAggregationRule(TenantAwareModel)` with table `sdbip_ticket_aggregation_rules`:
  - `kpi_id` FK to `sdbip_kpis.id`, indexed
  - `ticket_category` String(50) — matches TicketCategory enum values
  - `aggregation_type` String(10) — count/sum/avg
  - `formula_description` Text, nullable — human-readable
  - `source_query_ref` String(500), nullable — set by engine at run-time
  - `is_active` Boolean, default True
  - UniqueConstraint on `(kpi_id, ticket_category)` named `uq_agg_rule_kpi_category`

### AutoPopulationEngine service (`src/services/pms_auto_populate.py`)

Core engine with:
- `get_quarter_boundaries(financial_year, quarter)` — SA financial year (July-start) Q1-Q4 date ranges
- `get_current_quarter()` — resolves today's date to (financial_year, quarter)
- `populate_current_quarter(db)` — convenience wrapper
- `populate_quarter(financial_year, quarter, db)` — main logic:
  - Uses raw SQL `text()` to discover distinct tenant_ids (bypasses ORM tenant filter which requires context)
  - Iterates per-tenant with `set_tenant_context()`/`clear_tenant_context()` try/finally
  - SEC-05: `Ticket.is_sensitive == False` applied unconditionally in every aggregation query
  - Idempotency: checks for existing non-validated auto-populated actual before inserting
  - `source_query_ref` documents exact query parameters on every SDBIPActual created

### Celery beat task (`src/tasks/pms_auto_populate_task.py`)

- Task name: `src.tasks.pms_auto_populate_task.populate_sdbip_actuals`
- Follows `sla_monitor.py` pattern: asyncio.run() wrapper, Windows loop policy, max_retries=3
- Returns dict: `{populated: N, skipped: N, errors: N}`

### Beat schedule (`src/tasks/celery_app.py`)

- Added `"src.tasks.pms_auto_populate_task"` to `include` list
- Added `"populate-sdbip-actuals"` beat entry: `crontab(minute=0, hour=1)` — 01:00 SAST daily
- Imported `crontab` from `celery.schedules`

### Aggregation rule API endpoints (`src/api/v1/sdbip.py`)

- `POST /api/v1/sdbip/kpis/{kpi_id}/aggregation-rules` (201, Tier 2+)
- `GET /api/v1/sdbip/kpis/{kpi_id}/aggregation-rules` (200, Tier 3+)
- `DELETE /api/v1/sdbip/aggregation-rules/{rule_id}` (200, soft deactivate, Tier 2+)

### Pydantic schemas (`src/schemas/sdbip.py`)

- `AggregationRuleCreate(BaseModel)`: ticket_category, aggregation_type, formula_description?
- `AggregationRuleResponse(BaseModel)`: full rule with id, kpi_id, all fields, from_attributes=True

### Alembic migration (`alembic/versions/2026_02_28_0007_add_aggregation_rules.py`)

Creates `sdbip_ticket_aggregation_rules` table with all columns, FK to `sdbip_kpis.id`, unique constraint, and tenant_id/kpi_id indexes.

### Tests (`tests/test_pms_auto_populate.py`) — 10 tests, all pass

| # | Test | Coverage |
|---|------|----------|
| 1 | `test_auto_populate_writes_actual` | Engine creates actual with is_auto_populated=True |
| 2 | `test_gbv_excluded_from_auto_populate` | SEC-05: GBV ticket not counted |
| 3 | `test_count_aggregation` | 3 water tickets -> actual_value=3, electricity excluded |
| 4 | `test_source_query_ref_populated` | source_query_ref has category, is_sensitive=FALSE, dates |
| 5 | `test_idempotency_skips_existing` | Second run: skipped=1, populated=0, 1 actual total |
| 6 | `test_quarter_boundaries` | Q1-Q4 SA financial year date ranges (July-start) |
| 7 | `test_quarter_boundaries_earlier_financial_year` | Boundary logic works for 2024/25 |
| 8 | `test_get_current_quarter_returns_valid_quarter` | Returns valid (fy, quarter) tuple |
| 9 | `test_quarter_boundaries_exclude_out_of_range_tickets` | Q1 ticket date not in Q3 range |
| 10 | `test_auto_populated_flag_distinguishable` | is_auto_populated True vs False |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tenant context cleared by populate_quarter() breaks subsequent ORM calls in tests**
- **Found during:** Task 2 (test_auto_populated_flag_distinguishable)
- **Issue:** `populate_quarter()` calls `clear_tenant_context()` in its `finally` block for each tenant. After the engine run completes, tenant context is cleared. Test called `service.submit_actual()` after engine ran, triggering SecurityError (tenant context not set).
- **Fix:** Added `set_tenant_context(tenant_id)` call in test after `populate_quarter()` returns, before calling `submit_actual()`. Added explanatory comment.
- **Files modified:** `tests/test_pms_auto_populate.py`
- **Commit:** included in 8007306

None other — plan executed as designed.

## Key Security Properties Verified

- `Ticket.is_sensitive == False` appears in every aggregation query in `_process_rule()`
- SEC-05 test explicitly verifies GBV ticket (is_sensitive=True) is NOT counted
- `actual_value == 1` (not 2) when both normal + GBV ticket exist — confirms exclusion

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/models/sdbip.py | FOUND |
| src/services/pms_auto_populate.py | FOUND |
| src/tasks/pms_auto_populate_task.py | FOUND |
| alembic/versions/2026_02_28_0007_add_aggregation_rules.py | FOUND |
| tests/test_pms_auto_populate.py | FOUND |
| .planning/phases/28-idp-sdbip-core-performance-monitoring/28-06-SUMMARY.md | FOUND |
| Commit 6315137 (Task 1) | FOUND |
| Commit 8007306 (Task 2) | FOUND |
| SEC-05 filter (is_sensitive == False) in service | 6 occurrences confirmed |
| All 10 tests pass | CONFIRMED |
