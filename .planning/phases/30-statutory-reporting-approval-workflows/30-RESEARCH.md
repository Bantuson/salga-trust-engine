# Phase 30: Statutory Reporting & Approval Workflows — Research

**Researched:** 2026-03-01
**Status:** Complete
**Researcher:** Orchestrator (direct)

## 1. Existing Codebase Foundations

### 1.1 Data Source Models (Phase 28/29 — fully built)

**SDBIP hierarchy** (`src/models/sdbip.py`):
- `SDBIPScorecard` → `SDBIPKpi` → `SDBIPQuarterlyTarget` + `SDBIPActual`
- Financial year format: `"YYYY/YY"` (e.g., `"2025/26"`)
- Quarter enum: `Q1` (Jul-Sep), `Q2` (Oct-Dec), `Q3` (Jan-Mar), `Q4` (Apr-Jun)
- Traffic-light: green ≥80%, amber 50-79%, red <50%
- `compute_achievement(actual, target) -> (pct, traffic_light)` helper exists
- Actuals include `achievement_pct`, `traffic_light_status`, `is_validated`, `is_auto_populated`

**PA hierarchy** (`src/models/pa.py`):
- `PerformanceAgreement` → `PAKpi` → `PAQuarterlyScore`
- PA status workflow: draft → signed → under_review → assessed
- `annual_score` computed from weighted quarterly scores at `assess` transition
- Linked to SDBIP KPIs via `PAKpi.sdbip_kpi_id`

**IDP hierarchy** (`src/models/idp.py`):
- `IDPCycle` → `IDPGoal` → `IDPObjective` → linked to `SDBIPKpi` via FK
- Golden thread: IDP → Goals → Objectives → SDBIP KPIs → Actuals

### 1.2 Existing Patterns to Reuse

**State machine pattern** (python-statemachine 3.0.0):
- Used in `SDBIPWorkflow` and `PAWorkflow`
- Model binding: `StateMachine(model=obj, state_field="status", start_value=obj.status)`
- Catch `TransitionNotAllowed` → HTTP 409
- Approval states already established for SDBIP (draft→approved→revised) and PA (draft→signed→under_review→assessed)
- Phase 30 needs a NEW 5-stage workflow: `drafting → internal_review → mm_approved → submitted → tabled`

**Celery task pattern** (`src/tasks/`):
- `celery_app.py` beat schedule with crontab
- `pa_notify_task.py` and `pms_auto_populate_task.py` both use:
  - `asyncio.run()` wrapper for async logic
  - Windows `WindowsSelectorEventLoopPolicy`
  - Raw SQL `text()` for tenant discovery (bypasses ORM RLS filter)
  - `set_tenant_context()`/`clear_tenant_context()` with try/finally per tenant
- Beat schedule entries in `celery_app.py`

**Service layer pattern** (`src/services/`):
- Stateless classes with async methods taking `(data, user, db)` args
- HTTPException raising for validation errors (422, 409, 403)
- Audit logging via `AuditLog` model with `OperationType`

**TenantAwareModel base** (`src/models/base.py`):
- All new models MUST inherit `TenantAwareModel` (id, tenant_id, created_at, updated_at, created_by, updated_by)
- Automatic RLS filtering via `do_orm_execute` event listener

**API router pattern** (`src/api/v1/`):
- FastAPI `APIRouter` with prefix and tags
- Dependencies: `get_current_user`, `get_db`, `require_role()`
- Rate limiting via `@limiter.limit()`
- Imported and included in `src/main.py`

**Frontend pattern** (`frontend-dashboard/`):
- PMS Hub (`PmsHubPage.tsx`) with dropdown view selector
- CSS variables from `design-tokens.css` (NOT Tailwind config)
- `@shared/components/ui/` for reusable components (GlassCard, Button, Select)
- `useAuth()` hook for role checking

### 1.3 Municipality Model (logo/branding)
- `Municipality` model (`src/models/municipality.py`) is a `NonTenantModel`
- Has `name`, `code`, `province`, `category`, `demarcation_code`, `financial_year_start_month`
- **Does NOT yet have**: `logo_url`, `header_text` for branded reports
- Need to add logo/branding columns or handle via Supabase Storage lookup

