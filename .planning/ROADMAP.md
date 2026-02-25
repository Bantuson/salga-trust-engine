# Roadmap: SALGA Trust Engine

## Overview

This roadmap delivers an AI-powered municipal service management platform in 6 phases, following dependency chains from foundational security architecture through agentic AI, citizen reporting channels, operational workflows, and finally public transparency. The sequence prioritizes irreversible architectural decisions (multi-tenancy, POPIA compliance, API-first design), validates the WhatsApp-first thesis early, proves AI categorization value, builds internal operational capabilities, and culminates in public-facing transparency that demonstrates municipal accountability. Each phase delivers a coherent, verifiable capability that unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Security** - Multi-tenant architecture, POPIA compliance, API-first design
- [x] **Phase 2: Agentic AI System** - CrewAI manager and specialist agents with multilingual support
- [x] **Phase 3: Citizen Reporting Channels** - WhatsApp bot and web portal intake with photo uploads
- [x] **Phase 4: Ticket Management & Routing** - Geospatial routing, SLA tracking, automated escalation
- [x] **Phase 5: Municipal Operations Dashboard** - Manager dashboard with real-time updates and analytics
- [x] **Phase 6: Public Transparency & Rollout** - Public dashboard, pilot municipality deployment

## Phase Details

### Phase 1: Foundation & Security
**Goal**: Platform infrastructure is secure, compliant, and multi-tenant capable
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-05, PLAT-06, PLAT-07, PLAT-08, SEC-01, SEC-02, SEC-03, SEC-04, SEC-06, SEC-07, SEC-08
**Success Criteria** (what must be TRUE):
  1. Three pilot municipalities can register with complete data isolation (no cross-tenant data leakage)
  2. All API endpoints enforce authentication and role-based access control (citizen, manager, admin, SAPS liaison)
  3. System captures POPIA consent at registration with clear purpose explanation in user's language
  4. User can request access to their personal data and request deletion (POPIA rights functional)
  5. All data is encrypted at rest and in transit with comprehensive audit logging on all operations
  6. All unit, integration, and security tests pass with >=80% coverage on phase code
**Plans:** 7 plans

Plans:
- [x] 01-01-PLAN.md -- Project foundation, database layer, and all data models
- [x] 01-02-PLAN.md -- Authentication system with JWT, RBAC, and POPIA consent at registration
- [x] 01-03-PLAN.md -- Security middleware, rate limiting, input sanitization, and CORS
- [x] 01-04-PLAN.md -- POPIA data rights endpoints and comprehensive audit logging
- [x] 01-05-PLAN.md -- Municipality management API and multi-tenant RLS isolation
- [x] 01-06-PLAN.md -- Database encryption config (SEC-01) and test infrastructure overhaul (gap closure)
- [x] 01-07-PLAN.md -- Test suite separation, unit tests, and coverage verification (gap closure)

### Phase 2: Agentic AI System
**Goal**: AI agents handle message routing and structured conversational intake
**Depends on**: Phase 1 (requires secure API foundation)
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07, PLAT-04
**Success Criteria** (what must be TRUE):
  1. Manager agent receives messages in English, isiZulu, or Afrikaans and routes to correct specialist agent
  2. Municipal services specialist agent conducts structured intake and creates ticket with complete information
  3. GBV specialist agent captures sensitive reports with enhanced privacy and routes to nearest SAPS station
  4. All agent interactions have guardrails preventing inappropriate responses or data leakage
  5. System detects language and responds in kind across all three supported languages
  6. All unit, integration, and security tests pass with >=80% coverage on phase code; all Phase 1 tests still pass
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md -- Language detection, conversation state manager, and Ticket data model
- [x] 02-02-PLAN.md -- CrewAI Flow architecture, message routing, and municipal services crew
- [x] 02-03-PLAN.md -- GBV specialist crew with enhanced privacy and SAPS notification
- [x] 02-04-PLAN.md -- Guardrails engine, message API endpoint, and Phase 2 test coverage

### Phase 3: Citizen Reporting Channels
**Goal**: Citizens can report issues via WhatsApp and web with visual evidence
**Depends on**: Phase 2 (requires AI agents for intake)
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-07, RPT-08, RPT-09, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. Citizen can report service issue via WhatsApp in any supported language and receive unique tracking number
  2. Citizen can report service issue via web portal with same functionality as WhatsApp
  3. Citizen can upload photos with report for visual evidence (auto-captured or manual)
  4. System captures GPS geolocation automatically with manual address fallback option
  5. Citizen can report GBV/abuse and system routes to nearest SAPS station (not municipal team)
  6. User must verify proof of residence (OCR document analysis) to bind account to specific municipality
  7. GBV report data is stored with enhanced encryption and need-to-know access controls
  8. All unit, integration, and security tests pass with >=80% coverage on phase code; all Phase 1-2 tests still pass
