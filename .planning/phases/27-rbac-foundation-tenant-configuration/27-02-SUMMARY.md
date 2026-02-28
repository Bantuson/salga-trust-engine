---
phase: 27-rbac-foundation-tenant-configuration
plan: 02
subsystem: api
tags: [fastapi, sqlalchemy, pydantic, department, organogram, pms, rbac, rls, municipality]

# Dependency graph
requires:
  - phase: 27-rbac-foundation-tenant-configuration
    plan: 01
    provides: Department model, DepartmentTicketCategoryMap model, Municipality PMS columns, Alembic migration (committed as 0731211)

provides:
  - Department CRUD API (create, list, get, update, soft-delete) with tenant isolation
  - Organogram endpoint returning recursive hierarchy tree with director names and roles
  - Ticket category to department mapping CRUD with 1:1 uniqueness enforcement per tenant
  - Municipality PMS settings endpoints (view, update, lock, unlock)
  - Pydantic v2 schemas for all department and municipality settings interactions
  - RBAC tier hierarchy (TIER_ORDER) and require_min_tier() dependency in deps.py
  - 23 unit tests covering all endpoints, cross-tenant isolation, and schema validation

affects:
  - phase: 28-sdbip-kpi-management (SDBIP KPIs scoped to departments)
  - phase: 29-performance-agreements (directors assigned per department)
  - phase: 30-statutory-reporting (department context in statutory reports)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Soft-delete via is_active=False (consistent with existing tickets pattern)
    - municipality_router as separate APIRouter on /api/v1/municipalities prefix within same module
    - _build_department_response() helper for joining director name from users table
    - _build_organogram() helper building recursive tree from flat department list
    - Settings lock/unlock pattern with explicit confirmation body (UnlockConfirm)

key-files:
  created:
    - src/schemas/department.py
    - src/api/v1/departments.py
    - tests/test_departments_api.py
  modified:
    - src/main.py (departments router + municipality_router registered)
    - src/api/deps.py (TIER_ORDER map + require_min_tier() dependency)
    - tests/conftest.py (Phase 27 RBAC user fixtures added)

key-decisions:
  - "Department soft-delete (is_active=False) instead of hard delete — preserves historical KPI/SDBIP linkage"
  - "municipality_router as a second APIRouter in departments.py module — cleaner separation without extra file"
  - "Settings lock enforced at API layer (403 when locked) with explicit unlock confirmation body"
  - "Organogram built from flat list in Python (not recursive SQL) — simpler for SQLite test compatibility"
  - "TIER_ORDER dict in deps.py (not database) — roles are static, DB lookup adds latency for no benefit"

patterns-established:
  - "Tenant filtering: always WHERE tenant_id = current_user.tenant_id in all department queries"
  - "Director join: separate scalar query on users table, not ORM relationship (avoids lazy-load async issues)"
  - "Rate limiting: @limiter.limit(SENSITIVE_READ/WRITE_RATE_LIMIT) on all endpoints"

requirements-completed:
  - RBAC-02
  - RBAC-03
  - RBAC-05

# Metrics
duration: 15min
completed: 2026-02-28
---

# Phase 27 Plan 02: Department CRUD API and Municipality PMS Settings Summary

**Department CRUD API with organogram tree, ticket category mapping, and lockable municipality PMS settings — organizational backbone for SDBIP KPIs scoped to departments**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-28T16:00:00Z
- **Completed:** 2026-02-28T16:10:27Z
- **Tasks:** 2 (Task 1 was pre-committed as 0731211; Task 2 committed as 2b33881)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Department CRUD API with 9 endpoints on /api/v1/departments (create, list, get, update, soft-delete, organogram, ticket-category-map CRUD)
- Municipality PMS settings with 4 endpoints on /api/v1/municipalities (get, update, lock, unlock settings)
- Organogram endpoint returning recursive hierarchy tree from flat department list with director names and roles
- All 23 unit tests pass with mock-based approach (no PostgreSQL required)
- RBAC tier hierarchy (TIER_ORDER + require_min_tier) added to deps.py for Phase 27 role checking

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Department model, extend Municipality, and Alembic migration** - `0731211` (feat)
2. **Task 2: Department CRUD API, organogram endpoint, municipality settings, and unit tests** - `2b33881` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/schemas/department.py` - Pydantic v2 schemas: DepartmentCreate, DepartmentUpdate, DepartmentResponse, OrganogramNode, TicketCategoryMappingCreate/Response, MunicipalitySettingsUpdate/Response, UnlockConfirm
- `src/api/v1/departments.py` - Full department CRUD, organogram, ticket category mapping, municipality PMS settings (two APIRouters in one module)
- `tests/test_departments_api.py` - 23 unit tests covering all endpoints, cross-tenant isolation, schema validation
- `src/main.py` - Registered departments.router and departments.municipality_router + roles.router (27-01 scope)
- `src/api/deps.py` - Added TIER_ORDER map and require_min_tier() dependency for Phase 27 RBAC
- `tests/conftest.py` - Added Phase 27 RBAC user fixtures (executive_mayor_user, section56_director_user, etc.)

## Decisions Made

- Department soft-delete (is_active=False) instead of hard delete — preserves historical KPI and SDBIP data linkage for Phase 28+
- Settings lock pattern: explicit 403 when locked, separate /unlock endpoint requiring `{"confirm": true}` to prevent accidental unlocks
- Organogram built from flat list in Python (not recursive CTE SQL) — simpler and works with SQLite in unit tests
- Two APIRouters in single module (departments.py): one prefixed /api/v1/departments, one /api/v1/municipalities — avoids extra file while keeping endpoints logically grouped

## Deviations from Plan

None — plan executed exactly as written. The untracked files were inspected and found to be complete, correct implementations. All 23 tests passed on first run.

## Issues Encountered

None. The prior commit (0731211) had correctly implemented Task 1 (models + migration). The untracked Task 2 files were complete and functional. Tests required no modifications.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Department API is operational — Phase 28 (SDBIP KPI Management) can use department_id as scope for KPIs
- Section 56 directors can be assigned to departments via PUT /api/v1/departments/{id}
- Organogram endpoint ready for frontend consumption
- Municipality settings lock/unlock pattern established for PMS configuration workflow
- Pre-existing test errors in test_gbv_crew.py, test_rls_policies.py, test_municipal_crew.py, test_tools_basetool.py, test_output_formatting.py are unrelated to this plan (agent/crew module issues from prior development)

---
*Phase: 27-rbac-foundation-tenant-configuration*
*Completed: 2026-02-28*

## Self-Check: PASSED

All created files verified present:
- FOUND: src/schemas/department.py
- FOUND: src/api/v1/departments.py
- FOUND: tests/test_departments_api.py
- FOUND: src/models/department.py
- FOUND: .planning/phases/27-rbac-foundation-tenant-configuration/27-02-SUMMARY.md

All task commits verified:
- FOUND: 0731211 (Task 1 - models + migration)
- FOUND: 2b33881 (Task 2 - schemas, API, tests)
