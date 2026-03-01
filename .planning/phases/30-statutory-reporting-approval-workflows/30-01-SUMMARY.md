---
phase: 30-statutory-reporting-approval-workflows
plan: 30-01
subsystem: database, api, reporting
tags: [statutory-reporting, mfma, section-52, section-72, weasyprint, docxtpl, jinja2, statemachine, celery, pdf]

# Dependency graph
requires:
  - phase: 29-individual-performance-agreements
    provides: PerformanceAgreement model with annual_score for Section 46/121 PA summaries
  - phase: 28-idp-sdbip-core-performance-monitoring
    provides: SDBIPKpi, SDBIPActual, SDBIPQuarterlyTarget models for KPI data assembly in reports

provides:
  - StatutoryReport model with 5-stage ReportWorkflow state machine (REPORT-05)
  - StatutoryReportSnapshot model for data snapshotting at mm_approved (REPORT-06)
  - Notification model for in-app deadline/status notifications
  - Municipality.logo_url field for branded PDF exports (REPORT-08)
  - StatutoryReportService: create, transition (role-gated), snapshot, assemble_report_data
  - REST API: /api/v1/statutory-reports (CRUD + transitions + generate + download)
  - REST API: /api/v1/notifications (list, unread-count, mark-read)
  - Celery task: generate_statutory_report (WeasyPrint PDF + docxtpl DOCX)
  - Jinja2 HTML templates: section_52.html, section_72.html (AG-compliant format)
  - 30 unit tests all passing

affects:
  - 30-02 (Section 46/121 templates built on same service + state machine)
  - 30-03 (deadline monitor Celery task uses Notification model)
  - 30-04 (frontend PMS hub uses statutory-reports API and notifications API)

# Tech tracking
tech-stack:
  added:
    - weasyprint>=62.0 (PDF generation from HTML)
    - docxtpl>=0.18.0 (DOCX generation from .docx templates)
    - jinja2>=3.1.0 (HTML template rendering; already installed via FastAPI, now explicit)
  patterns:
    - ReportWorkflow state machine: same start_value binding pattern as SDBIPWorkflow/PAWorkflow
    - Data snapshot at mm_approved: StatutoryReportSnapshot.snapshot_data JSON blob
    - assemble_report_data: renders from snapshot (status >= mm_approved) or live SDBIP data
    - Role-gate dict (_TRANSITION_ROLES): maps event name -> set of permitted UserRole values
    - Notification model: user-scoped in-app notifications with is_read + read_at fields

key-files:
  created:
    - src/models/statutory_report.py
    - src/models/notification.py
    - src/schemas/statutory_report.py
    - src/schemas/notification.py
    - src/services/statutory_report_service.py
    - src/api/v1/statutory_reports.py
    - src/api/v1/notifications.py
    - src/tasks/report_generation_task.py
    - src/templates/statutory/section_52.html
    - src/templates/statutory/section_72.html
    - tests/test_statutory_reports.py
  modified:
    - pyproject.toml (added weasyprint, docxtpl, jinja2)
    - src/models/__init__.py (StatutoryReport, Notification, ReportType, ReportStatus, ReportWorkflow registered)
    - src/models/municipality.py (logo_url field added for REPORT-08)
    - src/tasks/celery_app.py (report_generation_task added to include list)
    - src/main.py (statutory_reports and notifications routers registered)

key-decisions:
  - "ReportWorkflow tabled state marked final=True — python-statemachine 3.0.0 requires all non-final states have outgoing transitions; tabled is permanent"
  - "Data snapshot serialised as JSON string in Text column — avoids JSONB dependency for SQLite unit test compatibility"
  - "Municipality.logo_url added as String(500) nullable — not a foreign key to Supabase storage, stores URL directly for REPORT-08 template rendering"
  - "_TRANSITION_ROLES dict in service (not database) — static governance rules, DB lookup adds latency for no benefit (same pattern as TIER_ORDER in deps.py)"
  - "DOCX generation graceful degradation — if .docx template missing, log and skip (do not fail the task); WeasyPrint PDF is the primary deliverable"
  - "assemble_report_data uses snapshot for status >= mm_approved to implement REPORT-06 auditability; pre-approval renders from live SDBIP queries"
  - "Period computation via _compute_period() helper: South African FY = July–June; Q3/Q4 use next_year for Jan–Jun dates"

patterns-established:
  - "Report generation task: asyncio.run() + WindowsSelectorEventLoopPolicy + raw SQL for tenant discovery (same pattern as pa_notify_task)"
  - "Snapshot at state transition: _snapshot_report_data called inside transition_report before commit when event == 'approve'"
  - "Role gate dict pattern: _TRANSITION_ROLES maps event -> set of UserRole values; compared against user.role string value"

requirements-completed: [REPORT-01, REPORT-02, REPORT-05, REPORT-06, REPORT-08]

# Metrics
duration: 13min
completed: 2026-03-01
---

# Phase 30 Plan 01: Statutory Report Models, Approval State Machine, Report Generation Service, and Section 52/72 Templates Summary

**StatutoryReport ORM model with 5-stage ReportWorkflow state machine, data snapshot at mm_approved, WeasyPrint PDF + docxtpl DOCX generation via Celery, and AG-compliant Section 52/72 Jinja2 HTML templates**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-01T19:26:36Z
- **Completed:** 2026-03-01T19:40:29Z
- **Tasks:** 3 (Task 1, Task 2a, Task 2b)
- **Files modified:** 15 (11 created, 4 modified)