**Plans:** 7 plans

Plans:
- [x] 03-01-PLAN.md -- Storage infrastructure, media model, and GBV field-level encryption
- [x] 03-02-PLAN.md -- Twilio WhatsApp webhook integration with media handling
- [x] 03-03-PLAN.md -- OCR service and proof of residence verification
- [x] 03-04-PLAN.md -- Web portal upload and report submission API with React frontend
- [x] 03-05-PLAN.md -- Phase 3 test suite and coverage verification
- [x] 03-06-PLAN.md -- Fix WhatsApp tracking number and MediaAttachment creation (gap closure)
- [x] 03-07-PLAN.md -- Add unit tests for coverage >= 80% (gap closure)

### Phase 4: Ticket Management & Routing
**Goal**: Tickets are automatically routed and tracked with SLA enforcement
**Depends on**: Phase 3 (requires citizen reporting channels)
**Requirements**: TKT-01, TKT-02, TKT-03, TKT-04, TKT-05, SEC-05
**Success Criteria** (what must be TRUE):
  1. Citizen receives automated status updates via WhatsApp as ticket progresses through workflow
  2. System uses geospatial analytics to route tickets to correct municipal team based on location and category
  3. System tracks SLA compliance (response time and resolution time) against configured targets
  4. System automatically escalates tickets that breach SLA thresholds to higher authority
  5. Each ticket has complete audit trail showing creation, assignment, status changes, and resolution
  6. GBV data is accessible only to authorized SAPS liaison and system admin (firewall-isolated)
  7. All unit, integration, and security tests pass with >=80% coverage on phase code; all Phase 1-3 tests still pass
**Plans:** 5 plans

Plans:
- [x] 04-01-PLAN.md -- PostGIS migration, Team/Assignment/SLA models, Celery infrastructure
- [x] 04-02-PLAN.md -- Geospatial routing service with GBV firewall and assignment tracking
- [x] 04-03-PLAN.md -- SLA service, escalation service, notification service, and Celery tasks
- [x] 04-04-PLAN.md -- Ticket management API endpoints with audit trail and GBV access controls
- [x] 04-05-PLAN.md -- Phase 4 test suite, GBV firewall tests, and coverage verification

### Phase 5: Municipal Operations Dashboard
**Goal**: Municipal managers can view, assign, and analyze tickets with real-time updates
**Depends on**: Phase 4 (requires tickets flowing through system)
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Municipal manager can view, filter, search, and assign tickets via web dashboard
  2. Ward councillor can view dashboard filtered to issues in their specific ward
  3. Dashboard shows real-time ticket volumes, SLA compliance metrics, and team workload
  4. Manager can export issue data to Excel/CSV for offline analysis
  5. Dashboard updates in real-time when ticket status changes (no page refresh required)
  6. All unit, integration, and security tests pass with >=80% coverage on phase code; all Phase 1-4 tests still pass
**Plans:** 5 plans

Plans:
- [x] 05-01-PLAN.md -- Backend dashboard API, enhanced tickets endpoint, WARD_COUNCILLOR role
- [x] 05-02-PLAN.md -- SSE real-time events, Redis Pub/Sub broadcaster, CSV/Excel export
- [x] 05-03-PLAN.md -- Frontend ticket list page with TanStack Table, filters, and export
- [x] 05-04-PLAN.md -- Frontend dashboard metrics page with Recharts, SSE integration, routing
- [x] 05-05-PLAN.md -- Phase 5 test suite, SEC-05 verification, and regression check

### Phase 6: Public Transparency & Rollout
**Goal**: Public can view municipal performance, and pilot municipalities are onboarded
**Depends on**: Phase 5 (requires operational data flowing)
**Requirements**: TRNS-01, TRNS-02, TRNS-03, TRNS-04, TRNS-05
**Success Criteria** (what must be TRUE):
  1. Public dashboard displays average response times per municipality (accessible without login)
  2. Public dashboard displays resolution rates per municipality with trend data
  3. Public dashboard displays geographic heatmap of reported issues
  4. GBV/sensitive report data is NEVER displayed on public dashboard (aggregated counts only, no identifying details)
  5. Three to five pilot municipalities are onboarded with active citizen reporting and visible municipal responses
  6. Full test suite passes across all 6 phases with >=80% coverage; no regressions
**Plans:** 3/3 plans complete

Plans:
- [x] 06-01-PLAN.md -- Public metrics backend: cross-tenant aggregation service and unauthenticated API endpoints
- [x] 06-02-PLAN.md -- Public dashboard frontend: Recharts visualizations, Leaflet heatmap, municipality selector
- [x] 06-03-PLAN.md -- Pilot onboarding seed script, GBV firewall public tests, and full regression suite

## Phase Verification Policy

