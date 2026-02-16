---
status: resolved
trigger: "gbv-privacy.spec.ts:483 SAPS liaison CAN see GBV report fails because backend detection guard doesn't trigger"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - page-content-based guards were unreliable; direct HTTP connectivity check works
test: Ran full gbv-privacy.spec.ts suite twice
expecting: 0 failures, 3 positive tests skipped
next_action: Archive session

## Symptoms

expected: Test should detect FastAPI backend is not running and skip itself
actual: Guard at lines 497-511 doesn't trigger; test proceeds to line 515 where it asserts tracking number visibility and times out after 30s
errors: Error: expect(locator).toBeVisible() failed. Locator: locator('text=TKT-20260215-179A41'). Timeout: 30000ms. Element(s) not found.
reproduction: cd e2e-tests && npx playwright test --project=public-chromium tests/public/gbv-privacy.spec.ts --reporter=list
started: Always broken - FastAPI backend has never been running during E2E tests

## Eliminated

- hypothesis: Page shows "failed to load" or "network error" text when backend is down
  evidence: Guard code checking for these strings doesn't trigger, meaning the page content doesn't contain them
  timestamp: 2026-02-15 (from prior fix attempt)

- hypothesis: Loading skeleton stays visible when backend is down
  evidence: The .react-loading-skeleton check returns false, meaning skeletons either aren't used or disappear quickly
  timestamp: 2026-02-15 (from prior fix attempt)

- hypothesis: Page shows "No tickets found" when backend is down
  evidence: Guard checking for this string doesn't trigger
  timestamp: 2026-02-15 (from prior fix attempt)

## Evidence

- timestamp: 2026-02-15
  checked: Current guard implementation at lines 497-511
  found: Guard relies on page content matching specific strings that the dashboard UI doesn't render when backend is unreachable
  implication: Page-content-based detection is unreliable; need direct backend connectivity check

- timestamp: 2026-02-15
  checked: Other test files (authorization.spec.ts, tenant-isolation.spec.ts, input-validation.spec.ts)
  found: These files use unconditional test.skip() as first line in tests requiring backend
  implication: Established pattern exists for skipping backend-dependent tests

- timestamp: 2026-02-15
  checked: Three positive test blocks needing fix
  found: SAPS at line 483, Admin at line 519, Citizen at line 555 - all have same broken guard pattern
  implication: All three need the same fix

- timestamp: 2026-02-15
  checked: Full test suite run after fix (run 1)
  found: Ward Councillor auth timeout (transient network issue), but all 3 positive tests properly skipped
  implication: Fix works; Ward Councillor failure is unrelated transient auth flakiness

- timestamp: 2026-02-15
  checked: Full test suite run after fix (run 2)
  found: 13 passed, 3 skipped, 0 failed
  implication: Fix verified - all tests pass, positive tests correctly skip when backend unavailable

## Resolution

root_cause: The backend detection guard relies on checking page DOM content for specific error strings ("failed to load", "network error", "econnrefused", "No tickets found") and loading skeleton visibility. The dashboard frontend doesn't render any of these when the FastAPI backend is unreachable - it shows an empty table or default UI state instead. So the guard passes, the test proceeds to assert tracking number visibility, and times out after 30s.
fix: Added isBackendAvailable() helper function that makes a direct HTTP fetch to http://localhost:8000/ with a 3-second timeout. Result is cached after first call. Replaced all three broken page-content guards (SAPS, Admin, Citizen positive tests) with this deterministic connectivity check at the top of each test body, before any page navigation.
verification: Two full test runs - second run confirmed 13 passed, 3 skipped (positive tests), 0 failed.
files_changed:
- e2e-tests/tests/public/gbv-privacy.spec.ts
