# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Citizens report a problem and the municipality visibly responds — the core feedback loop that transforms opaque, reactive local government into transparent, accountable service delivery.
**Current focus:** Phase 5 - Municipal Operations Dashboard

## Current Position

Phase: 5 of 6 (Municipal Operations Dashboard)
Plan: 5 of 5 in current phase
Status: Complete
Last activity: 2026-02-10 — Completed 05-05: Testing & Verification (310 tests passing, SEC-05 verified, RBAC tested)

Progress: [██████████] 100% (5/5 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 28
- Average duration: 19.0 minutes
- Total execution time: 8.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 7 | 121.4m | 17.3m |
| 02 | 4 | 94.3m | 23.6m |
| 03 | 7 | 103.3m | 14.8m |
| 04 | 5 | 124.4m | 24.9m |
| 05 | 5 | 90.4m | 18.1m |

**Recent Trend:**
- Last 5 plans: 38.1m, 20.1m, 20.1m, 16.4m, 17.6m
- Trend: Phase 05 COMPLETE - all dashboard features + comprehensive testing

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
| 03-07 | 28.8m (1727s) | 2 | 2 |
| 04-01 | 31.1m (1863s) | 2 | 18 |
| 04-02 | 9.6m (576s) | 2 | 2 |
| 04-03 | 32.6m (1954s) | 2 | 6 |
| 04-04 | 13.0m (779s) | 2 | 5 |
| 04-05 | 38.1m (2286s) | 2 | 7 |
| 05-01 | 20.1m (1205s) | 2 | 6 |
| 05-02 | 20.1m (1205s) | 2 | 5 |
| 05-03 | 16.0m (960s) | 2 | 8 |
| 05-04 | 16.4m (984s) | 2 | 8 |
| 05-05 | 17.6m (1055s) | 2 | 3 |

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
- [Phase 04-01]: PostGIS GEOMETRY(Point, 4326) for ticket location instead of separate lat/lng columns
- [Phase 04-01]: Backward-compatible lat/lng properties on Ticket for Phase 2-3 code
- [Phase 04-01]: SLAConfig uses NonTenantModel (admins configure cross-tenant policies)
- [Phase 04-01]: TicketAssignment tracks full assignment history with is_current flag
- [Phase 04-01]: Celery uses Redis DB 1 (DB 0 reserved for rate limiting/sessions)
- [Phase 04-01]: USE_SQLITE_TESTS env var disables GeoAlchemy2 for unit test compatibility
- [Phase 04-02]: PostGIS ST_DWithin with 10km radius for geospatial proximity search
- [Phase 04-02]: PostGIS ST_Distance ordering for nearest-first team matching
- [Phase 04-02]: GBV routing uses explicit assert + is_saps==True filter (SEC-05 security boundary)
- [Phase 04-02]: Municipal routing explicitly filters is_saps==False to prevent SAPS teams receiving municipal tickets
- [Phase 04-02]: Fallback to category-based routing when no spatial match or location is None
- [Phase 04-02]: first_responded_at set when ticket assigned to user AND status is open
- [Phase 04-02]: Assignment deactivation uses UPDATE with is_current=False before creating new assignment
- [Phase 04-02]: reassign_ticket enforces GBV-to-SAPS constraint at assignment layer (defense in depth)
- [Phase 04-03]: GBV tickets (is_sensitive=True) excluded from all SLA monitoring per SAPS protocols
- [Phase 04-03]: System default SLA: 24h response, 168h (7 days) resolution
- [Phase 04-03]: PostgreSQL advisory locks prevent duplicate escalation in multi-worker Celery environments
- [Phase 04-03]: Escalation assigns to team manager (not generic team member)
- [Phase 04-03]: WhatsApp status updates use body text (not Twilio Content API templates) for faster iteration
- [Phase 04-03]: Celery tasks accept only primitive types (str/int) for JSON serialization
- [Phase 04-03]: Windows compatibility: WindowsSelectorEventLoopPolicy for asyncio.run() in Celery
- [Phase 04-03]: SLA config caching per task run for performance (in-memory dict)
- [Phase 04-03]: Fixed ticket_tool.py to use PostGIS location field instead of lat/lng properties
- [Phase 04-04]: TicketDetailResponse extends TicketResponse with SLA status and assignment history
- [Phase 04-04]: GBV API endpoints enforce 403 for non-SAPS/non-ADMIN roles (SEC-05 firewall)
- [Phase 04-04]: Status updates dispatch WhatsApp notifications via Celery best-effort (non-blocking)
- [Phase 04-04]: Ticket-specific structured logging added to generic audit system for operational visibility
- [Phase 04-05]: 84 comprehensive tests for Phase 4 (routing, SLA, escalation, notification, assignment, API, GBV firewall)
- [Phase 04-05]: SEC-05 GBV firewall verified at all layers (routing, assignment, SLA, API) with dedicated test suite
- [Phase 04-05]: Timezone-naive datetime mocking pattern for SLA service tests
- [Phase 04-05]: AsyncMock side_effect list pattern for sequential database query mocking
- [Phase 05-01]: Added WARD_COUNCILLOR role for municipal councillor access with interim ward filtering
- [Phase 05-01]: Server-side pagination with page/page_size pattern instead of limit/offset
- [Phase 05-01]: Dashboard metrics exclude GBV/sensitive tickets and SAPS teams (SEC-05 compliance)
- [Phase 05-02]: Redis Pub/Sub for event broadcasting across multiple server instances
- [Phase 05-02]: SSE over WebSocket for dashboard real-time updates (one-way streaming, auto-reconnect)
- [Phase 05-02]: Ward councillor SSE filtering at server layer for RBAC enforcement
- [Phase 05-02]: Separate CSV and Excel export endpoints (Excel requires openpyxl, CSV always available)
- [Phase 05-02]: Export endpoints enforce SEC-05 (GBV tickets excluded via is_sensitive == False filter)
- [Phase 05-04]: Recharts for all dashboard visualizations (bar charts, pie/gauge)
- [Phase 05-04]: Hash-based routing to avoid react-router dependency
- [Phase 05-04]: Simple SSE re-fetch strategy (refresh all metrics on any event)
- [Phase 05-04]: Tab visibility detection to disable SSE when inactive
- [Phase 05-04]: Color-coded SLA metrics (green >=80%, amber >=60%, red <60%)
- [Phase 05]: Use TanStack Table with server-side pagination/sorting (manualPagination: true)
- [Phase 05]: Debounce search input at 300ms using setTimeout (not external library)
- [Phase 05]: Export uses authenticated fetch with blob download (not direct link due to Bearer token)
- [Phase 05-05]: Unit tests use AsyncMock for database/Redis (no real dependencies)
- [Phase 05-05]: SEC-05 GBV exclusion tested at all layers (service, API, export)
- [Phase 05-05]: RBAC tested for all roles (MANAGER/ADMIN/WARD_COUNCILLOR/CITIZEN/FIELD_WORKER)
- [Phase 05-05]: 310 tests passing (0 failures), 111 integration tests skipped (PostgreSQL unavailable)

### Pending Todos

None - CrewAI successfully installed and integrated.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-10 (Phase 5 COMPLETE)
Stopped at: Phase 5 Plan 05 COMPLETE — Testing & Verification: Comprehensive test suite with 310 passing tests, SEC-05 GBV exclusion verified at all layers, RBAC tested for all user roles, enhanced tickets list endpoint tests, full regression validation, frontend builds successfully. Phase 5 Municipal Operations Dashboard is COMPLETE. Ready for Phase 6 (Public Transparency & Rollout).
Resume file: None

---
*State initialized: 2026-02-09*
*Last updated: 2026-02-10T13:30:44Z*
