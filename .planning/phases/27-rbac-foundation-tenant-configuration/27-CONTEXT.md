# Phase 27: RBAC Foundation & Tenant Configuration - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the current 6-role flat RBAC system to a unified 4-tier hierarchy with 14 new municipal roles. Configure per-municipality department structures with director assignments. Gate all PMS features behind a readiness checklist. Make ticket management department-aware by mapping ticket categories to departments.

This phase delivers the role and organizational foundation that all subsequent PMS phases (28-32) depend on.

</domain>

<decisions>
## Implementation Decisions

### Role Hierarchy Design
- Strict 4-tier hierarchy — senior tiers inherit ALL permissions from lower tiers, regardless of department
- Unified hierarchy merging v1 and new PMS roles into a single model:
  - **Tier 1 (Executive):** executive_mayor, municipal_manager, cfo, speaker, admin, salga_admin
  - **Tier 2 (Directors):** section56_director, ward_councillor
  - **Tier 3 (Operational):** department_manager, pms_officer, audit_committee_member, internal_auditor, mpac_member, saps_liaison, manager
  - **Tier 4 (Frontline):** field_worker, citizen
- Multiple roles per user allowed — highest tier wins for permission checks
- SAPS liaisons sit under the Community Safety department; keep `saps_liaison` as the system role name (display name can differ in UI)

### Department Configuration UX
- Guided wizard flow for initial setup: (1) Municipality settings → (2) Create departments → (3) Assign directors → (4) Map ticket categories → (5) Review organogram
- Every department must have a director assigned (Section 56 or above) to be considered valid
- Visual tree diagram for organogram with expandable/collapsible nodes
- Municipality settings (category, province, demarcation code, SDBIP layers, scoring method) locked after initial setup — admin must explicitly "unlock" with confirmation to edit
- Teams nest inside departments (preserves v1 team structure, adds department layer above)

### Ticket-to-Department Mapping
- Admin maps ticket categories to departments during wizard setup (also available from standalone settings page)
- One department per category (1:1 mapping) — simple routing
- Unmapped ticket categories default to admin inbox for manual routing
- Tickets become department-scoped: directors see their department's tickets, managers/field workers belong to a department

### Financial Year & Municipality Settings
- Financial year hardcoded to July 1 - June 30 (MFMA standard) — not configurable
- Quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
- SDBIP layers and scoring method configured in Phase 27 wizard (ready for Phase 28)
- Municipality category (A/B/C) is informational metadata only — no functional differences based on category

### PMS Readiness Gate
- Full checklist required: municipality settings configured + all departments have assigned directors + at least 1 PMS officer role assigned
- Blocked users see the readiness checklist with green/red progress indicators showing exactly what's missing
- Enforced at both API level (403 with checklist payload) and frontend level (PMS nav hidden/disabled)
- Once PMS is active, destructive config changes are blocked (can't delete departments or unassign directors) — admin must explicitly deactivate PMS first

### Role Change Workflow
- Tier 2-4 role changes take effect immediately
- Tier 1 promotions (Executive Mayor, MM, CFO, Speaker) require SALGA admin approval as second step
- Pending Tier 1 promotions: user keeps old role until SALGA approves (no provisional access)
- SALGA admin gets in-app notification; request expires after 7 days if not actioned
- SALGA admin must provide a reason on rejection (visible to requesting admin)
- Force-logout via Redis on any role change — no stale permissions window
- Tenant admin is the sole role manager per municipality; SALGA admin is view-only for role management (except Tier 1 approval)
- Standard audit fields: actor, timestamp, target user, previous role(s), new role(s), IP address

### Multi-role JWT Structure
- JWT carries only the highest-tier role in app_metadata (fast auth checks)
- Full role list stored in database, queried when needed
- Role switcher appears on login for multi-role users: "You have N roles. View as: [Role A] | [Role B]"
- In-app role switcher accessible from navbar anytime (no re-login needed) — switches dashboard view context
- Role switcher hidden for single-role users (cleaner nav)

### Claude's Discretion
- Exact Supabase custom access token hook implementation for tier resolution
- Redis session invalidation mechanism details
- Organogram tree component library choice
- Wizard step validation UX (inline vs step-level errors)
- Department code format and auto-generation
- Role switcher component design and animation

</decisions>

<specifics>
## Specific Ideas

- Wizard flow should prevent incomplete municipality setup — each step validates before proceeding
- Organogram should feel interactive (expand/collapse nodes) not static
- Role switcher in navbar should be subtle for multi-role users, not take up too much space
- Ticket category mapping step in wizard should show existing v1 categories and let admin drag/assign to departments
- SALGA admin approval for Tier 1 is an oversight mechanism — treats the platform as an accountability tool

</specifics>

<deferred>
## Deferred Ideas

- Department-based ticket routing automation (auto-assign based on category → department → available team) — could enhance Phase 4 ticket management
- Role-based dashboard customization (different widgets per role) — Phase 31 handles role-specific dashboards
- Department performance comparison views — Phase 32 transparency features
- Email notifications for SALGA admin (Tier 1 approvals) — future notification system enhancement

</deferred>

---

*Phase: 27-rbac-foundation-tenant-configuration*
*Context gathered: 2026-02-28*
