# Requirements: SALGA Trust Engine v2.0

**Defined:** 2026-02-28
**Core Value:** Citizens report a problem and the municipality visibly responds — now connected end-to-end from citizen complaint to Council statutory report.

## v2.0 Requirements

Requirements for PMS integration milestone. Each maps to roadmap phases.

### RBAC & Tenant Configuration

- [x] **RBAC-01**: Platform supports 4-tier role hierarchy with 14 roles (executive_mayor, municipal_manager, cfo, speaker, councillor, section56_director, department_manager, pms_officer, audit_committee_member, internal_auditor, mpac_member, salga_admin + existing citizen, field_worker, saps_liaison, manager, admin)
- [x] **RBAC-02**: Admin can configure municipal department structure (name, code, hierarchy, assigned director) per tenant
- [x] **RBAC-03**: Admin can configure municipality settings (category, province, demarcation code, SDBIP layers, scoring method)
- [x] **RBAC-04**: Platform enforces role hierarchy inheritance so senior roles inherit access of subordinate roles
- [x] **RBAC-05**: Admin can view municipal organogram showing reporting structure
- [x] **RBAC-06**: Role changes and permission checks are fully audit-logged

### IDP Management

- [ ] **IDP-01**: Authorized user can create a 5-year IDP cycle with title, vision, mission, and status
- [ ] **IDP-02**: Authorized user can add strategic goals and objectives under an IDP cycle with National KPA alignment
- [ ] **IDP-03**: Authorized user can create annual IDP review versions within a cycle with version control
- [ ] **IDP-04**: User can view alignment mapping from IDP objectives down to linked SDBIP KPIs (golden thread)
- [ ] **IDP-05**: IDP cycle supports approval workflow (draft → approved → under_review)

### SDBIP Management

- [ ] **SDBIP-01**: PMS officer can create Top Layer SDBIP for a financial year with organizational KPIs
- [ ] **SDBIP-02**: Director can create Departmental SDBIP KPIs for their department linked to IDP objectives
- [ ] **SDBIP-03**: Each KPI includes description, unit of measurement, baseline, annual target, weight, and responsible director
- [ ] **SDBIP-04**: Each KPI has quarterly targets (Q1–Q4) that align to the annual target
- [ ] **SDBIP-05**: Each KPI links to a validated mSCOA budget code from seeded reference table (not free-text)
- [ ] **SDBIP-06**: SDBIP supports approval workflow (draft → approved → revised) with Mayor sign-off
- [ ] **SDBIP-07**: System auto-populates SDBIP actuals from ticket resolution data for service-delivery KPIs
- [ ] **SDBIP-08**: Auto-population rules are configurable per KPI (ticket category, aggregation type, formula description)
- [ ] **SDBIP-09**: Authorized user can adjust SDBIP targets at mid-year when adjustments budget is approved
- [ ] **SDBIP-10**: mSCOA reference table is seeded from National Treasury classification and queryable by segment

### Performance Monitoring & Evidence

- [ ] **EVID-01**: Director or department manager can submit quarterly actual values against SDBIP KPI targets
- [ ] **EVID-02**: System calculates achievement percentage for each KPI per quarter automatically
- [ ] **EVID-03**: User can upload portfolio of evidence (documents, photos, spreadsheets) per quarterly actual
- [ ] **EVID-04**: PMS officer can validate submitted quarterly actuals via validation workflow
- [ ] **EVID-05**: Validated actuals are immutable — corrections require new submission with full audit trail
- [ ] **EVID-06**: System flags KPIs with traffic-light status (green ≥80%, amber 50-79%, red <50% achievement)
- [ ] **EVID-07**: Evidence documents are virus-scanned on upload before storage
- [ ] **EVID-08**: Auto-populated actuals are clearly marked with source query reference and distinguishable from manual entries

### Individual Performance Agreements

