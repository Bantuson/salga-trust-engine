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
**Plans:** 3 plans

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 7/7 | ✓ Complete | 2026-02-09 |
| 2. Agentic AI System | 4/4 | ✓ Complete | 2026-02-09 |
| 3. Citizen Reporting Channels | 7/7 | ✓ Complete | 2026-02-10 |
| 4. Ticket Management & Routing | 5/5 | ✓ Complete | 2026-02-10 |
| 5. Municipal Operations Dashboard | 5/5 | ✓ Complete | 2026-02-10 |
| 6. Public Transparency & Rollout | 3/3 | ✓ Complete | 2026-02-10 |
| 6.1. Supabase & Dashboard Separation | 9/9 | ✓ Complete | 2026-02-11 |

---
*Roadmap created: 2026-02-09*
*Last updated: 2026-02-11 (Phase 6.2 revised — UX redesign + full backend integration, 8 plans in 4 waves)*

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
