# Roadmap: SALGA Trust Engine

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10.4 (shipped 2026-02-28)
- 🚧 **v2.0 Senior Municipal Roles & PMS Integration** — Phases 27-32 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (26 phases, ~127 plans) — SHIPPED 2026-02-28</summary>

### Core Phases
- [x] Phase 1: Foundation & Security (7/7 plans) — completed 2026-02-09
- [x] Phase 2: Agentic AI System (4/4 plans) — completed 2026-02-09
- [x] Phase 3: Citizen Reporting Channels (7/7 plans) — completed 2026-02-10
- [x] Phase 4: Ticket Management & Routing (5/5 plans) — completed 2026-02-10
- [x] Phase 5: Municipal Operations Dashboard (5/5 plans) — completed 2026-02-10
- [x] Phase 6: Public Transparency & Rollout (3/3 plans) — completed 2026-02-19

### Inserted Sub-Phases
- [x] Phase 6.1: Supabase & Dashboard Separation (9/9 plans) — completed 2026-02-11
- [x] Phase 6.1.1: Teams Analytics Settings (7/7 plans) — completed 2026-02-11
- [x] Phase 6.2: UX Redesign (8 plans) — completed
- [x] Phase 6.3: UI Redesign Pink/Rose Theme (6 plans) — completed
- [x] Phase 6.4: Dashboard Landing & Citizen Auth (7/7 plans) — completed 2026-02-13
- [x] Phase 6.5: Public Dashboard UI Refinements (3/3 plans) — completed 2026-02-14
- [x] Phase 6.6: Playwright E2E Testing (9/9 plans) — completed 2026-02-16
- [x] Phase 6.7: Municipal Intake Agent Testing (5 plans) — completed
- [x] Phase 6.8: Gugu Persona & Email OTP (5 plans) — completed
- [x] Phase 6.9: Multi-Agent Manager Refactor (4/4 plans) — completed
- [x] Phase 6.9.1: Agent Output Formatting (4/4 plans) — completed 2026-02-19
- [x] Phase 6.9.2: System-wide Integration Validation (5/5 plans) — completed 2026-02-20

### Gap Closure Phases
- [x] Phase 7: Fix WhatsApp → AI Agent Integration (2/2 plans) — completed 2026-02-22
- [x] Phase 8: Wire Web Portal Report Submission (2/2 plans) — completed 2026-02-22
- [x] Phase 9: OCR Supabase Bridge & Ward Filtering (2/2 plans) — completed 2026-02-22
- [x] Phase 10: Render Staging Deployment Fixes (1/1 plan) — completed 2026-02-22

### Post-Gap Improvement Phases
- [x] Phase 10.1: Auth System Email OTP Fix (2/2 plans) — completed
- [x] Phase 10.2: Auth System Security Hardening (2/2 plans) — completed
- [x] Phase 10.3: CrewAI Agent Rebuild & LLM Eval Framework (11/11 plans) — completed
- [x] Phase 10.4: Rich Mocks for Dashboards (2/2 plans) — completed 2026-02-27

Full details: `milestones/v1.0-ROADMAP.md`

</details>

---

### v2.0 Senior Municipal Roles & PMS Integration

**Milestone Goal:** Transform the Trust Engine from a citizen service delivery platform into a full-stack municipal operating system — connecting citizen complaints on the ground to Council statutory reporting at the top — by implementing the Performance Management System (PMS) modules mandated by the Municipal Systems Act (MSA) and Municipal Finance Management Act (MFMA).

