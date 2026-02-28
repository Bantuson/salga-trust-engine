# Project Research Summary

**Project:** SALGA Trust Engine v2.0 — Municipal PMS Integration
**Domain:** South African Municipal Performance Management System (PMS) — IDP/SDBIP management, statutory reporting, approval workflows, evidence storage, senior-role dashboards
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

The SALGA Trust Engine v2.0 adds a legislatively-mandated strategic layer on top of the operational v1.0 platform. South African municipalities are legally required under the Municipal Systems Act (MSA, Act 32 of 2000) and Municipal Finance Management Act (MFMA, Act 56 of 2003) to maintain Integrated Development Plans (IDPs), Service Delivery and Budget Implementation Plans (SDBIPs), individual Section 56/57 performance agreements, and to produce at minimum four statutory report types per year — all subject to Auditor-General scrutiny. The product feature set is therefore not market-researched but legislatively defined, making BCX SOLAR (the incumbent SA municipal PMS vendor used in 60+ municipalities) the clear benchmark to beat. The unique competitive moat is the auto-population engine: ticket resolution data from v1.0 feeds SDBIP actuals automatically, a connection no competitor can replicate without building a citizen reporting platform from scratch.

The recommended build approach is a clean six-phase dependency sequence: RBAC and tenant config first (gates everything else), then IDP and SDBIP data structures, then actuals submission and the auto-population engine, then performance agreements, then statutory reports and role-specific dashboards, and finally risk register and public transparency enhancement. The existing stack is largely sufficient — only four new libraries are required (WeasyPrint for PDF generation, docxtpl for DOCX generation, python-statemachine for approval workflows, and clamav-client for evidence virus scanning), plus a recharts upgrade to 3.x for hierarchical visualization components. All 13 new data entities should inherit from the existing `TenantAwareModel` base class, ensuring multi-tenant isolation and audit logging are automatic rather than bolted on.

The highest risks in this build are data integrity issues that could produce Auditor-General findings: GBV ticket data leaking into service-delivery KPIs (a SEC-05 firewall extension), auto-populated actuals with incorrect quarter-boundary logic, retroactive corrections to validated actuals that destroy the audit trail, and statutory reports that fail AG format compliance expectations. Each of these must be addressed at the phase where the underlying data is first created — not as a later hardening pass. The existing POPIA-compliant audit log and RLS infrastructure from v1.0 provide a strong foundation, but every new PMS table requires explicit RLS policy statements and the UserRole enum extension must be deployed atomically with the Supabase custom access token hook update.

---

## Key Findings

### Recommended Stack

The v1.0 stack (FastAPI 0.128, SQLAlchemy 2.0, Alembic, Celery + Redis, Supabase Auth/Storage, React 19 + Vite + Tailwind + Zustand, Recharts 2.x) is fully operational and sufficient for v2.0 with four targeted additions. PDF generation uses WeasyPrint 68.1 (HTML+CSS to PDF via Jinja2 templates already in the project; runs in Celery workers, never in request handlers). DOCX generation uses docxtpl 0.20.2 + python-docx 1.2.0 (Jinja2 placeholders inside municipality-branded Word templates; gives CFOs and AGs editable native Word files). Approval workflows use python-statemachine 3.0.0 (auto-detects async callbacks; state persisted in PostgreSQL status columns, not in memory). Evidence virus scanning uses clamav-client connected to a ClamAV Docker sidecar on port 3310. Recharts upgrades from 2.15.4 to 3.7.0 to unlock `SunburstChart` (IDP-to-KPI hierarchy) and improved `Treemap` (SDBIP scorecard grid); the upgrade is backward-compatible. react-d3-tree is added for the municipal organogram (node-link tree graphs Recharts cannot render). The mSCOA National Treasury reference data is loaded via openpyxl (already installed) into a seeded `mscoa_reference` lookup table — no ERP integration is in scope for v2.0.

