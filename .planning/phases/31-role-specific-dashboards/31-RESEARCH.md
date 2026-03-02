# Phase 31: Role-Specific Dashboards - Research

**Researched:** 2026-03-02
**Domain:** Role-based React dashboard pages + FastAPI role-scoped aggregation endpoints
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard Architecture**
- Separate page per role (CFODashboardPage.tsx, MunicipalManagerDashboardPage.tsx, etc.) — not a shared page with role-filtered widgets
- Replace '/' route per role — CFO lands on CFO dashboard, Mayor on Mayor dashboard. Router checks active role and renders the matching dashboard page
- Roles without a custom dashboard (field_worker, citizen, saps_liaison, etc.) keep the current DashboardPage as their '/' view
- Multi-role users switch dashboards via the existing RoleSwitcher dropdown — switching role swaps the dashboard page rendered at '/'
- Static data load + manual refresh button — PMS data changes infrequently, no Supabase Realtime subscriptions needed

**API Layer**
- Role-specific backend API endpoints (e.g., /api/v1/dashboard/cfo, /api/v1/dashboard/municipal-manager, /api/v1/dashboard/mayor)
- Strict role enforcement — each endpoint checks the user's role via require_role() and returns 403 for unauthorized callers
- Server-side de-identification NOT needed for SALGA Admin — they see actual municipality names. De-identification applies only to public-facing views (frontend-public)
- Each endpoint returns pre-composed dashboard data so frontend pages are simple renderers

**Widget Composition**
- MetricsCards style (dense KPI cards with large numbers, sparkline trends, traffic-light badges) — consistent with AnalyticsPage pattern
- Consistent traffic light thresholds across all roles: green >= 80%, amber 50-79%, red < 50% — same as existing TrafficLightBadge
- Actual vs target comparisons on each metric (e.g., "Revenue: R12.4M / R15M target (82.7%)")
- Click KPI card or metric navigates to the relevant detail page (SDBIP KPI page, PMS Hub filtered view) — drill-down via navigation, not inline expansion

**CFO Financial Views**
- Budget execution: table with progress bars (Vote name | Budget | Spent | % | progress bar) — not charts
- Variance alerts: threshold-based banner alerts at top of CFO dashboard (triggered when spend exceeds pace threshold, e.g., >80% budget before 80% of year elapsed)
- Service delivery correlation: side-by-side columns table (KPI Name | KPI Achievement | Related Tickets Resolved | Resolution Rate)
- Statutory reporting calendar: sorted deadline list (Date | Report Type | Status: due/overdue/submitted) — not a calendar grid

**Executive Mayor Dashboard**
- SDBIP approval: inline button with confirmation dialog on the SDBIP summary card. Click "Approve SDBIP" shows confirmation dialog with summary + optional comment field. Approve creates audit_logs entry

**Municipal Manager Dashboard**
- All-department performance overview with drill-down — click department or KPI navigates to SDBIP detail page filtered to that department

**Oversight Role Scoping**
- Audit Committee: all performance reports + full audit trail, read-only. Broadest oversight view
- Internal Auditor: KPI verification workqueue (KPIs needing verification with status: unverified/verified/insufficient). Click KPI row expands to show uploaded evidence files with metadata. "Verified" / "Insufficient" action buttons per evidence item
- MPAC: reports list as main area + flagged investigations sidebar showing their flagged items with status (pending/acknowledged/resolved). Flag button on each report row opens small form (reason dropdown + notes text)
- All three oversight roles are read-only by default. Internal Auditor can verify/reject POE. MPAC can flag investigations. Audit Committee is pure read-only

**Section 56 Director Dashboard**
- Auto-filter by assigned department (from user profile department_id) — no department picker needed
- View-only dashboard + PMS Hub for edits — dashboard links to PMS Hub pages for KPI editing, evidence upload, actuals update
- Top summary: KPI counts by traffic light ("12 Green | 5 Amber | 2 Red") with total achievement percentage. Below: KPI detail table

**SALGA Admin Cross-Municipality Benchmarking**
- Combined view: both PMS KPI achievement aggregations AND service delivery metrics (ticket resolution, SLA compliance)
- Ranked table with actual municipality names (SALGA Admin is national oversight — they see real names, de-identification is for public views only)
- Click municipality row to see summary of that municipality's KPI performance and service delivery metrics (read-only)
- CSV export button for benchmarking data — consistent with existing exportTicketsCSV pattern

**Empty / Loading States**
- Empty state: guided setup prompt with actionable message (e.g., "No SDBIP data available. Create your first SDBIP scorecard to see KPI performance here.") + button linking to PMS Hub
- Loading state: Skeleton placeholders (shimmer effect in dashboard layout shape) — uses existing @shared Skeleton component, consistent with DashboardPage and AnalyticsPage

**Audit Trail**
- All dashboard actions (SDBIP approval, investigation flags, POE verification) create entries in the existing audit_logs table with action_type like 'sdbip_approved', 'investigation_flagged', 'poe_verified'
- No separate approval_actions table needed