- [x] **Phase 27: RBAC Foundation & Tenant Configuration** - Extend role hierarchy to 4 tiers, configure department structure per municipality (completed 2026-02-28)
- [x] **Phase 28: IDP, SDBIP Core & Performance Monitoring** - Build the data backbone: strategic plans, KPIs, quarterly actuals, evidence, and the auto-population engine (completed 2026-03-01)
- [x] **Phase 29: Individual Performance Agreements** - Section 57 manager agreements, quarterly reviews, annual assessments (completed 2026-03-01)
- [x] **Phase 30: Statutory Reporting & Approval Workflows** - Auto-generate Section 52/72/46/121 reports with AG-compliant approval chains and deadline tracking (completed 2026-03-01)
- [x] **Phase 31: Role-Specific Dashboards** - CFO, Municipal Manager, Mayor, Council, and oversight dashboards for all 12 senior roles (completed 2026-03-02)
- [ ] **Phase 32: Risk Register & Public Transparency** - KPI-linked risk register and public SDBIP achievement data
- [ ] **Phase 33: Comprehensive v2.0 Gap Closure** - Fix all integration bugs (BUG-1–4), missing pages/routes, PA-01 form gap, IDP-04 route, Phase 27/28 verification, stale tracking, PMS readiness gate

## Phase Details

### Phase 27: RBAC Foundation & Tenant Configuration
**Goal**: Senior municipal staff can be assigned their correct roles and each municipality has its department structure configured, gating all PMS features
**Depends on**: v1.0 foundation (Supabase Auth, existing 6-role RBAC, TenantAwareModel)
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05, RBAC-06
**Success Criteria** (what must be TRUE):
  1. Admin can assign any of the 14 new roles (executive_mayor, municipal_manager, cfo, speaker, councillor, section56_director, department_manager, pms_officer, audit_committee_member, internal_auditor, mpac_member, salga_admin) to a user and the user's JWT reflects the new role without re-login issues
  2. Admin can create, name, and assign a responsible director to each department within their municipality tenant, and the organogram view reflects the configured hierarchy
  3. A user with a senior role (e.g., cfo) automatically inherits access to endpoints accessible by subordinate roles (e.g., manager) without additional configuration
  4. Every role change is visible in the audit log with the actor, timestamp, and previous/new role
  5. PMS feature endpoints return 403 until department configuration is complete, enforced by the PMS readiness gate
**Plans**: 3 plans

Plans:
- [x] 27-01-PLAN.md — Extend UserRole enum (18 roles, 4 tiers), create user_role_assignments and tier1_approval_requests models, update Supabase custom_access_token_hook for multi-role, add require_min_tier() dependency, Redis JWT blacklist, ROLE_CHANGE audit logging, role assignment API [Wave 1] — completed 2026-02-28
- [x] 27-02-PLAN.md — Department and DepartmentTicketCategoryMap models, extend Municipality with PMS settings, department CRUD API with organogram endpoint, ticket category mapping, municipality settings lock/unlock, RLS policies [Wave 1] — completed 2026-02-28
- [ ] 27-03-PLAN.md — PMS readiness gate service and endpoint, department setup wizard (5-step), OrganogramTree (react-d3-tree), RoleSwitcher component, PmsReadinessGate overlay, updated useRoleBasedNav for all 18 roles [Wave 2]

### Phase 28: IDP, SDBIP Core & Performance Monitoring
**Goal**: Authorized staff can define strategic goals (IDP), create KPIs with quarterly targets (SDBIP), submit quarterly actuals with evidence, and the system auto-populates actuals from resolved ticket data
**Depends on**: Phase 27 (department structure required for KPI assignment; roles required for all endpoints)
**Requirements**: IDP-01, IDP-02, IDP-03, IDP-04, IDP-05, SDBIP-01, SDBIP-02, SDBIP-03, SDBIP-04, SDBIP-05, SDBIP-06, SDBIP-07, SDBIP-08, SDBIP-09, SDBIP-10, EVID-01, EVID-02, EVID-03, EVID-04, EVID-05, EVID-06, EVID-07, EVID-08
**Success Criteria** (what must be TRUE):
  1. PMS officer can create a 5-year IDP cycle, add strategic goals and objectives with National KPA alignment, and view the IDP-to-SDBIP golden thread showing which KPIs link back to which objectives
  2. Director can create departmental SDBIP KPIs with quarterly targets, link each KPI to a validated mSCOA budget code from the seeded reference table (not free-text), and submit the SDBIP for Mayor sign-off via the approval workflow
  3. Director can submit quarterly actual values against KPI targets, upload portfolio of evidence documents, and see the system calculate achievement percentage and traffic-light status (green/amber/red) automatically
  4. After each quarter closes, the system's Celery auto-population task fills SDBIP actuals for service-delivery KPIs from resolved ticket data, and each auto-populated actual is clearly labeled with its source query reference and is never a GBV ticket
  5. Once a PMS officer validates a quarterly actual, it becomes immutable — corrections require a new submission record with a full audit trail, and the original validated value remains visible