**Core technologies (new additions only):**
- **WeasyPrint 68.1**: HTML-to-PDF statutory report generation — Python-native, Jinja2-compatible, no headless browser needed
- **docxtpl 0.20.2 + python-docx 1.2.0**: DOCX report generation from municipality-branded Word templates — CFOs annotate and sign native Word files
- **python-statemachine 3.0.0**: Declarative approval workflow state machine — async-native, transitions persisted in PostgreSQL status columns
- **clamav-client**: Virus scanning on every evidence upload before Supabase Storage write — runs against ClamAV Docker sidecar on port 3310
- **recharts 3.7.0**: Upgrade from 2.x — adds SunburstChart and improved Treemap for IDP-to-KPI hierarchical visualization
- **react-d3-tree 3.x**: Municipal organogram node-link tree — hierarchical org charts Recharts cannot render

**Critical version constraints:**
- WeasyPrint 68.1 requires Python 3.10+ (project uses 3.12 — compatible) and GTK/Pango system deps on Linux deploy (add to Dockerfile/render.yaml build step)
- docxtpl 0.20.2 must be pinned alongside python-docx 1.2.0 for version alignment
- python-statemachine 3.0.0 (released 2026-02-24) introduces auto-async detection — do not use 2.x for this project

### Expected Features

**Must have — v2.0 launch (Umsobomvu tender UMS/CS/PMS/02/2026 compliance):**
- 4-tier role hierarchy extension (14+ roles vs current 6) — the gate for all PMS features; nothing else can be built until this is deployed
- Configurable department structure per tenant — SDBIP KPIs require a responsible department; NOT NULL FK enforced
- IDP module: 5-year strategic plan management with annual reviews and version control (MSA s25-36)
- SDBIP management: Top Layer and Departmental scorecards with KPI definition and quarterly targets (MFMA s53)
- Quarterly actuals submission with Portfolio of Evidence (POE) upload — replaces spreadsheet-and-email workflows in 90%+ of Category B municipalities
- Auto-population engine: ticket data feeds SDBIP actuals — the killer differentiator; no SA competitor offers this connection
- Section 57/56 individual performance agreements (create, sign, quarterly review, annual assessment) — AG checks signing deadlines against July 31 each year
- Section 52 quarterly and Section 72 mid-year report generation in PDF and DOCX — must match AG-accepted National Treasury formats
- Report approval workflow: drafting to internal_review to mm_approved to submitted to tabled — required for AG audit trail
- Statutory reporting calendar with escalating deadline notifications (30/14/7/3 days) — 40%+ of municipalities miss statutory deadlines
- CFO dashboard and Municipal Manager dashboard — the primary sales tools for procurement decision-makers
- Audit trail on all PMS data — extend existing v1.0 SQLAlchemy event listeners to all new TenantAwareModel subclasses

**Should have — v2.1 (post-validation, 3-6 months post-launch):**
- Section 46 annual performance report and Section 121 annual report — triggered after first financial year on platform
- Mayor and Council dashboard — triggered after political buy-in secured
- Risk register linked to SDBIP KPIs — auto-surface risks when KPIs trend red
- AG audit finding tracker — remediation tracking currently done in spreadsheets
- Organogram view with performance status — visual accountability map for Municipal Manager
- Digital signature workflow for performance agreements — removes paper-based signing friction

**Defer — v2.2 and beyond (12+ months):**
- Cross-municipality benchmarking SALGA admin view — requires 5+ municipalities for statistical significance
- Enhanced public dashboard (IDP progress, budget execution) — defer until SDBIP data proven accurate over 2+ quarters
- ERP/financial system integration (Sebata, Munsoft) — multi-year effort; document as v3.0 milestone
- AI-assisted KPI performance prediction — requires 3+ years of actuals data for meaningful training

