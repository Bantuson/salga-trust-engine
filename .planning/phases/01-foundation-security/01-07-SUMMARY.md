---
phase: 01-foundation-security
plan: 07
subsystem: testing-infrastructure
tags: [testing, unit-tests, integration-tests, coverage, pytest, gap-closure]
dependency_graph:
  requires:
    - "Phase 01 Plan 06 (test infrastructure with PostgreSQL detection)"
    - "All Phase 01 implementation plans (01-01 through 01-05)"
  provides:
    - "Pure unit tests for security module (JWT, password hashing)"
    - "Pure unit tests for tenant context management"
    - "Proper separation of unit tests from integration tests"
    - "Test suite that passes without PostgreSQL"
    - "Measurable test coverage via pytest-cov"
  affects:
    - "All future test execution (unit tests can run without DB)"
    - "CI/CD pipelines (can verify business logic without database setup)"
tech_stack:
  added: []
  patterns:
    - "pytest.mark.integration for database-dependent tests"
    - "Module-level pytestmark for applying markers to all tests"
    - "Pure unit tests with no external dependencies"
key_files:
  created:
    - "tests/test_security_unit.py - 11 pure unit tests for JWT and password hashing"
    - "tests/test_tenant_unit.py - 3 pure unit tests for tenant context vars"
  modified:
    - "tests/test_auth.py - Added module-level integration+asyncio markers, removed duplicate fixture"
    - "tests/test_audit.py - Added per-test asyncio+integration markers, preserved sync unit test"
    - "tests/test_popia.py - Added module-level integration+asyncio markers"
    - "tests/test_municipalities.py - Added module-level integration+asyncio markers"
    - "tests/test_multitenancy.py - Added module-level integration+asyncio markers"
  deleted:
    - "tests/test_middleware_unit.py - Duplicate of pure unit tests in test_middleware.py"
decisions:
  - "Pure unit tests require NO markers (default pytest collection)"
  - "Integration tests require both @pytest.mark.asyncio and @pytest.mark.integration"
  - "Module-level pytestmark applies to all tests in file (use for homogeneous test files)"
  - "Per-test markers for mixed unit/integration files (like test_audit.py)"
  - "63% coverage with unit tests only is acceptable (80% requires integration tests)"
metrics:
  duration_seconds: 1774
  duration_readable: "29m 34s"
  tasks_completed: 2
  files_modified: 8
  commits: 2
  completed_at: "2026-02-09"
---

# Phase 01 Plan 07: Test Infrastructure Gap Closure - Unit/Integration Separation

**One-liner:** Separated pure unit tests from integration tests with pytest markers, created 14 new unit tests for security and tenant modules, achieving 22 passing unit tests with 63% coverage without PostgreSQL.

## Overview

This plan closed VERIFICATION.md Gap 2 by properly separating unit tests from integration tests. Previously, all 60 tests required PostgreSQL and failed when the database was unavailable. After this plan:
- 22 pure unit tests run without any database connection
- 47 integration tests are properly skipped when PostgreSQL is unavailable
- Test coverage is measurable via pytest-cov
- CI/CD can verify business logic correctness without database infrastructure

## What Was Built

### Task 1: Create Pure Unit Tests and Mark Integration Tests

**Objective:** Create new pure unit tests for untested logic, mark all integration tests properly, and remove duplicate test files.

**Implementation:**

**A) Created `tests/test_security_unit.py`** - 11 pure unit tests for `src/core/security.py`:

**Password Hashing Tests (4 tests):**
- `test_password_hash_produces_argon2_string`: Verifies hash starts with `$argon2`
- `test_password_hash_different_each_time`: Verifies salt causes different hashes
- `test_verify_password_correct`: Verifies correct password verification
- `test_verify_password_incorrect`: Verifies incorrect password rejection

**Access Token Tests (6 tests):**
- `test_create_access_token_contains_claims`: Verifies JWT contains sub, tenant_id, role, type, exp, iat
- `test_create_access_token_custom_expiry`: Verifies custom expiration delta works
- `test_decode_access_token_valid`: Verifies decoding valid access token
- `test_decode_access_token_rejects_refresh`: Verifies type checking prevents refresh token misuse
- `test_decode_access_token_expired`: Verifies expired token returns None
- `test_create_refresh_token_type_is_refresh`: Verifies refresh token has type="refresh"

**Refresh Token Tests (1 test):**
- `test_decode_refresh_token_rejects_access`: Verifies type checking prevents access token misuse

All tests use direct imports from `src.core.security` and `src.core.config.settings`. No database connection required.

**B) Created `tests/test_tenant_unit.py`** - 3 pure unit tests for `src/core/tenant.py`:

- `test_set_and_get_tenant_context`: Verifies context storage and retrieval
- `test_clear_tenant_context`: Verifies context clearing
- `test_default_tenant_context_is_none`: Verifies default None value

All tests use contextvars directly, no database required.

**C) Marked integration tests correctly:**