## Accomplishments

- StatutoryReport model with ReportWorkflow (5 states: drafting/internal_review/mm_approved/submitted/tabled; 4 transitions) and UniqueConstraint on (report_type, financial_year, quarter, tenant_id)
- StatutoryReportSnapshot model for REPORT-06: data snapshotted at mm_approved, subsequent exports render from snapshot not live data
- Notification model for in-app deadline/status/approval notifications with user-scoped filtering
- StatutoryReportService with role-gated transitions (5 distinct allowed-role sets), SDBIP KPI data assembly, and municipality branding (logo_url) for REPORT-08
- REST API: 7 endpoints (/statutory-reports) + 3 endpoints (/notifications)
- Celery task routes all 4 report types (S52, S72, S46, S121) to correct template paths with WeasyPrint PDF and docxtpl DOCX; graceful degradation if DOCX template missing
- Section 52/72 Jinja2 HTML templates: AG-compliant with KPI table (11 mandatory columns), logo, executive summary, sign-off, and DRAFT watermark
- 30 unit tests all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: StatutoryReport, Notification models, ReportWorkflow state machine, schemas** - `c51744d` (feat)
2. **Task 2a: Service, API routes, Celery task, main.py wiring** - `2450ecb` (feat)
3. **Task 2b: Section 52/72 templates and 30 unit tests** - `6ac9cf0` (feat)

## Files Created/Modified

- `src/models/statutory_report.py` - StatutoryReport, StatutoryReportSnapshot, ReportType, ReportStatus, ReportWorkflow
- `src/models/notification.py` - Notification model with NotificationType enum
- `src/schemas/statutory_report.py` - StatutoryReportCreate, Response, TransitionRequest, SnapshotResponse
- `src/schemas/notification.py` - NotificationResponse, NotificationMarkRead
- `src/services/statutory_report_service.py` - StatutoryReportService with create, transition, snapshot, assemble
- `src/api/v1/statutory_reports.py` - 7 REST endpoints for statutory report management
- `src/api/v1/notifications.py` - 3 REST endpoints for in-app notifications
- `src/tasks/report_generation_task.py` - Celery task: WeasyPrint PDF + docxtpl DOCX generation
- `src/templates/statutory/section_52.html` - Jinja2 HTML template for Section 52 quarterly reports
- `src/templates/statutory/section_72.html` - Jinja2 HTML template for Section 72 mid-year assessment
- `tests/test_statutory_reports.py` - 30 unit tests covering all critical paths
- `pyproject.toml` - weasyprint, docxtpl, jinja2 dependencies added
- `src/models/__init__.py` - New models registered
- `src/models/municipality.py` - logo_url field added (REPORT-08)
- `src/tasks/celery_app.py` - report_generation_task in include list
- `src/main.py` - Phase 30 routers registered

## Decisions Made

- ReportWorkflow `tabled` state marked `final=True` — python-statemachine 3.0.0 requires all non-final states have outgoing transitions; tabled is a permanent terminal state
- Data snapshot as JSON string in Text column — avoids JSONB type for SQLite unit test compatibility (same pattern as existing codebase)
- `_TRANSITION_ROLES` dict in service layer (not database) — static governance rules, same reasoning as `TIER_ORDER` in deps.py
- DOCX generation uses graceful degradation — if `.docx` template file is missing, log info and skip; WeasyPrint PDF is the primary deliverable
- `assemble_report_data` renders from snapshot for status >= mm_approved to implement REPORT-06 auditability guarantee
- Period computation via `_compute_period()` helper function — July-June financial year, Q3/Q4 use next_year (2026 dates for 2025/26 FY)
- Municipality.logo_url stored as URL string (String(500) nullable) — direct URL, not Supabase storage FK, for simplicity in MVP

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed invalid SDBIPKpi.financial_year reference in _snapshot_report_data**
- **Found during:** Task 2a (service implementation verification)
- **Issue:** The _snapshot_report_data query used `SDBIPKpi.financial_year` in a WHERE clause, but SDBIPKpi does not have a financial_year column (SDBIPActual does)
- **Fix:** Removed the invalid filter from the query; financial_year filtering is applied when iterating actuals
- **Files modified:** src/services/statutory_report_service.py
- **Verification:** `python -c "from src.services.statutory_report_service import StatutoryReportService; print('OK')"` passes
- **Committed in:** 2450ecb (Task 2a commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered

None - all tasks completed successfully on first attempt.

## User Setup Required

None - no external service configuration required. WeasyPrint and docxtpl will be installed when `pip install -e ".[dev]"` is run (added to pyproject.toml dependencies).

## Next Phase Readiness

- Plan 30-01 complete: StatutoryReport model, 5-stage workflow, service, API, Celery task, Section 52/72 templates
- Plan 30-02 can proceed: Section 46 and Section 121 HTML templates + frontend plan
- The `src/templates/statutory/section_46.html` and `section_121.html` templates need to be created in 30-02
- The Celery task will raise FileNotFoundError with a clear message if Section 46/121 generation is triggered before templates exist

---
*Phase: 30-statutory-reporting-approval-workflows*
*Completed: 2026-03-01*