**Anti-features (explicitly excluded from v2.0):**
- Full Section 71 financial report auto-generation — requires live ERP trial balance data not accessible in v2.0
- PMDS for all staff — Section 56/57 managers only (5-8 people per municipality); full HR PMDS is a separate product
- Automated AI KPI target setting — targets are politically sensitive and set by Council, not algorithm
- Blockchain evidence integrity — AGSA does not accept it; SHA-256 hashing plus immutable audit log is sufficient

### Architecture Approach

The v2.0 PMS layer integrates as a clean namespace addition to the existing ~88K LOC codebase without restructuring any existing modules. All 13 new SQLAlchemy models live under `src/models/pms/`, all new API routes under `src/api/v1/pms/`, all new services under `src/services/pms/`, and new Celery tasks in `src/tasks/pms_auto_populate.py` and `src/tasks/statutory_deadlines.py`. Only three existing models need modification (User, Municipality, Ticket) and all changes are additive. The single most important architectural pattern is that every new PMS model inherits from `TenantAwareModel` — this gives automatic tenant_id filtering, audit logging, and timestamps without additional code. All approval workflows (SDBIP, performance agreements, statutory reports) use a centralised state machine service rather than inline status updates scattered across handlers. PDF and DOCX generation always runs in Celery workers, never in FastAPI request handlers. The ticket-to-SDBIP boundary is strictly one-directional: the auto-population engine is a periodic Celery task that reads tickets as a read-only consumer, never writing back to the tickets table.

**Major components:**
1. **IDP Module** (`src/models/pms/idp.py`, `src/api/v1/pms/idp.py`) — 5-year strategic cycles and objectives; every SDBIP KPI must reference an IDP objective (enforced as NOT NULL FK)
2. **SDBIP Module** (`src/models/pms/sdbip.py`, `src/api/v1/pms/sdbip.py`) — KPI definition, quarterly targets, actuals submission, mSCOA linkage via FK to `mscoa_reference` reference table
3. **Auto-Population Engine** (`src/services/pms/auto_population_service.py`, `src/tasks/pms_auto_populate.py`) — Celery beat task aggregates ticket data by category/quarter/tenant into `sdbip_actual` records; `auto_populated=True` flag and logged `source_query` for AG traceability
4. **Approval Workflow Engine** (`src/services/pms/approval_workflow.py`) — centralised state machine for all PMS workflow entities; validates transitions, checks roles, dispatches Celery notifications; all status changes route through this service
5. **Document Generation** (`src/services/pms/document_generation.py`, Celery tasks) — WeasyPrint for PDF, docxtpl for DOCX; triggered by state transitions; output stored in Supabase Storage; source data snapshotted at generation time
6. **Evidence / POE Storage** — per-municipality Supabase Storage buckets (`salga-evidence-{municipality_id}`); metadata in `EvidenceDocument` PostgreSQL table; ClamAV scan before any write; signed 1-hour URLs served on demand, never stored as full URLs
7. **Role-Scoped Dashboards** (`src/api/v1/pms/pms_dashboards.py`, React pages) — CFO, Municipal Manager, Mayor, Oversight dashboards assembled from multiple PMS services in dedicated FastAPI routes
8. **Deadline Calendar** (`src/services/pms/deadline_service.py`, `src/tasks/statutory_deadlines.py`) — per-tenant `financial_year` model drives all deadline computations; Celery beat iterates over active financial years per tenant; no hardcoded date literals

### Critical Pitfalls

1. **Role enum and Supabase hook deployed non-atomically** — If the Python UserRole enum extension and Supabase custom access token hook update are not deployed as a single atomic step, users with new roles receive 403 until forced re-login. For senior officials (CFO, Municipal Manager, Mayor) using persistent sessions, this gap can last hours. Inversely, demoted officials retain elevated JWT permissions until token expiry — a governance risk in politically turbulent SA municipalities. Prevention: atomic deployment script; DB CHECK constraint on `users.role`; startup assertion in `main.py` validating enum vs constraint; Redis force-logout on any role change in the admin API. (Phase 1)

