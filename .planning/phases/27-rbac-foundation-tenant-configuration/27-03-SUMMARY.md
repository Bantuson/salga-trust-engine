---
phase: 27-rbac-foundation-tenant-configuration
plan: 03
subsystem: ui
tags: [pms, rbac, react, fastapi, department, organogram, role-switcher, react-d3-tree, css-variables]

# Dependency graph
requires:
  - phase: 27-01
    provides: 18-role RBAC hierarchy, UserRole enum, UserRoleAssignment model, JWT blacklist
  - phase: 27-02
    provides: Department CRUD API, Municipality PMS settings, organogram endpoint

provides:
  - PMS readiness gate service (src/services/pms_readiness.py) — check_pms_readiness(), require_pms_ready()
  - GET /api/v1/departments/pms-readiness endpoint returning structured checklist
  - 5-step PMS department setup wizard (frontend-dashboard/src/pages/PmsSetupWizardPage.tsx)
  - Interactive organogram tree component using react-d3-tree (OrganogramTree.tsx)
  - Role switcher navbar component for multi-role users (RoleSwitcher.tsx)
  - PMS readiness gate overlay with checklist (PmsReadinessGate.tsx)
  - Updated useRoleBasedNav covering all 18 roles with PMS navigation items

affects:
  - Phase 28+ PMS KPI management (will use require_pms_ready() gate)
  - Any frontend page needing role-based navigation
  - Admin workflows for department configuration

# Tech tracking
tech-stack:
  added:
    - react-d3-tree 3.6.5 (organogram tree visualization, already in package.json)
  patterns:
    - CSS variables for all styling (no Tailwind) — inline styles using design-tokens.css variables
    - GlassCard + Button + Input from @shared/components for consistent design system
    - AnimatedGradientBg for full-page wizard background
    - PmsReadinessStatus dataclass with asdict() for structured 403 response payloads
    - require_pms_ready() factory pattern for FastAPI endpoint gating

key-files:
  created:
    - src/services/pms_readiness.py — PmsReadinessStatus dataclass, check_pms_readiness(), require_pms_ready()
    - frontend-dashboard/src/pages/PmsSetupWizardPage.tsx — 5-step PMS wizard
    - frontend-dashboard/src/components/rbac/RoleSwitcher.tsx — multi-role navbar switcher
    - frontend-dashboard/src/components/rbac/PmsReadinessGate.tsx — readiness checklist overlay
    - frontend-dashboard/src/components/organogram/OrganogramTree.tsx — react-d3-tree wrapper
    - tests/test_pms_readiness.py — 11 unit tests for PMS readiness gate
  modified:
    - src/api/v1/departments.py — added GET /pms-readiness endpoint
    - frontend-dashboard/src/hooks/useRoleBasedNav.ts — extended to all 18 roles

key-decisions:
  - "CSS variables over Tailwind: frontend-dashboard uses design-tokens.css CSS custom properties (--color-teal, --surface-elevated, --border-subtle etc.) — no Tailwind configured; all new components use inline styles with CSS variables"
  - "PmsReadinessStatus as dataclass not Pydantic model: asdict() converts directly to dict for 403 response body — no schema file needed"
  - "GlassCard + Button for wizard UI: shared components ensure visual consistency with OnboardingWizardPage pattern"
  - "react-d3-tree nodes use CSS variable colors not hardcoded hex — fill='var(--color-teal)' adapts to theme changes"
  - "RoleSwitcher returns null for single-role users — cleaner navbar per RBAC design spec"

patterns-established:
  - "Full-page wizard pattern: AnimatedGradientBg + GlassCard + StepIndicator (inline styles using CSS vars)"
  - "require_pms_ready() factory: returns 403 + PMS_NOT_READY code + asdict(checklist) when not configured"
  - "Frontend design system pattern: NEVER use Tailwind — always CSS variables via inline styles or @shared components"

requirements-completed: [RBAC-01, RBAC-02, RBAC-04, RBAC-05, RBAC-06]

# Metrics
duration: 45min
completed: 2026-02-28
---

# Phase 27 Plan 03: PMS Readiness Gate, Department Wizard, Organogram, and Role Switcher Summary

**PMS readiness gate with 403+checklist, 5-step department setup wizard using GlassCard design system, react-d3-tree organogram, role switcher for 18-role RBAC, and 11 passing unit tests**

## Performance

- **Duration:** ~45 min (continuation session fixing design system issue)
- **Started:** 2026-02-28T20:00:00Z
- **Completed:** 2026-02-28
- **Tasks:** 2 completed (Task 3 at human-verify checkpoint)
- **Files modified:** 7

## Accomplishments

