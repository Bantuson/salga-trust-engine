---
phase: 31-role-specific-dashboards
plan: 3
subsystem: frontend-dashboard
tags: [react, typescript, oversight, pms, dashboards, councillor, audit-committee, internal-auditor, mpac]
dependency_graph:
  requires: ["31-01", "31-02"]
  provides: ["OversightDashboardPage", "oversight-api-functions"]
  affects: ["frontend-dashboard/src/pages/OversightDashboardPage.tsx", "frontend-dashboard/src/services/api.ts"]
tech_stack:
  added: []
  patterns: ["role-config-map pattern", "optimistic UI update with rollback", "inline expand/collapse form (no modal)", "collapsible KPI accordion"]
key_files:
  created: []
  modified:
    - frontend-dashboard/src/pages/OversightDashboardPage.tsx
    - frontend-dashboard/src/services/api.ts
decisions:
  - "role-config-map (ROLE_CONFIG) selects API function and title per role — eliminates per-role if/else in data fetching"
  - "MPAC Flag Investigation uses inline expandable row form (not a modal) per plan spec — avoids React portal complexity"
  - "Internal Auditor optimistic update with rollback on error — immediate feedback while confirming with refetch"
  - "MPAC sidebar computes flagged item status by parsing changes JSON from audit_log entries (append-only pattern) — latest entry wins"
  - "Global style injection for MPAC 70/30 grid (media query via document.createElement style) — inline styles cannot use media queries"
metrics:
  duration: 5 min
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_modified: 2
---

# Phase 31 Plan 3: OversightDashboardPage Summary

OversightDashboardPage serving 4 oversight roles (councillor, audit_committee, internal_auditor, mpac) from a single file with role-config-map architecture; includes POE verification workqueue and MPAC investigation flagging.

## What Was Built

### Task 1 — API service functions (commit: 0904ec1)

Added 6 new exported functions to `frontend-dashboard/src/services/api.ts`:

- `fetchCouncillorDashboard(token)` — GET `/api/v1/role-dashboards/councillor`
- `fetchAuditCommitteeDashboard(token)` — GET `/api/v1/role-dashboards/audit-committee`
- `fetchInternalAuditorDashboard(token)` — GET `/api/v1/role-dashboards/internal-auditor`
- `verifyEvidence(token, evidenceId, status)` — POST `/api/v1/role-dashboards/internal-auditor/verify-evidence`
- `fetchMPACDashboard(token)` — GET `/api/v1/role-dashboards/mpac`
- `flagInvestigation(token, reportId, reason, notes)` — POST `/api/v1/role-dashboards/mpac/flag-investigation`

All functions use `fetch()` with `Authorization: Bearer <token>` header, matching the established pattern from Plan 31-02.

### Task 2 — OversightDashboardPage (commit: 58b88e7)

Replaced the stub in `frontend-dashboard/src/pages/OversightDashboardPage.tsx` with a 1384-line full implementation.

**Architecture:**

```typescript
const ROLE_CONFIG: Record<OversightRole, { title: string; fetch: (token: string) => Promise<any> }> = {
  councillor: { title: 'Ward Councillor Dashboard', fetch: fetchCouncillorDashboard },
  audit_committee: { title: 'Audit Committee Dashboard', fetch: fetchAuditCommitteeDashboard },
  internal_auditor: { title: 'Internal Auditor Dashboard', fetch: fetchInternalAuditorDashboard },
  mpac: { title: 'MPAC Dashboard', fetch: fetchMPACDashboard },
};
```

**Councillor view (DASH-07):**
- Read-only SDBIP KPI table: Description / Annual Target / Latest Actual / Achievement % / Status (TrafficLightBadge)
- Read-only Statutory Reports table: Report Type / Financial Year / Status / Due Date

**Audit Committee view (DASH-08):**
- Performance Reports table (same format as councillor statutory reports)
- Audit Trail table ordered by timestamp DESC, max 100 entries, details truncated to 60 chars

**Internal Auditor view (DASH-09):**
- Collapsible KPI accordion (expandedKpis Set<string> state)
- Each KPI shows unverified count badge in header
- Evidence item rows: File Name / Content Type / Uploaded Date / Status Badge / Action Buttons
- "Verified" (teal outline) and "Insufficient" (coral outline) buttons for unverified items only
- Optimistic status update with rollback on error + refetch on success

**MPAC view (DASH-10):**
- Two-column layout: main area (statutory reports table + Flag Investigation inline form) + sidebar (flagged investigations)
- Flag Investigation: expandable row form with reason dropdown (4 options) + notes textarea + Submit/Cancel
- Sidebar: parses investigation_flags audit log entries, groups by record_id, latest entry determines status
- Status badges: pending (amber), acknowledged (blue), resolved (teal)

**Shared states all roles:**
- Loading: SkeletonTheme with table placeholder shapes
- Empty: GlassCard with "No data available" + PMS Hub Button
- Error: red alert banner with Retry Button

## Verification Results

1. `npx tsc --noEmit` — PASS (clean, no errors)
2. `npm run build` — PASS (production build succeeds, 55.74s)
3. OversightDashboardPage exports `OversightDashboardPage({ role })` and renders different content per role — PASS
4. Internal Auditor view has Verify/Insufficient action buttons for unverified evidence items — PASS
5. MPAC view has Flag Investigation inline form + flagged investigations sidebar — PASS
6. Councillor and Audit Committee views are purely read-only — PASS
7. All API calls use correct endpoints with Authorization header — PASS (verified via grep)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `frontend-dashboard/src/pages/OversightDashboardPage.tsx` exists (1384 lines, >= 250)
- [x] `frontend-dashboard/src/services/api.ts` modified with 6 new functions
- [x] Commit `0904ec1` exists — Task 1 API functions
- [x] Commit `58b88e7` exists — Task 2 OversightDashboardPage
- [x] TypeScript: PASS
- [x] Production build: PASS