### Claude's Discretion
- Exact layout/spacing of each role dashboard page
- Specific sparkline implementation for MetricsCards
- Error state handling and retry logic
- Backend query optimization for role-specific aggregations
- Mobile responsive layout breakpoints for dashboard pages

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | CFO can view budget execution dashboard (expenditure vs budget per vote, revenue collection rate, variance alerts) | Backend: `/api/v1/dashboard/cfo` endpoint; SDBIPScorecard + SDBIPActual + mSCOA code data; budget vote = mSCOA segment aggregation; variance threshold logic in service layer |
| DASH-02 | CFO can view SDBIP achievement summary with traffic-light status across all KPIs | TrafficLightBadge reuse; SDBIPActual.traffic_light enum; aggregate by traffic_light status across all KPI actuals for the current financial year |
| DASH-03 | CFO can view service delivery correlation linking ticket resolution rates to SDBIP KPIs | Join SDBIPKpi + SDBIPActual + Ticket via auto-population rule FK; DashboardService.get_metrics pattern for resolution rate computation (SEC-05: is_sensitive=False) |
| DASH-04 | CFO can view statutory reporting calendar with upcoming deadlines and current status | StatutoryDeadline + StatutoryReport models; existing DeadlineService.populate_deadlines(); reuse urgencyColor logic from StatutoryReportsPage |
| DASH-05 | Municipal Manager can view all-department performance overview with drill-down to individual KPIs | `/api/v1/dashboard/municipal-manager` endpoint; group SDBIPKpi by department_id; department name from Department model; click navigates to /pms/sdbip/{scorecardId}/kpis |
| DASH-06 | Executive Mayor can view organizational scorecard and approve SDBIP via dashboard | `/api/v1/dashboard/mayor` endpoint; SDBIP state machine (SDBIPWorkflow.submit event); require_role(executive_mayor, admin, salga_admin); audit_logs entry on approval action |
| DASH-07 | Councillor can view quarterly reports and SDBIP dashboard (read-only) | Ward councillor already in TIER_ORDER at Tier 2; existing StatutoryReportsPage pattern; read-only variant of SDBIP KPI list filtered to public-safe KPIs |
| DASH-08 | Audit Committee member can review all performance reports and access audit trail | `/api/v1/dashboard/audit-committee` endpoint; AuditLog model queries; StatutoryReport list (all tenants = no — scoped to their municipality); AuditLog.table_name filter for PMS tables |
| DASH-09 | Internal Auditor can verify evidence/POE for any KPI across departments | Existing EvidenceService; EvidenceDocument model; POE verification creates AuditLog with action 'poe_verified'; verification state tracked per evidence item (no new model — use audit_logs) |
| DASH-10 | MPAC member can view performance reports and request performance investigations | InvestigationFlag concept stored in audit_logs with action_type='investigation_flagged' + JSON changes field for reason/notes; no new DB table per locked decision |
| DASH-11 | SALGA Admin can view cross-municipality benchmarking and manage system configuration | `/api/v1/dashboard/salga-admin` endpoint; cross-tenant query bypassing RLS (raw SQL text() pattern used in AutoPopulationEngine); Municipality model (NonTenantModel); CSV export via existing exportTicketsCSV pattern |
| DASH-12 | Section 56 Director can view own department's SDBIP performance and manage departmental KPIs | `/api/v1/dashboard/section56-director` endpoint; filter by user.department_id (needs to be on User model or looked up via role_assignment); SDBIPKpi filtered to department_id |
</phase_requirements>

---

## Summary

Phase 31 assembles 12 role-specific dashboard pages using data produced in Phases 28–30. The work divides cleanly into two layers: (1) FastAPI aggregation endpoints in a new `role_dashboards.py` module that compose data from existing SDBIP, statutory report, evidence, and ticket models, and (2) React page components for each role that call their endpoint and render the composed response with existing UI primitives.

The architecture is a "thin frontend, fat backend" pattern: each role endpoint does the heavy aggregation (joining SDBIPKpi + SDBIPActual + Department + Ticket) and returns a pre-composed JSON shape. Frontend pages are simple renderers of that shape — no additional data fetching in components. This is already established by DashboardService and StatutoryReportService.

The primary technical challenges are: (a) SALGA Admin cross-tenant queries (which require bypassing the per-tenant RLS filter using the `text()`/raw SQL pattern established in Phase 28), (b) routing changes so the `'/'` route renders the correct role dashboard without breaking existing roles, and (c) the Executive Mayor SDBIP approval action, which must call the existing SDBIP state machine (`SDBIPWorkflow.submit`) and write an audit log.

**Primary recommendation:** Add one new `role_dashboards.py` API module (8–10 endpoints), update `RoleBasedDashboard` in App.tsx to route all 12 PMS roles, and build 6 role dashboard page files (CFO, Manager, Mayor, Oversight group, SALGA Admin, Section56 Director). No new database models are needed.

---

## Standard Stack

### Core (all already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | project version | Backend API router and dependency injection | Already in use |
| SQLAlchemy 2.0 (async) | project version | ORM queries for aggregation service | Already in use; `select()`, `func.count()`, `group_by()` |
| React + Vite | project version | Frontend page components | Already in use |
| React Router v6 | project version | Conditional '/' route based on role | Already in use in App.tsx |
| `@shared/components/ui/` | project version | GlassCard, Skeleton, Button, Input, Select | Already in use across all pages |