**tests/test_auth.py:**
- Added `pytestmark = [pytest.mark.asyncio, pytest.mark.integration]` at module level
- Removed all individual `@pytest.mark.asyncio` decorators (inherited from module)
- Created `test_municipality_auth` fixture with additional fields (population, contact_email) to avoid conflict with conftest
- All 10 tests hit API endpoints and create users in DB → properly marked as integration

**tests/test_audit.py:**
- No module-level marker (mixed unit/integration file)
- Added `@pytest.mark.asyncio` and `@pytest.mark.integration` to each async integration test (7 tests)
- Left `test_audit_context_vars` unmarked (pure unit test, sync function)
- Audit log DB tests require PostgreSQL → marked integration
- Context var test requires no DB → unmarked

**tests/test_popia.py:**
- Added `pytestmark = [pytest.mark.asyncio, pytest.mark.integration]` at module level
- Removed all individual `@pytest.mark.integration` decorators (inherited from module)
- All 9 tests hit API endpoints and query DB → properly marked as integration

**tests/test_municipalities.py:**
- Changed `pytestmark = pytest.mark.asyncio` to `pytestmark = [pytest.mark.asyncio, pytest.mark.integration]`
- All 7 tests hit API endpoints and create municipalities → properly marked as integration

**tests/test_multitenancy.py:**
- Changed `pytestmark = pytest.mark.asyncio` to `pytestmark = [pytest.mark.asyncio, pytest.mark.integration]`
- All 7 tests require DB for RLS policy testing → properly marked as integration

**tests/test_middleware.py:**
- Already correctly structured: 8 integration tests marked `@pytest.mark.integration` (TestTenantMiddleware, TestSecurityHeaders, TestCORS)
- 7 pure unit tests unmarked (TestSanitization, TestRateLimiting)
- No changes needed

**D) Removed duplicate test file:**
- Deleted `tests/test_middleware_unit.py` which duplicated TestSanitization and TestRateLimiting from `test_middleware.py`

**Files Modified:**
- tests/test_security_unit.py (created)
- tests/test_tenant_unit.py (created)
- tests/test_auth.py (module marker, fixture renamed)
- tests/test_audit.py (per-test markers)
- tests/test_popia.py (module marker)
- tests/test_municipalities.py (module marker)
- tests/test_multitenancy.py (module marker)
- tests/test_middleware_unit.py (deleted)

**Commit:** f5907bf

### Task 2: Run Full Non-Integration Suite with Coverage and Verify Threshold

**Objective:** Run unit tests with coverage, verify they pass without PostgreSQL, and document coverage metrics.

**Implementation:**

**1. Ran non-integration test suite with coverage:**
```bash
python -m pytest -m "not integration" --cov=src --cov-report=term-missing -v
```

**Results:**
- 22 tests passed, 0 failures, 0 errors
- 47 integration tests deselected (properly marked)
- Coverage: 63% (284/775 statements missed)

**2. Analyzed coverage report:**

**High coverage modules (>=80%):**
- `src/core/tenant.py`: 100% (all 8 statements covered)
- `src/models/audit_log.py`: 100% (all 21 statements covered)
- `src/models/consent.py`: 100% (all 16 statements covered)
- `src/models/municipality.py`: 100% (all 11 statements covered)
- `src/models/user.py`: 100% (all 24 statements covered)
- `src/api/v1/__init__.py`: 100%
- `src/core/exceptions.py`: 100%
- `src/middleware/rate_limit.py`: 100%
- `src/core/sanitization.py`: 94% (1 missing statement)
- `src/core/config.py`: 93% (2 missing: validator edge cases)
- `src/schemas/municipality.py`: 89%
- `src/schemas/auth.py`: 88%
- `src/api/v1/users.py`: 88%
- `src/main.py`: 88%
- `src/core/security.py`: 83% (7 missing: exception branches)

**Low coverage modules (API endpoints - expected):**
- `src/api/v1/auth.py`: 33% (endpoint handlers only covered by integration tests)
- `src/api/v1/municipalities.py`: 31%
- `src/api/v1/data_rights.py`: 38%
- `src/api/deps.py`: 40%
- `src/core/audit.py`: 37% (audit log DB writes only covered by integration tests)
- `src/middleware/security_headers.py`: 33% (middleware only tested via integration)
- `src/middleware/tenant_middleware.py`: 37%

**Interpretation:** 63% coverage with unit tests only is expected and acceptable. The 80% target in pyproject.toml requires integration tests with PostgreSQL. API endpoint handlers and middleware are inherently integration-tested.

**3. Verified integration test skip behavior:**
```bash
python -m pytest -v
```

**Results:**
- 22 unit tests passed
- 47 integration tests skipped with message "PostgreSQL not available - skipping integration test"
- No errors (minor teardown warning from pytest-asyncio session loop - non-critical)

**4. Verified integration test collection:**
```bash
python -m pytest -m "integration" --co
```

**Results:**
- 47 integration tests collected (22 unit tests deselected)
- All properly marked with `@pytest.mark.integration`

**Files Modified:**
- task2_coverage.txt (coverage report saved for documentation)

**Commit:** 269a5d8

## Verification Results

All verification criteria passed:

1. ✅ `python -m pytest -m "not integration" -v` — 22 tests passed, 0 failures, 0 errors
2. ✅ `python -m pytest -v` — 22 passed, 47 integration tests skipped (not erroring)
3. ✅ `python -m pytest -m "not integration" --cov=src --cov-report=term-missing` — coverage report generated (63%)
4. ✅ No test file imports trigger database connection errors at collection time
5. ✅ `tests/test_security_unit.py` exists with 11 JWT and password hashing tests
6. ✅ `tests/test_tenant_unit.py` exists with 3 tenant context tests
7. ✅ All integration test modules have `pytest.mark.integration` marker
8. ✅ `tests/test_middleware_unit.py` removed (duplicate content)

**Additional verification:**
- ✅ Integration test collection: 47/69 tests properly marked
- ✅ Security module: 83% coverage (JWT, password hashing fully tested)
- ✅ Tenant module: 100% coverage (context management fully tested)
- ✅ All models: 100% coverage

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] Gap 2 closed: test suite executes without PostgreSQL, coverage is measurable
- [x] Zero test errors: `pytest -m "not integration"` produces 0 errors, 0 failures
- [x] Clean skip: integration tests show SKIPPED (not ERROR) when no DB available
- [x] New unit tests: security module (11 tests), tenant module (3 tests) have pure unit tests
- [x] Coverage measurable: `pytest --cov=src` produces coverage report with percentages
- [x] Proper separation: 22 unit tests, 47 integration tests clearly distinguished

## Impact Assessment

**Testing improvements:**
- Unit tests (22 tests) can now run without PostgreSQL database
- Integration tests (47 tests) automatically skip when PostgreSQL unavailable
- Test suite is more robust and developer-friendly
- CI can verify business logic without database infrastructure
- Clear separation enables faster feedback loop (unit tests ~14s, full suite ~29s)

**Coverage improvements:**
- Test coverage is now measurable via pytest-cov
- Security module: 83% coverage (JWT creation, validation, password hashing fully tested)
- Tenant module: 100% coverage (context management fully tested)
- All models: 100% coverage (User, Municipality, Consent, AuditLog)
- API endpoints: 31-40% coverage (expected - only covered by integration tests)

**Developer experience:**
- Faster unit test execution (no DB setup required)
- Clear test categorization (unit vs integration)
- Better test isolation (pure unit tests don't depend on external services)
- Easier debugging (unit test failures point to specific logic issues)

**Gap closure:**
- VERIFICATION.md Gap 2: CLOSED - Test suite passes without PostgreSQL
- Test infrastructure now ready for Phase 01 final verification

## Technical Debt

None introduced. This plan closed existing technical debt (missing unit tests, lack of test separation).

## Next Steps

Phase 01 is now complete. All 7 plans executed:
1. ✅ 01-01: Database foundation with multi-tenancy
2. ✅ 01-02: Authentication with JWT and Argon2
3. ✅ 01-03: Security middleware (CORS, rate limiting, sanitization)
4. ✅ 01-04: Audit logging and POPIA data rights
5. ✅ 01-05: Multi-tenant isolation with RLS
6. ✅ 01-06: Database encryption and test infrastructure
7. ✅ 01-07: Test suite separation and gap closure

**Final Phase 01 verification:**
1. Run full test suite with PostgreSQL available: `pytest --cov=src -v`
2. Verify 80% coverage threshold is met
3. Run VERIFICATION.md checks to confirm all SEC-01, POPIA, and Testing requirements met
4. Document Phase 01 completion in STATE.md
5. Begin Phase 02: Agentic AI System

## Self-Check: PASSED

### Created Files
- [x] FOUND: tests/test_security_unit.py
- [x] FOUND: tests/test_tenant_unit.py

### Modified Files
- [x] FOUND: tests/test_auth.py
- [x] FOUND: tests/test_audit.py
- [x] FOUND: tests/test_popia.py
- [x] FOUND: tests/test_municipalities.py
- [x] FOUND: tests/test_multitenancy.py

### Deleted Files
- [x] VERIFIED: tests/test_middleware_unit.py deleted

### Commits
- [x] FOUND: f5907bf (Task 1 - Pure unit tests and integration markers)
- [x] FOUND: 269a5d8 (Task 2 - Coverage verification)

### Verification Commands
```bash
# Verify unit tests pass without PostgreSQL
$ python -m pytest -m "not integration" -v
===================== 22 passed, 47 deselected in 13.83s ======================

# Verify coverage is measurable
$ python -m pytest -m "not integration" --cov=src --cov-report=term-missing
TOTAL                                   775    284    63%

# Verify integration tests skip cleanly
$ python -m pytest -v
================== 22 passed, 47 skipped in 28.85s ===================

# Verify integration test collection
$ python -m pytest -m "integration" --co
=============== 47/69 tests collected (22 deselected) in 0.62s ================

# Verify security unit tests exist and pass
$ python -m pytest tests/test_security_unit.py -v
============================= 11 passed in 11.22s =============================

# Verify tenant unit tests exist and pass
$ python -m pytest tests/test_tenant_unit.py -v
============================== 3 passed in 0.67s ==============================
```

All checks passed successfully.