- [ ] **PA-01**: PMS officer can create performance agreement for Section 57 manager linked to financial year
- [ ] **PA-02**: Performance agreement KPIs link to organizational SDBIP KPIs with individual targets and weights
- [ ] **PA-03**: Evaluator can score individual KPIs per quarter in quarterly review workflow
- [ ] **PA-04**: System compiles annual assessment score from quarterly scores and KPI weights
- [ ] **PA-05**: Performance agreement supports status workflow (draft → signed → under_review → assessed)
- [ ] **PA-06**: Municipal Manager signs performance agreements for directors; Executive Mayor signs for Municipal Manager

### Statutory Reporting

- [ ] **REPORT-01**: System auto-generates Section 52 quarterly performance report from SDBIP actuals
- [ ] **REPORT-02**: System auto-generates Section 72 mid-year budget and performance assessment
- [ ] **REPORT-03**: System auto-generates Section 46 annual performance report
- [ ] **REPORT-04**: System auto-generates Section 121 annual report performance chapter
- [ ] **REPORT-05**: Reports follow approval workflow (drafting → internal_review → mm_approved → submitted → tabled)
- [ ] **REPORT-06**: Report generation snapshots source data at mm_approved status for point-in-time consistency
- [ ] **REPORT-07**: System tracks statutory deadlines per financial year with escalating notifications (30d → 14d → 7d → 3d → overdue)
- [ ] **REPORT-08**: Reports export as PDF and DOCX with municipality-branded templates (logo, headers, formatting)
- [ ] **REPORT-09**: System auto-creates report tasks 30 days before each statutory deadline

### Dashboards & Oversight

- [ ] **DASH-01**: CFO can view budget execution dashboard (expenditure vs budget per vote, revenue collection rate, variance alerts)
- [ ] **DASH-02**: CFO can view SDBIP achievement summary with traffic-light status across all KPIs
- [ ] **DASH-03**: CFO can view service delivery correlation linking ticket resolution rates to SDBIP KPIs
- [ ] **DASH-04**: CFO can view statutory reporting calendar with upcoming deadlines and current status
- [ ] **DASH-05**: Municipal Manager can view all-department performance overview with drill-down to individual KPIs
- [ ] **DASH-06**: Executive Mayor can view organizational scorecard and approve SDBIP via dashboard
- [ ] **DASH-07**: Councillor can view quarterly reports and SDBIP dashboard (read-only)
- [ ] **DASH-08**: Audit Committee member can review all performance reports and access audit trail
- [ ] **DASH-09**: Internal Auditor can verify evidence/POE for any KPI across departments
- [ ] **DASH-10**: MPAC member can view performance reports and request performance investigations
- [ ] **DASH-11**: SALGA Admin can view cross-municipality benchmarking and manage system configuration
- [ ] **DASH-12**: Section 56 Director can view own department's SDBIP performance and manage departmental KPIs

### Risk Register

- [ ] **RISK-01**: Authorized user can create risk items linked to SDBIP KPIs with likelihood, impact, and rating
- [ ] **RISK-02**: Each risk item includes mitigation strategy and responsible person
- [ ] **RISK-03**: System auto-flags high-risk items when linked KPI status turns red
- [ ] **RISK-04**: CFO and Municipal Manager can view risk register filtered by department

## v2.1+ Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Financial Integration

- **FIN-01**: Integration with municipal financial systems (Munsoft, Sebata, SAGE) for budget actuals
- **FIN-02**: Section 71 monthly financial report auto-generation
- **FIN-03**: Real-time National Treasury data feeds for budget monitoring
- **FIN-04**: Supply chain management tracking linked to service delivery tickets

### Extended Performance Management

- **EPERF-01**: Full PMDS for all municipal employees (not just Section 57)
- **EPERF-02**: AG audit finding tracker with remediation workflow
- **EPERF-03**: AI-assisted performance trend analysis and early warning

### Offline & Mobile

