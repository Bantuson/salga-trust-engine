---
phase: 34-municipal-onboarding-production-readiness
plan: "03"
subsystem: frontend-onboarding
tags: [onboarding, wizard, pms, react, invitation, municipality-registration]
dependency_graph:
  requires: [34-01]
  provides: [onboarding-wizard-pms, invite-user-modal, request-access-enhanced]
  affects: [frontend-dashboard-onboarding-flow]
tech_stack:
  added: []
  patterns:
    - 6-step localStorage-backed wizard with step indicator
    - InviteUserModal with TeamCreateModal shell pattern
    - allowedRoles prop for role filtering
key_files:
  created:
    - frontend-dashboard/src/components/onboarding/InviteUserModal.tsx
  modified:
    - frontend-dashboard/src/pages/OnboardingWizardPage.tsx
    - frontend-dashboard/src/pages/RequestAccessPage.tsx
decisions:
  - InviteUserModal: allowedRoles prop filters from ALL_INVITABLE_ROLES (12 roles); field_worker and saps_liaison explicitly excluded per onboarding spec
  - OnboardingWizardPage: complete rewrite; old v1.0 components (ProfileStep, InviteTeamStep, ConfigureWardsStep, SetSLAStep, CompletionStep, WizardProgress) remain on disk as library — new wizard uses inline step rendering
  - departments localStorage-tracked with saved/unsaved flag — saves locally when API unavailable (municipality may not have tenant_id yet during initial onboarding)
  - PMS readiness gate falls back to local wizard state when /api/v1/pms/readiness returns non-200 — ensures step 6 always shows useful information
metrics:
  duration: "12 minutes"
  completed_date: "2026-03-02"
  tasks: 2
  files_changed: 3
  files_created: 1
---

# Phase 34 Plan 03: PMS-Aware Onboarding Wizard Summary

PMS-aware 6-step onboarding wizard replacing v1.0 citizen-era flow, enhanced municipality registration form with demarcation code and category, and a reusable InviteUserModal component.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Refactor OnboardingWizardPage to 6-step PMS wizard + enhance RequestAccessPage | b7f40c8 | OnboardingWizardPage.tsx, RequestAccessPage.tsx |
| 2 | Create InviteUserModal component | 18fbf65 | InviteUserModal.tsx |

## What Was Built

### Task 1: OnboardingWizardPage (complete rewrite)

Replaced the v1.0 wizard (Welcome/Profile/Team/Wards/SLA/Done) with a PMS-aligned 6-step flow:

**Step 1 — Welcome:** Displays municipality name from user metadata. Dropdown for SDBIP configuration level (Top Layer Only vs Top Layer + Departmental).

**Step 2 — Department Setup:** Create departments (name + code), remove button, soft warning when < 3, shows running count. POSTs to `/api/v1/departments/` with graceful degradation when API unavailable (stored locally with "local" badge).

**Step 3 — Invite Tier 1 Leaders:** Exactly 4 fixed role rows — Executive Mayor, Municipal Manager (pre-filled, read-only), CFO, Speaker. Each has email input, "Send" checkbox, green check when sent. "I'll invite them later" skip option. Invites sent via `POST /api/v1/invitations/bulk`.

**Step 4 — Invite Directors:** Dynamic — one row per department created in Step 2. Role is automatically `section56_director`. "I'll assign directors later" skip. Same bulk invite API.

**Step 5 — SLA & Wards:** Response time slider (1–72h), resolution time slider (1–30 days), optional ward count input.

**Step 6 — PMS Readiness Gate:** Fetches `GET /api/v1/pms/readiness`. Displays 4-item checklist (departments, tier1 invites, directors, SLA) with green/red indicators. Green "PMS-ready" or amber "proceed and complete later" banner. "Go to Dashboard" button.

**Wizard chrome:** Step indicator with numbered circles at top, opacity transitions between steps, localStorage persistence (key: `salga_onboarding_wizard_v2`), AnimatedGradientBg for visual continuity with login page.

### Task 1: RequestAccessPage (enhanced)

- Heading changed to "Municipality Onboarding — Registration"
- 2-step progress indicator showing Step 1 (current) and Step 2 (post-approval)
- New required fields: Demarcation Code (MDB official code), Municipality Category (A/B/C dropdown)
- Contact fields reframed as "Municipal Manager Name" and "Municipal Manager Email" (required)
- Contact Phone remains optional
- File upload relabeled as "Council Resolution Document (Optional)"
- Success state updated: mentions Municipal Manager email specifically, 5 business day approval timeline, notes Step 2 onboarding wizard access
- All new fields included in POST body to `/api/v1/access-requests`

### Task 2: InviteUserModal component

Reusable modal following TeamCreateModal shell pattern exactly:
- Overlay: `position: fixed, inset: 0, rgba(0,0,0,0.5), blur(4px), zIndex: 1000`
- Modal: `glass-pink-frost, blur medium, border glass-border, radius-xl, max-w 560px, max-h 85vh`
- Sticky header/footer, body scroll lock, Escape close, overlay click close

Props: `onClose, onInvited, allowedRoles?, defaultRole?, departmentId?, departmentName?`

ALL_INVITABLE_ROLES (12): executive_mayor, municipal_manager, cfo, speaker (Tier 1), section56_director, ward_councillor, chief_whip (Tier 2), pms_officer, audit_committee_member, internal_auditor, mpac_member (Tier 3), department_manager (Tier 4).

`field_worker` and `saps_liaison` intentionally excluded per plan requirement.

When `allowedRoles` contains exactly 1 role, the dropdown is replaced with a read-only display (e.g., section56_director for a department page). When `departmentName` is provided, the header reads "Invite Director — {name}".

Success: brief 1.2s flash before calling `onInvited()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused Input import in OnboardingWizardPage**
- **Found during:** TypeScript build check
- **Issue:** `Input` component imported but new inline-element wizard doesn't use it
- **Fix:** Removed the import statement
- **Files modified:** OnboardingWizardPage.tsx
- **Commit:** b7f40c8

**2. [Rule 1 - Bug] Added explicit React.ChangeEvent types in RequestAccessPage onChange handlers**
- **Found during:** TypeScript build check
- **Issue:** `Input` component's pre-existing broken types cause `e` to be inferred as `any` in onChange callbacks
- **Fix:** Added explicit `React.ChangeEvent<HTMLInputElement>` type annotation to 5 handlers
- **Files modified:** RequestAccessPage.tsx
- **Commit:** b7f40c8

## Notes

The old v1.0 onboarding sub-components (WelcomeStep, ProfileStep, InviteTeamStep, ConfigureWardsStep, SetSLAStep, CompletionStep, WizardProgress) remain on disk in `frontend-dashboard/src/components/onboarding/`. They are no longer used by OnboardingWizardPage but may be referenced by tests or future plans. Cleanup is deferred.

App.tsx route `/onboarding` already pointed to `OnboardingWizardPage` — no route changes needed.

## Self-Check: PASSED

- FOUND: frontend-dashboard/src/pages/OnboardingWizardPage.tsx
- FOUND: frontend-dashboard/src/pages/RequestAccessPage.tsx
- FOUND: frontend-dashboard/src/components/onboarding/InviteUserModal.tsx
- FOUND: .planning/phases/34-municipal-onboarding-production-readiness/34-03-SUMMARY.md
- FOUND commit b7f40c8: feat(34-03): refactor OnboardingWizardPage to 6-step PMS wizard
- FOUND commit 18fbf65: feat(34-03): create InviteUserModal reusable component
