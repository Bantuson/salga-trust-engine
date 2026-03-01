---
phase: 30-statutory-reporting-approval-workflows
plan: 30-03
subsystem: database, celery, notifications
tags: [statutory-deadlines, celery-beat, notifications, escalation, auto-task, report-09, report-07]

# Dependency graph
requires:
  - phase: 30-statutory-reporting-approval-workflows
    plan: 30-01
    provides: StatutoryReport model, Notification model

provides:
  - StatutoryDeadline model with notification flags and auto-task tracking
  - DeadlineService: compute_deadlines, populate_deadlines, check_and_notify, auto_create_report_tasks
  - Celery beat task: check_statutory_deadlines (daily 07:00 SAST)
  - Deadline API endpoints: GET /deadlines, POST /deadlines/populate
  - Escalating email notifications via SMTP (graceful degradation)
  - 19 unit tests passing

affects:
  - 30-04 (frontend deadline calendar widget uses deadline API)

# Tech tracking
tech-stack:
  patterns:
    - compute_deadlines: 7 deadline dates from financial_year string, zero hardcoded literals
    - notification flags: boolean columns prevent duplicate sends per window (30d/14d/7d/3d/overdue)
    - auto-task creation: StatutoryReport in DRAFTING status 30 days before deadline
    - _send_deadline_email: SMTP with graceful degradation (try/except, log on failure)
    - Celery beat: crontab(minute=0, hour=7) daily task

key-files:
  created:
    - src/services/deadline_service.py
    - src/tasks/statutory_deadline_task.py
    - tests/test_statutory_deadlines.py
  modified:
    - src/models/statutory_report.py (StatutoryDeadline model added)
    - src/schemas/statutory_report.py (deadline response schemas)
    - src/api/v1/statutory_reports.py (deadline endpoints)
    - src/tasks/celery_app.py (beat schedule + include)
    - src/models/__init__.py (StatutoryDeadline registered)

key-decisions:
  - "Email send wrapped in try/except — failures never block notification creation (graceful degradation)"
  - "Tenant discovery via sdbip_scorecards table — only tenants with SDBIP data need deadline tracking"
  - "_determine_current_financial_year: month >= 7 → current year, else previous year (SA July-June FY)"
  - "Auto-task idempotent: skips existing reports for same type+FY+quarter, only within 30-day window"

requirements-completed: [REPORT-07, REPORT-09]

# Metrics
duration: ~13min (across sessions with bugfix)
completed: 2026-03-01
---

# Phase 30 Plan 03: Statutory Deadline Calendar, Notifications, Auto-Task Summary

**StatutoryDeadline model, DeadlineService with FY-driven computation, escalating notifications, and auto-task creation**

## Performance

- **Tasks:** 2 (model+service+API, Celery beat+tests)
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- StatutoryDeadline model with 5 notification flag columns and auto-task tracking
- compute_deadlines generates all 7 statutory deadline dates from any FY string (no hardcoded dates)
- populate_deadlines: idempotent INSERT with UniqueConstraint protection
- check_and_notify: escalating notifications at 30/14/7/3 days before + overdue flagging
- auto_create_report_tasks: creates StatutoryReport in DRAFTING status 30 days before deadline
- Email notifications via SMTP with graceful degradation (try/except wrapping)
- Celery beat schedule: daily 07:00 SAST check_statutory_deadlines task
- GET /deadlines and POST /deadlines/populate API endpoints
- 19 unit tests all passing

## Task Commits

1. **Task 1: StatutoryDeadline model, DeadlineService, deadline API** - `17ede98` (feat)
2. **Task 2: Celery beat task, email fix, tests** - `96caeaa` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. Email send not wrapped in try/except**
- _send_deadline_email call in check_and_notify was not protected
- Fix: wrapped in try/except with logger.warning — notifications still created on email failure

## Issues Encountered

None after bugfix applied.

---
*Phase: 30-statutory-reporting-approval-workflows*
*Completed: 2026-03-01*
