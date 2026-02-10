# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Citizens report a problem and the municipality visibly responds — the core feedback loop that transforms opaque, reactive local government into transparent, accountable service delivery.
**Current focus:** Phase 3 - Citizen Reporting Channels

## Current Position

Phase: 3 of 6 (Citizen Reporting Channels)
Plan: 6 of 6 in current phase
Status: Phase Complete
Last activity: 2026-02-10 — Completed 03-06: WhatsApp Tracking Number & MediaAttachment Gap Closure

Progress: [██████████] 100% (6/6 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 17.6 minutes
- Total execution time: 5.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 7 | 121.4m | 17.3m |
| 02 | 4 | 94.3m | 23.6m |
| 03 | 6 | 74.5m | 12.4m |

**Recent Trend:**
- Last 5 plans: 7.9m, 9.1m, 16.2m, 35.4m, 3.3m
- Trend: Phase 03 gap closure completed in 3.3 min - quick fix for tracking number and MediaAttachment creation

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
| 02-01 | 14.2m (853s) | 2 | 10 |
| 02-02 | 26.8m (1607s) | 2 | 9 |
| 02-03 | 15.0m (898s) | 2 | 7 |
| 02-04 | 38.3m (2298s) | 2 | 9 |
| 03-01 | 2.6m (158s) | 2 | 10 |
| 03-02 | 7.9m (473s) | 2 | 5 |
| 03-03 | 9.1m (543s) | 2 | 4 |
| 03-04 | 16.2m (971s) | 2 | 26 |
| 03-05 | 35.4m (2126s) | 2 | 9 |
| 03-06 | 3.3m (197s) | 1 | 1 |

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
- 02-01: lingua-py for trilingual language detection (EN/ZU/AF)
- 02-01: Short text fallback (<20 chars) to user's preferred language
- 02-01: Language detection confidence threshold (0.7) to avoid false positives
- 02-01: Redis-backed conversation state with GBV/municipal namespace separation
- 02-01: Max 20 turns per conversation (safety limit)
- 02-01: Ticket model uses separate lat/lng columns (PostGIS deferred to Phase 4)
- 02-01: Tracking number format: TKT-YYYYMMDD-{6_random_hex}
- 02-01: CrewAI installation deferred due to Windows C++ build tools requirement
- 02-02: Keyword-based classification for municipal vs GBV (no LLM API in unit tests)
- 02-02: IntakeState fields require defaults for CrewAI Flow initialization
- 02-02: Tool wrapper pattern separates implementation from @tool decorator for testing
- 02-02: Fake OPENAI_API_KEY in tests enables Agent initialization without real keys
- 02-02: Language-specific prompts injected as agent backstory (full conversation examples)
- 02-02: Synchronous database engine for CrewAI tools (converted from async URL)
- 02-03: GBV crew memory disabled (memory=False) to prevent cross-session data leakage
- 02-03: GBV max_iter=8 (vs 10 for municipal) to avoid over-questioning trauma victims
- 02-03: SAPS notification as internal log in v1 (no SAPS API exists)
- 02-03: No PII in SAPS logs (only ticket_id, incident_type, general location, danger_level)
- 02-03: Session clearing after GBV ticket creation (data minimization per POPIA)
- 02-04: Rule-based guardrails without NeMo (deterministic, fast, no LLM calls)
- 02-04: Emergency numbers (10111, 0800 150 150) preserved in output sanitization
- 02-04: X-Tenant-ID header required for messages endpoint (tenant isolation)
- 02-03: Emergency numbers (10111, 0800 150 150) in all GBV prompts
- [Phase 03-01]: AWS S3 for media storage with separate buckets for evidence and documents
- [Phase 03-01]: Fernet symmetric encryption with key rotation support via MultiFernet
- [Phase 03-01]: Presigned POST URLs for direct browser uploads (reduces server load)
- [Phase 03-02]: WhatsApp webhook exempt from tenant middleware (Twilio can't send X-Tenant-ID)
- [Phase 03-02]: Phone-to-user lookup is cross-tenant by necessity (phone is unique constraint)
- [Phase 03-02]: Twilio signature validation skipped in dev mode (no auth token configured)
- [Phase 03-02]: Media downloads use temp ticket_id placeholder (updated after ticket creation)
- [Phase 03-03]: Tesseract OCR with graceful degradation (allows CI/testing without Tesseract)
- [Phase 03-03]: Confidence thresholds: >= 0.7 auto-verify, >= 0.5 manual review, < 0.5 reject
- [Phase 03-03]: Full EXIF stripping for privacy (GPS coordinates, device metadata removed)
- [Phase 03-03]: South African address patterns (street, PO Box, 4-digit postal codes)
- [Phase 03-04]: Presigned POST URLs for direct browser uploads (not multipart to backend)
- [Phase 03-04]: Upload-first workflow (MediaAttachment created without ticket_id, linked on submission)
- [Phase 03-04]: GPS coordinates captured with 10s timeout and high accuracy enabled
- [Phase 03-04]: Manual address fallback when GPS unavailable (Pydantic validator requires one of location or manual_address)
- [Phase 03-04]: AI classification optional (user can pre-select category or let IntakeFlow classify)
- [Phase 03-04]: GBV consent dialog shows emergency numbers (10111, 0800 150 150) before submission

### Pending Todos

None - CrewAI successfully installed and integrated.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-10 (plan 03-06 execution)
Stopped at: Completed 03-06-PLAN.md - WhatsApp Tracking Number & MediaAttachment Gap Closure. Fixed verification gap #2: WhatsApp service now creates MediaAttachment records and includes tracking number in citizen responses.
Resume file: None

---
*State initialized: 2026-02-09*
*Last updated: 2026-02-10T05:49:06Z*