### 1.4 Dependencies Not Yet Installed
- `weasyprint` — NOT in `pyproject.toml` (needs adding for PDF generation)
- `docxtpl` — NOT in `pyproject.toml` (needs adding for DOCX generation)
- `jinja2` — Already installed (v3.1.5) — shared with FastAPI templates

## 2. South African Statutory Reporting Framework

### 2.1 MFMA Reporting Requirements

**Section 52** — Quarterly Performance Reports:
- Due within 30 days after end of each quarter
- SA financial year: July-June; quarters: Q1 (Jul-Sep), Q2 (Oct-Dec), Q3 (Jan-Mar), Q4 (Apr-Jun)
- Deadlines: ~31 Oct (Q1), ~31 Jan (Q2), ~31 Mar (Q3), ~30 Jun (Q4)
- Content: KPI progress against targets, traffic-light status, variance analysis, deviation reasons
- Column structure: baseline, annual target, quarterly target, actual, variance, deviation reason
- Municipal Manager submits to Mayor and Council

**Section 72** — Mid-Year Budget & Performance Assessment:
- Due by 25 January each year (covers Jul-Dec, i.e., H1)
- Combines budget performance + service delivery KPIs
- Comprehensive mid-year review with recommendations
- MM submits to Mayor, who tables to Council

**Section 46** — Annual Performance Report:
- Due by 31 August each year (covers full prior financial year)
- Comprehensive annual performance against SDBIP targets
- Feeds into Section 121 annual report
- Must be submitted to Auditor-General

**Section 121** — Annual Report:
- Due by 31 January each year
- Contains the performance chapter (from Section 46)
- Tabled to Council, submitted to AGSA, National/Provincial Treasury
- Most comprehensive report combining financial + non-financial performance

### 2.2 Statutory Deadline Calendar (for financial year YYYY/YY)

| Report | Section | Period Covered | Statutory Deadline |
|--------|---------|---------------|-------------------|
| Q1 Performance | 52 | Jul-Sep | 31 October |
| Q2 Performance | 52 | Oct-Dec | 31 January |
| Mid-Year Assessment | 72 | Jul-Dec | 25 January |
| Q3 Performance | 52 | Jan-Mar | 30 April* |
| Q4 Performance | 52 | Apr-Jun | 31 July* |
| Annual Performance | 46 | Full FY | 31 August |
| Annual Report | 121 | Full FY | 31 January (next FY) |

*Note: Q3/Q4 Section 52 deadlines are convention — MFMA specifies "within 30 days" not fixed dates.

### 2.3 Report Template Structure (AG-compliant)

National Treasury prescribed format for Section 52:
```
Municipality Name & Logo
Report Title: "Quarterly Performance Report — Section 52 of the MFMA"
Financial Year: 2025/26
Quarter: Q1 (July - September 2025)

Table columns:
| KPI # | Description | Unit | Baseline | Annual Target | Quarterly Target | Actual | Achievement % | Status | Variance | Deviation Reason |

Summary sections:
- Executive Summary
- Overall Achievement Statistics (% green/amber/red)
- Departmental Breakdown
- Critical Underperformance (red KPIs)
- Recommendations
- Sign-off block (Municipal Manager + Mayor)
```

## 3. Technical Implementation Decisions

### 3.1 Report Generation Architecture

**WeasyPrint for PDF** (specified in research decisions):
- Renders HTML/CSS to PDF — Jinja2 templates → HTML → WeasyPrint → PDF
- Supports CSS for formatting, page breaks, headers/footers, watermarks
- Draft watermark via CSS `@page::after` with rotated text or background image
- Municipality logo injected as base64 or URL in template context
- Runs in Celery worker (CPU-intensive, never block request handler)

**docxtpl for DOCX** (specified in research decisions):
- Uses python-docx under the hood with Jinja2-style template tags
- `.docx` template file with `{{ variable }}` placeholders
- Supports tables with `{% for row in rows %}` loops
- Template files stored in `src/templates/statutory/` directory
- Also runs in Celery worker