2. **Auto-population produces AG-adverse data** — Quarter date boundary errors (filtering by `status = 'resolved'` without `resolved_at BETWEEN quarter_start AND quarter_end`), GBV ticket inclusion (`is_sensitive = True`), and double-counting re-opened tickets all produce mathematically wrong SDBIP actuals that appear credible until the AG runs their own count. The 2023-24 AGSA report found 48% of municipalities submitted unreliable performance data. Prevention: mandatory `resolved_at BETWEEN` date bounds; explicit `AND is_sensitive = FALSE` in every aggregation rule (SEC-05 firewall extension); point-in-time snapshot when a quarter closes; reconciliation job 24 hours after auto-population comparing counts to stored actual. (Phase 2)

3. **Retroactive corrections destroy audit trail** — In-place UPDATE to a validated `sdbip_actual` leaves the database value inconsistent with Council-tabled reports. The AG asks "what was reported to Council on date X?" and the answer has changed. Prevention: validated actuals are immutable at the database level; corrections require a `sdbip_actual_correction` record with its own approval workflow; statutory report generation snapshots all source data into a `statutory_report_snapshot` table (JSON blob) at `mm_approved` status so the generated document always matches the snapshot regardless of subsequent corrections. (Phase 2)

4. **RLS policies missing on new PMS tables** — New tables not covered by explicit `CREATE POLICY` statements default to allowing all rows when no policy matches, creating cross-tenant data exposure. Application-level `WHERE tenant_id = :tenant_id` filtering creates false confidence. Prevention: CI check queries `pg_policies` and fails if any TenantAwareModel table lacks a tenant isolation policy; shared Alembic migration helper function creates the standard tenant isolation policy per new table. (Phase 1 and every subsequent phase)

5. **Statutory reports failing AG format compliance** — Reports with incorrect section numbering, missing mandatory columns (baseline, annual target, quarterly target, actual, variance, reason for deviation — six required in SDBIP tables), or inconsistent number formatting (R 1.23M vs R 1,234,567.00) receive compliance findings even when the underlying data is correct. Prevention: obtain National Treasury Section 52 and Section 46 official templates before writing any Jinja2 template; static section numbering in templates (not auto-incremented); mandatory field completeness check before generation (refuse to generate if mandatory columns are NULL); draft watermark until `mm_approved` status. (Phase 4)

---

## Implications for Roadmap

Based on combined research, the dependency graph is clear and unambiguous. The feature dependency tree in FEATURES.md and the build order in ARCHITECTURE.md converge on the same six-phase sequence. Every phase is blocked by the prior phase's outputs, with one parallelism opportunity: Phase 3 (Performance Agreements) can begin while Phase 2 actuals workflow is being validated.

### Phase 1: RBAC Foundation and Tenant Configuration

**Rationale:** Every subsequent PMS feature uses role-gated endpoints. The 4-tier role hierarchy (14+ roles), configurable department structure per tenant, and `MunicipalityConfig` plus `financial_year` models must all exist before any PMS data can be created. The Supabase custom access token hook must recognise all new roles before any user is assigned one. This phase has no PMS feature dependencies — everything else depends on it.

**Delivers:** Extended UserRole enum (executive_mayor, municipal_manager, cfo, director, pms_officer, audit_committee_member, internal_auditor, mpac_member, salga_admin), `require_minimum_tier()` dependency alongside existing `require_role()`, configurable department structure CRUD, PMS readiness checklist endpoint (`GET /api/v1/municipalities/{id}/pms-readiness`), `financial_year` model (foundational for Phase 4 deadline calculations), placeholder PMS navigation for new roles in `useRoleBasedNav.ts`.

**Addresses:** 4-tier role hierarchy, configurable department structure per tenant (FEATURES.md).

