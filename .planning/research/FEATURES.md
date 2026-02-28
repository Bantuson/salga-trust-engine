# Feature Landscape: Municipal PMS Integration (v2.0)

**Domain:** South African Municipal Performance Management System (PMS) — IDP/SDBIP Management, Statutory Reporting, Senior Role Dashboards
**Researched:** 2026-02-28
**Confidence:** HIGH (legislative requirements), MEDIUM (competitor feature gaps), HIGH (SA municipal practice)
**Milestone:** v2.0 Senior Municipal Roles & PMS Integration — extending the Trust Engine beyond service delivery into strategic planning and statutory compliance

---

## Context: What Already Exists (Do Not Re-Build)

The following features are fully operational in v1.0 and serve as the foundation for v2.0:

- Ticket lifecycle management (create, assign, resolve, escalate)
- SLA tracking with automated escalation and Celery beat schedules
- Multi-tenant data isolation (PostgreSQL RLS + application-level tenant_id filtering)
- RBAC with 6 roles: citizen, manager, admin, field_worker, saps_liaison, ward_councillor
- Municipal operations dashboard (ticket management, team management, analytics)
- Public transparency dashboard (resolution rates, geographic heatmaps)
- GBV/abuse reporting with 5-layer security firewall
- Audit logging on all model changes

**The PMS integration adds a strategic layer on top of this operational foundation.** The killer differentiator is the auto-population engine: ticket resolution data from v1.0 feeds SDBIP actuals in v2.0 — a connection no SA PMS vendor currently provides.

---

## Legislative Mandate (Why These Features Are Non-Negotiable)

Every South African municipality must comply with the Municipal Systems Act (MSA, Act 32 of 2000) and Municipal Finance Management Act (MFMA, Act 56 of 2003). These mandate identical workflows, deadlines, and documents across all 257 municipalities — only the org charts differ. This standardization means the platform's PMS feature set is legislatively defined, not market-researched.

| Statutory Requirement | Legislation | What the Platform Must Support |
|-----------------------|-------------|-------------------------------|
| IDP: 5-year strategic plan | MSA s25-36 | IDP module with 5-year cycles, objectives, annual reviews |
| SDBIP: Annual operational plan | MFMA s53 | SDBIP creation, quarterly targets, actuals, mSCOA linkage |
| Section 56 performance agreements | MSA s56-57 | Individual performance agreements for directors linked to SDBIP |
| Section 52 quarterly reports | MFMA s52(d) | Quarterly performance reports tabled to Council |
| Section 72 mid-year assessment | MFMA s72 | Mid-year budget and performance review due January 25 |
| Section 71 monthly financial reports | MFMA s71 | Monthly financial statements due 10th of following month |
| Section 46 annual performance report | MSA s46 | Annual performance report as part of Annual Report |
| Section 121 annual report | MFMA s121 | Annual report tabled to Council by January 31 |
| Section 129 oversight report | MFMA s129 | Council oversight report due March 31 |
| Performance Audit Committee | MSA Performance Regulations | Independent oversight view of all performance data |

**Confidence:** HIGH — sourced from official MSA and MFMA legislation texts via AGSA and National Treasury publications.

---

## Table Stakes (Users Expect These)

