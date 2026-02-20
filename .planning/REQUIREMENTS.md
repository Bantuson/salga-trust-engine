# Requirements: SALGA Trust Engine

**Defined:** 2026-02-09
**Core Value:** Citizens report a problem and the municipality visibly responds — through transparent, accountable, secure service delivery.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Platform Infrastructure

- [ ] **PLAT-01**: System uses multi-tenant architecture with data isolation per municipality (3-5 pilots)
- [ ] **PLAT-02**: User must create an account to submit reports (mandatory registration)
- [ ] **PLAT-03**: User must verify proof of residence (OCR document analysis) to bind account to specific municipality
- [ ] **PLAT-04**: System supports trilingual interface (English, isiZulu, Afrikaans)
- [ ] **PLAT-05**: All API endpoints implement input/output validation with security guardrails
- [ ] **PLAT-06**: System implements security firewalls between service endpoints (endpoint isolation)
- [ ] **PLAT-07**: System is POPIA-compliant from day one (consent management, data minimization, right to access/delete)
- [ ] **PLAT-08**: API-first architecture — all features accessible via documented REST API with tool-use design pattern

### Agentic AI System

- [x] **AI-01**: System uses CrewAI-based agentic architecture with manager agent receiving all incoming messages
- [x] **AI-02**: Manager agent analyzes message content and routes to appropriate specialist agent by category
- [x] **AI-03**: Specialist agent for municipal services (water, roads, electricity, waste, sanitation) handles report capture and ticket creation
- [x] **AI-04**: Specialist agent for GBV/domestic violence/abuse handles sensitive report capture with enhanced privacy
- [x] **AI-05**: Each specialist agent conducts structured conversational intake to gather required information
- [x] **AI-06**: Agents support English, isiZulu, and Afrikaans (detect language, respond in kind)
- [x] **AI-07**: All agent interactions have guardrails preventing inappropriate responses or data leakage

### Citizen Reporting

- [ ] **RPT-01**: Citizen can report service issues via WhatsApp using hybrid bot (guided intake + AI agent)
- [ ] **RPT-02**: Citizen can report service issues via web portal
- [ ] **RPT-03**: Citizen can upload photos with report for visual evidence
- [ ] **RPT-04**: System captures GPS geolocation automatically (with manual address fallback)
- [ ] **RPT-05**: Citizen receives unique tracking number for each report
- [ ] **RPT-06**: Citizen can report GBV/domestic violence/abuse as a dedicated category
- [ ] **RPT-07**: GBV reports are automatically routed to the nearest SAPS police station based on geolocation
- [ ] **RPT-08**: GBV report data is stored with enhanced encryption and access controls (need-to-know basis)
- [ ] **RPT-09**: System performs OCR analysis on uploaded documents/images for verification and evidence capture

### Ticket Management

- [ ] **TKT-01**: Citizen receives automated status updates via WhatsApp as ticket progresses
- [ ] **TKT-02**: System uses geospatial analytics to route tickets to correct municipal team based on location + category
- [ ] **TKT-03**: System tracks SLA compliance (response time and resolution time against targets)
- [ ] **TKT-04**: System auto-escalates tickets that breach SLA thresholds to higher authority
- [ ] **TKT-05**: Each ticket has full audit trail (creation, assignment, status changes, resolution)

### Municipal Operations

- [x] **OPS-01**: Municipal manager can view, filter, search, and assign tickets via web dashboard
- [x] **OPS-02**: Municipal manager can export issue data to Excel/CSV
- [x] **OPS-03**: Ward councillor can view dashboard filtered to issues in their ward
- [x] **OPS-04**: Dashboard shows real-time ticket volumes, SLA compliance, and team workload

### Public Transparency

- [ ] **TRNS-01**: Public dashboard displays average response times per municipality
- [ ] **TRNS-02**: Public dashboard displays resolution rates per municipality
- [ ] **TRNS-03**: Public dashboard displays geographic heatmap of reported issues
- [ ] **TRNS-04**: Public dashboard is accessible without login (open to all citizens)
- [ ] **TRNS-05**: GBV/sensitive report data is NEVER displayed on public dashboard (aggregated counts only, no identifying details)

### Security & Compliance