**Avoids:** Role enum/Supabase hook sync failure; stale JWT after role changes; flat role checking that cannot express hierarchical access; department config gate (block PMS creation until departments configured); RLS missing on new tables.

**Research flag:** Standard patterns. Supabase RBAC, PostgreSQL RLS, and SQLAlchemy enum extension are well-documented. Skip research phase.

---

### Phase 2: IDP, SDBIP Core, and Auto-Population Engine

**Rationale:** IDP objectives are the legislative parent of SDBIP KPIs — KPIs cannot be created without an IDP linkage (NOT NULL FK enforced at data model level). SDBIP KPIs must exist before actuals can be submitted. The auto-population engine is the product's killer differentiator and must be built with forensic-grade query logging from day one, not retrofitted. Evidence storage bucket architecture (per-municipality buckets, virus scanning, signed URLs) must be right before the first upload — retrofitting thousands of files across bucket boundaries is a costly migration.

**Delivers:** IDP cycle and objective management (5-year with version control), SDBIP KPI creation and quarterly target setting, `mscoa_reference` table seeded from National Treasury Excel, `SDBIPTicketAggregationRule` model for configuring auto-population rules, `SDBIPActual` with immutability enforcement after validation, evidence document upload with ClamAV scanning, Celery beat tasks for weekly monitoring and quarterly auto-population, frontend IDP and SDBIP pages.

**Uses:** clamav-client + ClamAV Docker sidecar; JSONB `mscoa_tags` on `sdbip_kpi`; composite index on `(tenant_id, category, created_at, status)` in tickets migration (STACK.md).

**Implements:** IDP Module, SDBIP Module, Auto-Population Engine, Evidence/POE Storage (ARCHITECTURE.md).

**Avoids:** Auto-population GBV data leakage (SEC-05 extension, `AND is_sensitive = FALSE` in every aggregation rule); quarter date boundary errors (`resolved_at BETWEEN`); immutable validated actuals (correction records not UPDATE); RLS on all new tables; mSCOA as free-text (FK to reference table from day one); per-municipality evidence buckets from day one.

**Research flag:** Auto-population rule schema design is novel — how municipalities configure ticket category-to-KPI mappings has no established template. Consider a targeted research session before Phase 2 planning begins. ClamAV Docker sidecar integration pattern is community-validated but warrants a spike.

---

### Phase 3: Performance Agreements

**Rationale:** Section 56/57 performance agreements link directly to SDBIP KPIs (Phase 2) and are reviewed against quarterly actuals (Phase 2). They cannot be created without KPIs existing. They are legislatively mandatory (AG checks signing deadlines against July 31 each year) but do not block Phase 4 reporting — they can run in parallel with Phase 2 final testing or sequentially with minimal risk.

**Delivers:** PerformanceAgreement and PerformanceAgreementKpi models, create/sign/quarterly-review/annual-assessment workflow using the centralised approval state machine from Phase 2, frontend performance agreements page with review forms, Celery notifications to evaluators (Municipal Manager or Mayor) on submission.

**Addresses:** Section 57 performance agreements (FEATURES.md).

**Avoids:** Political roles (executive_mayor, mayor) are read-only on all performance data; only the assessed official, evaluator, municipal_manager, and pms_officer can view individual scores; MPAC sees aggregate scores only; performance agreements carry a POPIA retention period for data deletion rights on departure.

**Research flag:** Standard patterns. SQLAlchemy models, FastAPI CRUD, and the approval state machine (already built in Phase 2) are well-established. Skip research phase.

---

### Phase 4: Statutory Reports, Approval Workflows, and Role-Specific Dashboards

**Rationale:** Statutory report generation aggregates data from all three prior phases (IDP objectives, SDBIP actuals, performance agreement scores). Role-specific dashboards display cross-phase data. Building last means all data sources are available and testable. The deadline calendar engine uses the `financial_year` model created in Phase 1 — model exists, notification engine is new in this phase.