**Mandatory unit testing after every phase.** No phase is considered complete until:

1. **All new code has unit tests** — every module, endpoint, and utility introduced in the phase must have corresponding tests
2. **All tests pass** — `pytest` runs green with zero failures before phase sign-off
3. **Coverage gate** — phase code must achieve minimum 80% line coverage (measured via `pytest --cov`)
4. **Regression check** — all tests from prior phases must still pass (full suite, not just new tests)
5. **Test categories required per phase:**
   - **Unit tests**: Individual functions, models, utilities, validators
   - **Integration tests**: API endpoints, database operations, middleware chains
   - **Security tests**: Auth enforcement, RBAC restrictions, tenant isolation, input sanitization
6. **Phase cannot advance** — execution of the next phase is blocked until the current phase's test suite passes completely

This policy applies to all 6 phases. Test files live in `tests/` mirroring the `src/` structure.

### Phase 7: Fix WhatsApp -> AI Agent Integration (GAP CLOSURE)
**Goal:** Fix broken WhatsApp intake path — WhatsAppService calls removed IntakeFlow API (llm_model kwarg, receive_message(), classify_message()). Update to route through ManagerCrew. Fix GBV routing via Twilio webhook path.
**Depends on:** Phase 6.9 (ManagerCrew must exist)
**Requirements:** RPT-01, RPT-07
**Gap Closure:** Closes gaps from v1.0 milestone audit
**Plans:** 2/2 plans complete

Plans:
- [ ] 07-01-PLAN.md -- Fix broken call sites: replace IntakeFlow with direct ManagerCrew.kickoff() in messages.py, reports.py, whatsapp_service.py; fix session_id stability in whatsapp.py
- [ ] 07-02-PLAN.md -- Add GBV confirmation state machine (gbv_pending_confirm) in crew_server.py and whatsapp_service.py; update test mocks for ManagerCrew pipeline

### Phase 8: Wire Web Portal Report Submission (GAP CLOSURE)
**Goal:** Replace mock submit in ReportIssuePage.tsx with real API call to POST /api/v1/reports/submit. Fix reports.py to use ManagerCrew API instead of removed IntakeFlow methods. When tickets actually create: photos link (RPT-03), GPS saves (RPT-04), tracking numbers issue (RPT-05), GBV tickets create (RPT-06), encryption exercises (RPT-08).
**Depends on:** Phase 6.9 (ManagerCrew must exist)
**Requirements:** RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-08
**Gap Closure:** Closes gaps from v1.0 milestone audit
**Plans:** 2/2 plans complete

Plans:
- [ ] 08-01-PLAN.md -- Fix PostGIS location bug in reports.py, route ordering, USE_POSTGIS guard, update test mocks from IntakeFlow to ManagerCrew
- [ ] 08-02-PLAN.md -- Wire ReportIssuePage.tsx handleSubmit to real POST /api/v1/reports/submit with auth, category mapping, GPS accuracy, media linking, GBV flag

### Phase 9: OCR Supabase Bridge & Ward Filtering (GAP CLOSURE)
**Goal:** Bridge OCR verification result to Supabase user_metadata (residence_verified = true) so frontend gate unlocks. Add User.ward_id field with migration and wire ward filtering in tickets/dashboard queries so ward councillors see only their ward's tickets.
**Depends on:** Nothing (independent)
**Requirements:** PLAT-03, RPT-09, OPS-03
**Gap Closure:** Closes gaps from v1.0 milestone audit
**Plans:** 2/2 plans complete

Plans:
- [ ] 09-01-PLAN.md -- OCR-to-Supabase bridge: sync residence_verified to user_metadata after verification, frontend session refresh
- [ ] 09-02-PLAN.md -- Ward filtering: User.ward_id field, Alembic migration, enforce ward-scoped filtering in tickets and dashboard endpoints

### Phase 10: Render Staging Deployment Fixes (GAP CLOSURE)
**Goal:** Fix render.yaml deployment config: Celery startCommand path (src.celery_app -> src.tasks.celery_app), add missing SUPABASE_JWT_SECRET env var, fix TWILIO_WHATSAPP_FROM -> TWILIO_WHATSAPP_NUMBER env var name. Unblocks staging WhatsApp notifications and municipal dashboard auth.
**Depends on:** Nothing (independent)
**Requirements:** TKT-01, SEC-01, SEC-04, RPT-01
**Gap Closure:** Closes deployment gaps from v1.0 milestone audit
**Plans:** 1/1 plans complete

