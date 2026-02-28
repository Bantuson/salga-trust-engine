---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: active
last_updated: "2026-02-28T12:00:00Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 21
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Citizens report a problem and the municipality visibly responds — now connected end-to-end from citizen complaint to Council statutory report.
**Current focus:** v2.0 — Phase 27: RBAC Foundation & Tenant Configuration

## Current Position

Phase: 27 of 32 (RBAC Foundation & Tenant Configuration)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-02-28 — v2.0 roadmap created (6 phases, 21 plans, 60 requirements)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: TBD
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

From v1.0 (carried forward):
- Supabase Auth with custom claims hook — extend for 14 new PMS roles (RBAC-01); atomic deployment required
- TenantAwareModel base class — all 13 new PMS models must inherit it for automatic RLS + audit
- Celery + Redis beat — reused for auto-population engine and statutory deadline notifications
- Per-municipality Supabase Storage buckets — `salga-evidence-{municipality_id}` for POE uploads

From research:
- python-statemachine 3.0.0 for approval workflows (all three: SDBIP, PA, statutory reports)
- WeasyPrint 68.1 (PDF) + docxtpl 0.20.2 (DOCX) for statutory report generation in Celery workers
- clamav-client against ClamAV Docker sidecar on port 3310 for evidence virus scanning
- Auto-population SEC-05 extension: `AND is_sensitive = FALSE` on every aggregation query

### Pending Todos

- Obtain National Treasury mSCOA v5.5 Excel file before Phase 28 planning (product owner action)
- Obtain official Section 52/72/46/121 report templates from treasury.gov.za before Phase 30 planning
- Verify Supabase Pro bucket count limits at 257-municipality scale before Phase 28 implementation
- Validate ClamAV Docker sidecar configuration on Render/Fly.io before Phase 28 implementation

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-28
Stopped at: Roadmap created — all 6 phases written, 60 requirements mapped, STATE.md initialized
Resume file: None