**Delivers:** Section 52 quarterly and Section 72 mid-year report generation (WeasyPrint PDF + docxtpl DOCX), report approval workflow (drafting to submitted to tabled), `statutory_report_snapshot` table capturing source data at generation time, deadline calendar Celery beat with escalating notifications (30/14/7/3 days), CFO dashboard, Municipal Manager dashboard, Mayor and Oversight Committee dashboards (read-only), statutory reports frontend page with download and approval actions, deadline calendar widget with traffic-light status.

**Uses:** WeasyPrint 68.1 (PDF), docxtpl 0.20.2 (DOCX), python-statemachine 3.0.0 (approval workflow), recharts 3.7.0 SunburstChart and Treemap (dashboards) (STACK.md).

**Implements:** Reporting Layer, Document Generation, Approval Workflow Engine, Deadline Calendar, Role-Scoped Dashboards (ARCHITECTURE.md).

**Avoids:** Obtain official National Treasury Section 52/46 templates before writing any Jinja2 template; static section numbering; mandatory completeness check before generation; snapshot source data at `mm_approved` (do not re-query at submission); financial year model drives all deadline calculations (no hardcoded date literals); report generation always in Celery worker; store generated files (do not re-generate on every download).

**Research flag:** Needs a research session for report format compliance before planning begins. The exact National Treasury Section 52/72/46 format requirements must be sourced from official circular guidance and validated against a real municipality's submitted report before template design starts.

---

### Phase 5: Risk Register and v2.1 Enhancements

**Rationale:** Risk register is a competitive differentiator that enhances but does not block statutory reporting. AG audit finding tracker and organogram view are post-validation additions triggered by explicit municipality requests. Section 46 annual performance report and Section 121 annual report require a completed financial year of actuals data — naturally suited to this phase.

**Delivers:** Risk register CRUD with KPI-to-risk linkage, risk status dashboard widget (KPIs in red auto-surface as risk items), AG audit finding tracker (finding to responsible department to remediation status), Section 46 and Section 121 report templates extending Phase 4 generation service, organogram view using react-d3-tree, Mayor and Council dashboard.

**Addresses:** Risk register, AG audit finding tracker, Section 46/121 annual reports, organogram view, Mayor and Council dashboard (FEATURES.md).

**Research flag:** Standard patterns building on Phase 4 report generation infrastructure. Skip research phase.

---

### Phase 6: Public Transparency Enhancement and SALGA Admin View (v2.2)

**Rationale:** Cross-municipality benchmarking conflicts directly with tenant data isolation and requires careful de-identification design. The enhanced public dashboard with IDP progress requires 2+ quarters of proven accurate SDBIP data before public exposure. Both are deferred until product-market fit is established with multiple municipalities (5+ recommended for statistical significance in benchmarking).

**Delivers:** SDBIP achievement stats added to public transparency dashboard (plain-language translations, not raw figures), IDP progress section on public dashboard, `salga_admin` cross-municipality benchmarking view with de-identified aggregations by KPA category and municipality size.

**Addresses:** Cross-municipality benchmarking, enhanced public dashboard (FEATURES.md).

**Avoids:** `salga_admin` accesses aggregated data only via a dedicated `SALGAAdmin` dependency; individual municipality data requires explicit `municipality_id` scope enforced in every query; raw SDBIP percentages never exposed publicly (plain-language translation required).

**Research flag:** Cross-tenant data aggregation without tenant data leakage in a multi-tenant PostgreSQL RLS architecture is a novel pattern for this codebase. Consider a targeted research session before Phase 6 planning.

---

### Phase Ordering Rationale

