---
phase: 31-role-specific-dashboards
plan: 1
subsystem: backend-pms
tags: [role-dashboards, rbac, sdbip, evidence, poe, mpac, salga-admin, api, service-layer]
dependency_graph:
  requires:
    - 28-idp-sdbip-core-performance-monitoring (SDBIPKpi, SDBIPActual, SDBIPScorecard models)
    - 29-performance-agreements (PA tables referenced in audit trail)
    - 30-statutory-reporting-approval-workflows (StatutoryReport, AuditLog)
    - 27-rbac-foundation-tenant-configuration (require_role(), UserRole enum, TIER_ORDER)
  provides:
    - src/services/role_dashboard_service.py (RoleDashboardService - 12 aggregation methods)
    - src/api/v1/role_dashboards.py (13 endpoints under /api/v1/role-dashboards/)
    - alembic/versions/20260302_add_evidence_verification_status.py (EvidenceDocument migration)
    - tests/test_role_dashboards.py (23 unit tests)
  affects:
    - src/models/evidence.py (verification_status column added)
    - src/main.py (role_dashboards.router registered)
tech_stack:
  added: []
  patterns:
    - raw SQL text() for cross-tenant SALGA Admin queries (bypass ORM tenant filter)
    - SDBIPWorkflow.send() with start_value= model binding (Phase 28 pattern)
    - MissingGreenlet-safe: capture UUID before commit in approve_sdbip
    - append-only audit_log pattern for investigation flags (table_name='investigation_flags')
    - dependency_overrides for RBAC 403 tests (inject mock user, bypass JWT+DB lookup)
    - SEC-05: is_sensitive=False on all ticket-related queries (unconditional)
key_files:
  created:
    - src/services/role_dashboard_service.py
    - src/api/v1/role_dashboards.py
    - alembic/versions/20260302_add_evidence_verification_status.py
    - tests/test_role_dashboards.py
  modified:
    - src/models/evidence.py (verification_status column)
    - src/main.py (Phase 31 router registration)
decisions:
  - RBAC 403 tests use app.dependency_overrides to inject mock users — avoids JWT+DB lookup 500 errors from non-existent test users in SQLite
  - Councillor endpoint grants WARD_COUNCILLOR and CHIEF_WHIP (no plain COUNCILLOR role exists in UserRole enum)
  - SALGA Admin uses raw SQL text() for sdbip_scorecards DISTINCT tenant_id discovery — same pattern as Phase 28 cross-tenant auto-population
  - Audit log 403 tests filter changes.is_not(None) + substring match — SQLAlchemy event listeners may also create audit entries for the same record_id
  - Service delivery correlation returns KPI achievement data only (no direct ticket join) — ticket data accessible via existing /api/v1/dashboard (SEC-05 compliant)
  - StatutoryDeadline model not used for CFO deadline calendar — StatutoryReport.period_end used as deadline proxy to keep implementation self-contained
metrics:
  duration_minutes: 36
  completed_date: "2026-03-02"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
  tests_written: 23
  tests_passing: 23
---

# Phase 31 Plan 1: Role-Specific Dashboard Backend Summary

**One-liner:** FastAPI service layer + 13 RBAC-gated endpoints for all 12 senior municipal roles (CFO, MM, Mayor, Councillor, Audit Committee, Internal Auditor, MPAC, SALGA Admin, Section 56 Director) with EvidenceDocument POE verification column and Alembic migration.

## What Was Built

### RoleDashboardService (`src/services/role_dashboard_service.py`)

A single service class with 12 aggregation methods covering all DASH-01 through DASH-12 requirements:

| Method | DASH | Description |
|--------|------|-------------|
| `get_cfo_dashboard` | DASH-01 | Budget execution (KPI targets vs actuals), SDBIP achievement summary, service delivery correlation, statutory deadlines |
| `get_mm_dashboard` | DASH-02 | Per-department KPI overview with traffic light counts |
| `get_mayor_dashboard` | DASH-03 | Organisational scorecard + SDBIP scorecards for approval |
| `approve_sdbip` | DASH-10 | SDBIPWorkflow.send("submit") + audit_log with action='sdbip_approved' |
| `get_councillor_dashboard` | DASH-04 | Read-only SDBIP KPIs + statutory reports |
| `get_audit_committee_dashboard` | DASH-05 | All performance reports + PMS audit trail (last 100) |
| `get_internal_auditor_dashboard` | DASH-06 | Unverified POE workqueue grouped by KPI |
| `verify_evidence` | DASH-11 | Updates EvidenceDocument.verification_status + audit_log |
| `get_mpac_dashboard` | DASH-07 | Statutory reports + investigation flags (append-only) |
| `flag_investigation` | DASH-12 | Creates audit_log with table_name='investigation_flags' |
| `get_salga_admin_dashboard` | DASH-08 | Cross-tenant benchmarking via raw SQL text() |
| `get_section56_director_dashboard` | DASH-09 | Dept-scoped KPIs via Department.assigned_director_id |

### API Endpoints (`src/api/v1/role_dashboards.py`)

13 endpoints under `/api/v1/role-dashboards/` prefix:

```
GET  /cfo                                   → CFO, ADMIN, SALGA_ADMIN
GET  /municipal-manager                     → MUNICIPAL_MANAGER, ADMIN, SALGA_ADMIN
GET  /mayor                                 → EXECUTIVE_MAYOR, ADMIN, SALGA_ADMIN
POST /mayor/approve-sdbip                   → EXECUTIVE_MAYOR, ADMIN, SALGA_ADMIN
GET  /councillor                            → WARD_COUNCILLOR, CHIEF_WHIP, ADMIN, SALGA_ADMIN
GET  /audit-committee                       → AUDIT_COMMITTEE_MEMBER, ADMIN, SALGA_ADMIN
GET  /internal-auditor                      → INTERNAL_AUDITOR, ADMIN, SALGA_ADMIN
POST /internal-auditor/verify-evidence      → INTERNAL_AUDITOR, ADMIN, SALGA_ADMIN
GET  /mpac                                  → MPAC_MEMBER, ADMIN, SALGA_ADMIN
POST /mpac/flag-investigation               → MPAC_MEMBER, ADMIN, SALGA_ADMIN
GET  /salga-admin                           → SALGA_ADMIN, ADMIN
GET  /salga-admin/export-csv                → SALGA_ADMIN, ADMIN (StreamingResponse)
GET  /section56-director                    → SECTION56_DIRECTOR, ADMIN, SALGA_ADMIN
```

### EvidenceDocument Migration

Added `verification_status` column to `evidence_documents` table:
- Values: `unverified` (default), `verified`, `insufficient`
- `server_default='unverified'` ensures all existing rows get the new status
- Migration ID: `20260302_evidence_verification`, revises `2026_03_01_0001`

### Unit Tests (`tests/test_role_dashboards.py`)

23 tests covering all DASH-XX requirements plus RBAC enforcement:
- Service-level tests: call service methods directly with SQLite in-memory DB
- RBAC tests: use `app.dependency_overrides[get_current_user]` to inject mock users
- All tests use `set_tenant_context()`/`clear_tenant_context()` with try/finally

## Key Technical Decisions

**RBAC test pattern:** Standard TestClient + JWT approach fails in unit tests because the user doesn't exist in the SQLite test DB (returns 500 during DB lookup, not 403). Solution: `app.dependency_overrides[get_current_user] = lambda: pms_user` bypasses JWT + DB lookup entirely, directly testing the `require_role()` gate.

**Councillor endpoint:** The `UserRole` enum has `WARD_COUNCILLOR` and `CHIEF_WHIP` but no plain `COUNCILLOR`. The plan referenced `UserRole.COUNCILLOR` which doesn't exist — endpoint was implemented with `WARD_COUNCILLOR` and `CHIEF_WHIP`.

**Audit log filtering:** SQLAlchemy event listeners (from `src/core/audit.py`) auto-create AuditLog entries when models change. Tests that verify our explicitly created audit entries filter `changes.is_not(None)` + substring match for the action name to find the service-created entry vs the auto-listener entry.

**Service delivery correlation (DASH-01 CFO):** Returns KPI achievement data without a direct ticket table join. The existing `/api/v1/dashboard` API provides ticket metrics (SEC-05 compliant). The correlation endpoint provides KPI context for cross-referencing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] RBAC 403 tests via dependency_overrides**
- **Found during:** Task 3
- **Issue:** TestClient + create_supabase_access_token approach fails with 500 in SQLite test environments (user doesn't exist in DB, UUID type mismatch on lookup)
- **Fix:** All RBAC 403 tests use `app.dependency_overrides[get_current_user] = lambda: mock_user` pattern — tests the role gate in isolation without JWT/DB overhead
- **Files modified:** `tests/test_role_dashboards.py`

**2. [Rule 1 - Bug] UserRole.COUNCILLOR does not exist**
- **Found during:** Task 2
- **Issue:** Plan specification referenced `UserRole.COUNCILLOR` in councillor endpoint role list, but the enum only has `WARD_COUNCILLOR` and `CHIEF_WHIP`
- **Fix:** Councillor endpoint uses `WARD_COUNCILLOR, CHIEF_WHIP, ADMIN, SALGA_ADMIN`
- **Files modified:** `src/api/v1/role_dashboards.py`

**3. [Rule 1 - Bug] Audit log entry ordering in tests**
- **Found during:** Task 3
- **Issue:** `test_mayor_approve_sdbip` failed because `log_entries[0].changes` was `None` — the SQLAlchemy auto-listener created an AuditLog entry for the scorecard UPDATE before our service-created entry, and the auto-entry has `changes=None`
- **Fix:** Tests filter `changes.is_not(None)` and use substring match to find the specific service-created entry
- **Files modified:** `tests/test_role_dashboards.py`

## Self-Check: PASSED

### Created files exist
- FOUND: `src/services/role_dashboard_service.py`
- FOUND: `src/api/v1/role_dashboards.py`
- FOUND: `alembic/versions/20260302_add_evidence_verification_status.py`
- FOUND: `tests/test_role_dashboards.py`
- FOUND: `.planning/phases/31-role-specific-dashboards/31-01-SUMMARY.md`

### Commits exist
- FOUND: `be44bfa` — feat(31-01): add RoleDashboardService and EvidenceDocument.verification_status
- FOUND: `cc40036` — feat(31-01): add role-dashboard API endpoints and register in main.py
- FOUND: `33f7423` — test(31-01): add unit tests for all role dashboard endpoints (23 tests)

### Verification
- Service imports cleanly: `from src.services.role_dashboard_service import RoleDashboardService` — OK
- Router has 13 routes: `from src.api.v1.role_dashboards import router` — OK (13 routes)
- App has 13 role-dashboard routes registered — OK
- EvidenceDocument.verification_status column exists — OK
- All 23 unit tests pass: `pytest tests/test_role_dashboards.py -x` — 23 passed in 30.60s