- **OFFLN-01**: Progressive web app for PMS data entry in low-connectivity areas
- **OFFLN-02**: Offline-first evidence upload with background sync

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full ERP/financial system integration | Standalone PMS first; ERP integration requires per-vendor API work (Munsoft, Sebata, SAGE) — defer to v2.1 |
| PMDS for all 500+ municipal staff | Section 57 managers only (5-8 per municipality); full PMDS is a separate product category |
| Real-time National Treasury data feeds | Manual/import approach sufficient for v2.0; real-time requires NT API partnership |
| AI-generated performance assessments | Human judgment legally required for Section 57 evaluations; AI for routing only |
| Mobile native app for PMS | Senior municipal staff use desktops; web-only sufficient for PMS workflows |
| Citizen-facing PMS data | Public dashboard shows aggregate SDBIP achievement in v2.0; detailed IDP/KPI data deferred |
| SMS/USSD notifications for statutory deadlines | Email + in-app notifications sufficient for senior staff with email access |
| Custom scoring rubrics per municipality | Standardized scoring (percentage-based) for v2.0; custom rubrics add complexity without clear value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RBAC-01 | Phase 27 | Complete |
| RBAC-02 | Phase 27 | Complete |
| RBAC-03 | Phase 27 | Complete |
| RBAC-04 | Phase 27 | Complete |
| RBAC-05 | Phase 27 | Complete |
| RBAC-06 | Phase 27 | Complete |
| IDP-01 | Phase 28 | Pending |
| IDP-02 | Phase 28 | Pending |
| IDP-03 | Phase 28 | Pending |
| IDP-04 | Phase 28 | Pending |
| IDP-05 | Phase 28 | Pending |
| SDBIP-01 | Phase 28 | Pending |
| SDBIP-02 | Phase 28 | Pending |
| SDBIP-03 | Phase 28 | Pending |
| SDBIP-04 | Phase 28 | Pending |
| SDBIP-05 | Phase 28 | Pending |
| SDBIP-06 | Phase 28 | Pending |
| SDBIP-07 | Phase 28 | Pending |
| SDBIP-08 | Phase 28 | Pending |
| SDBIP-09 | Phase 28 | Pending |
| SDBIP-10 | Phase 28 | Pending |
| EVID-01 | Phase 28 | Pending |
| EVID-02 | Phase 28 | Pending |
| EVID-03 | Phase 28 | Pending |
| EVID-04 | Phase 28 | Pending |
| EVID-05 | Phase 28 | Pending |
| EVID-06 | Phase 28 | Pending |
| EVID-07 | Phase 28 | Pending |
| EVID-08 | Phase 28 | Pending |
| PA-01 | Phase 29 | Pending |
| PA-02 | Phase 29 | Pending |
| PA-03 | Phase 29 | Pending |
| PA-04 | Phase 29 | Pending |
| PA-05 | Phase 29 | Pending |
| PA-06 | Phase 29 | Pending |
| REPORT-01 | Phase 30 | Pending |
| REPORT-02 | Phase 30 | Pending |
| REPORT-03 | Phase 30 | Pending |
| REPORT-04 | Phase 30 | Pending |
| REPORT-05 | Phase 30 | Pending |
| REPORT-06 | Phase 30 | Pending |
| REPORT-07 | Phase 30 | Pending |
| REPORT-08 | Phase 30 | Pending |
| REPORT-09 | Phase 30 | Pending |
| DASH-01 | Phase 31 | Pending |
| DASH-02 | Phase 31 | Pending |
| DASH-03 | Phase 31 | Pending |
| DASH-04 | Phase 31 | Pending |
| DASH-05 | Phase 31 | Pending |
| DASH-06 | Phase 31 | Pending |
| DASH-07 | Phase 31 | Pending |
| DASH-08 | Phase 31 | Pending |
| DASH-09 | Phase 31 | Pending |
| DASH-10 | Phase 31 | Pending |
| DASH-11 | Phase 31 | Pending |
| DASH-12 | Phase 31 | Pending |
| RISK-01 | Phase 32 | Pending |
| RISK-02 | Phase 32 | Pending |
| RISK-03 | Phase 32 | Pending |
| RISK-04 | Phase 32 | Pending |

**Coverage:**
- v2.0 requirements: 60 total
- Mapped to phases: 60
- Unmapped: 0 ✓

**Note:** REQUIREMENTS.md header originally stated 61 requirements. Actual count from listed items is 60 (RBAC:6, IDP:5, SDBIP:10, EVID:8, PA:6, REPORT:9, DASH:12, RISK:4). All 60 are mapped.

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 — traceability populated by roadmapper (60/60 requirements mapped)*
