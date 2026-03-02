---
phase: 32-risk-register-public-transparency
plan: 1
subsystem: risk-register
tags: [risk-register, sdbip, celery, public-transparency, rbac, iso-31000]
dependency_graph:
  requires:
    - "Phase 28: SDBIP models (SDBIPKpi, SDBIPActual)"
    - "Phase 27: TenantAwareModel, require_role, require_min_tier, require_pms_ready"
    - "Phase 28: AuditLog, OperationType"
  provides:
    - "RiskItem model with ISO 31000 risk_rating"
    - "RiskMitigation model"
    - "RiskService: create, list, update, delete, auto_flag_for_kpi"
    - "7 endpoints under /api/v1/risk-register/"
    - "flag_risk_items_for_kpi Celery task"
    - "Public SDBIP achievement endpoint /api/v1/public/sdbip-performance"
  affects:
    - "src/api/v1/sdbip.py: auto-flag dispatch on red actuals"
    - "src/tasks/celery_app.py: include list extended"
    - "src/main.py: risk router registered"
    - "src/api/v1/public.py: sdbip-performance endpoint added"
    - "src/services/public_metrics_service.py: get_sdbip_achievement method added"
tech_stack:
  added:
    - "No new dependencies added"
  patterns:
    - "TDD: test first (RED), then implementation (GREEN)"
    - "ISO 31000 5x5 risk matrix: score = likelihood * impact"
    - "ID-before-commit pattern: flush() before commit() to avoid MissingGreenlet"
    - "Celery on-demand dispatch with try/except fail-open pattern"
    - "Raw SQL text() for cross-tenant public SDBIP query"
    - "require_pms_ready() + require_role() RBAC layering"
key_files:
  created:
    - src/models/risk.py
    - src/schemas/risk.py
    - src/services/risk_service.py
    - src/api/v1/risk.py
    - src/tasks/risk_autoflag_task.py
    - alembic/versions/20260302_add_risk_register.py
    - tests/test_risk_register.py
  modified:
    - src/api/v1/sdbip.py
    - src/tasks/celery_app.py
    - src/main.py
    - src/api/v1/public.py
    - src/services/public_metrics_service.py
decisions:
  - "Auto-flag fail-open: Celery dispatch failure on Redis down does not break actuals submission — try/except logs warning only"
  - "Auto-flag count returns 0 for critical items: critical rating is never auto-overwritten (governance invariant)"
  - "Manual edit clears auto_flag: is_auto_flagged=False on any update, allowing CFO override"
  - "Raw SQL text() for public SDBIP achievement query — bypasses ORM tenant filter for cross-tenant public aggregation"
  - "Public SDBIP endpoint falls back to empty list on SQL error — graceful degradation for SQLite test environment"
  - "Migration down_revision: 20260302_evidence_verification — latest migration at plan time"
metrics:
  duration: "24 minutes"
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_created: 7
  files_modified: 5
---

# Phase 32 Plan 1: Risk Register Backend Summary

**One-liner:** ISO 31000 risk register backend with 7 CRUD endpoints, Celery auto-flag task on red actuals, and public SDBIP achievement transparency endpoint.

## What Was Built

### Task 1: Risk Register Models, Schemas, Service, Migration, and Unit Tests

**`src/models/risk.py`** — Two TenantAwareModel classes:
- `RiskRating` StrEnum (low, medium, high, critical)
- `compute_risk_rating(likelihood, impact)` — ISO 31000 5x5: score = likelihood * impact; critical >= 15, high >= 8, medium >= 4, low < 4
- `RiskItem` — kpi_id, department_id, title, description, likelihood, impact, risk_rating, is_auto_flagged, auto_flagged_at, is_deleted
- `RiskMitigation` — risk_item_id, strategy, responsible_person_id, target_date, status

**`src/schemas/risk.py`** — Pydantic v2 schemas with `from_attributes=True`:
- `RiskItemCreate`, `RiskItemUpdate`, `RiskItemResponse`
- `RiskMitigationCreate`, `RiskMitigationResponse`
- `RiskRegisterSummary` (total, critical, high, medium, low, auto_flagged)