Plans:
- [ ] 10-01-PLAN.md -- Fix render.yaml deployment bugs (Celery path, JWT secret, Twilio env var) and add configuration validation test

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Gap closure phases (7-10) are independent and can execute in parallel.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 7/7 | ✓ Complete | 2026-02-09 |
| 2. Agentic AI System | 4/4 | ✓ Complete | 2026-02-09 |
| 3. Citizen Reporting Channels | 7/7 | ✓ Complete | 2026-02-10 |
| 4. Ticket Management & Routing | 5/5 | ✓ Complete | 2026-02-10 |
| 5. Municipal Operations Dashboard | 5/5 | ✓ Complete | 2026-02-10 |
| 6. Public Transparency & Rollout | 3/3 | Complete   | 2026-02-19 |
| 6.1. Supabase & Dashboard Separation | 9/9 | ✓ Complete | 2026-02-11 |
| 6.4. Dashboard Landing & Citizen Auth | 7/7 | ✓ Complete | 2026-02-13 |
| 6.5. Public Dashboard UI Refinements | 3/3 | ✓ Complete | 2026-02-14 |
| 6.6. Playwright MCP Automated Testing | 9/9 | ✓ Complete | 2026-02-16 |
| 6.9.1. Agent Output Formatting & Prompt Engineering | 4/4 | ✓ Complete | 2026-02-19 |
| 6.9.2. System-wide Integration Validation | 5/5 | ✓ Complete | 2026-02-20 |
| 7. Fix WhatsApp -> AI Agent Integration | 2/2 | Complete   | 2026-02-22 |
| 8. Wire Web Portal Report Submission | 2/2 | Complete   | 2026-02-22 |
| 9. OCR Supabase Bridge & Ward Filtering | 2/2 | Complete   | 2026-02-22 |
| 10. Render Staging Deployment Fixes | 1/1 | Complete    | 2026-02-22 |

---
*Roadmap created: 2026-02-09*
*Last updated: 2026-02-25 (Phase 10.2 planned: 2 plans for auth system security hardening)*

### Phase 10.3: CrewAI Agent Rebuild and LLM Evaluation Framework (INSERTED)

**Goal:** Rebuild the entire CrewAI agent system from scratch using Flow @router architecture (replacing broken Process.hierarchical). Archive existing code, rebuild each specialist agent (Auth, Municipal, TicketStatus, GBV) independently with proven end-to-end tests, then wire IntakeFlow routing. Establish LLM evaluation framework with trajectory evals (deepeval ToolCorrectnessMetric) and Claude-as-judge rubrics for regression prevention.
**Depends on:** Phase 10
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Plans:** 8 plans

Plans:
- [ ] 10.3-01-PLAN.md -- Archive old agents, scaffold new directory structure, install deepeval, create test infrastructure
- [ ] 10.3-02-PLAN.md -- Eval framework: scenarios for all 5 agents, trajectory eval harness, judge rubrics
- [ ] 10.3-03-PLAN.md -- Auth agent rebuild (tools, prompts, crew) + crew_server.py rebuild from scratch
- [ ] 10.3-04-PLAN.md -- Auth agent unit tests + crew server unit tests
- [ ] 10.3-05-PLAN.md -- Municipal Intake + Ticket Status agents rebuild with tools, prompts, tests
- [ ] 10.3-06-PLAN.md -- GBV agent rebuild with trauma-informed prompts, SAPS tool, SEC-05 boundary tests
- [ ] 10.3-07-PLAN.md -- IntakeFlow @router rebuild, wire all specialists, update WhatsApp/messages endpoints
- [ ] 10.3-08-PLAN.md -- Integration tests, eval runner, regression check, Streamlit verification checkpoint

### Phase 10.2: Auth system security hardening (INSERTED)

**Goal:** Harden the auth system with strong password validation (12 chars, uppercase+lowercase+digit), POPIA-safe auth event audit logging on all FastAPI auth endpoints, client-side password requirements UI on registration pages, and Supabase Dashboard security configuration (OTP expiry, password policy, session settings).
**Depends on:** Phase 10.1
**Requirements:** SEC-01, SEC-02, SEC-04, SEC-06, SEC-07, SEC-08
**Plans:** 2/2 plans complete

Plans:
- [ ] 10.2-01-PLAN.md -- Backend auth hardening: password complexity validator, auth event audit logging, OperationType enum extension, unit tests
- [ ] 10.2-02-PLAN.md -- Frontend password validation UI on registration pages + Supabase Dashboard security settings verification checkpoint

### Phase 10.1: Auth system diagnosis fix invalid credentials and enable email code verification for dashboards (INSERTED)

**Goal:** Fix "invalid credentials" registration bug (unconfirmed email accounts) by adding inline 6-digit OTP verification to both registration pages, add email OTP as a login method alongside password and phone OTP, and remediate existing stuck accounts.
**Depends on:** Phase 10
**Requirements:** SEC-01, SEC-02
**Plans:** 2/2 plans complete

Plans:
- [ ] 10.1-01-PLAN.md -- Auth layer email OTP methods + inline OTP verification step on both registration pages
- [ ] 10.1-02-PLAN.md -- Email OTP sign-in mode on both login pages + SQL remediation + template verification checkpoint