### 3.2 Data Snapshot Strategy (REPORT-06)

When report reaches `mm_approved` status:
1. Query all SDBIP KPIs + quarterly targets + actuals for the report's scope
2. Serialize the complete dataset as JSON
3. Store in `StatutoryReportSnapshot` table (report_id FK, JSON blob, timestamp)
4. All subsequent exports (PDF/DOCX) render from snapshot, NOT live data
5. This guarantees the approved document matches what was reviewed

### 3.3 Approval State Machine (5 stages)

```
drafting → internal_review → mm_approved → submitted → tabled
```

Transitions:
- `submit_for_review`: drafting → internal_review (any PMS officer)
- `approve`: internal_review → mm_approved (MM or CFO role gate)
- `submit_external`: mm_approved → submitted (MM — to AG/Treasury)
- `table`: submitted → tabled (final — presented to Council)

Role gates:
- `submit_for_review`: `pms_officer`, `department_manager`, `cfo`, `admin`, `salga_admin`
- `approve`: `municipal_manager`, `cfo`, `admin`, `salga_admin`
- `submit_external`: `municipal_manager`, `admin`, `salga_admin`
- `table`: `municipal_manager`, `speaker`, `admin`, `salga_admin`

### 3.4 Notification Infrastructure (REPORT-07)

Escalating deadline notifications at 30, 14, 7, 3 days before, and overdue:
- Celery beat daily check task (e.g., 07:00 SAST)
- Query `statutory_deadlines` table for deadlines within notification windows
- Create `Notification` records in DB (in-app notifications)
- Send email via existing Supabase/SMTP (not WhatsApp — internal staff tool)
- Log all notifications for audit trail

Notification model (new):
- `id`, `tenant_id`, `user_id`, `type`, `title`, `message`, `is_read`, `created_at`
- Types: `deadline_warning`, `deadline_overdue`, `report_status_change`, `approval_required`

### 3.5 Statutory Deadline Calendar (REPORT-09)

**Financial-year-driven computation** (no hardcoded dates):
- Input: `financial_year` string (e.g., "2025/26") + `financial_year_start_month` from Municipality settings
- Parse start year and compute all 7 deadline dates dynamically
- Store as `StatutoryDeadline` records per financial year per tenant
- Auto-create via Celery task or on-demand when new FY begins

### 3.6 Auto-Task Creation (REPORT-09)

30 days before each statutory deadline:
- Celery beat daily task checks for deadlines 30 days out
- Creates a "drafting task" (could be a ticket or a dedicated task record)
- Assigns to responsible role (CFO or MM based on report type)

## 4. New Models Required

### 4.1 StatutoryReport
- `id`, `tenant_id` (TenantAwareModel)
- `report_type`: enum (section_52, section_72, section_46, section_121)
- `financial_year`: String(10)
- `quarter`: String(2) nullable (Q1-Q4 for S52; null for S72/S46/S121)
- `period_start`, `period_end`: Date
- `title`: String
- `status`: String (drafting, internal_review, mm_approved, submitted, tabled)
- `generated_by`, `generated_at`: user + timestamp
- `approved_by`, `approved_at`: user + timestamp (at mm_approved)
- `pdf_storage_path`, `docx_storage_path`: String nullable
- `created_by`, `updated_by`: audit

### 4.2 StatutoryReportSnapshot
- `id`, `tenant_id` (TenantAwareModel)
- `report_id`: FK to StatutoryReport
- `snapshot_data`: Text (JSON blob of all KPI data at time of approval)
- `snapshot_at`: DateTime
- `snapshot_reason`: String (e.g., "mm_approved", "manual_snapshot")

### 4.3 StatutoryDeadline
- `id`, `tenant_id` (TenantAwareModel)
- `report_type`: enum matching StatutoryReport
- `financial_year`: String(10)
- `deadline_date`: Date
- `description`: String
- `task_created`: Boolean (auto-task 30 days before)
- `task_created_at`: DateTime nullable
- `notification_30d_sent`, `notification_14d_sent`, `notification_7d_sent`, `notification_3d_sent`, `notification_overdue_sent`: Boolean flags