- **Role hierarchy is the unconditional first step:** Every PMS endpoint uses `require_role()`. No PMS feature can be built until the 4-tier hierarchy and Supabase hook are deployed and validated. This is the single non-negotiable ordering constraint identified across all four research files.
- **IDP before SDBIP, legislatively and architecturally:** SDBIP KPIs must reference an IDP objective at creation time. The data model enforces this with a NOT NULL FK. The legislative chain is IDP → SDBIP → actuals → reports, and the architecture follows the same sequence.
- **Auto-population engine must be correct from day one:** Data integrity pitfalls (GBV exclusion, date boundaries, immutability) cannot be retroactively added to an auto-population engine that has already generated production data used in AG submissions.
- **Performance agreements parallel with late Phase 2:** Section 57 agreements reference KPIs (Phase 2 output) but do not gate reporting. Phase 3 can begin while Phase 2 actuals workflow is being validated in the last weeks of that phase.
- **Dashboards last:** Role-specific dashboards assemble data from all prior phases. Building them last means all data sources are available and the dashboard layer is a pure aggregation concern, not blocked by missing data.
- **Risk register and annual reports deferred to Phase 5:** Section 46/121 reports require a completed financial year of actuals data (a timeline constraint, not a technical dependency). Risk register is a competitive feature, not a compliance requirement, and is lower priority than the reporting engine.
- **Cross-tenant features isolated to final phase:** SALGA benchmarking has architectural tension with tenant isolation that must be resolved carefully. Deferring to Phase 6 means the isolation patterns are proven before the exception is built.

---

### Research Flags

**Needs research-phase before planning:**
- **Phase 2:** Auto-population aggregation rule schema design — how municipalities configure ticket category-to-KPI mappings is novel with no established template in the SA PMS market. Also: ClamAV Docker sidecar deployment configuration for the target infrastructure (Render/Fly.io).
- **Phase 4:** Report format compliance — National Treasury Section 52/72/46 official template requirements must be sourced and reviewed before any Jinja2 report template is designed.
- **Phase 6:** Cross-tenant de-identification patterns — aggregating SDBIP data across municipality tenants without leaking individual tenant data in a PostgreSQL RLS architecture.

**Standard patterns (skip research-phase):**
- **Phase 1:** Supabase RBAC, PostgreSQL RLS, SQLAlchemy enum extension — extensively documented with official guides.
- **Phase 3:** Performance agreement CRUD and state machine approval workflow — same patterns as Phase 2; well-established.
- **Phase 5:** Risk register CRUD and report template extension — builds directly on Phase 4 infrastructure with no novel patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions verified against PyPI and npm registries as of 2026-02-28. WeasyPrint, docxtpl, python-statemachine, recharts 3.x all production-stable with multiple dependents. clamav-client integration is MEDIUM — community-validated pattern, not official documentation. |
| Features | HIGH | Legislative requirements sourced from official MSA and MFMA texts via AGSA and National Treasury. Competitor analysis (BCX SOLAR) is MEDIUM — based on public product pages and white papers; no hands-on evaluation. |
| Architecture | HIGH | Based on direct codebase inspection of the ~88K LOC v1.0 system and `salga-pms-integration-plan.md`. All integration points (TenantAwareModel, require_role, Supabase Storage, Celery beat) verified against existing code. |
| Pitfalls | HIGH | Cross-verified against AGSA 2022-24 consolidated audit reports, MFMA primary legislation, PostgreSQL RLS official documentation, Supabase auth documentation, and SA municipal PMS academic literature. |

**Overall confidence:** HIGH

### Gaps to Address

