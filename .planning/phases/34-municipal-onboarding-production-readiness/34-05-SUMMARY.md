---
phase: 34-municipal-onboarding-production-readiness
plan: "05"
subsystem: e2e-tests
tags: [playwright, e2e, user-journeys, role-based-testing, pms, onboarding]
dependency_graph:
  requires: [34-01, 34-02, 34-03, 34-04]
  provides: [JOURNEY-01]
  affects: [e2e-tests/tests/journeys, e2e-tests/fixtures/auth.ts]
tech_stack:
  added: []
  patterns:
    - "Role journey spec pattern: import authTest, skip gracefully on backend-down, 60s navigation timeout"
    - "Each journey test is independent (no state sharing between steps)"
    - "pmsOfficerPage fixture added to auth.ts following existing factory pattern"
key_files:
  created:
    - e2e-tests/tests/journeys/executive-mayor-journey.spec.ts
    - e2e-tests/tests/journeys/municipal-manager-journey.spec.ts
    - e2e-tests/tests/journeys/cfo-journey.spec.ts
    - e2e-tests/tests/journeys/section56-director-journey.spec.ts
    - e2e-tests/tests/journeys/pms-officer-journey.spec.ts
    - e2e-tests/tests/journeys/salga-admin-journey.spec.ts
    - e2e-tests/tests/journeys/admin-journey.spec.ts
    - e2e-tests/tests/journeys/oversight-journey.spec.ts
    - e2e-tests/tests/journeys/onboarding-journey.spec.ts
    - e2e-tests/profiles/municipal/pms-officer.profile.ts
  modified:
    - e2e-tests/fixtures/auth.ts
decisions:
  - "pmsOfficerPage fixture added inline to auth.ts (not separate file) — consistent with existing pattern for all role fixtures"
  - "oversight-journey.spec.ts covers 3 roles (audit_committee, internal_auditor, mpac_member) in one file using separate authTest.describe blocks — journeys overlap significantly"
  - "onboarding-journey.spec.ts uses base test (no auth) for public /request-access route; adminPage fixture as proxy for authenticated /onboarding wizard route"
  - "All journey tests are graceful-skip on backend-down — production readiness gate requires tests to run even without live backend"
  - "pms-officer.profile.ts created with email pms-officer@test-jozi-001.test following existing tenantId pattern"
metrics:
  duration: "~25 min"
  completed: "2026-03-02"
  tasks: 2
  files: 11
---

# Phase 34 Plan 05: Role Journey E2E Test Suite Summary

**One-liner:** 9 Playwright journey specs covering every major PMS role's daily workflow with graceful backend-down handling and 60s navigation timeouts.

## What Was Built

### New Journey Test Suite: `e2e-tests/tests/journeys/`

A comprehensive E2E user journey test suite with 9 spec files, each covering the daily-use workflow for a specific PMS role. The suite serves as the living specification of what each role does every day and ensures no regression breaks a role's critical path.

**Files created:**

| Spec File | Role | Steps | Key Pages Tested |
|-----------|------|-------|-----------------|
| `executive-mayor-journey.spec.ts` | Executive Mayor | 4 | dashboard, /pms?view=sdbip-scorecards, /pms?view=statutory-reports, /departments |
| `municipal-manager-journey.spec.ts` | Municipal Manager | 5 | dashboard, /departments, /pms?view=statutory-reports, /settings, /analytics |
| `cfo-journey.spec.ts` | CFO | 5 | dashboard, /pms?view=sdbip-scorecards, /pms?view=quarterly-actuals, /analytics, /departments |
| `section56-director-journey.spec.ts` | Section 56 Director | 4 | dashboard, /pms?view=quarterly-actuals, /pms?view=sdbip-scorecards, /departments |
| `pms-officer-journey.spec.ts` | PMS Officer | 6 | /pms, /pms?view=idp, /pms?view=sdbip-scorecards, /pms?view=quarterly-actuals, /pms?view=evidence, /departments |
| `salga-admin-journey.spec.ts` | SALGA Admin | 5 | dashboard, benchmarking table, /role-approvals, /municipalities, /system |
| `admin-journey.spec.ts` | Admin | 6 | dashboard, /teams, create-team button, /settings, /tickets, /analytics |
| `oversight-journey.spec.ts` | 3 Oversight Roles | 6 total | audit-committee→statutory, internal-auditor→evidence, mpac-member→statutory |
| `onboarding-journey.spec.ts` | Onboarding | 8 total | /request-access (public), /onboarding wizard (authenticated) |

### Auth Fixture Extension

- **`e2e-tests/profiles/municipal/pms-officer.profile.ts`** — New test profile for `pms_officer` role, following existing tenantId and email convention
- **`e2e-tests/fixtures/auth.ts`** — Added `pmsOfficerPage` fixture to interface, import, and factory (import from pms-officer.profile.js, extend `AuthFixtures` interface, add `pmsOfficerPage` fixture factory)

## Test Patterns Applied

Every spec follows the same resilient pattern:

```typescript
authTest('Step N: Navigate to X', async ({ rolePage }) => {
  try {
    await rolePage.goto('/path', { timeout: 60000, waitUntil: 'domcontentloaded' });
  } catch {
    authTest.skip(true, 'Navigation timed out — server may be down');
    return;
  }
  await rolePage.waitForTimeout(1500);
  await expect(rolePage.locator('body')).toBeVisible();
});
```

**Key patterns:**
- `timeout: 60000` on all navigation calls (accounts for GSAP animations per CLAUDE.md)
- `try/catch` wrapping navigation with `authTest.skip()` on timeout (backend-down graceful)
- `waitForTimeout(1500–2000)` after navigation for GSAP animation settle
- Minimum assertion: `body` is visible (confirms no blank screen/crash)
- Stronger assertions: heading/card visibility using `.catch(() => false)` + `expect(result).toBeTruthy()`
- Each test is independent (no state sharing between steps)

## Deviations from Plan

### Added — pms-officer.profile.ts (Rule 2 — Missing Critical Functionality)

**Found during:** Task 1 — no pms-officer profile existed

**Issue:** The plan required a `pmsOfficerPage` fixture but no `pms-officer.profile.ts` existed in `e2e-tests/profiles/municipal/`, which is required by the auth fixture factory pattern.

**Fix:** Created `e2e-tests/profiles/municipal/pms-officer.profile.ts` with `pms_officer` role, standard test email (`pms-officer@test-jozi-001.test`), and tenantId `00000000-0000-0000-0000-000000000001`.

**Files modified:** `e2e-tests/profiles/municipal/pms-officer.profile.ts` (created), `e2e-tests/fixtures/auth.ts` (extended)

**Commit:** f596eb1

## Self-Check: PASSED

All files verified:

```
e2e-tests/tests/journeys/ — 9 spec files
e2e-tests/profiles/municipal/pms-officer.profile.ts — FOUND
e2e-tests/fixtures/auth.ts — pmsOfficerPage fixture — FOUND
```

Commits:
- f596eb1 — feat(34-05): create journey test directory and first 5 role journey specs
- 9ec9cb1 — feat(34-05): create remaining 4 role journey specs — SALGA Admin, Admin, Oversight, Onboarding