**`src/services/risk_service.py`** — `RiskService` class with 8 methods:
- `create_risk_item` — auto-computes risk_rating, creates child mitigations, uses flush() before commit (MissingGreenlet pattern)
- `add_mitigation` — adds mitigation to existing risk item
- `list_risk_items` — ordered by severity (critical first), supports department_id filter (RISK-04)
- `get_risk_item` — single item with mitigations eager-loaded via selectinload
- `update_risk_item` — recomputes rating if likelihood/impact changed, clears auto_flag
- `delete_risk_item` — soft delete (is_deleted=True)
- `auto_flag_for_kpi` — sets high rating + is_auto_flagged on all linked non-critical items, creates AuditLog entries
- `get_risk_register_summary` — counts by rating and auto-flag status

**`alembic/versions/20260302_add_risk_register.py`** — Migration creating `risk_items` and `risk_mitigations` tables with all FK constraints and indexes.

**`tests/test_risk_register.py`** — 13 unit tests covering all RISK-01 through RISK-04 requirements. All pass.

### Task 2: Risk Register API, Celery Auto-Flag Task, Actuals Hook, Public SDBIP Endpoint

**`src/api/v1/risk.py`** — FastAPI router with 7 endpoints under `/risk-register/`:
1. `POST /` — Create risk item (Tier 2+, PMS ready)
2. `GET /` — List risk register (CFO/MM/ExecMayor/Admin/SalgaAdmin only — RISK-04)
3. `GET /summary` — Summary counts (same RBAC as GET /)
4. `GET /{id}` — Get single item (Tier 2+)
5. `PUT /{id}` — Update risk item (Tier 2+)
6. `DELETE /{id}` — Soft delete (Tier 2+)
7. `POST /{id}/mitigations` — Add mitigation strategy (Tier 2+)

**`src/tasks/risk_autoflag_task.py`** — `flag_risk_items_for_kpi` Celery task:
- On-demand dispatch (not beat schedule)
- Windows asyncio compat (WindowsSelectorEventLoopPolicy)
- Exponential retry: 60s/120s/240s (max 3 retries)
- Deferred imports for Celery worker isolation

**`src/tasks/celery_app.py`** — Added `"src.tasks.risk_autoflag_task"` to include list.

**`src/main.py`** — Registered risk router: `app.include_router(risk_register.router, prefix="/api/v1")` after Phase 31 routers.

**`src/api/v1/sdbip.py`** — Hooked auto-flag dispatch in both `submit_actual` and `validate_actual` when `traffic_light_status == "red"`. Uses try/except fail-open (Redis failure logs warning, does not break actuals submission).

**`src/services/public_metrics_service.py`** — Added `get_sdbip_achievement` method using raw SQL `text()` for cross-tenant public query. Returns per-municipality KPI achievement summary (total_kpis, green, amber, red, overall_achievement_pct).

**`src/api/v1/public.py`** — Added `/sdbip-performance` endpoint: no auth, rate-limited, supports municipality_id and financial_year filters.

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

```
pytest tests/test_risk_register.py -x
13 passed, 5 warnings in 17.08s
```

All 13 tests pass. Warnings are about sync functions with asyncio mark (test helper functions) — not failures.

## Self-Check: PASSED

Files created/verified:
- FOUND: src/models/risk.py
- FOUND: src/schemas/risk.py
- FOUND: src/services/risk_service.py
- FOUND: src/api/v1/risk.py
- FOUND: src/tasks/risk_autoflag_task.py
- FOUND: alembic/versions/20260302_add_risk_register.py
- FOUND: tests/test_risk_register.py

Commits verified:
- FOUND: c20f6b6 (Task 1: models, schemas, service, migration, tests)
- FOUND: 1002ce2 (Task 2: API, Celery task, actuals hook, public endpoint)

Verification commands all pass:
- `python -c "from src.models.risk import RiskItem, RiskMitigation, RiskRating, compute_risk_rating"` — Models OK
- `python -c "from src.schemas.risk import RiskItemCreate, RiskItemResponse"` — Schemas OK
- `python -c "from src.services.risk_service import RiskService"` — Service OK
- `python -c "from src.api.v1.risk import router; print(len(router.routes))"` — 7 routes
- `python -c "from src.tasks.risk_autoflag_task import flag_risk_items_for_kpi"` — Task imported OK
- Risk routes registered: 7 (in main.py)
- `hasattr(PublicMetricsService, 'get_sdbip_achievement')` — Public SDBIP method OK