### Phase 06.9: Multi-Agent Manager Refactor -- CrewAI hierarchical routing with manager agent greeting task auth routing municipal tickets agent (INSERTED)

**Goal:** Replace keyword-based IntakeFlow router and imperative crew_server.py routing logic with a CrewAI hierarchical manager agent. Manager handles first contact, classifies intent via LLM, delegates to specialist agents (auth, municipal intake, GBV, ticket status). Add new ticket status agent for citizens to check on existing reports.
**Depends on:** Phase 6.8
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Plans:** 4/4 plans complete

Plans:
- [ ] 06.9-01-PLAN.md -- ConversationState extension, ticket_lookup_tool, TicketStatusCrew, YAML config for all agents/tasks
- [ ] 06.9-02-PLAN.md -- ManagerCrew with Process.hierarchical, Gugu manager agent, specialist delegation
- [ ] 06.9-03-PLAN.md -- IntakeFlow and crew_server.py refactor to route through ManagerCrew
- [ ] 06.9-04-PLAN.md -- Unit tests for ManagerCrew/TicketStatusCrew, update existing tests, Streamlit presets

### Phase 06.9.2: System-wide integration validation — full security audit, API completeness, 3-way communication, code quality, CI/CD, Render staging (INSERTED)

**Goal:** End-to-end system validation before production deployment. (1) API completeness: every endpoint tested, secured (auth + RBAC), and rate-limited — including CrewAI tool endpoints (crew_server). (2) Dashboard fetch fixes: investigate and fix failing fetches in both municipal and public dashboards. (3) Full security audit (OWASP, POPIA, SEC-05 GBV firewall). (4) 3-way communication validation: CrewAI WhatsApp agents create tickets → municipal dashboard receives for filing/status updates → analytics aggregate municipal stats → public dashboard transparency views. (5) Code quality checks. (6) CI/CD pipeline setup. (7) Render staging deployment with live Twilio WhatsApp credentials for final CrewAI integration test. Tests assess component behavior, failure points, and system design soundness — not overengineered.
**Depends on:** Phase 6.9.1
**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, AI-01, AI-02, AI-03, TKT-01, TKT-02, OPS-01, OPS-02, TRNS-01, TRNS-02, TRNS-03
**Plans:** 5/5 plans complete

Plans:
- [x] 06.9.2-01-PLAN.md -- API security hardening: crew server CORS/rate-limiting/input-validation, endpoint-specific rate limits on all 71 endpoints
- [x] 06.9.2-02-PLAN.md -- Dashboard fetch fixes: 401 retry with token refresh (municipal), Supabase query resilience (public)
- [x] 06.9.2-03-PLAN.md -- Code quality (ruff linter), GitHub Actions CI pipeline, Render staging Blueprint
- [x] 06.9.2-04-PLAN.md -- Security audit tests: OWASP auth enforcement, RBAC coverage, SEC-05 GBV 5-layer firewall, POPIA compliance
- [x] 06.9.2-05-PLAN.md -- 3-way communication tests: agent ticket creation -> municipal dashboard -> public stats, crew server behavioral tests

### Phase 06.9.1: Fix agent output formatting Pydantic models auth OTP tool failures and system prompt engineering (INSERTED)

**Goal:** Fix agent behavior quality across all crews: eliminate internal reasoning leakage to citizens, add Pydantic structured output models for all crews, fix auth OTP tool execution failures, and re-engineer system prompts against CrewAI best practices.
**Depends on:** Phase 6.9
**Requirements:** AI-01, AI-02, AI-03, AI-04, AI-05, AI-06, AI-07
**Plans:** 4/4 plans complete

Plans:
- [x] 06.9.1-01-PLAN.md -- System prompt hardening: tool hard-blocks, universal guardrails, per-crew strictness in prompts and YAML
- [x] 06.9.1-02-PLAN.md -- Pydantic output models for all crews, repair strategy in base_crew, auth OTP tool fixes
- [x] 06.9.1-03-PLAN.md -- Code-level delegation filtering in sanitize_reply() and ManagerCrew.parse_result()
- [x] 06.9.1-04-PLAN.md -- Unit and integration tests for sanitization, Pydantic validation, and auth tool fixes

### Phase 06.7: Municipal intake agent testing -- DeepSeek LLM Streamlit chat dashboard auth agent phone detection API-first security (INSERTED)

**Goal:** Build an end-to-end testable municipal intake agent system powered by DeepSeek V3.2 LLM via CrewAI. Includes: auth agent with dual registration flow, deterministic phone detection, API-first crew server endpoints, and Streamlit chat dashboard for manual multi-turn testing.
**Depends on:** Phase 6
**Plans:** 5 plans