### Supporting (existing project components)

| Component | Path | Purpose | When to Use |
|-----------|------|---------|-------------|
| `TrafficLightBadge` | `components/pms/TrafficLightBadge.tsx` | KPI status badges (green/amber/red) | Every role dashboard that shows KPI status |
| `KPICard` | `components/analytics/KPICard.tsx` | Stripe-style stat card with sparkline | Top metrics row on each dashboard |
| `MetricsCards` | `components/dashboard/MetricsCards.tsx` | Pattern to follow for metric card grids | Reference for grid layout |
| `SparkLine` | `components/analytics/SparkLine.tsx` | SVG sparkline for KPICard | When trend data is available |
| `Skeleton` / `SkeletonTheme` | `@shared/components/ui/Skeleton` | Loading placeholders | All async data loads |
| `GlassCard` | `@shared/components/ui/GlassCard` | Card container | Dashboard sections |
| `Button` | `@shared/components/ui/Button` | Actions (refresh, approve, flag, export) | Interactive elements |
| `exportTicketsCSV` pattern | `services/api.ts` | CSV download via fetch-blob | SALGA Admin benchmarking export |
| `require_role()` | `src/api/deps.py` | Strict role enforcement on endpoints | All new role dashboard endpoints |
| `require_pms_ready()` | `src/services/pms_readiness.py` | PMS configuration gate | All new PMS dashboard endpoints |
| `DashboardService` | `src/services/dashboard_service.py` | Ticket metrics aggregation pattern | Service layer pattern reference |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pre-composed backend endpoint per role | Shared generic endpoint with role filter param | Generic endpoint leaks data if role param is spoofed; per-role enforced at dependency injection level is safer |
| Separate page files per role | Single page with conditional sections | Separate files are cleaner to maintain and test independently; matches existing field_worker / saps_liaison pattern in App.tsx |
| audit_logs for investigation flags | New InvestigationFlag table | audit_logs already exists, supports JSON in `changes` field; no migration needed per locked decision |

**Installation:**
```bash
# No new packages required — all dependencies are already present
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/api/v1/
└── role_dashboards.py            # New module: 8–10 role-specific endpoints

src/services/
└── role_dashboard_service.py     # New service: aggregation queries per role

frontend-dashboard/src/pages/
├── CFODashboardPage.tsx           # DASH-01, DASH-02, DASH-03, DASH-04
├── MunicipalManagerDashboardPage.tsx  # DASH-05
├── MayorDashboardPage.tsx         # DASH-06
├── OversightDashboardPage.tsx     # DASH-07, DASH-08, DASH-09, DASH-10 (role-branched)
├── SALGAAdminDashboardPage.tsx    # DASH-11
└── Section56DirectorDashboardPage.tsx # DASH-12
```

### Pattern 1: Role-Gated API Endpoint

Each endpoint uses `require_role()` as a dependency-level guard, then a role-specific service method to compose the data. This is the pattern established in `src/api/v1/dashboard.py` and `src/api/v1/statutory_reports.py`.

```python
# Source: src/api/v1/dashboard.py + src/api/deps.py
@router.get("/cfo")
async def get_cfo_dashboard(
    current_user: User = Depends(require_role(UserRole.CFO, UserRole.ADMIN, UserRole.SALGA_ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = RoleDashboardService()
    return await service.get_cfo_dashboard(current_user.tenant_id, db)
```

### Pattern 2: RoleBasedDashboard Router Extension

The existing `RoleBasedDashboard` component in `App.tsx` already handles `field_worker` and `saps_liaison`. Phase 31 extends it with all 12 PMS roles:

```typescript
// Source: frontend-dashboard/src/App.tsx (existing pattern, to be extended)
function RoleBasedDashboard() {
  const { getUserRole } = useAuth();
  const role = getUserRole();

  if (role === 'field_worker') return <FieldWorkerTicketsPage />;
  if (role === 'saps_liaison') return <SAPSReportsPage />;

  // Phase 31 additions:
  if (role === 'cfo') return <CFODashboardPage />;
  if (role === 'municipal_manager') return <MunicipalManagerDashboardPage />;
  if (role === 'executive_mayor') return <MayorDashboardPage />;
  if (role === 'audit_committee_member') return <OversightDashboardPage role="audit_committee" />;
  if (role === 'internal_auditor') return <OversightDashboardPage role="internal_auditor" />;
  if (role === 'mpac_member') return <OversightDashboardPage role="mpac" />;
  if (role === 'ward_councillor') return <OversightDashboardPage role="councillor" />;
  if (role === 'salga_admin') return <SALGAAdminDashboardPage />;
  if (role === 'section56_director') return <Section56DirectorDashboardPage />;

  return <DashboardPage />; // fallback for admin, manager, pms_officer, etc.
}
```

### Pattern 3: Cross-Tenant SALGA Admin Query

SALGA Admin benchmarking requires querying across all municipalities. The pattern established in Phase 28 (`AutoPopulationEngine`) uses raw SQL `text()` to bypass the per-tenant RLS filter. This is the only safe cross-tenant query path.