- [ ] **SEC-01**: All data encrypted at rest and in transit (TLS 1.3, AES-256)
- [ ] **SEC-02**: POPIA consent captured at registration with clear data processing purpose
- [ ] **SEC-03**: User can request access to their data and request deletion (POPIA rights)
- [x] **SEC-04**: Role-based access control (citizen, field worker, manager, admin, SAPS liaison)
- [ ] **SEC-05**: GBV data accessible only to authorized SAPS liaison and system admin (firewall-isolated)
- [ ] **SEC-06**: API rate limiting and abuse prevention on all public endpoints
- [ ] **SEC-07**: Comprehensive audit logging on all data access and modifications
- [ ] **SEC-08**: Input sanitization and output encoding on all user-facing endpoints (OWASP Top 10)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced AI

- **AI-V2-01**: Advanced multilingual NLP with code-switching detection
- **AI-V2-02**: Voice input for low-literacy users (speech-to-text in isiZulu/Afrikaans)
- **AI-V2-03**: Predictive analytics for service delivery bottleneck prediction
- **AI-V2-04**: Duplicate detection via geo-based clustering

### Enhanced Reporting

- **RPT-V2-01**: SMS fallback reporting channel
- **RPT-V2-02**: Two-way SMS (USSD-style) for feature phone users
- **RPT-V2-03**: Community upvoting on reported issues

### Enhanced Operations

- **OPS-V2-01**: Offline-first field worker mobile app with sync
- **OPS-V2-02**: ESRI/GIS system integration

### Enhanced Transparency

- **TRNS-V2-01**: Spending transparency per ward/area (cost per resolved issue)
- **TRNS-V2-02**: Impact stories with before/after photos
- **TRNS-V2-03**: Advanced reporting with custom dashboards and drill-downs

### Platform Scale

- **PLAT-V2-01**: Open API for third-party integrations
- **PLAT-V2-02**: ERP/Munsoft integration for budget tracking

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time citizen-to-citizen messaging | Becomes unmoderated social network; liability and abuse risk |
| AI-generated responses to citizens | Erodes trust if wrong; use AI for routing only, human-written templates for responses |
| Custom branded apps per municipality | Maintenance nightmare; single white-label with municipality branding |
| Blockchain audit trail | Over-engineering; standard audit logs + encrypted backups sufficient |
| Video calls with municipal staff | Bandwidth costs, connectivity issues, privacy concerns |
| Full social media integration | Amplifies complaints before municipality can respond; PR risk |
| Gamification (points, badges, leaderboards) | Trivializes serious issues; encourages spam |
| Citizen-driven prioritization | Politicizes platform; vocal minorities dominate; municipality decides |
| Mobile native app for citizens | WhatsApp is the citizen interface; web portal for alternative; native app deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 3 | Pending |
| PLAT-03 | Phase 3 | Pending |
| PLAT-04 | Phase 2 | Pending |
| PLAT-05 | Phase 1 | Pending |
| PLAT-06 | Phase 1 | Pending |
| PLAT-07 | Phase 1 | Pending |
| PLAT-08 | Phase 1 | Pending |
| AI-01 | Phase 2 | Complete |
| AI-02 | Phase 2 | Complete |
| AI-03 | Phase 2 | Complete |
| AI-04 | Phase 2 | Complete |
| AI-05 | Phase 2 | Complete |
| AI-06 | Phase 2 | Complete |
| AI-07 | Phase 2 | Complete |
| RPT-01 | Phase 3 | Pending |
| RPT-02 | Phase 3 | Pending |
| RPT-03 | Phase 3 | Pending |
| RPT-04 | Phase 3 | Pending |
| RPT-05 | Phase 3 | Pending |
| RPT-06 | Phase 3 | Pending |
| RPT-07 | Phase 3 | Pending |
| RPT-08 | Phase 3 | Pending |
| RPT-09 | Phase 3 | Pending |
| TKT-01 | Phase 4 | Pending |
| TKT-02 | Phase 4 | Pending |
| TKT-03 | Phase 4 | Pending |
| TKT-04 | Phase 4 | Pending |
| TKT-05 | Phase 4 | Pending |
| OPS-01 | Phase 5 | Complete |
| OPS-02 | Phase 5 | Complete |
| OPS-03 | Phase 5 | Complete |
| OPS-04 | Phase 5 | Complete |
| TRNS-01 | Phase 6 | Pending |
| TRNS-02 | Phase 6 | Pending |
| TRNS-03 | Phase 6 | Pending |
| TRNS-04 | Phase 6 | Pending |
| TRNS-05 | Phase 6 | Pending |
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 4 | Pending |
| SEC-06 | Phase 1 | Pending |
| SEC-07 | Phase 1 | Pending |
| SEC-08 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-09 after roadmap creation*
