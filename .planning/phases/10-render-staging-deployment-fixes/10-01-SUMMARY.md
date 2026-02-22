---
phase: 10-render-staging-deployment-fixes
plan: "01"
subsystem: deployment
tags: [render, celery, jwt, twilio, configuration, ci]
dependency_graph:
  requires: []
  provides: [render-staging-deployment-unblocked]
  affects: [staging, celery-workers, jwt-auth, whatsapp-notifications]
tech_stack:
  added: []
  patterns: [pytest-yaml-validation, render-blueprint]
key_files:
  created:
    - tests/test_render_config.py
  modified:
    - render.yaml
key_decisions:
  - "render.yaml fixes are targeted one-line changes only — no structural changes"
  - "SUPABASE_JWT_SECRET added to salga-celery defensively even though current tasks do not use JWT directly"
  - "PyYAML used for test parsing (already available as transitive dependency — no new deps)"
  - "Tests organised into 3 classes by concern (Celery path, JWT secret, Twilio name) for clarity"
metrics:
  duration: "291s (4.9m)"
  completed: "2026-02-22"
  tasks: 2
  files: 2
---

# Phase 10 Plan 01: Render Staging Deployment Fixes Summary

**One-liner:** Fixed three render.yaml bugs (wrong Celery module path, missing JWT secret, wrong Twilio env var name) that collectively broke Celery workers, all authenticated endpoints, and WhatsApp notifications in staging.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix three render.yaml deployment bugs | afda9af | render.yaml |
| 2 | Add render.yaml configuration validation test | 8abef01 | tests/test_render_config.py |

## What Was Built

### Bug Fixes (render.yaml)

**Bug 1 — Celery startCommand module path (salga-celery)**

- **Before:** `celery -A src.celery_app worker --loglevel=info --concurrency=2`
- **After:** `celery -A src.tasks.celery_app worker --loglevel=info --concurrency=2`
- **Impact:** Celery worker was failing to start with `ModuleNotFoundError`. SLA breach checks and WhatsApp status notifications were completely broken in staging.

**Bug 2 — Missing SUPABASE_JWT_SECRET**

- Added `SUPABASE_JWT_SECRET` (sync: false) to `salga-api` envVars after `SUPABASE_SERVICE_ROLE_KEY`
- Added `SUPABASE_JWT_SECRET` (sync: false) to `salga-celery` envVars for defensive consistency
- **Impact:** `verify_supabase_token()` in `src/core/security.py` has an early-return guard `if not settings.SUPABASE_JWT_SECRET: return None`. Without this env var, every token verification returns None, making ALL authenticated API endpoints return 401 Unauthorized.

**Bug 3 — TWILIO_WHATSAPP_FROM → TWILIO_WHATSAPP_NUMBER (two locations)**

- Renamed in `salga-api` envVars (was line 43)
- Renamed in `salga-celery` envVars (was line 114)
- **Impact:** `src/core/config.py` defines the field as `TWILIO_WHATSAPP_NUMBER`. Pydantic Settings with `extra="ignore"` silently drops the wrongly-named env var, leaving `settings.TWILIO_WHATSAPP_NUMBER` as empty string and causing all WhatsApp citizen status notifications to fail silently.

### Automated Test Guard (tests/test_render_config.py)

5 pytest tests that parse render.yaml using PyYAML and assert configuration correctness:

1. `TestCeleryModulePath::test_celery_startcommand_uses_tasks_module` — validates `src.tasks.celery_app` in startCommand
2. `TestSupabaseJwtSecret::test_supabase_jwt_secret_in_api` — validates SUPABASE_JWT_SECRET present in salga-api
3. `TestSupabaseJwtSecret::test_supabase_jwt_secret_in_celery` — validates SUPABASE_JWT_SECRET present in salga-celery
4. `TestTwilioEnvVarName::test_twilio_whatsapp_number_in_api` — validates TWILIO_WHATSAPP_NUMBER (not FROM) in salga-api
5. `TestTwilioEnvVarName::test_twilio_whatsapp_number_in_celery` — validates TWILIO_WHATSAPP_NUMBER (not FROM) in salga-celery

All 5 tests pass. Each test has a docstring explaining precisely what breaks in staging if the assertion fails.

## Verification Results

```
pytest tests/test_render_config.py -v  →  5 passed in 3.96s
grep -c "src.tasks.celery_app" render.yaml  →  1
grep -c "TWILIO_WHATSAPP_FROM" render.yaml  →  0
grep -c "SUPABASE_JWT_SECRET" render.yaml  →  2
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] `render.yaml` exists and contains all three fixes
- [x] `tests/test_render_config.py` exists with 5 tests (153 lines)
- [x] Commit afda9af exists (render.yaml fixes)
- [x] Commit 8abef01 exists (test file)
- [x] Zero occurrences of `src.celery_app` (bare, without tasks) in render.yaml
- [x] Zero occurrences of `TWILIO_WHATSAPP_FROM` in render.yaml
- [x] Two occurrences of `SUPABASE_JWT_SECRET` in render.yaml (salga-api + salga-celery)
