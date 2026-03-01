# Phase 30: Statutory Reporting & Approval Workflows — Verification

## Phase Goal
The system auto-generates Section 52/72/46/121 statutory reports from live PMS data, routes them through a multi-step approval chain, and tracks every statutory deadline with escalating notifications.

## Requirement Coverage

| Requirement | Plan(s) | Verification |
|-------------|---------|-------------|
| REPORT-01: S52 auto-generation | 30-01 | `POST /api/v1/statutory-reports/{id}/generate` for section_52 report triggers Celery PDF/DOCX generation |
| REPORT-02: S72 auto-generation | 30-01 | Same endpoint for section_72; Jinja2 template renders H1 data |
| REPORT-03: S46 auto-generation | 30-02 | section_46 template with full-year data + PA summaries |
| REPORT-04: S121 auto-generation | 30-02 | section_121 template with IDP alignment + chapter structure |
| REPORT-05: Approval workflow | 30-01, 30-04 | 5-stage state machine (drafting->tabled) + UI buttons |
| REPORT-06: Data snapshot | 30-01 | StatutoryReportSnapshot created at mm_approved transition |
| REPORT-07: Deadline tracking + notifications | 30-03, 30-04 | Celery beat daily task + escalating notifications + deadline calendar UI |
| REPORT-08: Branded PDF/DOCX export | 30-01, 30-02 | Templates with municipality name, mandatory columns, draft watermark |
| REPORT-09: Auto-task creation | 30-03 | DeadlineService auto-creates StatutoryReport 30 days before deadline |

## Success Criteria Checklist

- [ ] `python -m pytest tests/test_statutory_reports.py tests/test_statutory_deadlines.py -x -v` — all tests pass
- [ ] `python -c "from src.models.statutory_report import StatutoryReport, StatutoryReportSnapshot, StatutoryDeadline, ReportWorkflow; print('OK')"` succeeds
- [ ] `python -c "from src.models.notification import Notification; print('OK')"` succeeds
- [ ] `python -c "from src.tasks.report_generation_task import generate_statutory_report; print('OK')"` succeeds
- [ ] `python -c "from src.tasks.statutory_deadline_task import check_statutory_deadlines; print('OK')"` succeeds
- [ ] `ls src/templates/statutory/section_52.html src/templates/statutory/section_72.html src/templates/statutory/section_46.html src/templates/statutory/section_121.html` — all 4 templates exist
- [ ] `cd frontend-dashboard && npx tsc --noEmit --pretty` — TypeScript compiles with no errors
- [ ] `grep -c 'statutory-reports' frontend-dashboard/src/pages/PmsHubPage.tsx` returns >= 2
- [ ] `grep -c 'notification' frontend-dashboard/src/components/layout/DashboardLayout.tsx` returns >= 3

## Wave Execution Order

```
Wave 1: 30-01 (models, service, API, S52/S72 templates, Celery task, tests)
Wave 2: 30-02 (S46/S121 templates, completeness validation) + 30-03 (deadlines, notifications, auto-tasks) [parallel]
Wave 3: 30-04 (frontend page, PMS Hub integration, notification bell)
```
