---
phase: 09-ocr-supabase-bridge-ward-filtering
plan: "02"
subsystem: backend-api
tags:
  - ward-filtering
  - rbac
  - security
  - dashboard
  - tickets
  - alembic
dependency_graph:
  requires:
    - 09-01 (OCR-Supabase bridge)
  provides:
    - User.ward_id field
    - Ward councillor ticket enforcement
    - Ward councillor dashboard enforcement
    - Alembic migration ix_users_ward_id
  affects:
    - src/api/v1/tickets.py
    - src/api/v1/dashboard.py
    - src/models/user.py
tech_stack:
  added: []
  patterns:
    - Fail-safe ward enforcement (empty/zeroed on no ward_id, not fail-open)
    - Stored-value override (server-side ward_id replaces client-supplied param)
    - Direct function call unit tests with mock users for RBAC enforcement
key_files:
  created:
    - alembic/versions/2026_02_22_add_ward_id_to_users.py
  modified:
    - src/models/user.py
    - src/api/v1/tickets.py
    - src/api/v1/dashboard.py
    - tests/test_tickets_api.py
    - tests/test_dashboard_api.py
decisions:
  - "Stored ward_id from user profile overrides any client-supplied ward_id query param — prevents ward spoofing"
  - "Ward councillor with no ward_id returns empty/zeroed results (fail-safe, not fail-open)"
  - "Dashboard tests use direct function calls with mock users — avoids DB dependency for RBAC logic tests"
  - "Ticket ward enforcement tests placed in integration class — skipped without PostgreSQL, logic verified by manual test"
  - "Pre-existing dashboard test bugs fixed: missing request param for volume/sla endpoints, missing start_date/end_date=None"
  - "get_ticket_detail() now includes WARD_COUNCILLOR in allowed roles + ward boundary check via address.ilike pattern"
metrics:
  duration: "14 minutes"
  completed_date: "2026-02-22"
  tasks_completed: 2
  files_modified: 5
---

# Phase 09 Plan 02: Ward ID Field and Enforcement Summary

**One-liner:** Ward councillor enforcement via stored `ward_id` on User model — auto-filters tickets and dashboard metrics with fail-safe empty returns when no ward assigned.

## What Was Built

### Task 1: User.ward_id Field and Alembic Migration

Added `ward_id: Mapped[str | None]` to the `User` model in `src/models/user.py`, placed after `municipality_id`. The field uses `String(100)` (SA ward identifiers are human-readable strings like "Ward 5"), is nullable (only ward councillors need it populated), and is indexed for efficient ward filter queries.

Created Alembic migration `alembic/versions/2026_02_22_add_ward_id_to_users.py` with:
- `revision = 'a1b2c3d4e5f6'`
- `down_revision = 'feb9e9b8f0ff'` (last migration before this plan)
- `upgrade()`: `op.add_column` + `op.create_index("ix_users_ward_id", ...)`
- `downgrade()`: `op.drop_index` + `op.drop_column`

### Task 2: Ward Enforcement in Tickets and Dashboard

**tickets.py — `list_tickets()`:** Replaced interim warning log with real enforcement:
- Ward councillors: `effective_ward_id = current_user.ward_id` overrides any client-supplied `ward_id` parameter
- No ward_id assigned: immediately return `PaginatedTicketResponse(tickets=[], total=0, page_count=0)` — no DB query made

**tickets.py — `get_ticket_detail()`:** Added `WARD_COUNCILLOR` to allowed roles, plus ward boundary check via `address.ilike(ward_id)` pattern. Returns 403 if ticket not in councillor's ward.

**dashboard.py — All 4 endpoints:** Added ward enforcement block after RBAC check:
- `get_dashboard_metrics`: zeroed dict `{total_open: 0, ...}` for no-ward councillor
- `get_volume_by_category`: `return []` for no-ward councillor
- `get_sla_compliance`: zeroed SLA dict for no-ward councillor
- `get_team_workload`: `return []` for no-ward councillor
- All endpoints: `ward_id = current_user.ward_id` overrides client-supplied value

**Tests added:**

Dashboard (`tests/test_dashboard_api.py`) — 6 new tests in `TestDashboardWardCouncillorEnforcement`:
1. `test_dashboard_metrics_ward_councillor_auto_filters` — stored ward_id used, client ward_id ignored
2. `test_dashboard_metrics_ward_councillor_no_ward_returns_zero` — zeroed dict, DashboardService not called
3. `test_dashboard_volume_ward_councillor_no_ward_returns_empty` — empty list, service not called
4. `test_dashboard_sla_ward_councillor_no_ward_returns_zero` — zeroed SLA dict, service not called
5. `test_dashboard_workload_ward_councillor_no_ward_returns_empty` — empty list, service not called
6. `test_dashboard_metrics_manager_unaffected_by_ward_enforcement` — manager uses client-supplied ward_id

Tickets (`tests/test_tickets_api.py`) — 3 new tests in `TestWardCouncillorEnforcement`:
1. `test_list_tickets_ward_councillor_with_ward_id` — valid paginated response, DB queried
2. `test_list_tickets_ward_councillor_no_ward_id_returns_empty` — empty result, no DB query
3. `test_list_tickets_manager_unaffected_by_ward_enforcement` — DB queried normally

## Test Results

- **`tests/test_dashboard_api.py`:** 16/16 passed (10 existing + 6 new)
- **`tests/test_tickets_api.py`:** 3 new tests collected, skipped (module-level integration mark requires PostgreSQL — logic verified via direct Python test)
- **Full suite (excluding pre-existing broken files):** 584 passing, no new failures introduced

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing dashboard test failures**
- **Found during:** Task 2
- **Issue:** 8 existing `test_dashboard_api.py` tests were failing before this plan due to: (a) `start_date=None` not passed explicitly causing FastAPI `Query(...)` objects to be passed to `datetime.strptime()`, (b) `get_volume_by_category` and `get_sla_compliance` missing `request` parameter for `@limiter.limit()` decorator
- **Fix:** Updated all test calls to pass `start_date=None, end_date=None` explicitly, added `make_mock_starlette_request()` to volume/sla endpoint calls. Also updated `make_mock_user()` to accept `ward_id` parameter and set it explicitly (vs MagicMock auto-creation which returns truthy mock objects).
- **Files modified:** `tests/test_dashboard_api.py`
- **Commit:** `385c94f`

**2. [Rule 2 - Missing critical functionality] Added ward boundary check to `get_ticket_detail()`**
- **Found during:** Task 2
- **Issue:** Plan specified adding WARD_COUNCILLOR to ticket detail endpoint, but without the ward boundary check a ward councillor could access any non-sensitive ticket by UUID regardless of ward
- **Fix:** Added ward_id check via `address.ilike(ward_id)` pattern — returns 403 if ticket not in councillor's ward
- **Files modified:** `src/api/v1/tickets.py`
- **Commit:** `385c94f`

## Self-Check: PASSED

All required files found:
- src/models/user.py — FOUND
- alembic/versions/2026_02_22_add_ward_id_to_users.py — FOUND
- src/api/v1/tickets.py — FOUND
- src/api/v1/dashboard.py — FOUND
- tests/test_tickets_api.py — FOUND
- tests/test_dashboard_api.py — FOUND
- .planning/phases/09-ocr-supabase-bridge-ward-filtering/09-02-SUMMARY.md — FOUND

All commits verified:
- 2d6f125 — Task 1: User.ward_id field and migration
- 385c94f — Task 2: ward enforcement in tickets and dashboard with tests
