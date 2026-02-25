---
phase: 09-ocr-supabase-bridge-ward-filtering
plan: 01
subsystem: verification
tags: [ocr, supabase, auth, session, citizen-portal, security]
requires: [src/core/supabase.py, src/api/v1/verification.py, frontend-public/src/pages/ProfilePage.tsx]
provides: [residence_verified synced to Supabase user_metadata after OCR, frontend session refresh after upload]
affects: [frontend-public/src/pages/ReportIssuePage.tsx (gate now unlocks), citizen verification flow]
tech-stack:
  added: []
  patterns: [get_supabase_admin() call after db.commit(), functools __wrapped__ for testing slowapi-decorated endpoints]
key-files:
  created:
    - tests/test_verification_supabase_sync.py
  modified:
    - src/api/v1/verification.py
    - frontend-public/src/pages/ProfilePage.tsx
decisions:
  - DB is source of truth — Supabase sync failure does NOT fail the endpoint (user is verified in DB regardless)
  - supabase_admin.auth.admin.update_user_by_id() called after await db.commit() to ensure sync only happens when DB has persisted
  - Missing Supabase admin client (dev mode) logs WARNING not ERROR — reduces alert noise in local dev environments
  - Frontend refreshSession() call is fire-and-forget — does not affect success/error UX state for the user
  - Unit tests use __wrapped__ attribute to bypass slowapi rate-limiter validation (established project pattern)
  - New tests placed in separate test_verification_supabase_sync.py (not test_verification_api.py) because the existing file uses module-level pytestmark integration which requires PostgreSQL
metrics:
  duration: "9.9m (594s)"
  completed: "2026-02-22"
  tasks: 2
  files: 3
---

# Phase 09 Plan 01: OCR-to-Supabase Bridge Summary

**One-liner:** OCR verification endpoint now syncs `residence_verified=True` to Supabase user_metadata via admin API, and ProfilePage refreshes the session after upload so the ReportIssuePage gate unlocks without manual reload.

## What Was Built

The OCR verification endpoint in `src/api/v1/verification.py` previously updated the local PostgreSQL database but never told Supabase Auth that the user was verified. The frontend reads `user_metadata.residence_verified` from the Supabase session, so the `ReportIssuePage` gate stayed permanently locked.

This plan closes that gap with two changes:

**Backend (verification.py):** After `await db.commit()` succeeds, the endpoint calls `supabase_admin.auth.admin.update_user_by_id()` to set `residence_verified=True` and `residence_verified_at` in the Supabase user_metadata. The sync is best-effort: Supabase failures are caught, logged as errors, and do NOT fail the response (DB is authoritative). Missing Supabase admin client (local dev) logs a warning and continues.

**Frontend (ProfilePage.tsx):** After the document upload and metadata update succeed, `supabase.auth.refreshSession()` is called. This causes the frontend Supabase client to fetch the latest session from the server. If OCR verification runs synchronously or has already completed, the updated `residence_verified` flag will be available in the session immediately, unlocking the gate without a page reload.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add Supabase user_metadata sync to verification endpoint | bf6447c | src/api/v1/verification.py, tests/test_verification_supabase_sync.py |
| 2 | Add session refresh in ProfilePage after verification upload | 010c381 | frontend-public/src/pages/ProfilePage.tsx |

## Verification Results

1. `pytest tests/test_verification_api.py tests/test_verification_supabase_sync.py -v` — 3 passed, 7 skipped (integration tests require PostgreSQL, skipped per project config)
2. `cd frontend-public && npm run build:check` — TypeScript compilation clean, no errors
3. `grep -n "update_user_by_id" src/api/v1/verification.py` — line 230 matches
4. `grep -n "refreshSession" frontend-public/src/pages/ProfilePage.tsx` — line 160 matches

## Deviations from Plan

**1. [Rule 3 - Blocking] Test file separated from existing test_verification_api.py**

- **Found during:** Task 1 test writing
- **Issue:** The existing `tests/test_verification_api.py` uses `pytestmark = [pytest.mark.asyncio, pytest.mark.integration]` at module level, which causes all tests in the file to require PostgreSQL. New unit tests added to that file would be skipped without PostgreSQL, defeating the purpose.
- **Fix:** Created `tests/test_verification_supabase_sync.py` as a standalone file with only `pytestmark = pytest.mark.asyncio` (no integration marker). This allows the 3 new tests to run in any environment.
- **Files modified:** tests/test_verification_supabase_sync.py (new file)
- **Commit:** bf6447c

**2. [Rule 3 - Blocking] __wrapped__ pattern to bypass slowapi decorator**

- **Found during:** Task 1 test execution
- **Issue:** slowapi validates that the `request` parameter is a real `starlette.requests.Request` instance. Calling `verify_proof_of_residence(request=MagicMock(), ...)` raised `Exception: parameter 'request' must be an instance of starlette.requests.Request`.
- **Fix:** Added `_get_endpoint_fn()` helper that traverses `__wrapped__` to obtain the pre-decorated function. This is the established project pattern (STATE.md: "slowapi rate-limited endpoints cannot be called directly in tests — inspect internal logic functions instead").
- **Files modified:** tests/test_verification_supabase_sync.py
- **Commit:** bf6447c

## Key Decisions

- **DB is source of truth:** Supabase sync failure returns 200 (not 5xx). The user IS verified in DB. Supabase sync is a convenience for frontend session state — not the authoritative verification record.
- **Warning vs Error for missing client:** Missing Supabase admin client is a WARNING (expected in local dev). A failed sync attempt is an ERROR (unexpected in production).
- **No polling:** Per plan specification — single `refreshSession()` call, no timer or polling. Async OCR results will be visible on next page visit.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/api/v1/verification.py | FOUND |
| frontend-public/src/pages/ProfilePage.tsx | FOUND |
| tests/test_verification_supabase_sync.py | FOUND |
| 09-01-SUMMARY.md | FOUND |
| commit bf6447c (Task 1) | FOUND |
| commit 010c381 (Task 2) | FOUND |
