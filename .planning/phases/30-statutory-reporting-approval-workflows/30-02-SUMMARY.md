---
phase: 30-statutory-reporting-approval-workflows
plan: 30-02
subsystem: templates, api, reporting
tags: [section-46, section-121, completeness-validation, jinja2, pa-summaries]

# Dependency graph
requires:
  - phase: 30-statutory-reporting-approval-workflows
    plan: 30-01
    provides: StatutoryReport model, ReportWorkflow, assemble_report_data base

provides:
  - Section 46 Annual Performance Report Jinja2 HTML template (full-year SDBIP + PA data)
  - Section 121 Annual Report Jinja2 HTML template (IDP alignment, chapter structure, PA data)
  - validate_report_completeness method (SDBIP scorecard, KPIs, actuals per quarter)
  - S46/S121 data assembly in assemble_report_data (quarterly_summary, pa_summaries, red_kpis, idp_objectives)
  - Snapshot extension for PA and IDP data at mm_approved
  - 39 unit tests passing (9 new for completeness + assembly)

affects:
  - 30-04 (frontend uses statutory-reports API with completeness validation)

# Tech tracking
tech-stack:
  patterns:
    - validate_report_completeness: type-specific checks (S52 quarters, S46 full year, S121 IDP)
    - _build_annual_departments: pivots KPIs with q1-q4 actuals for S46/S121 tables
    - _build_quarterly_summary: aggregates traffic-light stats per quarter
    - _query_live_pa_summaries: PA annual scores with rating classification
    - _query_live_idp_data: IDP cycle with selectinload chain for objectives + sdbip_kpis

key-files:
  created:
    - src/templates/statutory/section_46.html
    - src/templates/statutory/section_121.html
  modified:
    - src/services/statutory_report_service.py (completeness validation + S46/S121 assembly + bugfixes)
    - src/tasks/report_generation_task.py (S46/S121 routing verified)
    - tests/test_statutory_reports.py (9 new tests)
    - src/api/v1/pa.py (PA query adjustments)

key-decisions:
  - "UUID/string mismatch fix: Municipality.id comparison uses UUID(report.tenant_id) for SQLite compatibility"
  - "MissingGreenlet fix: eagerly load IDPObjective.sdbip_kpis via selectinload chain in _query_live_idp_data"
  - "PA rating classification: >= 80% Exceeds, 50-79% Meets, < 50% Below Expectations"

requirements-completed: [REPORT-03, REPORT-04, REPORT-08]

# Metrics
duration: ~15min (across sessions with bugfix)
completed: 2026-03-01
---

# Phase 30 Plan 02: Section 46/121 Templates, Completeness Validation Summary

**Section 46 and Section 121 Jinja2 HTML templates with completeness validation and S46/S121 data assembly**

## Performance

- **Tasks:** 2 (templates + completeness validation/assembly/tests)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Section 46 Annual Performance Report template: full-year quarterly breakdown, PA summaries, recommendations, logo
- Section 121 Annual Report template: 6-chapter structure, IDP alignment, PA data, TOC, page numbers
- validate_report_completeness: type-specific checks (SDBIP scorecard, KPIs, actuals, PA, IDP warnings)
- Generate endpoint returns 422 with missing_items when data incomplete
- assemble_report_data extended for S46 (quarterly_summary, pa_summaries, red_kpis) and S121 (idp_objectives, vision/mission)
- Snapshot captures PA and IDP data for S46/S121 at mm_approved
- Fixed UUID/string mismatch in Municipality query for SQLite
- Fixed MissingGreenlet by eagerly loading IDPObjective.sdbip_kpis
- 39 unit tests all passing

## Task Commits

1. **Task 1: S46/S121 HTML templates** - `e77c211` (feat)
2. **Task 2: Completeness validation, data assembly, tests, bugfixes** - `dab4e8c` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. UUID/string mismatch in Municipality.id comparison**
- SQLite cannot auto-cast string tenant_id to UUID for Municipality.id comparison
- Fix: wrap report.tenant_id in UUID() constructor with try/except fallback

**2. MissingGreenlet on IDPObjective.sdbip_kpis access**
- _query_live_idp_data loaded goals and objectives but not sdbip_kpis relationship
- Fix: added .selectinload(IDPObjective.sdbip_kpis) to selectinload chain

## Issues Encountered

None after bugfixes applied.

---
*Phase: 30-statutory-reporting-approval-workflows*
*Completed: 2026-03-01*
