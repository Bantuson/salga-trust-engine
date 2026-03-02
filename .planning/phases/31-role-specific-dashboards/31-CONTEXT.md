# Phase 31: Role-Specific Dashboards - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Each of the 12 senior municipal roles gets a role-appropriate dashboard view surfacing the PMS data most relevant to their mandate. CFO sees budget execution and SDBIP summaries; Municipal Manager sees all-department overview; Executive Mayor sees organizational scorecard with SDBIP approval; Audit/MPAC/Internal Auditor get oversight views; SALGA Admin sees cross-municipality benchmarking; Section 56 Directors see department-scoped KPIs. All assembled from data created in Phases 28-30.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Architecture
- Separate page per role (CFODashboardPage.tsx, MunicipalManagerDashboardPage.tsx, etc.) — not a shared page with role-filtered widgets
- Replace '/' route per role — CFO lands on CFO dashboard, Mayor on Mayor dashboard. Router checks active role and renders the matching dashboard page
- Roles without a custom dashboard (field_worker, citizen, saps_liaison, etc.) keep the current DashboardPage as their '/' view
- Multi-role users switch dashboards via the existing RoleSwitcher dropdown — switching role swaps the dashboard page rendered at '/'
- Static data load + manual refresh button — PMS data changes infrequently, no Supabase Realtime subscriptions needed

### API Layer
- Role-specific backend API endpoints (e.g., /api/v1/dashboard/cfo, /api/v1/dashboard/municipal-manager, /api/v1/dashboard/mayor)
- Strict role enforcement — each endpoint checks the user's role via require_role() and returns 403 for unauthorized callers
- Server-side de-identification NOT needed for SALGA Admin — they are the national oversight body and see actual municipality names. De-identification applies only to public-facing views (frontend-public)
- Each endpoint returns pre-composed dashboard data so frontend pages are simple renderers

### Widget Composition
- MetricsCards style (dense KPI cards with large numbers, sparkline trends, traffic-light badges) — consistent with AnalyticsPage pattern
- Consistent traffic light thresholds across all roles: green >= 80%, amber 50-79%, red < 50% — same as existing TrafficLightBadge
- Actual vs target comparisons on each metric (e.g., "Revenue: R12.4M / R15M target (82.7%)")
- Click KPI card or metric navigates to the relevant detail page (SDBIP KPI page, PMS Hub filtered view) — drill-down via navigation, not inline expansion

### CFO Financial Views
- Budget execution: table with progress bars (Vote name | Budget | Spent | % | progress bar) — not charts
- Variance alerts: threshold-based banner alerts at top of CFO dashboard (triggered when spend exceeds pace threshold, e.g., >80% budget before 80% of year elapsed)
- Service delivery correlation: side-by-side columns table (KPI Name | KPI Achievement | Related Tickets Resolved | Resolution Rate)
- Statutory reporting calendar: sorted deadline list (Date | Report Type | Status: due/overdue/submitted) — not a calendar grid

### Executive Mayor Dashboard
- SDBIP approval: inline button with confirmation dialog on the SDBIP summary card. Click "Approve SDBIP" shows confirmation dialog with summary + optional comment field. Approve creates audit_logs entry

### Municipal Manager Dashboard
- All-department performance overview with drill-down — click department or KPI navigates to SDBIP detail page filtered to that department

### Oversight Role Scoping
- Audit Committee: all performance reports + full audit trail, read-only. Broadest oversight view
- Internal Auditor: KPI verification workqueue (KPIs needing verification with status: unverified/verified/insufficient). Click KPI row expands to show uploaded evidence files with metadata. "Verified" / "Insufficient" action buttons per evidence item
- MPAC: reports list as main area + flagged investigations sidebar showing their flagged items with status (pending/acknowledged/resolved). Flag button on each report row opens small form (reason dropdown + notes text)
- All three oversight roles are read-only by default. Internal Auditor can verify/reject POE. MPAC can flag investigations. Audit Committee is pure read-only