```python
# Source: src/services/pms_auto_populate.py (established pattern)
# Raw SQL bypasses ORM do_orm_execute event listener that enforces tenant_id filter
result = await db.execute(
    text("SELECT DISTINCT tenant_id FROM sdbip_scorecards WHERE is_deleted = false")
)
tenant_ids = [row[0] for row in result.fetchall()]
```

For SALGA Admin, the query joins `municipalities` (NonTenantModel, no RLS) with aggregated data from `sdbip_kpis` + `sdbip_actuals`. Approach: query each municipality's aggregation separately using `set_tenant_context()` / `clear_tenant_context()` in a loop, then assemble the benchmarking list. This is the same pattern used in the auto-population engine.

### Pattern 4: Audit Log for Dashboard Actions

All dashboard actions (SDBIP approve, POE verify, investigation flag) create `AuditLog` entries. The pattern is established throughout the codebase — direct ORM insert (not SQLAlchemy event listener) for action-level events:

```python
# Source: pattern from src/services/sdbip_service.py (scorecard transitions)
audit = AuditLog(
    tenant_id=str(current_user.tenant_id),
    user_id=str(current_user.id),
    operation=OperationType.UPDATE,
    table_name="sdbip_scorecards",
    record_id=str(scorecard_id),
    changes=json.dumps({"action": "sdbip_approved", "comment": comment}),
)
db.add(audit)
await db.commit()
```

### Pattern 5: Section 56 Director Department Scoping

The `User` model does not have a `department_id` column. Director-to-department linkage is on `Department.assigned_director_id`. The Section 56 Director dashboard must resolve their department by querying `Department` where `assigned_director_id = current_user.id`.

```python
# Lookup director's department
result = await db.execute(
    select(Department).where(
        Department.assigned_director_id == current_user.id,
        Department.tenant_id == current_user.tenant_id,
        Department.is_active == True,
    )
)
dept = result.scalar_one_or_none()
if dept is None:
    return {"error": "no_department_assigned", ...}
```

### Pattern 6: CFO Budget Execution Data

Budget execution data in v2.0 does not come from a real financial system (ERP integration is deferred to v2.1, per REQUIREMENTS.md Out of Scope). The "budget execution" table for the CFO dashboard should aggregate from:
- **Budget (target)**: `SDBIPKpi` has no direct budget column, but each KPI links to an `mscoa_code` (budget classification). The actual budget amount is not stored in the PMS DB — it must be sourced from the mSCOA reference or shown as the KPI annual target as a proxy.
- **Actuals spent**: `SDBIPActual.actual_value` represents the most recent quarterly actual per KPI.