**Plans**: 7 plans

Plans:
- [ ] 28-01-PLAN.md — IDP models (IDPCycle, IDPGoal, IDPObjective, IDPVersion), IDPWorkflow state machine, IDP CRUD API, Pydantic schemas, unit tests [Wave 1]
- [ ] 28-02-PLAN.md — SDBIP models (SDBIPScorecard, SDBIPKpi, SDBIPQuarterlyTarget), MscoaReference NonTenantModel with 30-row seed, SDBIP CRUD API, mSCOA lookup endpoint [Wave 2]
- [ ] 28-03-PLAN.md — SDBIPWorkflow state machine (draft/approved/revised) with Mayor sign-off, mid-year target adjustment endpoint (no draft reset), audit logging [Wave 3]
- [ ] 28-04-PLAN.md — SDBIPActual model, compute_achievement helper, traffic-light status (green/amber/red), immutability enforcement, correction record pattern, actuals submission API [Wave 3]
- [ ] 28-05-PLAN.md — EvidenceDocument model, ClamAV virus scanning pipeline, per-municipality Supabase Storage buckets, PMS officer actual validation endpoint, signed URL serving [Wave 4]
- [ ] 28-06-PLAN.md — SDBIPTicketAggregationRule model, AutoPopulationEngine service with SEC-05 GBV exclusion, Celery beat task (daily 01:00 SAST), quarter boundary logic, idempotency [Wave 4]
- [ ] 28-07-PLAN.md — 7 frontend pages (IDP, SDBIP, Actuals, Evidence, GoldenThread), TrafficLightBadge component, golden thread API, sidebar PMS navigation [Wave 5]

### Phase 29: Individual Performance Agreements
**Goal**: PMS officers can create Section 57 performance agreements for senior managers, link them to SDBIP KPIs, and conduct quarterly reviews and annual assessments through a signed workflow
**Depends on**: Phase 28 (SDBIP KPIs must exist before agreements can reference them)
**Requirements**: PA-01, PA-02, PA-03, PA-04, PA-05, PA-06
**Success Criteria** (what must be TRUE):
  1. PMS officer can create a performance agreement for a Section 57 manager, link it to specific organizational SDBIP KPIs with individual targets and weightings, and the agreement enters draft status immediately
  2. The Municipal Manager can sign a director's performance agreement (and the Executive Mayor can sign the Municipal Manager's agreement) via the approval workflow, transitioning the agreement from draft to signed status
  3. An evaluator can score individual KPIs per quarter in the quarterly review workflow, and the system compiles the annual assessment score from all quarterly scores weighted by KPI weights automatically
  4. Completed performance agreement records carry a POPIA retention flag and data deletion rights are honored on official departure
**Plans**: TBD

Plans:
- [ ] 29-01: Performance agreement data models (`PerformanceAgreement`, `PAKpi`), CRUD API, approval state machine (draft → signed → under_review → assessed), role-gated signing endpoints
- [ ] 29-02: Quarterly review workflow, annual assessment score compilation, Celery notifications to evaluators; POPIA retention flag; performance agreements frontend page