### Section 56 Director Dashboard
- Auto-filter by assigned department (from user profile department_id) — no department picker needed
- View-only dashboard + PMS Hub for edits — dashboard links to PMS Hub pages for KPI editing, evidence upload, actuals update
- Top summary: KPI counts by traffic light ("12 Green | 5 Amber | 2 Red") with total achievement percentage. Below: KPI detail table

### SALGA Admin Cross-Municipality Benchmarking
- Combined view: both PMS KPI achievement aggregations AND service delivery metrics (ticket resolution, SLA compliance)
- Ranked table with actual municipality names (SALGA Admin is national oversight — they see real names, de-identification is for public views only)
- Click municipality row to see summary of that municipality's KPI performance and service delivery metrics (read-only)
- CSV export button for benchmarking data — consistent with existing exportTicketsCSV pattern

### Empty / Loading States
- Empty state: guided setup prompt with actionable message (e.g., "No SDBIP data available. Create your first SDBIP scorecard to see KPI performance here.") + button linking to PMS Hub
- Loading state: Skeleton placeholders (shimmer effect in dashboard layout shape) — uses existing @shared Skeleton component, consistent with DashboardPage and AnalyticsPage

### Audit Trail
- All dashboard actions (SDBIP approval, investigation flags, POE verification) create entries in the existing audit_logs table with action_type like 'sdbip_approved', 'investigation_flagged', 'poe_verified'
- No separate approval_actions table needed

### Claude's Discretion
- Exact layout/spacing of each role dashboard page
- Specific sparkline implementation for MetricsCards
- Error state handling and retry logic
- Backend query optimization for role-specific aggregations
- Mobile responsive layout breakpoints for dashboard pages

</decisions>

<specifics>
## Specific Ideas

- CFO budget table should feel like a financial report: Vote name, Budget amount, Spent amount, percentage, progress bar per row
- MPAC investigation flags should have a dropdown for reason type (performance concern, policy violation, procurement irregularity, other)
- SALGA Admin benchmarking should show both PMS achievement and service delivery so SALGA can correlate governance with on-the-ground delivery

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RoleSwitcher` (components/rbac/RoleSwitcher.tsx): Already handles multi-role switching via dropdown. Dashboard routing should respond to role changes
- `useRoleBasedNav` (hooks/useRoleBasedNav.ts): Returns role-specific nav items. All 18 roles defined. Needs update to route '/' to role-specific dashboard pages
- `TrafficLightBadge` (components/pms/TrafficLightBadge.tsx): green/amber/red badge with 80/50 thresholds. Reuse for all KPI displays
- `MetricsCards` (components/dashboard/MetricsCards.tsx): KPI card grid with metrics display. Pattern to follow for role dashboard metric cards
- `Skeleton` (@shared/components/ui/Skeleton): Shimmer loading placeholders. Already used in DashboardPage and AnalyticsPage
- `GlassCard` (@shared/components/ui/GlassCard): Card container component. Can use for dashboard sections
- `KPICard` (components/analytics/KPICard.tsx): Stripe-style KPI card with sparklines. Reuse for role dashboard metrics
- `exportTicketsCSV` (services/api.ts): CSV export pattern to follow for SALGA Admin benchmarking export

### Established Patterns
- PmsHubPage dropdown selector pattern for switching between PMS views
- `useAuth` hook provides `getUserRole()` and `getTenantId()` — used for role checks and tenant scoping
- `require_role()` dependency factory in backend (src/api/deps.py) — use for strict role enforcement on new endpoints
- CSS variables from @shared/design-tokens.css — all colors, spacing, typography via CSS vars
- Inline styles (React.CSSProperties) pattern used throughout dashboard pages — follow this, not CSS modules
- DashboardService pattern (src/services/dashboard_service.py) for aggregation queries

### Integration Points
- Router (App.tsx or router config): '/' route needs conditional rendering based on user role
- useRoleBasedNav: May need to update dashboard link behavior per role
- Backend: New route modules under src/api/v1/ (e.g., role_dashboards.py) registered in main.py router
- Existing SDBIP, Performance Agreement, Statutory Reports data models and services — role endpoints compose queries from these

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-role-specific-dashboards*
*Context gathered: 2026-03-02*
