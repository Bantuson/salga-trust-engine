# Roadmap: SALGA Trust Engine

## Overview

This roadmap delivers an AI-powered municipal service management platform in 6 phases, following dependency chains from foundational security architecture through agentic AI, citizen reporting channels, operational workflows, and finally public transparency. The sequence prioritizes irreversible architectural decisions (multi-tenancy, POPIA compliance, API-first design), validates the WhatsApp-first thesis early, proves AI categorization value, builds internal operational capabilities, and culminates in public-facing transparency that demonstrates municipal accountability. Each phase delivers a coherent, verifiable capability that unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Security** - Multi-tenant architecture, POPIA compliance, API-first design
- [ ] **Phase 2: Agentic AI System** - CrewAI manager and specialist agents with multilingual support
- [ ] **Phase 3: Citizen Reporting Channels** - WhatsApp bot and web portal intake with photo uploads
- [ ] **Phase 4: Ticket Management & Routing** - Geospatial routing, SLA tracking, automated escalation
- [ ] **Phase 5: Municipal Operations Dashboard** - Manager dashboard with real-time updates and analytics
- [ ] **Phase 6: Public Transparency & Rollout** - Public dashboard, pilot municipality deployment

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
**Plans**: TBD

Plans:
- [ ] 01-01: TBD during phase planning
- [ ] 01-02: TBD during phase planning
- [ ] 01-03: TBD during phase planning

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
**Plans**: TBD

Plans:
- [ ] 02-01: TBD during phase planning
- [ ] 02-02: TBD during phase planning
- [ ] 02-03: TBD during phase planning

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
**Plans**: TBD

Plans:
- [ ] 03-01: TBD during phase planning
- [ ] 03-02: TBD during phase planning
- [ ] 03-03: TBD during phase planning

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD during phase planning
- [ ] 04-02: TBD during phase planning
- [ ] 04-03: TBD during phase planning

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD during phase planning
- [ ] 05-02: TBD during phase planning
- [ ] 05-03: TBD during phase planning

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
**Plans**: TBD

Plans:
- [ ] 06-01: TBD during phase planning
- [ ] 06-02: TBD during phase planning
- [ ] 06-03: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Security | 0/3 | Not started | - |
| 2. Agentic AI System | 0/3 | Not started | - |
| 3. Citizen Reporting Channels | 0/3 | Not started | - |
| 4. Ticket Management & Routing | 0/3 | Not started | - |
| 5. Municipal Operations Dashboard | 0/3 | Not started | - |
| 6. Public Transparency & Rollout | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-09*
*Last updated: 2026-02-09*