- **mSCOA reference data file:** The National Treasury mSCOA v5.5 Excel file must be obtained and its column structure reviewed before the Phase 2 migration schema is designed. This is a pre-Phase 2 task for the product owner to procure.
- **National Treasury statutory report templates:** Official Section 52/72/46/121 report templates must be obtained from treasury.gov.za before Phase 4 template design begins. Without them, generated reports risk format non-compliance findings.
- **Supabase Storage per-municipality bucket limits:** Supabase Pro plan limits on bucket count per project must be verified before committing to the per-municipality bucket architecture. At full scale (257 municipalities), this could be binding. An alternative (single bucket with per-municipality RLS folder policies) needs design if limits are binding.
- **ClamAV sidecar on deployment target:** The exact Render or Fly.io configuration for ClamAV as a Background Worker (Docker image, resource requirements, TCP port 3310 exposure) must be validated against the actual deployment infrastructure before Phase 2 implementation.
- **Digital signature workflow (v2.1):** DocuSign or a South African equivalent (SignFlow, Acrobat Sign) must be evaluated for Section 56 performance agreement digital signing — API costs, POPIA compliance of external providers, and AGSA acceptance of digital signatures need verification before Phase 5 planning.

---

## Sources

### Primary (HIGH confidence)
- [Municipal Systems Act 32 of 2000 — SAFLII](https://www.saflii.org/za/legis/consol_act/lgmsa2000384.pdf) — IDP, SDBIP, Section 56/57 requirements
- [Municipal Finance Management Act 56 of 2003 — AGSA](https://www.agsa.co.za/Portals/0/Legislation/Municipal_Finance_Management_Act_MFMA.pdf) — Section 52, 71, 72, 121 statutory reporting requirements
- [AGSA Consolidated Local Government Audit Outcomes 2023-24](https://mfma-2024.agsareports.co.za/) — pitfall validation from real AG findings (48% unreliable performance data)
- [National Treasury mSCOA Regulations](https://mfma.treasury.gov.za/RegulationsandGazettes/MunicipalRegulationsOnAStandardChartOfAccountsFinal/Pages/default.aspx) — mSCOA v5.5 reference
- [WeasyPrint PyPI v68.1](https://pypi.org/project/weasyprint/) — PDF generation library, Python 3.10+ requirement confirmed
- [python-statemachine PyPI v3.0.0](https://pypi.org/project/python-statemachine/) — async-native state machine, released 2026-02-24
- [docxtpl PyPI v0.20.2](https://pypi.org/project/docxtpl/) — Jinja2 inside DOCX templates, released 2025-11-13
- [recharts npm v3.7.0](https://www.npmjs.com/package/recharts) — SunburstChart and Treemap confirmed in 3.x; 3,608 dependents
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — RBAC integration pattern
- [PostgreSQL RLS Implementation Guide — Permit.io](https://www.permit.io/blog/postgres-rls-implementation-guide) — pitfall validation
- `salga-pms-integration-plan.md` — project-specific integration strategy; primary source for data model and role hierarchy design

### Secondary (MEDIUM confidence)
- [BCX SOLAR Municipal Solutions — Product Page](https://www.bcx.co.za/industries/government-sector/solar-municipal-solutions/) — competitor feature benchmark
- [Steve Tshwete LM PMDS Framework 2024-25](https://stlm.gov.za/wp-content/uploads/2024/12/ANNEXURE-B-STLM-IPMS-vol2-PMDS-framework-review-2024-2025.pdf) — real municipal PMS practice
- [clamav-client PyPI](https://pypi.org/project/clamav-client/) — ClamAV Python client; community integration pattern
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) — backward compatibility details for 2.x to 3.x
- [SALGA Guide and Toolkit for MPAC](https://www.salga.org.za/event/mmf/Documents/Guide%20and%20Toolkit%20for%20Municipal%20Public%20Accounts%20Committees.pdf) — oversight role requirements

### Tertiary (informing context)
- AGSA 2022-23 MFMA consolidated report — 48% of municipalities submitted unreliable performance data; basis for auto-population data quality pitfalls
- [Strengthening PMS Implementation in SA Municipalities — ResearchGate](https://www.researchgate.net/publication/320377855_Strengthening_Performance_Management_System_Implementation_in_South_African_Municipalities) — gap between legislative requirements and actual practice

---

*Research completed: 2026-02-28*
*Ready for roadmap: yes*