**Critical Finding (MEDIUM confidence):** The CFO "budget execution (expenditure vs budget per vote)" cannot be literally fulfilled from the current data model because actual expenditure amounts are not in the PMS database (they live in the municipality's financial system). The practical implementation: show KPI achievement (actual vs target) grouped by mSCOA budget vote/segment as a proxy for budget execution. The CONTEXT.md describes "Vote name | Budget | Spent | % | progress bar" — Budget = KPI annual target, Spent = latest actual_value, Pct = achievement_percent. This is a PMS performance proxy for budget execution, not real financial data. The planner should be aware of this limitation.

### Anti-Patterns to Avoid

- **Cross-tenant query without raw SQL bypass:** Never use ORM queries that cross tenant boundaries — the `do_orm_execute` event listener will filter them. Use `text()` for SALGA Admin queries.
- **Role check inside service, not endpoint:** Role enforcement must happen at the FastAPI dependency layer (`require_role()`), not inside the service method, so it shows up in API docs and is guaranteed to run before any data is accessed.
- **Shared generic `/dashboard` endpoint with role param:** Never accept `?role=cfo` as a query param and return different data based on it — this is bypassable. Separate endpoints enforced by `require_role()` are the only secure pattern.
- **Fetching full KPI list in frontend:** Each role dashboard must receive pre-aggregated data from the backend. Do not fetch all KPIs in the frontend and filter client-side — for SALGA Admin and Municipal Manager, this would return thousands of records.
- **Using `useRoleBasedNav` to gate dashboard content:** `useRoleBasedNav` controls sidebar nav items, not dashboard content. Content is gated by the role check in `RoleBasedDashboard`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role enforcement on endpoints | Custom decorator or middleware check | `require_role()` from `src/api/deps.py` | Already implemented, tested, and integrates with FastAPI dependency injection |
| Traffic light status computation | Re-implement green/amber/red logic | `TrafficLightBadge` component + `compute_achievement()` from `src/models/sdbip.py` | Thresholds are locked (80/50) and already tested |
| CSV file download with auth header | Custom download link | fetch-then-blob pattern from `StatutoryReportsPage.handleDownload()` | Direct `<a href>` cannot include Authorization header; fetch-blob is the established pattern |
| Skeleton loading states | Custom shimmer animation | `Skeleton` + `SkeletonTheme` from `@shared/components/ui/Skeleton` | Already matches the design system; used in DashboardPage and AnalyticsPage |
| PMS readiness gate | Re-check PMS config inline | `require_pms_ready()` from `src/services/pms_readiness.py` | Returns structured 403 error with checklist; already tested |
| SDBIP state machine transitions | Direct DB update of status field | `SDBIPWorkflow` state machine with `start_value=` binding | Enforces valid transition sequences; bypassing breaks audit trail |
| Audit log entries | Custom action logging table | `AuditLog` model with `OperationType.UPDATE` | Per locked decision: no separate approval_actions table; audit_logs is the single source |

**Key insight:** Every significant utility (role enforcement, data aggregation patterns, state machines, traffic light computation, loading states, CSV download) already exists in the codebase. Phase 31 is composition, not construction.

---

## Common Pitfalls

### Pitfall 1: SALGA Admin Sees Zero Data Due to Tenant Filter

**What goes wrong:** SALGA Admin endpoint queries `SDBIPScorecard` using the ORM, but the `do_orm_execute` event listener filters by `tenant_id = current_user.tenant_id`. Since SALGA Admin's tenant_id may not match the municipalities being queried, the result is empty.

**Why it happens:** The tenant isolation filter (`do_orm_execute` in `src/core/database.py`) runs on every ORM `SELECT`. SALGA Admin needs cross-tenant data.

**How to avoid:** Use raw SQL `text()` for the initial municipality list (as in AutoPopulationEngine), then use `set_tenant_context()` / `clear_tenant_context()` in a try/finally loop per municipality for ORM queries within that tenant's scope.

**Warning signs:** SALGA Admin endpoint returns an empty list when municipalities exist with data.

### Pitfall 2: Section 56 Director Has No `department_id` on User Model

**What goes wrong:** Code tries to access `current_user.department_id` — field does not exist on the `User` model.

**Why it happens:** Department-director assignment is on `Department.assigned_director_id`, not `User.department_id`. The User model only has `municipality_id` and `ward_id`.

**How to avoid:** Always look up the director's department with `SELECT * FROM departments WHERE assigned_director_id = user.id AND tenant_id = user.tenant_id AND is_active = true`. Handle `None` result with an empty-state response.

**Warning signs:** `AttributeError: 'User' object has no attribute 'department_id'`

### Pitfall 3: SDBIP Approval on Mayor Dashboard Uses Wrong State Machine Binding

**What goes wrong:** Mayor clicks "Approve SDBIP" — endpoint creates `SDBIPWorkflow(model=scorecard)` without `start_value=` and the scorecard is in `approved` or `revised` state instead of `draft`. The state machine initializes to `draft` and the transition fails or produces the wrong state.

**Why it happens:** `python-statemachine 3.0.0` requires `start_value=scorecard.status` when binding to a model that is NOT in the initial state. This was a hard-won lesson from Phase 28.

**How to avoid:** Always pass `start_value=scorecard.status` when constructing `SDBIPWorkflow`:
```python
machine = SDBIPWorkflow(model=scorecard, state_field="status", start_value=scorecard.status)
machine.send("submit")
```

**Warning signs:** `TransitionNotAllowed` exceptions even when the scorecard appears to be in a valid state for the transition.

### Pitfall 4: CFO Budget Execution — Confusing KPI Achievement with Actual Expenditure

**What goes wrong:** Planner/implementer builds a "budget execution" view assuming the DB contains actual financial expenditure amounts. They search for an `expenditure` or `budget_spent` column and find none.

**Why it happens:** ERP/financial system integration is deferred to v2.1. The PMS only stores KPI targets and actuals, not financial expenditure amounts.

**How to avoid:** The CFO budget execution table uses `SDBIPKpi.annual_target` as "Budget" and `SDBIPActual.actual_value` as "Spent" — both are KPI measurement units, not Rand amounts. Column headers should clarify this (e.g., "Target" and "Actual" rather than "Budget" and "Spent" in Rands). Add a note in the UI: "Performance proxy — financial figures from municipal ERP."

**Warning signs:** Frontend shows "R0" or "N/A" for budget amounts.

### Pitfall 5: `'/'` Route Change Breaks Existing Roles

**What goes wrong:** Extending `RoleBasedDashboard` to handle 12 PMS roles adds new branches, but the logic is wrong for multi-role users (RoleSwitcher sets `viewRole` in `DashboardLayout`, but `RoleBasedDashboard` calls `getUserRole()` which always returns the JWT primary role, not the switched view role).

**Why it happens:** `DashboardLayout` has its own `viewRole` state managed by `RoleSwitcher`, but `RoleBasedDashboard` reads from `useAuth().getUserRole()` (the JWT role), not from the layout's `viewRole` state. These are disconnected.

**How to avoid:** The role-based routing in `RoleBasedDashboard` must receive the active `viewRole` as a prop (passed down from `DashboardLayout` or via context), not read it from the JWT. Inspect how `DashboardLayout` passes `userRole` to `Sidebar` to understand the existing prop-drilling pattern.

**Warning signs:** Switching role via RoleSwitcher doesn't change the dashboard page — it stays on the original role's dashboard.

### Pitfall 6: MPAC Investigation Flags — No New Table, But audit_logs Needs Structured Query

**What goes wrong:** Querying `audit_logs` for MPAC-flagged investigations is done with a simple string match on `changes` field, but the JSON is stored as a string (not JSONB in SQLite unit tests), so PostgreSQL JSON operators fail in tests.

**Why it happens:** `AuditLog.changes` is a `Text` column (not JSONB) for SQLite compatibility (established in Phase 30). JSON operators (`@>`, `->`) are PostgreSQL-only.

**How to avoid:** Filter by `table_name='investigation_flags'` (a sentinel value used for MPAC flags) and `operation=OperationType.CREATE` rather than parsing the JSON `changes` field in queries. Use application-level JSON parsing after fetching rows.

**Warning signs:** Tests fail with `OperationalError: no such function: json_extract` when using JSON operators.

---

## Code Examples

Verified patterns from existing codebase:

### Role-Specific API Endpoint (require_role pattern)

```python
# Source: src/api/deps.py + src/api/v1/dashboard.py
# Pattern: role enforcement at dependency layer, service call in handler

@router.get("/cfo")
async def get_cfo_dashboard(
    current_user: User = Depends(require_role(
        UserRole.CFO, UserRole.ADMIN, UserRole.SALGA_ADMIN
    )),
    db: AsyncSession = Depends(get_db),
) -> dict:
    service = RoleDashboardService()
    return await service.get_cfo_dashboard(
        municipality_id=current_user.tenant_id, db=db
    )
```

### Traffic Light Aggregation Query (backend service)

```python
# Source: pattern from src/services/sdbip_service.py + src/models/sdbip.py
# SDBIPActual.traffic_light is a TrafficLight enum: green/amber/red

result = await db.execute(
    select(
        SDBIPActual.traffic_light,
        func.count(SDBIPActual.id).label("count"),
    )
    .join(SDBIPKpi, SDBIPActual.kpi_id == SDBIPKpi.id)
    .join(SDBIPScorecard, SDBIPKpi.scorecard_id == SDBIPScorecard.id)
    .where(
        SDBIPScorecard.tenant_id == municipality_id,
        SDBIPScorecard.financial_year == financial_year,
        SDBIPActual.is_deleted == False,
    )
    .group_by(SDBIPActual.traffic_light)
)
counts = {row.traffic_light: row.count for row in result.fetchall()}
```

### Routing Extension in RoleBasedDashboard

```typescript
// Source: frontend-dashboard/src/App.tsx (existing component, to be extended)
// The `viewRole` must come from a prop or context, not useAuth().getUserRole()
// because RoleSwitcher in DashboardLayout manages a separate viewRole state.

function RoleBasedDashboard({ activeRole }: { activeRole: string }) {
  // Use activeRole prop (driven by RoleSwitcher) not getUserRole() (JWT only)
  if (activeRole === 'field_worker') return <FieldWorkerTicketsPage />;
  if (activeRole === 'saps_liaison') return <SAPSReportsPage />;
  if (activeRole === 'cfo') return <CFODashboardPage />;
  // ... etc.
  return <DashboardPage />;
}
```

### Fetch-Blob CSV Export (SALGA Admin)

```typescript
// Source: frontend-dashboard/src/pages/StatutoryReportsPage.tsx (handleDownload)
// Pattern for downloading auth-protected binary files

const handleExportCSV = () => {
  const url = `/api/v1/dashboard/salga-admin/export-csv`;
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `benchmarking-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    });
};
```

### Skeleton Loading State (frontend)

```typescript
// Source: frontend-dashboard/src/pages/DashboardPage.tsx
import { Skeleton, SkeletonTheme } from '@shared/components/ui/Skeleton';