Features that every municipal PMS user assumes the platform has. Missing these means the platform cannot replace existing tools like BCX SOLAR, Sebata EMS, or manual spreadsheet workflows. The primary competitor in SA municipal PMS is BCX SOLAR (used via BCX's Solar Municipal Solutions), which covers IDP-to-SDBIP alignment, portfolio of evidence management, individual KPI agreements, and organogram management.

| Feature | Why Expected | Complexity | Legislative Basis | Notes |
|---------|--------------|------------|-------------------|-------|
| **IDP module: 5-year strategic plan management** | Every municipality must maintain a current IDP under MSA. Without this, the platform cannot connect strategic goals to operational KPIs | HIGH | MSA s25-36 | Must support vision, mission, strategic goals (KPAs), objectives, annual reviews, and version control. IDP cycle is 5 years with annual reviews — the platform must track both |
| **SDBIP management: Top Layer and Departmental scorecards** | The SDBIP is the annual operational contract between the Mayor and the Municipal Manager. Every director needs to manage their departmental SDBIP contribution | HIGH | MFMA s53 | Top Layer SDBIP is Mayor-approved (consolidated view); Departmental SDBIP is per-director. Both must be supported with the same data model |
| **KPI definition with quarterly targets** | Municipalities set annual targets broken into quarterly milestones. Auditor-General scrutinizes whether targets were set correctly and achieved | MEDIUM | MSA Performance Regs | Each KPI needs: description, unit of measurement, baseline, annual target, Q1/Q2/Q3/Q4 targets, responsible director, budget linkage |
| **Quarterly actuals submission** | Directors must submit actual performance data every quarter with evidence. This is the core data entry workflow for most PMS users | MEDIUM | MFMA s52(d) | Includes actual value, achievement percentage, evidence notes, and supporting documents. Must have submission deadlines and validation workflow |
| **Portfolio of Evidence (POE) upload and management** | AGSA requires documentary evidence for every KPI claimed as achieved. Missing evidence = finding | MEDIUM | MSA Performance Regs | File upload (PDF, DOCX, XLSX, images). Per-KPI per-quarter evidence linking. Virus scanning. Storage via Supabase Storage (existing) |
| **Section 57/56 individual performance agreements** | All Section 56 managers (directors) and the Municipal Manager must have signed performance agreements before end of July each year | HIGH | MSA s56-57 | Agreements link individual KPIs to organizational SDBIP KPIs. Must support: creation, signing workflow, quarterly self-assessment, evaluator scoring, annual assessment |
| **Statutory reporting calendar with deadline tracking** | Municipalities face AG findings for late submission of statutory reports. Every municipality operates the same annual calendar | MEDIUM | MFMA s52, s71, s72, s121 | Automated deadline tracking with escalating notifications (30/14/7/3 days before due date). Flag overdue reports as non-compliance risk |
| **Statutory report generation (Section 52/72/46/121)** | These reports must be produced quarterly/annually and tabled to Council. Currently done manually with spreadsheets and Word documents | HIGH | MFMA s52, s72; MSA s46; MFMA s121 | Auto-populate report templates from SDBIP data. Municipality-branded (logo, headers). Export to PDF and DOCX. BCX SOLAR does this — the platform must too |
| **Report approval workflow** | Reports must go through: draft → internal review → Municipal Manager approval → Council tabling. AGSA checks this workflow | MEDIUM | MFMA s52(d) | Status tracking: drafting → internal_review → mm_approved → submitted → tabled. Each stage requires authorized approver. Timestamps stored for audit |
| **Configurable department structure per tenant** | Every municipality organizes departments differently (4 in a small Category B, 12+ in a metro). The platform must reflect each tenant's real org structure | MEDIUM | MSA s56 | Admin UI to create/edit departments, assign directors (Section 56 managers), set parent-child relationships. Per-tenant configuration, not hardcoded |
| **4-tier role hierarchy** | Existing 6 roles (v1.0) do not include executive_mayor, municipal_manager, cfo, speaker, councillor, pms_officer, audit_committee_member, mpac_member, internal_auditor, salga_admin | HIGH | Constitutionally mandated roles | New roles need scoped permissions. Political roles (read + approve), administrative (create + manage), oversight (read + audit). Must extend existing RBAC without breaking v1.0 |
| **Audit trail on all performance data** | AGSA asks "who changed this figure and when?" The AG actively investigates data manipulation | LOW | MFMA s165, AGSA Act | Existing audit logging (SQLAlchemy event listeners) must be extended to cover all new PMS models. Already built in v1.0 — extend, do not rebuild |
| **mSCOA budget linkage on KPIs** | MFMA requires every SDBIP KPI to link to a budget vote via mSCOA codes. The CFO validates this alignment | MEDIUM | MFMA + mSCOA Regulations | Each KPI stores an mSCOA code. CFO dashboard shows budget vote → KPI alignment. Not full financial management — reference codes only, not live financial integration |

---

## Differentiators (Competitive Advantage)

Features that no existing SA municipal PMS vendor offers, or where the Trust Engine's unique data position creates advantages competitors cannot replicate.

| Feature | Value Proposition | Complexity | Competitor Gap | Notes |
|---------|-------------------|------------|---------------|-------|
| **Auto-population engine: ticket data → SDBIP actuals** | Eliminates the most painful part of PMS — quarterly manual data capture. Directors spend days collecting data that the Trust Engine already has. This is the killer differentiator that no competitor (BCX SOLAR, Sebata, manual spreadsheets) can match | HIGH | No SA competitor connects citizen complaints to SDBIP reporting | Maps ticket categories (water, roads, electricity) to SDBIP KPIs via configurable aggregation rules. Auto-populates: count of tickets resolved, average resolution time, resolution rate, satisfaction scores. Auto-populated actuals are flagged so auditors can trace the source logic |
| **Statutory reporting deadline calendar as a compliance dashboard** | Most municipalities miss statutory deadlines because they track them in spreadsheets or email. The platform treats deadlines as a risk management instrument — not just a calendar | MEDIUM | Competitors have basic deadline tracking; none treat it as a compliance risk dashboard | Traffic-light status across all statutory obligations. CFO sees all deadlines in one view. Escalating notifications go to the responsible person, then their supervisor, then the Municipal Manager. Overdue = potential AG finding flag |
| **Service delivery ↔ performance correlation view** | Shows the CFO and Municipal Manager: "Our Technical Services department is resolving 94% of water tickets within SLA — and their SDBIP KPI for water response time is currently 2.3 days against a 5-day target." No other system connects these two layers | HIGH | Unique to Trust Engine — competitors have no service delivery data | Requires ticket data from v1.0 to be linked to SDBIP KPIs. The correlation view is a CFO dashboard widget showing the strength of the relationship between service delivery performance and SDBIP achievement |
| **IDP-to-SDBIP traceability** | Every SDBIP KPI must derive from an IDP objective. Currently maintained in disconnected spreadsheets. The platform enforces this linkage in the data model, making it auditable | MEDIUM | BCX SOLAR has this but it is not well-implemented in practice; most municipalities use disconnected files | SDBIP KPI must be linked to an IDP objective at creation time. Reports show IDP objective → SDBIP KPI → quarterly actual → evidence. AGSA can trace the chain |
| **Risk register linked to SDBIP KPIs** | When a KPI is trending red (behind target), it should automatically surface as a risk. Current municipal practice: maintain a separate risk register in a spreadsheet, manually updated | MEDIUM | Competitors have standalone risk registers with no KPI integration | Risk items can be manually created or auto-suggested when a KPI falls below threshold. Risk rating (likelihood × impact matrix). Mitigation strategy and responsible person. MPAC and Audit Committee can view risk register |
| **Cross-municipality benchmarking (SALGA admin view)** | SALGA national/provincial oversight can compare KPI achievement rates across municipalities — identifying which municipalities are struggling with which service areas | HIGH | No SA competitor has a multi-tenant comparison view | SALGA admin role gets a de-identified cross-municipality view. Shows: average SDBIP achievement by KPA category, municipality size, province. Benchmarking encourages competition and surfaces systemic issues |
| **AG audit finding tracker** | Open findings from the Auditor-General mapped to responsible departments. Currently tracked in spreadsheets with no system of record. Shows progress on remediation | MEDIUM | Not a PMS feature anywhere in SA municipal tech market | Audit findings entered after AG report received. Each finding assigned to responsible department and official. Status tracking: open → in progress → remediated → verified. Links findings to relevant SDBIP KPIs where applicable |
| **Performance agreement digital signing workflow** | Section 56 agreements are currently signed on paper, scanned, and filed. Digital signature workflow with audit trail | MEDIUM | Not standard in SA municipal PMS tools | Integration with PDF signing (DocuSign or similar). Signed agreements stored in Supabase Storage. AGSA can verify signing dates against July 31 deadline |
| **Municipal organogram with role mapping** | Visual representation of municipality structure with performance accountability at each node. Currently maintained in PowerPoint | LOW | Basic in BCX SOLAR (organogram view exists) | Show who reports to whom, with their performance agreement status and current SDBIP achievement rate visible to authorized roles |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full financial management / ERP integration** | "The CFO wants live budget-vs-actual data" | Building a general ledger or integrating Sebata/Munsoft is a multi-year project. mSCOA data is highly structured and requires financial accounting expertise. Scope creep risk is severe | Reference mSCOA codes on KPIs. Allow manual budget variance input by CFO for dashboard display. Document ERP integration as a v3.0 milestone when the platform has proven adoption |
| **Real-time financial data feeds from National Treasury** | "Section 71 data should update automatically from National Treasury's IYM system" | National Treasury's IYM (In-Year Monitoring) system does not have a public API for municipalities. Data is submitted by municipalities, not pulled. The assumption is technically wrong | Allow CFO to upload monthly financial data snapshots. Pre-populate Section 71 report templates from uploaded data. This is how BCX SOLAR and Sebata work too |
| **Citizen-visible SDBIP performance data on public dashboard** | "Show citizens exactly which KPIs are on track" | Raw SDBIP data is technical and uninterpretable by most citizens (e.g., "KPI 3.2.1: 87% achievement against baseline of 72%"). Creating misleading context is worse than no data | Translate SDBIP achievement into plain-language service delivery statements on the public dashboard: "83% of reported water issues resolved within 48 hours this quarter." This is what citizens care about |
| **Automated KPI target setting based on AI** | "AI should suggest what targets municipalities should set for their KPIs" | KPI targets are politically sensitive — set by Council, not an algorithm. COGTA has guidelines, but targets reflect local context, budgets, and political priorities. AI suggestions would be ignored or create liability | Use historical actuals from prior financial years to show "last year you achieved X — consider setting target above X." Present as context, not recommendation. Decision stays with humans |
| **Full Section 71 financial report auto-generation** | "The platform should generate the complete monthly financial statements" | Section 71 financial statements require actual trial balance data from the municipal financial management system (Sebata, Munsoft, etc.). Without that data, the platform cannot generate a compliant Section 71 report | Generate the Section 71 report template structure with performance (non-financial) sections pre-populated. Mark financial sections as requiring CFO data entry. This is honest about what the platform does |
| **Individual employee performance for all staff (PMDS for everyone)** | "Can we do performance management for all 500 staff?" | Full HR Performance Management and Development System (PMDS) for all employees is a separate product (HR module). It requires job descriptions, competency frameworks, learning plans, and pay progression linkage. Out of scope for PMS integration | Section 56 and 57 managers only (typically 5-8 people per municipality). This is the statutory obligation. Explicitly exclude lower-tier staff PMDS from v2.0 scope |
| **Custom KPI templates per department** | "Each department wants to define their own KPI structure and scoring methodology" | COGTA and National Treasury prescribe the structure of SDBIP KPIs (description, unit, baseline, target, quarterly milestone, mSCOA linkage). Custom structures break statutory compliance and make reporting inconsistent | One KPI template per the MFMA/MSA prescription. Per-municipality configuration allows custom department names and KPA categories — but not custom KPI structure |
| **Blockchain for evidence integrity** | "Evidence documents should be blockchain-verified so AGSA cannot dispute them" | AGSA does not accept blockchain-based evidence chains and has no integration pathway for this. Adds engineering complexity for zero audit benefit | Standard file hashing (SHA-256) on upload stored alongside each evidence document. Immutable audit log shows upload timestamp and uploader. This satisfies AGSA's "who uploaded what and when" question |

---

## Feature Dependencies

```
IDP Module (5-year cycles, objectives)
    └──required-by──> SDBIP KPI Module
                         └──required-by──> Quarterly Targets
                                              └──required-by──> Quarterly Actuals Submission
                                                                   └──required-by──> Section 52 Report Generation
                                                                   └──required-by──> Section 72 Mid-Year Report
                                              └──required-by──> Section 46 Annual Performance Report
                                              └──required-by──> Section 121 Annual Report

SDBIP KPI Module
    └──required-by──> Performance Agreement (Section 57)
                         └──required-by──> Quarterly Review Workflow
                                              └──required-by──> Annual Assessment

Department Structure (per tenant config)
    └──required-by──> SDBIP KPI Module (each KPI needs a responsible department)
    └──required-by──> Performance Agreement (each agreement belongs to a director in a department)

4-Tier Role Hierarchy Extension
    └──required-by──> All PMS modules (role-scoped permissions gate all PMS features)
    └──required-by──> CFO Dashboard (cfo role)
    └──required-by──> Mayor Dashboard (executive_mayor role)
    └──required-by──> Municipal Manager Dashboard (municipal_manager role)
    └──required-by──> Oversight Views (audit_committee_member, mpac_member, internal_auditor)

Ticket Data (v1.0 — already exists)
    └──feeds──> Auto-Population Engine
                    └──feeds──> SDBIP Quarterly Actuals (auto_populated = true)
                                    └──feeds──> Section 52 Reports (auto-populated sections)

Portfolio of Evidence (POE) Upload
    └──required-by──> Quarterly Actuals Submission (evidence must accompany actuals)
    └──required-by──> Audit trail integrity

Statutory Reporting Calendar
    └──enhanced-by──> Report Approval Workflow
    └──enhanced-by──> Deadline Notification System (Celery beat — already exists)

Risk Register
    └──enhanced-by──> SDBIP KPI Module (KPIs in red status can auto-surface risks)
    └──requires──> Department Structure (each risk has a responsible department)

Section 52/72/46/121 Report Generation
    └──requires──> SDBIP Quarterly Actuals (data source for report auto-population)
    └──requires──> Report Approval Workflow
    └──enhanced-by──> IDP Module (IDP progress section of Annual Report)

Cross-Municipality Benchmarking
    └──requires──> SDBIP Actuals across multiple tenants
    └──requires──> salga_admin role (4-tier hierarchy extension)
    └──conflicts──> Tenant data isolation (needs careful de-identification logic)
```

### Dependency Notes

- **Role hierarchy is the prerequisite gate**: No PMS feature can be built until the 4-tier role extension is complete. Every feature uses scoped permissions. Build this first.
- **Department structure unlocks SDBIP**: SDBIP KPIs must be assigned to a department. Without configurable department structure, KPI management cannot be tenant-specific.
- **IDP before SDBIP**: Legislatively and architecturally, SDBIP KPIs derive from IDP objectives. The IDP module must be buildable (even if initially empty) before the SDBIP module creates KPIs.
- **Actuals before reports**: Section 52 report generation requires at least one quarter of actuals data. The reporting engine is built in the same phase as actuals submission, but reports can only be generated once data exists.
- **Ticket auto-population enhances, not gates**: The auto-population engine is a differentiator that enhances actuals submission. The quarterly actuals workflow must work manually first; auto-population is added as an enhancement layer.
- **Cross-municipality benchmarking conflicts with tenant isolation**: Must de-identify or aggregate before exposing cross-tenant data. Design the aggregation layer carefully to never expose raw tenant KPIs to another tenant.

---

## MVP Definition for v2.0

### Launch With (v2.0 — 24 weeks)

Minimum feature set to fulfill the Umsobomvu tender (UMS/CS/PMS/02/2026) scope and demonstrate the platform to CFO and Municipal Manager personas.

- [ ] **4-tier role hierarchy** — Gate for everything else; extend RBAC without breaking v1.0
- [ ] **Configurable department structure per tenant** — Foundation for KPI ownership
- [ ] **IDP module: 5-year cycle management** — Strategic layer that SDBIP hangs from
- [ ] **SDBIP management: Top Layer and Departmental** — Core product; the daily workflow for directors and PMS officers
- [ ] **Quarterly actuals submission with POE upload** — The recurring data entry that replaces spreadsheets
- [ ] **Auto-population engine: tickets → SDBIP actuals** — The killer differentiator; demo this to every prospect
- [ ] **Section 57 performance agreements (create, sign, review)** — Legislatively mandatory; AG checks this every audit
- [ ] **Section 52 quarterly report generation** — Immediate time savings for PMS officers
- [ ] **Section 72 mid-year assessment report generation** — CFO's most important statutory report
- [ ] **Statutory reporting calendar with deadline tracking** — The CFO checks this daily
- [ ] **CFO dashboard** — The sales tool; the person who controls the budget needs to be impressed
- [ ] **Municipal Manager dashboard** — Accounting officer accountability view
- [ ] **Report approval workflow** — Required for audit trail; draft → review → approve → submit
- [ ] **Audit trail on all PMS data** — Extend existing v1.0 audit logging

### Add After Validation (v2.1 — 3-6 months post-launch)

Features to add once core PMS workflow is proven with Umsobomvu and pilot municipalities.

- [ ] **Section 46 annual performance report** — Trigger: first financial year completed on platform
- [ ] **Section 121 annual report (performance chapter)** — Trigger: first annual report cycle
- [ ] **Mayor and Council dashboard** — Trigger: political buy-in secured; Mayor adopting the platform
- [ ] **Risk register linked to KPIs** — Trigger: municipalities explicitly request risk management view
- [ ] **AG audit finding tracker** — Trigger: municipalities want to track remediation of AG findings
- [ ] **Organogram view with performance status** — Trigger: Municipal Manager wants visual accountability map
- [ ] **Digital signature workflow for performance agreements** — Trigger: paper-based signing becomes a friction point

### Future Consideration (v2.2 — 12+ months)

Features to defer until product-market fit is established with multiple municipalities.

- [ ] **Cross-municipality benchmarking (SALGA admin view)** — Requires 5+ municipalities on platform; statistical significance
- [ ] **Oversight roles (Audit Committee, MPAC, Internal Audit)** — Defer until political bodies are ready to adopt the tool
- [ ] **Enhanced public dashboard (IDP progress, budget execution)** — Defer until raw SDBIP data is proven accurate over 2+ quarters
- [ ] **ERP/financial system integration (Sebata, Munsoft)** — Defer until platform has proven adoption; multi-year integration effort
- [ ] **AI-assisted KPI performance prediction** — Defer until 3+ years of actuals data exists for training
- [ ] **Mobile app for PMS (field-level evidence capture)** — Defer; office-based workers use web app; field workers use v1.0 mobile app

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Phase | Priority |
|---------|------------|---------------------|-------|----------|
| 4-tier role hierarchy extension | HIGH | MEDIUM | Phase 1 | P1 |
| Configurable department structure | HIGH | MEDIUM | Phase 1 | P1 |
| IDP module (5-year cycle, objectives) | HIGH | HIGH | Phase 2 | P1 |
| SDBIP management (Top Layer + Departmental) | HIGH | HIGH | Phase 2 | P1 |
| Quarterly targets and actuals submission | HIGH | MEDIUM | Phase 2 | P1 |
| Portfolio of Evidence (POE) upload | HIGH | LOW | Phase 2 | P1 |
| Auto-population engine (tickets → actuals) | HIGH | HIGH | Phase 2 | P1 |
| Section 57 performance agreements | HIGH | HIGH | Phase 3 | P1 |
| Section 52/72 report generation | HIGH | HIGH | Phase 4 | P1 |
| Report approval workflow | HIGH | MEDIUM | Phase 4 | P1 |
| Statutory reporting calendar | HIGH | MEDIUM | Phase 4 | P1 |
| CFO dashboard | HIGH | HIGH | Phase 4 | P1 |
| Municipal Manager dashboard | HIGH | MEDIUM | Phase 4 | P1 |
| Section 46/121 annual reports | HIGH | MEDIUM | Phase 4-5 | P2 |
| Mayor and Council dashboard | MEDIUM | MEDIUM | Phase 5 | P2 |
| Risk register linked to KPIs | MEDIUM | MEDIUM | Phase 5 | P2 |
| AG audit finding tracker | MEDIUM | LOW | Phase 5 | P2 |
| Audit Committee / MPAC / Internal Audit views | MEDIUM | LOW | Phase 5 | P2 |
| Organogram view | LOW | LOW | Phase 5 | P2 |
| Digital signing for performance agreements | MEDIUM | HIGH | v2.1 | P2 |
| Cross-municipality benchmarking | HIGH | HIGH | v2.2 | P3 |
| Enhanced public dashboard (IDP/budget) | MEDIUM | MEDIUM | v2.2 | P3 |
| ERP/financial system integration | HIGH | HIGH | v3.0 | P3 |
| AI-assisted KPI prediction | MEDIUM | HIGH | v3.0 | P3 |

**Priority key:**
- P1: Must have for v2.0 launch (Umsobomvu tender compliance + CFO/MM demo-readiness)
- P2: Should have; add in v2.1 or as Phase 5 stretch goals
- P3: Future consideration; defer until multiple municipalities on platform

---

## Competitor Feature Analysis

The primary competitor in SA municipal PMS is **BCX SOLAR** (Solar Municipal Solutions), used across approximately 60+ municipalities and actively marketed to Category B and C municipalities. **Sebata EMS** and **Munsoft** cover financial management (ERP) but have limited PMS functionality. Manual spreadsheet workflows remain the de facto standard in most smaller municipalities.

| Feature | BCX SOLAR | Sebata EMS | Manual Spreadsheets | Trust Engine v2.0 |
|---------|-----------|------------|---------------------|-------------------|
| IDP management | Yes (IDP-to-SDBIP alignment) | No | Incumbent (Word/Excel) | Yes — with version control and traceability |
| SDBIP management | Yes (Top Layer + Departmental) | No | Incumbent (Excel) | Yes — with data model extending existing ticket schema |
| Quarterly actuals submission | Yes (electronic upload) | No | Incumbent (email/spreadsheet) | Yes — with workflow and POE linkage |
| Portfolio of Evidence management | Yes (electronic upload + auditing) | No | Paper folders | Yes — via Supabase Storage (already integrated) |
| Individual performance agreements | Yes (KPA/KPI management) | No | Paper/PDF | Yes — with quarterly review workflow |
| Statutory report generation | Yes (templates) | No | Manual (Word) | Yes — auto-populated from live SDBIP data |
| CFO budget monitoring dashboard | Limited | Yes (full GL + mSCOA) | Spreadsheets | Yes — SDBIP achievement view + mSCOA code tagging |
| Service delivery ↔ SDBIP linkage | **No** | **No** | **No** | **Yes — the killer differentiator** |
| Auto-population from operational data | **No** | **No** | **No** | **Yes — tickets auto-populate SDBIP actuals** |
| Citizen service delivery data | **No** | **No** | **No** | **Yes — v1.0 ticket platform already operational** |
| Risk register linked to KPIs | Basic | No | Manual | Yes — KPI-triggered risk surfacing |
| Cross-municipality benchmarking | No | No | No | Yes (SALGA admin view — v2.2) |
| Multi-tenant isolation | Single-municipality installs | Single-municipality installs | N/A | Yes — proven RLS architecture from v1.0 |
| Audit trail on data changes | Basic | Yes (financial audit) | None | Yes — extending v1.0 comprehensive audit logging |
| WhatsApp/citizen engagement integration | **No** | **No** | **No** | **Yes — native integration with v1.0 citizen reporting** |

### Key Competitive Insights

1. **BCX SOLAR is the benchmark**: The platform must match BCX SOLAR's IDP/SDBIP/POE feature set or municipalities will not switch. BCX SOLAR is deeply entrenched in the Category B market. The Trust Engine must be a superset, not an equal.

2. **The moat is integration**: BCX SOLAR and Sebata are standalone PMS tools. They have no connection to service delivery data. The Trust Engine's v1.0 ticket data is a unique asset that creates a competitive moat competitors cannot replicate without building a citizen reporting platform from scratch.

3. **Spreadsheets are the real competitor**: Many Category B municipalities (especially under-resourced ones like Umsobomvu) do not use any dedicated PMS software. They submit SDBIP Excel files to COGTA and maintain Word document performance agreements. The platform must be simpler to use than a spreadsheet for basic data capture, while being far more capable for compliance.

4. **Sebata/Munsoft are financial system partners, not PMS competitors**: These systems are the financial backbone. Integration with them (v3.0) will strengthen the platform, not compete with it. The CFO already uses Sebata for payroll and GL. The platform provides the performance management layer that Sebata lacks.

5. **No competitor has a CFO dashboard that crosses the operational-strategic divide**: CFO dashboards in existing tools (BCX SOLAR's limited budget view) show financial data in isolation. The Trust Engine CFO dashboard uniquely shows: "Budget execution rate AND service delivery KPI achievement AND ticket resolution rates AND statutory deadline status." This is the decision-support tool CFOs don't know they need yet.

---

## SA Municipal Context: Practice vs. Legislation

Research of actual municipal practice (via AGSA 2023-24 audit outcomes, COGTA performance frameworks, and published PMS frameworks from Steve Tshwete, Eden District, Mpofana, and Umsobomvu municipalities) reveals the gap between what the law requires and what municipalities actually do:

| Area | What Law Requires | What Municipalities Actually Do | Platform Opportunity |
|------|-------------------|----------------------------------|----------------------|
| SDBIP quarterly actuals | Electronic submission with evidence, validated and tabled to Council | Mostly manual (Excel/email), evidence in paper folders, often late | Structured electronic workflow replaces chaos |
| Performance agreements | Signed before July 31 each year | Often signed late or not at all; AGSA finding in 60%+ of municipalities | Digital workflow with deadline enforcement |
| Evidence management | Auditable, retrievable, linked to KPIs | Paper folders, impossible to search, lost during staff changes | Digital POE with per-KPI per-quarter structure |
| SDBIP-IDP linkage | Every KPI must derive from IDP objective | Maintained in disconnected documents; linkage unclear by year 3 | Enforced at data model level — can't create KPI without IDP linkage |
| Statutory report deadlines | Legislated dates | Frequently missed; 40%+ of municipalities late per AGSA | Automated deadline tracking with escalation |
| AG finding remediation | Formal remediation plans required | Tracked in spreadsheets; poor follow-through | AG finding tracker with responsible person and status |

**Confidence:** HIGH — sourced from AGSA 2022/23 and 2023/24 consolidated local government audit outcomes, and official PMS frameworks from published municipal policies.

---

## Dependencies on Existing v1.0 Features

| PMS Feature | Dependency on v1.0 | How It Uses It |
|-------------|-------------------|----------------|
| Auto-population engine | Ticket model (category, status, resolution_time, ward) | Aggregates ticket data by category and period to compute SDBIP actuals |
| Statutory reporting calendar notifications | Celery beat (already configured) | Adds new scheduled tasks for deadline reminders without new infrastructure |
| Portfolio of evidence upload | Supabase Storage (already integrated) | Creates new bucket/folder structure for SDBIP evidence documents |
| Performance agreement audit trail | SQLAlchemy audit event listeners (already built) | Registers new models with existing listeners |
| CFO dashboard service delivery widget | ticket and sla_config models | Queries resolution rates and SLA compliance from existing ticket data |
| Department structure | tenant_id + municipality models | Extends existing municipality model with department child records |
| 4-tier role hierarchy | Supabase Auth + RBAC system | Adds new roles to the existing custom claims hook; no auth system rebuild needed |

---

## Sources

### South African Legislation (HIGH confidence)
- [Municipal Systems Act 32 of 2000 — SAFLII](https://www.saflii.org/za/legis/consol_act/lgmsa2000384.pdf)
- [Municipal Finance Management Act 56 of 2003 — AGSA](https://www.agsa.co.za/Portals/0/Legislation/Municipal_Finance_Management_Act_MFMA.pdf)
- [MFMA Website — National Treasury](https://mfma.treasury.gov.za/)
- [Section 71 Monthly Report requirements — National Treasury (Gov.za)](https://www.gov.za/news/media-statements/national-treasury-fourth-quarter-local-government-section-71-report-period-01)

### AGSA Audit Outcomes (HIGH confidence)
- [2023-24 Consolidated Local Government Audit Outcomes — AGSA](https://mfma-2024.agsareports.co.za/)
- [2021/22 Consolidated Municipal Audit Outcomes — PMG](https://pmg.org.za/committee-meeting/37561/)
- [Municipal audit results decline — Daily Maverick (2024-08-27)](https://www.dailymaverick.co.za/article/2024-08-27-municipal-audit-results-continue-to-decline-irregular-wasteful-expenditure-balloons-to-r7-4bn/)

### Municipal PMS Frameworks — Published Municipal Policies (HIGH confidence)
- [Steve Tshwete LM PMDS Framework 2024-25](https://stlm.gov.za/wp-content/uploads/2024/12/ANNEXURE-B-STLM-IPMS-vol2-PMDS-framework-review-2024-2025.pdf)
- [Eden District Municipality PMS Framework 2015](https://www.gardenroute.gov.za/wp-content/uploads/2018/05/Revised-Performance-Management-Policy-Framework.pdf)
- [Mpofana LM PMS Framework 2023-24](https://mpofana.gov.za/wp-content/uploads/2024/08/MLM-PMS-Framework-2023.2024.pdf)
- [Stellenbosch (SBM) Performance Management Policy 2023](https://sbm.gov.za/wp-content/uploads/Pages/Performance_Agreements/Performance_Management/Final-Performance-Management-and-Development-System-Policy-July-2023.pdf)

### Competitor Research (MEDIUM confidence)
- [BCX SOLAR Municipal Solutions — Product Page](https://www.bcx.co.za/industries/government-sector/solar-municipal-solutions/)
- [BCX SOLAR White Paper (2020)](https://www.bcx.co.za/wp-content/uploads/2021/02/SOLAR-White-Paper.pdf) — referenced; PDF not parseable but cited in search results
- [Sebata Municipal Solutions — LinkedIn](https://za.linkedin.com/company/sebata-municipal-solutions)
- [Munsoft — Fledge Capital (67 municipalities, highest market share in local gov)](https://fledge.co.za/portfolio-item/munsoft/)
- [GetApp Municipal Software SA 2026](https://www.getapp.za.com/directory/1177/municipal/software)

### MPAC and Oversight (HIGH confidence)
- [SALGA Guide and Toolkit for MPAC](https://www.salga.org.za/event/mmf/Documents/Guide%20and%20Toolkit%20for%20Municipal%20Public%20Accounts%20Committees.pdf)
- [COGTA: Improving Oversight and Accountability through MPACs (2022)](https://www.cogta.gov.za/index.php/2022/08/17/improving-oversight-and-accountability-through-mpacs/)

### Section 57 Performance Agreements (HIGH confidence)
- [City of Cape Town Section 57 Performance Agreements](https://www.capetown.gov.za/Family%20and%20home/city-publications/agreements/section-57-performance-agreements-and-dashboards)
- [eThekwini (Durban) Section 57 Performance Plans](http://www.durban.gov.za/City_Government/Administration/city_manager/performance_management_unit/Pages/Section-57-Performance-Plans-and-Agreements.aspx)

### Project-Specific Context (HIGH confidence — primary source)
- `salga-pms-integration-plan.md` — detailed PMS integration strategy, data model extensions, role hierarchy, statutory calendar
- `.planning/PROJECT.md` — Umsobomvu tender context (UMS/CS/PMS/02/2026), v2.0 milestone requirements
- `CLAUDE.md` — existing stack constraints and multi-tenant architecture

---

*Feature research for: SALGA Trust Engine v2.0 — Municipal PMS Integration*
*Researched: 2026-02-28*
*Confidence: HIGH (legislative requirements and audit practice), MEDIUM (competitor gap analysis)*
