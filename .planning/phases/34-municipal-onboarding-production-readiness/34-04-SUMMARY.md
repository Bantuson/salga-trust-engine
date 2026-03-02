---
phase: 34-municipal-onboarding-production-readiness
plan: 04
subsystem: frontend-dashboard
tags: [departments, role-approvals, modals, activation-gates, page-deduplication, salga-admin]
dependency_graph:
  requires: [34-02, 34-03]
  provides: [department-management-ui, role-approval-queue-ui, page-deduplication]
  affects: [frontend-dashboard, salga-admin-workflow, department-onboarding]
tech_stack:
  added: []
  patterns:
    - CreateDepartmentModal following TeamCreateModal shell pattern (overlay/glass-pink-frost/sticky-header-footer)
    - ActivationBadge component with green/amber/red semantic status (director+KPIs/director-only/no-director)
    - Client-side filtering with useMemo on filter bar selections
    - Non-blocking parallel fetch for pending approval count in SALGA dashboard
key_files:
  created:
    - frontend-dashboard/src/components/departments/CreateDepartmentModal.tsx
  modified:
    - frontend-dashboard/src/pages/DepartmentsPage.tsx
    - frontend-dashboard/src/pages/RoleApprovalsPage.tsx
    - frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx
    - frontend-dashboard/src/App.tsx
decisions:
  - CreateDepartmentModal supports create/edit mode via optional editDepartment prop — one component, two modes, reduces code duplication
  - Activation gate logic is pure frontend (director_id + has_kpis) — no extra API call needed; backend provides has_kpis in department response
  - RoleApprovalsPage approve/reject uses optimistic local state update after API confirm — immediate feedback, no full refetch needed
  - Pending approvals count in SALGA dashboard is non-blocking — fetch failure does not block benchmarking data from loading
  - Page deduplication verified: all 16 routes have documented unique purposes; no two pages show same data in same format
metrics:
  duration_seconds: 850
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_changed: 5
---

# Phase 34 Plan 04: Department Management UI + Role Approval Queue Summary

**One-liner:** DepartmentsPage rebuilt with CreateDepartmentModal, green/amber/red activation gates, and per-row InviteUserModal filtered to section56_director; RoleApprovalsPage rewritten as SALGA Admin action queue with role/municipality/status/date filters and paginated approval table.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Build DepartmentsPage with CreateDepartmentModal, activation gates, director invite | 0d5259d | `components/departments/CreateDepartmentModal.tsx`, `pages/DepartmentsPage.tsx` |
| 2 | Enhance RoleApprovalsPage with filters; verify page deduplication | 4182aae | `pages/RoleApprovalsPage.tsx`, `pages/SALGAAdminDashboardPage.tsx`, `App.tsx` |

## What Was Built

### Task 1: DepartmentsPage + CreateDepartmentModal

**CreateDepartmentModal.tsx** (new file):
- Follows TeamCreateModal shell pattern exactly — overlay, glass-pink-frost, sticky header/footer, body scroll lock, Escape close
- Fields: Department Name (required), Department Code (required, auto-uppercase, max 10 chars), Parent Department (optional dropdown)
- Supports create mode (POST /api/v1/departments) and edit mode (PATCH /api/v1/departments/{id}) via `editDepartment` prop
- Error banner, submitting state, validation

**DepartmentsPage.tsx** (full rewrite):
- Header: "Department Management" + "View Organogram" link + "Create Department" button (opens modal, NOT alert)
- Activation gate badges per row: GREEN (director_id + has_kpis), AMBER (director_id, no KPIs), RED (no director)
- Per-row actions: "Invite Director" (opens InviteUserModal filtered to section56_director) when no director, "Edit" (opens CreateDepartmentModal pre-filled), "Deactivate" (DELETE /api/v1/departments/{id})
- Error fallback: shows amber warning banner + MOCK_DEPARTMENTS (4 departments with mixed activation statuses)
- Empty state: centered icon + message + large "Create Department" button
- Loading state: skeleton table rows (3 rows × 6 columns)
- Activation legend below table explaining the three badge states
- All CRUD operations call API endpoints and refetch list

### Task 2: RoleApprovalsPage + Page Deduplication

**RoleApprovalsPage.tsx** (full rewrite):
- Title: "Role Approval Queue" with subtitle "Manage Tier 1 role assignment requests across all municipalities"
- Filter bar (flexwrap): Role (Exec Mayor/MM/CFO/Speaker), Municipality (dynamic from data), Status (Pending/Approved/Rejected), Date From, Date To, Clear Filters button
- Client-side filtering via useMemo, resets to page 0 on filter change
- Approval table columns: Requester (name + email), Requested Role (gold badge), Municipality, Requested Date, Status badge, Actions
- Actions: Approve (green) + Reject (red) buttons on pending rows; dash on decided rows
- Optimistic updates: mark as approved/rejected in local state immediately after API confirm
- Mock fallback: 6 requests (3 pending, 2 approved, 1 rejected) across different municipalities
- Pagination: simple prev/next at PAGE_SIZE=20

**SALGAAdminDashboardPage.tsx** (enhancement):
- Added 5th summary card: "Pending Role Approvals" with count + "View All →" link to /role-approvals
- Non-blocking fetch: GET /api/v1/auth/tier1-approvals filters for status=pending, failure is silent
- Dashboard retains unique purpose (cross-municipality benchmarking) — no full approval table

**App.tsx** (documentation):
- Added PAGE DEDUPLICATION MAP comment block documenting all 16 routes with unique purposes
- Verified: no two pages show the same data in the same format
- Updated route comments: /departments and /role-approvals now have correct purpose descriptions

## Must-Haves Verification

| Truth | Satisfied |
|-------|-----------|
| DepartmentsPage has Create Department button opening modal (not alert) | Yes — useState showCreateModal triggers CreateDepartmentModal |
| Activation status: green (director+KPIs), amber (director, no KPIs), red (no director) | Yes — ActivationBadge with three states |
| Invite Director button per row opens InviteUserModal | Yes — filtered to section56_director with departmentName/departmentId |
| RoleApprovalsPage has focused action queue with filters | Yes — role/municipality/status/date filters |
| Every page has unique purpose | Yes — documented in App.tsx deduplication map |
| All endpoints persist data via API fetch | Yes — all CRUD calls API with refetch |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- `frontend-dashboard/src/components/departments/CreateDepartmentModal.tsx` — FOUND
- `frontend-dashboard/src/pages/DepartmentsPage.tsx` — FOUND (rewritten)
- `frontend-dashboard/src/pages/RoleApprovalsPage.tsx` — FOUND (rewritten)
- `frontend-dashboard/src/pages/SALGAAdminDashboardPage.tsx` — FOUND (enhanced)
- `frontend-dashboard/src/App.tsx` — FOUND (updated)

### Commits Exist
- `0d5259d` — feat(34-04): build DepartmentsPage with CreateDepartmentModal, activation gates, and director invite
- `4182aae` — feat(34-04): enhance RoleApprovalsPage with filters; add pending approvals card to SALGA dashboard; document page deduplication

### TypeScript
- Zero errors from our new/modified files (verified via grep of tsc output)
- Pre-existing errors in unrelated files were failing before this plan (confirmed via git stash baseline check)

## Self-Check: PASSED