Plans:
- [ ] 06.7-01-PLAN.md -- DeepSeek LLM config, phone detection service, and auth tools
- [ ] 06.7-02-PLAN.md -- Auth crew with trilingual prompts and YAML config
- [ ] 06.7-03-PLAN.md -- Update existing crews and IntakeFlow to use DeepSeek LLM objects
- [ ] 06.7-04-PLAN.md -- Standalone crew server with /chat, /session/reset, /health endpoints
- [ ] 06.7-05-PLAN.md -- Streamlit test dashboard with WhatsApp-style chat and debug panel

### Phase 06.8: Agent personality enhancement (Gugu persona) & email OTP fix (INSERTED)

**Goal:** Enhance all agent personas with "Gugu" identity (feminine warmth, ask citizen names, platform context in backstory, trilingual personality). Fix Supabase Auth email OTP sending magic links instead of 6-digit codes. Evaluate SMS OTP via Twilio Verify integration.
**Depends on:** Phase 6.7
**Requirements:** AI-05, AI-06, AI-07
**Plans:** 5 plans

Plans:
- [x] 06.8-01-PLAN.md -- Gugu persona enhancement across auth, municipal, and GBV agent backstory prompts (9 language variants)
- [ ] 06.8-02-PLAN.md -- Language auto-detection in crew server and Supabase email OTP template fix + SMS OTP evaluation
- [x] 06.8-03-PLAN.md -- Response sanitization: strip LLM artifacts, Pydantic output models, warm Gugu-voiced error fallbacks
- [ ] 06.8-04-PLAN.md -- Fix Gugu identity confusion, greeting-first flow, and language lock in auth prompts (gap closure)
- [ ] 06.8-05-PLAN.md -- Branded email OTP template with 6-digit code display (gap closure)

### Phase 06.5: Public dashboard UI refinements -- scroll behavior, card styling, mobile fixes, login customization (INSERTED)

**Goal:** Fix header/navbar scroll persistence (should hide on scroll), fix scroll-to-top on navigation, improve scroll animation looping and inverse behavior, standardize card styling (white gloss -> pink gloss), fix mobile layout spacing and backgrounds, customize login card titles per context, polish request access page styling, fix dashboard hero text and stats card colors.
**Depends on:** Phase 6.4
**Plans:** 3 plans

Plans:
- [x] 06.5-01-PLAN.md -- Header scroll behavior, GSAP animation looping, feature card styling
- [x] 06.5-02-PLAN.md -- Dashboard visual refinements, context-aware login tagline
- [x] 06.5-03-PLAN.md -- Mobile layout, request access styling, stats card colors

### Phase 06.6: Playwright MCP automated dashboard testing (INSERTED)

**Goal:** End-to-end automated testing using Playwright MCP across both dashboards. Create 10 test profiles (5 per dashboard, role-specific for municipal). Test against mock municipality "Jozi Municipal Test" with second municipality for multi-tenant isolation. Cover full user journeys: account creation, report submission, routing, status updates, access requests, onboarding, GBV handling, and security/adversarial testing at OWASP level.
**Depends on:** Phase 6.5
**Success Criteria** (what must be TRUE):
  1. All users can create and manage accounts across both dashboards
  2. Database persistence of user data verified end-to-end
  3. Reports made in dashboard are routed and received by appropriate municipal role user for resolution and accountability; status updates persist and are visible in public dashboard tracking
  4. Municipality admin can request access, get approval, and gain access to onboard team
  5. Edge cases are considered and accounted for
  6. Security is maintained at OWASP level for all endpoints, user authorization and access restrictions, rate limiting and other security/adversarial tests pass
**Plans:** 9 plans

Plans:
- [x] 06.6-01-PLAN.md -- Playwright infrastructure: config, profiles, page objects, auth fixtures, test data generators
- [x] 06.6-02-PLAN.md -- Public dashboard E2E tests: citizen auth, report submission, GBV consent, profile, landing
- [x] 06.6-03-PLAN.md -- Municipal dashboard E2E tests: access request, onboarding, RBAC, ticket management
- [x] 06.6-04-PLAN.md -- Security tests: OWASP auth, tenant isolation, GBV privacy firewall, input validation
- [x] 06.6-05-PLAN.md -- Integration tests: cross-dashboard report-to-resolution, data persistence verification
- [x] 06.6-06-PLAN.md -- Run full suite, diagnose failures, fix selectors/timing/app bugs, iterate to 100% green
- [x] 06.6-07-PLAN.md -- Fix GSAP animation visibility (auth buttons, feature cards, headings) + register layout (gap closure)
- [x] 06.6-08-PLAN.md -- Fix glass readability tokens, dashboard card contrast, ticket page retry loop (gap closure)
- [x] 06.6-09-PLAN.md -- Fix CTA button backgrounds, mobile feature card visibility, Citizen Portal heading (gap closure)