- PMS readiness service computing all 3 conditions (settings locked, directors assigned, PMS officer exists), blocking PMS endpoints with structured 403 when not configured
- 5-step department setup wizard (municipality settings, create departments, assign directors, map ticket categories, review organogram) using proper design system components
- Interactive organogram tree using react-d3-tree with teal circle nodes, department names, and director labels, collapsible on click
- Role switcher hidden for single-role users, visible multi-role dropdown without re-login for context switching
- All 18 RBAC roles covered in useRoleBasedNav with appropriate PMS navigation items
- 11 unit tests covering all PMS readiness conditions and gate behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: PMS readiness service, gate dependency, unit tests** - `95ace0e` (feat)
2. **Task 2: Frontend wizard, organogram, role switcher, navigation** - `65d4773` (feat)
3. **Fix: Rewrite frontend components with proper design system** - `47308cd` (fix)

_Task 3 is a blocking human-verify checkpoint (visual inspection of wizard + organogram)._

## Files Created/Modified

- `src/services/pms_readiness.py` — PmsReadinessStatus dataclass, check_pms_readiness(), require_pms_ready()
- `src/api/v1/departments.py` — added GET /pms-readiness endpoint with rate limiting
- `tests/test_pms_readiness.py` — 11 unit tests (TestCheckPmsReadiness, TestRequirePmsReadyGate, TestPmsReadinessEndpoint)
- `frontend-dashboard/src/pages/PmsSetupWizardPage.tsx` — 5-step wizard with AnimatedGradientBg, GlassCard, Button, Input
- `frontend-dashboard/src/components/organogram/OrganogramTree.tsx` — react-d3-tree wrapper with CSS variable colors
- `frontend-dashboard/src/components/rbac/RoleSwitcher.tsx` — multi-role navbar switcher, null for single-role
- `frontend-dashboard/src/components/rbac/PmsReadinessGate.tsx` — GlassCard checklist overlay with Button CTA
- `frontend-dashboard/src/hooks/useRoleBasedNav.ts` — extended to all 18 roles (already done in previous session)

## Decisions Made

- CSS variables over Tailwind: frontend-dashboard has no Tailwind configuration — all styling uses inline styles with CSS variables from design-tokens.css
- GlassCard + Button + Input from @shared/components for wizard UI — matches OnboardingWizardPage pattern exactly
- react-d3-tree node colors use CSS variables (`fill="var(--color-teal)"`) not hardcoded hex for theme adaptability
- PmsReadinessStatus as Python dataclass (not Pydantic) — asdict() converts directly to dict for 403 detail payload

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote frontend components replacing Tailwind with project design system**
- **Found during:** Task 3 checkpoint (human-verify) in previous session
- **Issue:** PmsSetupWizardPage.tsx, OrganogramTree.tsx, RoleSwitcher.tsx, PmsReadinessGate.tsx all used Tailwind CSS classes (bg-teal-600, flex, rounded-xl, etc.) which have no effect because the dashboard has NO Tailwind CSS configured. All styled elements rendered as unstyled HTML.
- **Fix:** Rewrote all 4 components to use CSS custom properties from @shared/design-tokens.css via inline styles, and replaced bare HTML elements with GlassCard, Button, Input, AnimatedGradientBg from @shared/components — following the OnboardingWizardPage.tsx pattern exactly
- **Files modified:** PmsSetupWizardPage.tsx, OrganogramTree.tsx, RoleSwitcher.tsx, PmsReadinessGate.tsx
- **Verification:** `npx tsc --noEmit` passes with no TypeScript errors
- **Committed in:** 47308cd (fix(27-03))

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug: wrong styling system)
**Impact on plan:** Necessary fix — components were structurally correct but visually broken. No scope creep.

## Issues Encountered

- Previous session used Tailwind CSS classes throughout the 4 frontend components. The project's `frontend-dashboard` has no Tailwind configuration (only vite.config.ts with @shared alias, no tailwind.config.js). All Tailwind classes were rendered as unstyled HTML. Discovered at Task 3 checkpoint, fixed in this continuation session by rewriting all 4 components to use CSS variables and @shared design components.

## User Setup Required

None — no external service configuration required beyond what was set up in Plans 27-01 and 27-02.

## Next Phase Readiness

- PMS readiness gate (`require_pms_ready()`) ready for use by Phase 28 KPI management endpoints
- Wizard at `/pms-setup` route ready for admin use (router registration needed if not already done)
- Organogram tree component ready for reuse in department views
- All 18 roles covered in `useRoleBasedNav` for Phase 28+ navigation expansion

**Blocker for Task 3:** Human visual verification of wizard UI required — admin must navigate to /pms-setup, walk through steps 1-5, and confirm the organogram tree renders with correct design system styling (glass cards, teal accents, no Tailwind artifacts).

---
*Phase: 27-rbac-foundation-tenant-configuration*
*Completed: 2026-02-28*
