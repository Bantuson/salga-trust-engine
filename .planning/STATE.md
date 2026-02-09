# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Citizens report a problem and the municipality visibly responds — the core feedback loop that transforms opaque, reactive local government into transparent, accountable service delivery.
**Current focus:** Phase 1 - Foundation & Security

## Current Position

Phase: 1 of 6 (Foundation & Security)
Plan: 7 of 7 in current phase
Status: Complete
Last activity: 2026-02-09 — Completed 01-07: Test Infrastructure Gap Closure - Unit/Integration Separation

Progress: [██████████] 100% (7/7 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 17.5 minutes
- Total execution time: 2.04 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 7 | 121.4m | 17.3m |

**Recent Trend:**
- Last 5 plans: 18.0m, 15.6m, 18.7m, 10.5m, 29.6m
- Trend: Phase 01 complete - final plan focused on comprehensive test separation

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| 01-01 | 15.4m (923s) | 3 | 26 |
| 01-02 | 12.5m (752s) | 2 | 8 |
| 01-03 | 18.0m (1078s) | 2 | 10 |
| 01-04 | 15.6m (937s) | 2 | 9 |
| 01-05 | 18.7m (1121s) | 2 | 12 |
| 01-06 | 10.5m (632s) | 2 | 5 |
| 01-07 | 29.6m (1774s) | 2 | 8 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Platform-wide: Python stack with FastAPI for AI/NLP capabilities and async webhook handling
- Platform-wide: WhatsApp via Twilio as primary citizen channel (highest SA penetration)
- Platform-wide: Trilingual from v1 (EN/ZU/AF) for accessibility
- Platform-wide: 3-5 municipality pilot cohort to prove model before scaling
- Phase 1: Multi-tenant architecture with row-level data isolation per municipality
- Phase 1: POPIA compliance foundational (not bolted on later)
- Phase 2: CrewAI agentic architecture with manager + specialist agents
- Phase 3: GBV reporting routes to SAPS stations, not municipal teams
- v2 Deferred: Offline-first field worker mobile app (not in v1)
- v2 Deferred: SMS fallback reporting channel (not in v1)
- 01-01: SQLAlchemy 2.0 declarative style with Mapped[T] type hints
- 01-01: Municipality and AuditLog use NonTenantModel (cross-tenant scope)
- 01-01: User email uniqueness per tenant via UniqueConstraint(email, tenant_id)
- 01-01: Windows asyncio compatibility via WindowsSelectorEventLoopPolicy
- 01-02: PyJWT chosen over python-jose (deprecated with security issues)
- 01-02: Argon2-cffi chosen over passlib (passlib maintenance ended 2020)
- 01-02: Token type validation to prevent refresh token misuse as access token
- 01-02: Token rotation on refresh (issue new refresh token, not just access token)
- 01-03: Tenant middleware validates UUID format but does NOT query database (performance)
- 01-03: Rate limiting uses Redis in production, in-memory in development
- 01-03: CORS configured with explicit origins list (no wildcard per OWASP)
- 01-03: Error handler returns generic messages in production to prevent information leakage
- 01-03: Security headers relax CSP in development for Swagger UI assets
- 01-03: Integration tests marked @pytest.mark.integration (require database setup)
- 01-04: SQLAlchemy after_flush event for audit logging (not after_insert/update individually)
- 01-04: Direct connection.execute for audit log insertion prevents recursive triggers
- 01-04: Rate limit data export to 5/hour, account deletion to 1/day
- 01-04: Audit logs preserved after account deletion (legal requirement)
- 01-04: Use "system" tenant_id for non-tenant model audit logs
- 01-04: Soft delete with PII anonymization (email, name, phone) keeps user record
- 01-05: Municipality endpoints excluded from tenant context requirement (they manage tenants)
- 01-05: PostgreSQL RLS uses FORCE ROW LEVEL SECURITY to apply even to table owner
- 01-05: SET LOCAL app.current_tenant ensures transaction-scoped RLS context (no connection pool leakage)
- 01-05: Application-level filtering raises SecurityError on missing tenant (fail-closed, not fail-open)
- 01-05: Province validation against official SA provinces list
- 01-05: Municipality codes auto-converted to uppercase
- 01-06: Use sslmode=require for production, sslmode=prefer for development
- 01-06: Document encryption strategy: TLS in-transit, storage-level at-rest
- 01-06: Defer pgcrypto column-level encryption to future phases
- 01-06: SQLite fallback for unit tests, PostgreSQL required for integration tests
- 01-06: Auto-skip integration tests when PostgreSQL unavailable
- 01-07: Pure unit tests require no markers (default pytest collection)
- 01-07: Integration tests require both @pytest.mark.asyncio and @pytest.mark.integration
- 01-07: Module-level pytestmark for homogeneous test files (all unit or all integration)
- 01-07: Per-test markers for mixed unit/integration files
- 01-07: 63% coverage with unit tests only is acceptable (80% requires integration tests)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-09 (plan 01-07 execution)
Stopped at: Completed 01-07-PLAN.md - Test Infrastructure Gap Closure. Phase 01 (Foundation & Security) complete. Ready for Phase 02.
Resume file: None

---
*State initialized: 2026-02-09*
*Last updated: 2026-02-09T13:55:20Z*