### 4.4 Notification (general-purpose for Phase 30+)
- `id`, `tenant_id` (TenantAwareModel)
- `user_id`: FK to users
- `type`: String (deadline_warning, deadline_overdue, report_status_change, approval_required)
- `title`: String
- `message`: Text
- `link`: String nullable (deep link to report)
- `is_read`: Boolean default False
- `read_at`: DateTime nullable

## 5. Files to Create/Modify

### New Files
- `src/models/statutory_report.py` — StatutoryReport, StatutoryReportSnapshot, StatutoryDeadline, ReportWorkflow state machine
- `src/models/notification.py` — Notification model
- `src/schemas/statutory_report.py` — Pydantic schemas
- `src/schemas/notification.py` — Notification schemas
- `src/services/statutory_report_service.py` — Report generation, approval, snapshot logic
- `src/services/deadline_service.py` — Deadline computation, notification scheduling
- `src/api/v1/statutory_reports.py` — API endpoints
- `src/api/v1/notifications.py` — Notification API (list, mark read)
- `src/tasks/statutory_deadline_task.py` — Celery beat task for deadline checks + auto-task creation
- `src/tasks/report_generation_task.py` — Celery task for async PDF/DOCX generation
- `src/templates/statutory/section_52.html` — Jinja2 HTML template for S52 PDF
- `src/templates/statutory/section_72.html` — Jinja2 HTML template for S72 PDF
- `src/templates/statutory/section_46.html` — Jinja2 HTML template for S46 PDF
- `src/templates/statutory/section_121.html` — Jinja2 HTML template for S121 PDF
- `src/templates/statutory/section_52.docx` — docxtpl template for S52 DOCX
- `src/templates/statutory/section_72.docx` — docxtpl template for S72 DOCX
- `frontend-dashboard/src/pages/StatutoryReportsPage.tsx` — Frontend page

### Modified Files
- `pyproject.toml` — Add weasyprint, docxtpl dependencies
- `src/models/__init__.py` — Import new models
- `src/main.py` — Include statutory_reports and notifications routers
- `src/tasks/celery_app.py` — Add statutory deadline + report generation tasks to include and beat schedule
- `frontend-dashboard/src/pages/PmsHubPage.tsx` — Add "Statutory Reports" view option
- `frontend-dashboard/src/components/layout/DashboardLayout.tsx` — Notification bell (if adding)

## 6. Requirement Coverage Map

| Requirement | Plan | Implementation |
|-------------|------|---------------|
| REPORT-01 (S52 generation) | 30-01 | Report model + S52 Jinja2 template + WeasyPrint/docxtpl in Celery |
| REPORT-02 (S72 generation) | 30-01 | S72 template + same generation pipeline |
| REPORT-03 (S46 generation) | 30-02 | S46 template + completeness check |
| REPORT-04 (S121 generation) | 30-02 | S121 template + completeness check |
| REPORT-05 (approval workflow) | 30-01 | ReportWorkflow state machine (5 stages) |
| REPORT-06 (data snapshot) | 30-01 | StatutoryReportSnapshot at mm_approved |
| REPORT-07 (deadline tracking) | 30-03 | StatutoryDeadline + escalating Celery notifications |
| REPORT-08 (branded export) | 30-01/02 | Logo/header in templates, draft watermark CSS |
| REPORT-09 (auto-task creation) | 30-03 | Celery beat 30-day-before task creation |

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| WeasyPrint system dependency (GTK/Pango) | Build/deploy complexity | Document install steps; consider alternative (xhtml2pdf) if too heavy |
| docxtpl template complexity | Template files hard to version control | Store in repo, test generation in unit tests with sample data |
| Large JSON snapshots | DB bloat over time | Compress with zlib; consider archival policy |
| Municipality logo not stored | Reports missing branding | Add `logo_url` to Municipality model or use Supabase Storage convention |
| Deadline computation edge cases | Missed/wrong notifications | Use dateutil for date math; comprehensive unit tests for FY boundary cases |

## RESEARCH COMPLETE
