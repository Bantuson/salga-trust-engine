---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-03-01T12:30:08.384Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 12
  completed_plans: 11
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-02-28T22:09:33.023Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 10
  completed_plans: 8
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-02-28T19:06:34.318Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: active
last_updated: "2026-02-28T21:49:00Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 21
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Citizens report a problem and the municipality visibly responds — now connected end-to-end from citizen complaint to Council statutory report.
**Current focus:** v2.0 — Phase 28: IDP SDBIP Core Performance Monitoring

## Current Position

Phase: 28 of 32 (IDP SDBIP Core Performance Monitoring)
Plan: 7 of 7 in current phase (28-07 paused at checkpoint Task 3/4)
Status: Active — 28-07 tasks 1-2 complete, awaiting visual verification (Task 3)
Last activity: 2026-03-01 — 28-07 tasks 1a/1b/2 complete (7 PMS frontend pages, TrafficLightBadge, golden thread API with KPI selectinload, sidebar PMS navigation, 7 App.tsx routes)

Progress: [██████░░░░] 71%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v2.0)
- Average duration: ~35 min/plan
- Total execution time: ~3.1 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 27-rbac-foundation-tenant-configuration | 3/3 plans done (excl. 27-03) | ~90 min | ~30 min |
| 28-idp-sdbip-core-performance-monitoring | 5/7 plans done | ~150 min | ~30 min |

*Updated after each plan completion*
| Phase 28 P06 | 12 | 2 tasks | 8 files |
| Phase 29 P01 | 13 | 6 tasks | 8 files |

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
- Redis JWT blacklist: fail-open (outage logs warning, allows request) — fail-closed would lock out users on Redis unavailability
- Tier 1 approval required for executive_mayor, municipal_manager, cfo, speaker only — admin and salga_admin bypass (assigned directly)
- assign_role does NOT auto-blacklist tokens (caller's responsibility for Tier 2-4 assignments)
- DB-coupled integration tests use set_tenant_context()/clear_tenant_context() with try/finally to satisfy RLS tenant filter
- [Phase 27-03]: CSS variables over Tailwind for all dashboard frontend components — no Tailwind config exists in frontend-dashboard; use inline styles with design-tokens.css variables and @shared/components
- [Phase 27-03]: require_pms_ready() factory pattern for PMS endpoint gating — returns 403 + structured PMS_NOT_READY checklist dict when municipality configuration incomplete

From Phase 28 execution (Plan 28-01):
- SDBIPKpi forward relationship NOT declared on IDPObjective in Wave 1 — SQLAlchemy raises InvalidRequestError at startup; Plan 28-04 adds relationship after SDBIPKpi model exists
- IDPWorkflow uses start_value parameter (python-statemachine 3.0.0) for model binding to non-initial states — critical for transition_cycle when cycle.status != "draft"
- IDP tests use real SQLite db_session + set_tenant_context/clear_tenant_context pattern — mocks insufficient for selectinload golden thread tests
- idp_versions uniqueness via DB UniqueConstraint + service-layer IntegrityError catch (409 Conflict)

From Phase 28 execution (Plan 28-02):
- MscoaReference uses NonTenantModel (no tenant_id) — mSCOA v5.5 codes are National Treasury reference data shared globally; do_orm_execute event listener skips filtering when hasattr(class, 'tenant_id') is False
- QuarterlyTargetBulkCreate enforces all 4 quarters at once (min_length/max_length=4 + model_validator) — preventing partial quarterly target sets that corrupt reporting
- Quarterly target upsert: DELETE + INSERT (not ON CONFLICT) for SQLite compatibility in unit tests
- mSCOA code and IDP objective FK validation at service layer (SELECT then 422) rather than DB FK violation (opaque 500 in SQLite)
- mscoa-codes endpoint has no PMS readiness gate — reference data accessible to Tier 3+ users before PMS configuration is complete

From Phase 28 execution (Plan 28-03):
- resubmit event (revised->approved) requires same Mayor role gate as submit — governance consistency: re-approval requires executive sign-off
- OperationType.UPDATE used for mid-year adjustment audit log — avoids introducing new audit operation types in this plan
- ID capture before commit: save UUID to local variable before any service call that commits; SQLAlchemy expires all ORM objects after commit, including primary key access triggers MissingGreenlet in async context
- SDBIPWorkflow uses start_value= model binding (same pattern as IDPWorkflow from 28-01) — critical for non-initial states

From Phase 28 execution (Plan 28-04):
- TrafficLight thresholds: green >= 80%, amber 50-79%, red < 50% — matches MFMA Section 52/72 reporting standards
- Division by zero (target=0) returns (Decimal('0'), 'red') — graceful degradation, not exception; enables KPIs with zero targets to still record actuals
- Correction chain: new SDBIPActual with corrects_actual_id FK (not soft-delete) — full audit trail; original validated record never modified
- Immutability at API layer (not DB constraint) — PUT/PATCH return 422 when is_validated=True; DB stays mutable for PMS officer validation in 28-05
- SDBIPActual.actuals relationship on SDBIPKpi uses explicit foreign_keys=[SDBIPActual.kpi_id] — avoids SQLAlchemy ambiguity with self-referencing corrects_actual_id FK
- Correction reason stored in source_query_ref field — reuses existing column rather than adding new reason column (correction context already logged)
- [Phase 28]: SEC-05 filter is_sensitive==False applied at query level not rule level — cannot be disabled per-rule, enforced unconditionally in AutoPopulationEngine
- [Phase 28]: Raw SQL text() for tenant_id discovery bypasses ORM do_orm_execute event — required for cross-tenant iteration without pre-existing context
- [Phase 28]: Idempotency via pre-check SELECT before INSERT (not UPSERT) — SQLite compatible for unit tests

From Phase 28 execution (Plan 28-05):
- pyclamd over python-clamd: python-clamd 0.0.2.dev0 fails on Windows Python 3.12 (ImportError: sendfds); pyclamd 0.4.0 works with ClamdNetworkSocket.scan_stream()
- pyclamd module-level import pattern: inline imports cannot be patched via unittest.mock.patch at module path; must be at module level with try/except ImportError fallback
- pyclamd.scan_stream() returns None (clean) or {'stream': ('FOUND', 'name')} — differs from clamd.instream() plan reference; adapted accordingly
- EvidenceDocument no cascade delete from SDBIPActual: evidence is permanent audit trail
- validate_actual() requires PMS_OFFICER, ADMIN, or SALGA_ADMIN — admin/salga_admin bypass for platform management
- [Phase 29]: PAWorkflow assessed state marked final=True — python-statemachine 3.0.0 requires all non-final states have outgoing transitions
- [Phase 29]: PA signing role gate: MM signs section57_director PAs, ExecMayor signs municipal_manager PA; admin/salga_admin bypass both

### Pending Todos

- Obtain National Treasury mSCOA v5.5 Excel file before Phase 28 planning (product owner action)
- Obtain official Section 52/72/46/121 report templates from treasury.gov.za before Phase 30 planning
- Verify Supabase Pro bucket count limits at 257-municipality scale before Phase 28 implementation
- Validate ClamAV Docker sidecar configuration on Render/Fly.io before Phase 28 implementation

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-01
Stopped at: Phase 28 Plan 28-07 paused at Task 3 checkpoint (human-verify). Tasks 1a, 1b, 2 complete. Frontend pages built, golden thread API updated with KPI selectinload, sidebar navigation updated with PMS section. Awaiting visual verification of PMS pages in browser.
Resume file: None