### Phase 30: Statutory Reporting & Approval Workflows
**Goal**: The system auto-generates Section 52/72/46/121 statutory reports from live PMS data, routes them through a multi-step approval chain, and tracks every statutory deadline with escalating notifications
**Depends on**: Phase 28 (IDP/SDBIP actuals as source data), Phase 29 (performance agreement scores contribute to reports)
**Requirements**: REPORT-01, REPORT-02, REPORT-03, REPORT-04, REPORT-05, REPORT-06, REPORT-07, REPORT-08, REPORT-09
**Success Criteria** (what must be TRUE):
  1. CFO or Municipal Manager can trigger generation of a Section 52 quarterly performance report or Section 72 mid-year assessment, and the system produces a PDF and DOCX file within the Celery worker (never blocking the request handler) using AG-compliant National Treasury formats
  2. Generated reports go through a five-stage approval chain (drafting → internal_review → mm_approved → submitted → tabled), and the source data used to generate the report is snapshotted at mm_approved status so the document never diverges from what was approved
  3. Senior staff receive escalating email and in-app notifications at 30, 14, 7, and 3 days before each statutory deadline, and overdue deadlines are flagged immediately
  4. The system auto-creates a report drafting task 30 days before each statutory deadline for the relevant financial year, with no hardcoded date literals
  5. Reports export with the municipality's logo, header formatting, and mandatory column structure (baseline, annual target, quarterly target, actual, variance, deviation reason), and carry a draft watermark until mm_approved
**Plans**: TBD

Plans:
- [ ] 30-01: Statutory report data models (`StatutoryReport`, `StatutoryReportSnapshot`), approval state machine (drafting → tabled), report generation service using WeasyPrint (PDF) and docxtpl (DOCX) in Celery workers; Section 52 and Section 72 Jinja2 templates
- [ ] 30-02: Section 46 annual performance report and Section 121 annual report templates; mandatory field completeness check before generation; draft watermark logic
- [ ] 30-03: Statutory reporting calendar — `financial_year`-driven deadline computation, Celery beat with escalating notifications (30/14/7/3 days), auto-task creation 30 days before deadlines (REPORT-07, REPORT-09)
- [ ] 30-04: Statutory reports frontend page — report list, approval action buttons, download PDF/DOCX, deadline calendar widget with traffic-light status

### Phase 31: Role-Specific Dashboards
**Goal**: Each of the 12 senior municipal roles sees a role-appropriate dashboard that surfaces the PMS data most relevant to their mandate, assembled from all prior phases
**Depends on**: Phase 28 (SDBIP data), Phase 29 (performance agreement data), Phase 30 (report and deadline data)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08, DASH-09, DASH-10, DASH-11, DASH-12
**Success Criteria** (what must be TRUE):
  1. CFO can view budget execution (expenditure vs budget per vote, revenue collection rate, variance alerts), SDBIP achievement summary with traffic-light KPIs, service delivery correlation linking ticket resolution rates to SDBIP KPIs, and statutory reporting calendar — all in a single authenticated dashboard
  2. Municipal Manager can view an all-department performance overview with drill-down to individual KPIs across departments
  3. Executive Mayor can view the organizational scorecard and approve the SDBIP via a dashboard action
  4. Audit Committee members can review all performance reports and access the full audit trail; Internal Auditors can verify portfolio of evidence for any KPI; MPAC members can view performance reports and flag investigation requests — each in a read-only role-scoped view
  5. SALGA Admin can view cross-municipality benchmarking data with de-identified aggregations, and Section 56 Directors can manage their own department's KPIs from a department-scoped view
**Plans**: 4 plans

Plans:
- [ ] 31-01-PLAN.md — Backend: RoleDashboardService (12 methods), role_dashboards.py API (13 endpoints), EvidenceDocument verification_status migration, unit tests [Wave 1] (DASH-01 through DASH-12)
- [ ] 31-02-PLAN.md — Frontend: ViewRoleContext, RoleBasedDashboard router for all 12 PMS roles, CFODashboardPage, MunicipalManagerDashboardPage, MayorDashboardPage with SDBIP approval [Wave 2] (DASH-01 through DASH-06)
- [ ] 31-03-PLAN.md — Frontend: OversightDashboardPage for Councillor (read-only), Audit Committee (reports + audit trail), Internal Auditor (POE verification workqueue), MPAC (investigation flags) [Wave 3] (DASH-07 through DASH-10)
- [ ] 31-04-PLAN.md — Frontend: SALGAAdminDashboardPage (cross-municipality benchmarking + CSV export), Section56DirectorDashboardPage (department-scoped KPIs) [Wave 3] (DASH-11, DASH-12)

