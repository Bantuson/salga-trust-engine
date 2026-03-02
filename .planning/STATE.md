---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-03-02T15:16:53.181Z"
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 24
  completed_plans: 23
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-03-02T09:56:39.116Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 20
  completed_plans: 20
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-03-02T09:47:10.389Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 20
  completed_plans: 18
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-03-02T09:32:56.100Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 20
  completed_plans: 17
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Senior Municipal Roles & PMS Integration
status: unknown
last_updated: "2026-03-01T19:42:10.695Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 16
  completed_plans: 13
---

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
**Current focus:** v2.0 — Phase 32: Risk Register & Public Transparency

## Current Position

Phase: 32 of 32 (Risk Register & Public Transparency)
Plan: 1 of 2 complete
Status: Phase 32 in progress (32-01 done: risk register backend, public SDBIP endpoint)
Last activity: 2026-03-02 — 32-01 complete: risk register models, schemas, service, 7 API endpoints, Celery auto-flag task, public SDBIP performance endpoint. 13 unit tests pass.

Progress: [█░░░░░░░░░] 50% (Phase 32)

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
| Phase 29 P02 | 31 | 4 tasks | 8 files |
| Phase 30-statutory-reporting-approval-workflows P30-01 | 13 | 3 tasks | 15 files |
| Phase 30 P30-04 | 3 | 2 tasks | 3 files |
| Phase 31 P31-01 | 36 | 3 tasks | 6 files |
| Phase 31 P1 | 36 | 3 tasks | 6 files |
| Phase 31 P02 | 9 | 3 tasks | 10 files |
| Phase 31 P03 | 5 | 2 tasks | 2 files |
| Phase 31 P4 | 5 | 2 tasks | 3 files |
| Phase 31 P06 | 11 | 2 tasks | 3 files |
| Phase 31 P05 | 11 | 2 tasks | 7 files |
| Phase 32 P01 | 24 | 2 tasks | 12 files |
| Phase 32 P1 | 24 | 2 tasks | 12 files |

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

From Phase 29 execution (Plan 29-02):
- assess-guard: assess transition requires at least one PAQuarterlyScore — enforced at service layer via JOIN query before state machine dispatch
- compile-on-assess: compile_annual_score() called within transition_agreement before state machine dispatch; agreement re-fetched after compile commit to avoid MissingGreenlet
- partial-compilation: KPIs with no scores excluded from weighted average — only KPIs with scores contribute to weight_sum denominator; enables partial scoring without division by zero
- pa-notify-phase30: PA evaluator notification task logs only — actual email/in-app delivery built in Phase 30 notification infrastructure
- sqlite-timezone: DateTime columns in SQLite strip tzinfo; assertions on scored_at timezone must use PostgreSQL integration tests, not unit tests
- [Phase 30-01]: ReportWorkflow tabled state marked final=True; data snapshot as JSON string in Text column for SQLite compatibility; _TRANSITION_ROLES dict in service layer (not DB) for static governance; DOCX generation graceful degradation; assemble_report_data renders from snapshot for status >= mm_approved (REPORT-06)
- [Phase 30]: Notification bell placed in fixed top header bar (48px) — DashboardLayout previously had no header; added glassmorphism header matching sidebar aesthetic
- [Phase 30]: Download uses fetch-then-blob pattern with auth header — direct href cannot include Authorization header for protected downloads
- [Phase 31]: RBAC 403 tests use app.dependency_overrides[get_current_user] to inject mock users - avoids JWT+DB lookup 500 errors in SQLite unit tests
- [Phase 31]: Councillor endpoint uses WARD_COUNCILLOR + CHIEF_WHIP — UserRole.COUNCILLOR does not exist in the enum
- [Phase 31]: RoleDashboardService uses raw SQL text() for SALGA Admin cross-tenant sdbip_scorecards query - same Phase 28 pattern
- [Phase 31]: [Phase 31-02]: ViewRoleContext lifts viewRole state above ReactNode children boundary — DashboardLayout local state removed, context provider wraps authenticated routes in App.tsx
- [Phase 31]: [Phase 31-02]: Confirmation dialog for SDBIP approval is inline modal (state-driven overlay) — no React portal, no external dialog library
- [Phase 31]: role-config-map (ROLE_CONFIG) selects API function and title per role — eliminates per-role if/else in data fetching
- [Phase 31]: [Phase 31-03]: MPAC Flag Investigation uses inline expandable row form (not modal) — avoids React portal complexity per plan spec
- [Phase 31]: [Phase 31-03]: Internal Auditor optimistic update with rollback on error — immediate feedback while confirming with refetch
- [Phase 31]: CSV export uses fetch-blob with Authorization header for authenticated downloads
- [Phase 31]: Section 56 Director empty state replaces normal content entirely — not a banner
- [Phase 31]: KPI detail table sorted ascending by achievement_pct to surface worst-performing KPIs first
- [Phase 31]: READ_ONLY_ROLES explicit allowlist in PmsHubPage — clearer intent than checking absence from ADMIN_ROLES
- [Phase 31]: Statutory Reports nav item links directly to /pms?view=statutory-reports — deeplink into PMS Hub for oversight roles and ward councillor
- [Phase 31]: Placeholder pages as inline functions in App.tsx — small enough to not warrant separate files; municipalities and system pages show realistic mock data
- [Phase 31]: catch block sets mock data instead of error string for all role dashboards
- [Phase 32]: Auto-flag fail-open: Celery dispatch failure on Redis down does not break actuals submission
- [Phase 32]: Critical risk items never overwritten by auto-flag — governance invariant for RISK-03
- [Phase 32]: Public SDBIP endpoint uses raw SQL text() for cross-tenant aggregation — same pattern as SALGA Admin dashboards

### Pending Todos

- Obtain National Treasury mSCOA v5.5 Excel file before Phase 28 planning (product owner action)
- Obtain official Section 52/72/46/121 report templates from treasury.gov.za before Phase 30 planning
- Verify Supabase Pro bucket count limits at 257-municipality scale before Phase 28 implementation
- Validate ClamAV Docker sidecar configuration on Render/Fly.io before Phase 28 implementation

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 32-01-PLAN.md — risk register backend (RiskItem, RiskMitigation models, RiskService, 7 API endpoints, flag_risk_items_for_kpi Celery task, auto-flag dispatch in sdbip.py, public SDBIP achievement endpoint). 13 unit tests pass. RISK-01 through RISK-04 requirements marked complete.
Resume file: None