{isLoading ? (
  <SkeletonTheme>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-lg)' }}>
      {[0,1,2,3].map(i => (
        <GlassCard key={i} variant="default">
          <Skeleton height={14} width="60%" style={{ marginBottom: 'var(--space-md)' }} />
          <Skeleton height={40} width="80%" />
        </GlassCard>
      ))}
    </div>
  </SkeletonTheme>
) : /* content */}
```

### Empty State with PMS Hub Link

```typescript
// Source: pattern from StatutoryReportsPage.tsx (no-data state)
// Consistent actionable empty state per locked decision

{kpis.length === 0 && (
  <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-secondary)' }}>
    <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>
      No SDBIP data available
    </p>
    <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
      Create your first SDBIP scorecard to see KPI performance here.
    </p>
    <Button variant="primary" onClick={() => navigate('/pms?view=sdbip')}>
      Go to PMS Hub
    </Button>
  </div>
)}
```

### MPAC Investigation Flag via audit_logs

```python
# Source: pattern from src/services/sdbip_service.py (audit log creation)
# No new table — use audit_logs with sentinel table_name

async def flag_investigation(
    report_id: UUID,
    reason: str,
    notes: str,
    current_user: User,
    db: AsyncSession,
) -> dict:
    audit = AuditLog(
        tenant_id=str(current_user.tenant_id),
        user_id=str(current_user.id),
        operation=OperationType.CREATE,
        table_name="investigation_flags",   # sentinel — not a real table
        record_id=str(report_id),
        changes=json.dumps({
            "action": "investigation_flagged",
            "reason": reason,
            "notes": notes,
            "report_id": str(report_id),
            "status": "pending",
        }),
    )
    db.add(audit)
    await db.commit()
    return {"flagged": True, "report_id": str(report_id)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single generic dashboard endpoint | Role-specific endpoints per Phase 31 decision | Phase 31 design | Eliminates client-side data filtering; role enforcement is server-side |
| Supabase Realtime for dashboard | Static load + manual refresh per Phase 31 decision | Phase 31 design | Simpler; appropriate for PMS data that changes infrequently |
| `python-clamd` for virus scanning | `pyclamd` | Phase 28 execution | Not relevant to Phase 31 |
| `asyncio_mode = "auto"` | Same | Phase 1 | All async tests work without explicit mark |

**Patterns from Phase 28-30 that MUST be carried forward:**
- `start_value=` in all state machine bindings (Phase 28-03)
- `text()` for cross-tenant queries (Phase 28)
- `set_tenant_context()` / `clear_tenant_context()` with try/finally (Phase 28)
- `id` capture before `await db.commit()` to avoid MissingGreenlet (Phase 28-03)
- Fetch-blob for authenticated downloads (Phase 30)

---

## Open Questions

1. **RoleBasedDashboard + RoleSwitcher viewRole disconnect**
   - What we know: `DashboardLayout` maintains a `viewRole` state driven by `RoleSwitcher`, and passes it to `Sidebar`. `RoleBasedDashboard` currently calls `useAuth().getUserRole()` (the JWT role).
   - What's unclear: Whether the `'/'` route's `RoleBasedDashboard` should receive the `viewRole` prop from `DashboardLayout` (requires prop drilling through `DashboardLayout` -> `children` interface, which is currently typed as `React.ReactNode`), or whether a React Context for `viewRole` should be introduced.
   - Recommendation: Introduce a minimal `ViewRoleContext` (or pass `activeRole` as a prop to the dashboard page) so `RoleBasedDashboard` responds to role switches. The simplest approach: move `RoleBasedDashboard` inside `DashboardLayout` where `viewRole` state is accessible, or pass the viewRole through a context.

2. **CFO Budget Execution Terminology**
   - What we know: No actual financial expenditure data exists in the PMS DB (ERP integration deferred to v2.1).
   - What's unclear: Whether the CFO will find "KPI target = Budget" and "KPI actual = Spent" acceptable as a proxy, or whether this needs a clear UI disclaimer.
   - Recommendation: Label the columns "Annual Target" and "Year-to-Date Actual" rather than "Budget" and "Spent", and add a small note: "Performance proxy — connect financial system for actual expenditure data." This fulfills DASH-01 within the constraints of available data.

3. **Internal Auditor POE Verification — Evidence State Tracking**
   - What we know: CONTEXT.md says "Verified / Insufficient action buttons per evidence item" and these create audit_logs entries. The `EvidenceDocument` model exists but has no `verification_status` column.
   - What's unclear: Whether the verification status is tracked in `EvidenceDocument.verification_status` (new column) or purely in audit_logs (no model change).
   - Recommendation: Add a `verification_status` column (`unverified` / `verified` / `insufficient`) to `EvidenceDocument` with an Alembic migration — this makes querying the Internal Auditor workqueue efficient without scanning all audit_logs. The migration is a simple `ALTER TABLE` with a default of `'unverified'`.

4. **MPAC Investigation Flag — Query Approach**
   - What we know: Flags stored in audit_logs with `table_name='investigation_flags'`. The MPAC sidebar needs to list flagged items with status.
   - What's unclear: How `status` transitions (pending → acknowledged → resolved) are tracked — whether each status change adds a new audit_log row or updates the JSON.
   - Recommendation: Each status change creates a new audit_log row (same `record_id`, different `changes.status`). The current status is determined by taking the latest row per `record_id`. This is append-only and fully auditable — consistent with the correction chain pattern from Phase 28.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `pyproject.toml` (`asyncio_mode = "auto"`) |
| Quick run command | `pytest tests/test_role_dashboards.py -x` |
| Full suite command | `pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | CFO endpoint returns budget_execution + variance_alerts | unit | `pytest tests/test_role_dashboards.py::test_cfo_dashboard_structure -x` | ❌ Wave 0 |
| DASH-02 | CFO endpoint includes SDBIP achievement summary with traffic_light counts | unit | `pytest tests/test_role_dashboards.py::test_cfo_sdbip_summary -x` | ❌ Wave 0 |
| DASH-03 | CFO endpoint includes service delivery correlation table | unit | `pytest tests/test_role_dashboards.py::test_cfo_service_correlation -x` | ❌ Wave 0 |
| DASH-04 | CFO endpoint includes statutory deadline list | unit | `pytest tests/test_role_dashboards.py::test_cfo_deadline_calendar -x` | ❌ Wave 0 |
| DASH-05 | MM endpoint returns per-department KPI overview | unit | `pytest tests/test_role_dashboards.py::test_mm_department_overview -x` | ❌ Wave 0 |
| DASH-06 | Mayor endpoint includes approve SDBIP action; creates audit log entry | unit | `pytest tests/test_role_dashboards.py::test_mayor_approve_sdbip -x` | ❌ Wave 0 |
| DASH-07 | Councillor endpoint returns read-only SDBIP KPI list + reports | unit | `pytest tests/test_role_dashboards.py::test_councillor_readonly_view -x` | ❌ Wave 0 |
| DASH-08 | Audit Committee endpoint returns all reports + audit log entries | unit | `pytest tests/test_role_dashboards.py::test_audit_committee_view -x` | ❌ Wave 0 |
| DASH-09 | Internal Auditor workqueue returns unverified evidence; verify action creates audit_log | unit | `pytest tests/test_role_dashboards.py::test_internal_auditor_poe_verify -x` | ❌ Wave 0 |
| DASH-10 | MPAC flag investigation endpoint creates audit_log with investigation_flags table_name | unit | `pytest tests/test_role_dashboards.py::test_mpac_flag_investigation -x` | ❌ Wave 0 |
| DASH-11 | SALGA Admin endpoint returns cross-municipality benchmarking list with actual names | unit | `pytest tests/test_role_dashboards.py::test_salga_admin_benchmarking -x` | ❌ Wave 0 |
| DASH-12 | Section 56 Director endpoint scoped to director's department; returns traffic_light summary | unit | `pytest tests/test_role_dashboards.py::test_section56_director_scoped -x` | ❌ Wave 0 |
| DASH-01 (RBAC) | Non-CFO role (e.g., pms_officer) on /dashboard/cfo returns 403 | unit | `pytest tests/test_role_dashboards.py::test_cfo_endpoint_403_for_pms_officer -x` | ❌ Wave 0 |
| DASH-06 (RBAC) | Non-mayor on /dashboard/mayor/approve returns 403 | unit | `pytest tests/test_role_dashboards.py::test_mayor_approve_403 -x` | ❌ Wave 0 |
| DASH-11 (RBAC) | Non-salga-admin on /dashboard/salga-admin returns 403 | unit | `pytest tests/test_role_dashboards.py::test_salga_admin_403 -x` | ❌ Wave 0 |
| DASH-12 | Director with no department assigned returns empty_state response | unit | `pytest tests/test_role_dashboards.py::test_section56_no_department -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pytest tests/test_role_dashboards.py -x`
- **Per wave merge:** `pytest tests/test_role_dashboards.py tests/test_pms_sdbip.py tests/test_statutory_reports.py -x`
- **Phase gate:** Full suite green before `/gsd:verify-work` — `pytest`

### Wave 0 Gaps

- [ ] `tests/test_role_dashboards.py` — new test file covering all 12 DASH-XX requirements with mock-based unit tests (pattern: `test_dashboard_api.py` with `make_mock_user()` + `AsyncMock` for db)
- [ ] `src/api/v1/role_dashboards.py` — new router module registered in `src/main.py`
- [ ] `src/services/role_dashboard_service.py` — new service class with aggregation methods
- [ ] Optional: Alembic migration for `EvidenceDocument.verification_status` column (if Open Question 3 resolves to adding the column)

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/api/deps.py` — `require_role()`, `require_min_tier()`, `TIER_ORDER` definitions
- Codebase: `src/api/v1/dashboard.py` — existing dashboard endpoint pattern (RBAC + service pattern)
- Codebase: `src/api/v1/statutory_reports.py` — `require_pms_ready()` + role gate pattern
- Codebase: `src/models/sdbip.py` — `SDBIPWorkflow`, `TrafficLight`, `compute_achievement()`, model structure
- Codebase: `src/models/audit_log.py` — `AuditLog`, `OperationType` — used for action audit trail
- Codebase: `src/models/department.py` — `Department.assigned_director_id` — director-department linkage
- Codebase: `src/models/municipality.py` — `Municipality` as NonTenantModel — SALGA Admin cross-tenant queries
- Codebase: `frontend-dashboard/src/App.tsx` — existing `RoleBasedDashboard` component structure
- Codebase: `frontend-dashboard/src/components/rbac/RoleSwitcher.tsx` — role switching pattern
- Codebase: `frontend-dashboard/src/components/pms/TrafficLightBadge.tsx` — badge thresholds
- Codebase: `frontend-dashboard/src/components/analytics/KPICard.tsx` — Stripe-style KPI card pattern
- Codebase: `frontend-dashboard/src/pages/StatutoryReportsPage.tsx` — fetch-blob download, table patterns, deadline urgency colors
- Codebase: `frontend-dashboard/src/pages/DashboardPage.tsx` — Skeleton loading pattern
- Codebase: `.planning/phases/31-role-specific-dashboards/31-CONTEXT.md` — all locked implementation decisions

### Secondary (MEDIUM confidence)

- Codebase: `src/services/pms_auto_populate.py` — cross-tenant `text()` query pattern (SALGA Admin benchmark approach)
- Codebase: `.planning/STATE.md` — accumulated decisions from Phases 28-30 (start_value, id capture before commit, fetch-blob, MissingGreenlet pattern)

### Tertiary (LOW confidence)

- None — all findings are from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed and in use; verified by reading existing code
- Architecture: HIGH — patterns are copied from existing working implementations in Phases 28-30
- Pitfalls: HIGH — identified from existing accumulated decisions in STATE.md and direct model inspection

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable stack; only invalidated if Phase 28-30 models are changed)