### Phase 06.4: Dashboard landing pages, public hero polish, and citizen auth architecture on public portal (INSERTED)

**Goal:** Establish citizen authentication on the public portal, build citizen report form and profile page, add auth-gated boundaries, polish landing page with scroll animations and readability fixes, enhance municipal dashboard login page with product info.
**Depends on:** Phase 6
**Plans:** 7 plans

Plans:
- [x] 06.4-01-PLAN.md -- Citizen auth infrastructure (AuthContext, useAuth, ProtectedRoute, Supabase client update)
- [x] 06.4-02-PLAN.md -- Landing page GSAP scroll animations + hero readability fix
- [x] 06.4-03-PLAN.md -- Municipal dashboard login page enhancement with product info
- [x] 06.4-04-PLAN.md -- Citizen login + register pages with return URL redirect
- [x] 06.4-05-PLAN.md -- App.tsx routing update + PublicHeader auth state (user menu dropdown)
- [x] 06.4-06-PLAN.md -- Citizen report form page + GBV consent dialog + receipt card
- [x] 06.4-07-PLAN.md -- Citizen profile page + proof of residence component

### Phase 06.3: Complete UI redesign with Johannesburg skyline background glassmorphic cards pink rose theme and proper design system for both dashboards (INSERTED)

**Goal:** Complete visual identity overhaul for both dashboards: replace navy dark mode with pink/rose (#cd5e81) dominant background, use the Johannesburg skyline photograph as hero imagery, refine glassmorphic card system for the new color palette, remove 3D globe and Ndebele patterns, and ensure both apps share an identical theme. All existing page structure and functionality stays -- this is a re-skin, not a restructure.
**Depends on:** Phase 6.2
**Plans:** 6 plans

Plans:
- [ ] 06.3-01-PLAN.md -- Design tokens + animations + AnimatedGradientBg + GlassCard + Skeleton (pink/rose foundation)
- [ ] 06.3-02-PLAN.md -- Remove Globe3D and NdebelePattern from both dashboards
- [ ] 06.3-03-PLAN.md -- Skyline hero on public landing page with GSAP scroll fade + pink border frame
- [ ] 06.3-04-PLAN.md -- Public dashboard App.css full pink/rose re-skin (header, footer, all sections)
- [ ] 06.3-05-PLAN.md -- Municipal dashboard App.css re-skin + skyline backgrounds on login/register/request-access
- [ ] 06.3-06-PLAN.md -- Build verification + visual checkpoint

### Phase 06.2: UX redesign user journeys design system and dashboard consistency (INSERTED)

**Goal:** Redesign both dashboards with properly defined user journeys, a consistent design system (Space Grotesk + Inter, glassmorphism, animated gradient, Ndebele/Zulu accents), complete registration/onboarding flows, page structure separation (transparency dashboard as dedicated page), and improved 3D elements
**Depends on:** Phase 6.1
**Success Criteria** (what must be TRUE):
  1. Both dashboards use a shared design system (same fonts, colors, components)
  2. Public site has 4 pages: Landing, Transparency Dashboard (separate page), Report Issue redirect, About
  3. Municipal dashboard has icon-only sidebar with role-adaptive navigation
  4. 3D globe uses premium materials (metallic/glass), glowing municipality data points, and atmospheric effects
  5. Municipality registration uses hybrid model (request access form submitting to backend API, not open signup)
  6. Onboarding wizard guides municipalities through 5-step setup with backend-persisted state
  7. Team invitations stored in Supabase database via API endpoints
  8. Citizen portal fetches real ticket data from backend with GBV privacy enforced server-side
  9. Citizen personal analytics computed server-side (total, resolved, avg time, municipality comparison)
  10. Heatmap has interactive controls (time filter, category toggle, click-to-drill)
  11. All animations respect prefers-reduced-motion
  12. Both frontend apps build with zero errors
  13. All new backend tables have RLS policies following existing security patterns
**Plans:** 8 plans

Plans:
- [ ] 06.2-01-PLAN.md -- Shared design system foundation (typography, glassmorphism, gradient bg, Ndebele patterns, skeleton loaders, a11y hooks)
- [ ] 06.2-02-PLAN.md -- Public site page structure (React Router, 4 pages, transparent header, footer)
- [ ] 06.2-03-PLAN.md -- Municipal dashboard restructure (React Router, icon sidebar, role nav, RegisterPage)
- [ ] 06.2-04-PLAN.md -- 3D globe premium upgrade + scroll animation polish with reduced motion support
- [ ] 06.2-05-PLAN.md -- Municipality registration (request access) + onboarding wizard (5 steps) with backend integration
- [ ] 06.2-06-PLAN.md -- Citizen portal (My Reports, GBV privacy UI) + enhanced heatmap (filters, drill-down) with backend integration
- [ ] 06.2-07-PLAN.md -- Skeleton loaders, micro-interaction polish, build verification + visual checkpoint
- [ ] 06.2-08-PLAN.md -- Backend infrastructure: DB tables (access_requests, onboarding_state, team_invitations), FastAPI endpoints for access requests, onboarding, invitations, citizen portal

### Phase 06.1: Postgres refactor to Supabase and dashboard separation (INSERTED)

**Goal:** Migrate to Supabase Cloud (database, auth, storage, realtime), split frontend into two independently deployable React apps, and add premium UI design layer with animations, 3D elements, and dark mode
**Depends on:** Phase 6
**Success Criteria** (what must be TRUE):
  1. FastAPI connects to Supabase Cloud PostgreSQL (not local PostgreSQL)
  2. All authentication uses Supabase Auth (email+password and phone OTP), custom JWT+Argon2 removed
  3. RBAC roles injected into JWT via custom access token hook (role + tenant_id in app_metadata)
  4. Media uploads use Supabase Storage with GBV evidence in SAPS-only private bucket
  5. Real-time dashboard updates use Supabase Realtime (Redis Pub/Sub + SSE removed)
  6. RLS policies use auth.jwt() pattern (SET LOCAL removed), all policy columns indexed
  7. Public dashboard queries Supabase directly via anon key + RLS views (zero FastAPI dependency)
  8. Municipal dashboard is independent Vite app (frontend-dashboard/) with Supabase Auth
  9. GBV firewall intact at all layers: storage RLS, database RLS, public views, application filter
  10. All 338+ tests pass, both frontend apps build, no regressions
  11. Both dashboards use dark mode (navy #0A0E1A) with shared design token system
  12. Municipal dashboard has branded login with 3D globe, glassmorphism, GSAP animations
  13. Public dashboard has scroll storytelling landing page with interactive 3D SA globe
  14. All animations use GSAP + Lenis + anime.js (NOT Barba.js)
**Plans:** 9 plans

Plans:
- [x] 06.1-01-PLAN.md -- Supabase project setup, SDK install, config, database connection, RBAC custom claims hook
- [x] 06.1-02-PLAN.md -- Auth migration to Supabase Auth (register, login, phone OTP, JWT verification) + WhatsApp sessions
- [x] 06.1-03-PLAN.md -- Storage migration (S3 to Supabase Storage) + Realtime migration (Redis to Supabase Realtime)
- [x] 06.1-04-PLAN.md -- RLS policy migration (SET LOCAL to auth.jwt()), public views for anon role, tenant filter update
- [x] 06.1-05-PLAN.md -- Frontend split: municipal dashboard (frontend-dashboard/) with Supabase Auth + Realtime
- [x] 06.1-06-PLAN.md -- Frontend split: public dashboard (frontend-public/) with Supabase anon + RLS views
- [x] 06.1-07-PLAN.md -- Test suite update, regression verification, GBV firewall check, final verification
- [x] 06.1-08-PLAN.md -- Shared design system + municipal dashboard premium UI (dark mode, GSAP transitions, branded login with 3D globe)
- [x] 06.1-09-PLAN.md -- Public dashboard premium UI + scroll storytelling landing page with interactive 3D SA globe

### Phase 06.1.1: Teams Analytics and Settings pages UI full implementations with user roles municipal multi-tenancy new roles new teams user journeys design consistency (INSERTED)

**Goal:** Replace "Coming Soon" placeholders for Teams, Analytics, and Settings pages in the municipal dashboard with full implementations. Create missing backend APIs (Teams CRUD, SLA config, audit logs, analytics time-series). All three pages respect existing RBAC roles, municipal multi-tenancy, and match the glassmorphic design system.
**Depends on:** Phase 6.1
**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04, SEC-04
**Plans:** 9/9 plans complete

Plans:
- [ ] 06.1.1-01-PLAN.md -- Backend APIs: Teams CRUD, Settings/SLA CRUD, audit logs listing, analytics time-series params
- [ ] 06.1.1-02-PLAN.md -- Frontend shared infrastructure: TypeScript types, API service functions, category/permission constants, SparkLine component
- [ ] 06.1.1-03-PLAN.md -- Teams page: card grid, team creation, detail modal with tabs (Members/Invitations/Activity)
- [ ] 06.1.1-04-PLAN.md -- Teams member management: quick invite, bulk invite, role preview, permission matrix
- [ ] 06.1.1-05-PLAN.md -- Analytics page: KPI stat cards with sparklines, time range controls, team leaderboard, category comparison
- [ ] 06.1.1-06-PLAN.md -- Settings page: anchor nav, municipality profile, SLA targets, notifications, branding, data export, audit log viewer
- [ ] 06.1.1-07-PLAN.md -- App.tsx wiring + build verification + visual checkpoint