### Phase 32: Risk Register & Public Transparency
**Goal**: Authorized staff can maintain a risk register linked to SDBIP KPIs (with auto-flagging when KPIs turn red), and the public dashboard shows plain-language SDBIP achievement data
**Depends on**: Phase 28 (SDBIP KPIs and traffic-light statuses needed for auto-flagging), Phase 31 (dashboards provide the risk register widget surface)
**Requirements**: RISK-01, RISK-02, RISK-03, RISK-04
**Success Criteria** (what must be TRUE):
  1. Authorized user can create a risk item linked to a specific SDBIP KPI, assign likelihood and impact ratings, record a mitigation strategy, and assign a responsible person
  2. When a linked KPI's achievement status turns red (<50%), the system automatically flags the associated risk item as high-risk without manual intervention
  3. CFO and Municipal Manager can view the risk register filtered by department and see which KPIs are driving risk elevations
**Plans**: TBD

Plans:
- [ ] 32-01: Risk register data models (`RiskItem`, `RiskMitigation`), CRUD API, auto-flagging Celery task triggered by KPI status changes, risk register dashboard widget and frontend page

### Phase 33: Comprehensive v2.0 Gap Closure
**Goal:** Close all gaps identified by v2.0 milestone audit — fix integration bugs, create missing pages/routes, complete PA-01 form, verify unverified phases, and clean up stale tracking
**Depends on**: Phase 31 (all existing phases must be complete before gap closure)
**Requirements**: IDP-04, PA-01, REPORT-05, RBAC-01, RBAC-02, RBAC-04 (code fixes); RBAC-03, RBAC-05, RBAC-06 (verification); REPORT-03, REPORT-04, REPORT-09 (tracking fixes)
**Gap Closure:** Closes all gaps from v2.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Municipal Manager can submit statutory report for review without 403 (BUG-1 fixed)
  2. All 5 sidebar nav links (/departments, /role-approvals, /pms-setup) route to real pages (BUG-2, BUG-3, BUG-4 fixed)
  3. PMS officer can create performance agreement with section57_manager_id (PA-01 complete)
  4. IDP-04 golden thread view discoverable via standalone route
  5. Phase 27 and Phase 28 have VERIFICATION.md with independent verification results
  6. REQUIREMENTS.md checkboxes match actual verification status (no stale [ ] or [x])
  7. Role-dashboard endpoints enforce require_pms_ready() gate
  8. All 10 E2E flows pass (0 broken)
**Plans**: TBD

Plans:
- [ ] 33-01: Comprehensive gap closure — all bug fixes, missing pages, verification, tracking cleanup

## Progress

**Execution Order:** 27 → 28 → 29 → 30 → 31 → 32

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10.4 (26 phases) | v1.0 | ~127/~127 | Complete | 2026-02-28 |
| 27. RBAC Foundation & Tenant Configuration | 3/3 | Complete   | 2026-02-28 | - |
| 28. IDP, SDBIP Core & Performance Monitoring | 7/7 | Complete   | 2026-03-01 | - |
| 29. Individual Performance Agreements | 2/2 | Complete   | 2026-03-01 | - |
| 30. Statutory Reporting & Approval Workflows | 4/4 | Complete    | 2026-03-01 | - |
| 31. Role-Specific Dashboards | 6/6 | Complete    | 2026-03-02 | - |
| 32. Risk Register & Public Transparency | 1/2 | In Progress|  | - |
| 33. Comprehensive v2.0 Gap Closure | v2.0 | 0/1 | Not started | - |

---
*Roadmap created: 2026-02-09*
*Last updated: 2026-02-28 (v2.0 milestone roadmap created)*
