---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: active
last_updated: "2026-02-28T16:10:27Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 21
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Citizens report a problem and the municipality visibly responds — now connected end-to-end from citizen complaint to Council statutory report.
**Current focus:** v2.0 — Phase 27: RBAC Foundation & Tenant Configuration

## Current Position

Phase: 27 of 32 (RBAC Foundation & Tenant Configuration)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-28 — Completed Plan 27-02 (Department CRUD API, organogram, municipality PMS settings)

Progress: [░░░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (v2.0)
- Average duration: ~15 min/plan
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 27-rbac-foundation-tenant-configuration | 2/3 | ~30 min | ~15 min |

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

From Phase 27 execution (Plans 27-01, 27-02):
- Department soft-delete (is_active=False) instead of hard delete — preserves historical KPI/SDBIP linkage for Phase 28+
- municipality_router as second APIRouter in departments.py module — no extra file needed
- Settings lock enforced at API layer (403 when locked) with explicit unlock confirmation body
- Organogram built from flat list in Python (not recursive CTE SQL) — SQLite-compatible for unit tests
- TIER_ORDER dict in deps.py (not database) — roles are static, DB lookup adds latency for no benefit
- 18-role 4-tier hierarchy: Tier 1 Executive (6 roles), Tier 2 Director (3), Tier 3 Operational (7), Tier 4 Frontline (2)

### Pending Todos

- Obtain National Treasury mSCOA v5.5 Excel file before Phase 28 planning (product owner action)
- Obtain official Section 52/72/46/121 report templates from treasury.gov.za before Phase 30 planning
- Verify Supabase Pro bucket count limits at 257-municipality scale before Phase 28 implementation
- Validate ClamAV Docker sidecar configuration on Render/Fly.io before Phase 28 implementation

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 27-02-PLAN.md — Department CRUD API, organogram, municipality PMS settings committed (2b33881)
Resume file: None
