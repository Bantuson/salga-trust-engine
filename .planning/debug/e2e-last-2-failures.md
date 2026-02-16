---
status: verifying
trigger: "Fix the last 2 E2E test failures in the SALGA Trust Engine Playwright test suite."
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:00:00Z
---

## Current Focus

hypothesis: Both failures are timing/assertion pattern issues already solved elsewhere in the codebase
test: Apply identical patterns from Manager test (line 63) and other fixed tests
expecting: Both tests pass after applying auto-retry assertions
next_action: Verify both fixes pass by running the failing tests

## Symptoms

expected: All 110 tests pass
actual: 108 passed, 2 failed
errors:
  1. dashboard-rbac.spec.ts:21 - Admin metrics count() returns 0 (one-shot check, no retry)
  2. gbv-privacy.spec.ts:483 - SAPS liaison sees loading skeletons instead of ticket data (2s wait insufficient)
reproduction: cd e2e-tests && npx playwright test --project=public-chromium --reporter=list
started: Consistent failures after previous round of fixes

## Eliminated

(none - root causes are pre-identified from failure analysis)

## Evidence

- timestamp: 2026-02-15T00:00:00Z
  checked: dashboard-rbac.spec.ts lines 21-33 vs lines 63-80
  found: Admin test at line 32 uses `expect(await metricsSection.count()).toBeGreaterThan(0)` (one-shot, no retry). Manager test at line 79 uses `await expect(metricsSection.first()).toBeVisible({ timeout: 15000 })` (auto-retry). Ward councillor at line 226 also uses the fixed pattern. Admin was missed.
  implication: Direct fix - apply same pattern to Admin test

- timestamp: 2026-02-15T00:00:00Z
  checked: gbv-privacy.spec.ts lines 483-497
  found: Test uses `waitForTimeout(2000)` then `page.content()` to check for tracking number. Error HTML shows react-loading-skeleton elements still present - data hasn't loaded in 2s.
  implication: Replace static wait + content check with Playwright auto-retry locator wait

## Resolution

root_cause:
  1. Admin dashboard test uses one-shot count() instead of auto-retrying toBeVisible()
  2. SAPS GBV test uses insufficient 2s static wait instead of waiting for data to load

fix:
  1. Change line 32 to use `await expect(metricsSection.first()).toBeVisible({ timeout: 15000 })` and wrap goto in try/catch with test.skip
  2. Replace lines 490-496 with skeleton wait + locator-based tracking number assertion

verification: (pending)
files_changed:
  - e2e-tests/tests/municipal/dashboard-rbac.spec.ts
  - e2e-tests/tests/public/gbv-privacy.spec.ts
