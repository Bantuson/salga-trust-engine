---
phase: 30-statutory-reporting-approval-workflows
plan: 30-04
subsystem: frontend-dashboard
tags: [statutory-reports, frontend, approval-workflow, notifications, pms-hub]
dependency_graph:
  requires: [30-01, 30-02, 30-03]
  provides: [statutory-reports-ui, notification-bell, pms-hub-integration]
  affects: [frontend-dashboard/src/pages, frontend-dashboard/src/components/layout]
tech_stack:
  added: []
  patterns:
    - CSS variables over Tailwind (Phase 27-03 decision)
    - Fetch with Bearer token auth pattern
    - Demo data fallback when API unavailable
    - Role-gated action buttons via TRANSITION_ROLES map
    - React useCallback + useEffect polling (60s interval for notifications)
key_files:
  created:
    - frontend-dashboard/src/pages/StatutoryReportsPage.tsx
  modified:
    - frontend-dashboard/src/pages/PmsHubPage.tsx
    - frontend-dashboard/src/components/layout/DashboardLayout.tsx
decisions:
  - "Notification bell placed in fixed top header bar (48px) — DashboardLayout previously had no header; added glassmorphism header matching sidebar aesthetic"
  - "StatutoryReportsPage uses showForm/onCloseForm props (not embedded/onToggleForm) — different prop naming to match plan spec while maintaining PMS Hub pattern"
  - "Download uses fetch-then-blob pattern with auth header — direct <a href> cannot include Authorization header for protected downloads"
  - "TRANSITION_ROLES includes municipal_manager in submit_for_review — MM can also submit drafts, not just approve"
  - "Deadline calendar falls back to demo data on API error — non-critical UX, page remains useful"
  - "Dashboard main padding-top increased to accommodate 48px header bar — preserves existing dashboard-main CSS while adding header offset"
metrics:
  duration: 3 minutes
  completed_date: "2026-03-01"
  tasks_completed: 2
  files_modified: 3
  files_created: 1
requirements_addressed:
  - REPORT-05
  - REPORT-07
  - REPORT-08
---

# Phase 30 Plan 04: Statutory Reports Frontend Page and PMS Hub Integration Summary

**One-liner:** Statutory reports list with approval workflow buttons, PDF/DOCX generation/download, deadline calendar widget, PMS Hub integration, and notification bell with dropdown panel in dashboard header.

## What Was Built

### Task 1: StatutoryReportsPage component (feat 7f209f9)

Created `frontend-dashboard/src/pages/StatutoryReportsPage.tsx` — a full statutory report management UI with:

**Report List Section:**
- Fetches from `GET /api/v1/statutory-reports/` with financial year and report type filters
- Status badges with color coding: drafting (gray), internal_review (blue), mm_approved (green), submitted (purple), tabled (dark green)
- Generate button (visible for drafting/internal_review status) calls `POST /api/v1/statutory-reports/{id}/generate` and shows toast on 202 response
- Role-gated transition buttons via `TRANSITION_ROLES` map:
  - drafting: "Submit for Review" (pms_officer, department_manager, cfo, admin, salga_admin, municipal_manager)
  - internal_review: "Approve" (municipal_manager, cfo, admin, salga_admin)
  - mm_approved: "Submit to AG/Treasury" (municipal_manager, admin, salga_admin)
  - submitted: "Table to Council" (municipal_manager, speaker, admin, salga_admin)
- Download buttons (PDF / DOCX) use fetch-then-blob with auth header when storage paths are non-null

**Create Report Form:**
- Report type dropdown (Section 52/72/46/121)
- Financial year input with South African FY auto-detection
- Quarter dropdown (only visible for Section 52)
- Auto-generated title that updates when type/FY/quarter changes
- Calls `POST /api/v1/statutory-reports/`
- Shown when `showForm=true` (controlled by PMS Hub "Create Report" button)

**Deadline Calendar Section:**
- Fetches from `GET /api/v1/statutory-reports/deadlines?financial_year={fy}`
- Shows 7 statutory deadlines sorted by date ascending
- Days remaining computed client-side from today
- Traffic-light urgency: > 30d (green), 14-30d (amber), 7-14d (orange), 1-7d (red), overdue (red pulsing)
- Auto-task created shown with checkmark SVG

**Fallback:** Demo data (3 reports, 4 deadlines) when API unavailable — page always renders.

### Task 2: PMS Hub integration + notification bell (feat 6305433)

**PmsHubPage.tsx updates:**
- Added `'statutory-reports'` to `PmsView` union type
- Added `{ value: 'statutory-reports', label: 'Statutory Reports', createLabel: '+ Create Report' }` between Performance Agreements and PMS Setup in `VIEW_OPTIONS`
- Wired `<StatutoryReportsPage showForm={showForm} onCloseForm={() => setShowForm(false)} />` in view switch

**DashboardLayout.tsx updates:**
- Added `Notification` interface and `BellIcon` SVG component
- Fixed top header bar (48px, glassmorphism backdrop-filter: blur(12px))
- Notification bell button with red badge when unreadCount > 0
- Polls `GET /api/v1/notifications/unread-count` on mount + every 60 seconds
- Clicking bell opens dropdown panel, fetching `GET /api/v1/notifications/?limit=10`
- Dropdown: unread blue dot, bold title, truncated message, time-ago timestamp
- "Mark all read" button calls `POST /api/v1/notifications/mark-read`
- Click-away closes panel via `mousedown` event listener
- Notification link click navigates via `window.location.href`
- Dashboard `main` padding-top increased to accommodate 48px header

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All plan verification criteria passed:
- `npx tsc --noEmit` — TypeScript compiles with no errors
- `grep -c 'statutory-reports' frontend-dashboard/src/pages/PmsHubPage.tsx` — returns 3 (>= 2 required)
- `grep -c 'notification' frontend-dashboard/src/components/layout/DashboardLayout.tsx` — returns 31 (>= 3 required)
- `frontend-dashboard/src/pages/StatutoryReportsPage.tsx` — file exists

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7f209f9 | feat(30-04): StatutoryReportsPage with report list, approval actions, generation, download, deadline calendar |
| 2 | 6305433 | feat(30-04): PMS Hub statutory-reports view and notification bell in dashboard header |

## Self-Check: PASSED
