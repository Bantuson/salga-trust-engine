---
phase: 28-idp-sdbip-core-performance-monitoring
plan: "05"
subsystem: pms-evidence-validation
tags: [evidence, clamav, virus-scanning, pms-officer, validation, portfolio-of-evidence, supabase-storage]
dependency_graph:
  requires: ["28-04"]
  provides: ["evidence-upload", "pms-officer-validation", "portfolio-of-evidence"]
  affects: ["28-06", "28-07"]
tech_stack:
  added:
    - pyclamd>=0.4.0 (ClamAV client for virus scanning)
  patterns:
    - ClamAV fail-open/fail-closed pattern (dev vs production)
    - Per-municipality Supabase Storage bucket naming (salga-evidence-{tenant_id})
    - Pydantic from_attributes=True for ORM response schemas
    - Module-level optional import for mockable pyclamd dependency
key_files:
  created:
    - src/models/evidence.py
    - src/schemas/evidence.py
    - src/services/evidence_service.py
    - alembic/versions/2026_02_28_0007-add_evidence_documents.py
    - tests/test_pms_evidence.py
  modified:
    - src/models/__init__.py (added EvidenceDocument import + __all__)
    - src/core/config.py (added CLAMAV_HOST, CLAMAV_PORT, CLAMAV_ENABLED settings)
    - src/services/sdbip_service.py (added validate_actual method)
    - src/api/v1/sdbip.py (added evidence + validation endpoints)
    - tests/test_pms_actuals.py (added validation tests + router path assertions)
    - pyproject.toml (added pyclamd>=0.4.0)
decisions:
  - pyclamd over python-clamd: python-clamd 0.0.2.dev0 fails on Windows Python 3.12 (sendfds import error); pyclamd 0.4.0 works correctly with ClamdNetworkSocket.scan_stream()
  - Module-level pyclamd import: enables unittest.mock.patch on evidence_service.pyclamd; inline import cannot be patched at module path
  - scan_stream returns None (clean) or dict {'stream':('FOUND','virus')}: different from clamd.instream API — adapted implementation accordingly
  - EvidenceDocument has no cascade delete from SDBIPActual: evidence is permanent audit trail; parent deletion would be a separate governance action
  - Validation endpoint requires PMS_OFFICER, ADMIN, or SALGA_ADMIN: admin and salga_admin bypass for platform management; PMS officer is the operational validator
metrics:
  duration: "~24 minutes"
  completed_date: "2026-03-01"
  tasks_completed: 2
  tests_added: 13
  files_created: 5
  files_modified: 6
---

# Phase 28 Plan 05: Portfolio of Evidence Upload and PMS Officer Validation Summary

**One-liner:** ClamAV-scanned evidence upload with per-municipality Supabase Storage buckets, pyclamd library, and PMS officer actual validation (fail-open in dev, fail-closed in production).

## What Was Built

### Task 1a: EvidenceDocument model, ClamAV service, and evidence tests

**`src/models/evidence.py`** — `EvidenceDocument(TenantAwareModel)`:
- FK to `sdbip_actuals.id` (FK links evidence to quarterly actual)
- `scan_status`: `pending`, `clean`, `infected`, `scan_failed`
- `storage_path`: `actuals/{actual_id}/{uuid_filename}` in `salga-evidence-{tenant_id}` bucket
- No cascade delete — evidence is permanent audit trail

**`src/schemas/evidence.py`** — Three schemas:
- `EvidenceUploadResponse` — returned after upload (from_attributes=True)
- `EvidenceListResponse` — wraps list with total count
- `EvidenceDownloadResponse` — signed URL + expires_in

**`src/core/config.py`** — Added `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_ENABLED` settings.

**`src/services/evidence_service.py`** — `EvidenceService`:
- `scan_and_upload()`: enforces 50MB limit, runs ClamAV scan (if enabled), uploads to Supabase, persists DB record
- `_run_clamav_scan()`: uses `pyclamd.ClamdNetworkSocket.scan_stream()`
  - `None` return → clean
  - `{'stream': ('FOUND', 'virus_name')}` → raise 422
  - Exception → fail-open in dev (scan_failed), fail-closed in production (422)
- `list_evidence()`: returns all documents for an actual ordered by upload time
- `get_signed_url()`: generates 1-hour Supabase signed URL with fallback API path

**ClamAV integration key decision:** `pyclamd` is imported at module level (not inline in methods) so that `unittest.mock.patch("src.services.evidence_service.pyclamd")` works correctly. Inline imports cannot be patched at module path.

**Alembic migration `2026_02_28_0007-add_evidence_documents.py`** — Creates `evidence_documents` table with RLS policy.

**`tests/test_pms_evidence.py`** — 9 tests:
1. `test_evidence_upload` — CLAMAV_ENABLED=False, scan_status="clean"
2. `test_evidence_upload_clamav_enabled_clean` — mock ClamAV returning None (clean)
3. `test_virus_rejected` — mock FOUND → 422 with virus name
4. `test_virus_rejected_production` — same 422 in production
5. `test_list_evidence_for_actual` — 3 docs uploaded → list returns all 3
6. `test_list_evidence_empty_for_new_actual` — empty list for new actual
7. `test_evidence_scan_fail_dev` — ClamAV error in dev → scan_failed, doc created
8. `test_evidence_scan_fail_production` — ClamAV error in production → 422
9. `test_evidence_imports` — all imports clean

### Task 1b: SDBIPService validation, API endpoints, and validation tests

**`src/services/sdbip_service.py`** — Added `validate_actual()`:
- Sets `is_validated=True`, `validated_by=str(user.id)`, `validated_at=utcnow()`
- Guard: already validated → 422
- Not found → 404

**`src/api/v1/sdbip.py`** — Added 4 endpoints:
- `POST /actuals/{actual_id}/evidence` (201) — upload evidence file; Tier 2+ gate
- `GET /actuals/{actual_id}/evidence` (200) — list evidence; Tier 3+ gate
- `GET /evidence/{doc_id}/download` (200) — signed URL; Tier 3+ gate
- `POST /actuals/{actual_id}/validate` (200) — PMS officer validates; PMS_OFFICER/ADMIN/SALGA_ADMIN gate

**`tests/test_pms_actuals.py`** — 4 new tests (34 total, all pass):
1. `test_pms_officer_validates_actual` — is_validated=True, validated_by, validated_at set
2. `test_validate_preserves_achievement_data` — achievement_pct and traffic_light unchanged
3. `test_already_validated_returns_422` — idempotency guard: second validation → 422
4. `test_validate_nonexistent_actual_returns_404` — fake ID → 404

## Test Results

```
tests/test_pms_evidence.py: 9 passed
tests/test_pms_actuals.py:  34 passed (30 existing + 4 new)
Total: 43 tests, 0 failures
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] python-clamd incompatible on Windows Python 3.12**
- **Found during:** Task 1a setup
- **Issue:** `python-clamd 0.0.2.dev0` fails with `ImportError: cannot import name 'sendfds' from 'multiprocessing.reduction'` on Windows 3.12
- **Fix:** Used `pyclamd 0.4.0` instead — supports `ClamdNetworkSocket` + `scan_stream()` correctly
- **Files modified:** `pyproject.toml`, `src/services/evidence_service.py`
- **Commit:** c42962e

**2. [Rule 1 - Bug] pyclamd module-level import needed for test mockability**
- **Found during:** Task 1a test execution
- **Issue:** Inline `import pyclamd` inside method body cannot be patched via `unittest.mock.patch("src.services.evidence_service.pyclamd")` — attribute not found on module
- **Fix:** Moved to module-level import with `try/except ImportError` fallback; `pyclamd = None` sentinel
- **Files modified:** `src/services/evidence_service.py`
- **Commit:** c42962e

**3. [Rule 1 - Bug] SyntaxWarning: invalid escape sequence in EICAR test bytes literal**
- **Found during:** Task 1a test execution
- **Issue:** `b"X5O!P%@AP[4\PZX54..."` contains `\P` escape sequence causing SyntaxWarning
- **Fix:** Replaced with clean test bytes `b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"`
- **Files modified:** `tests/test_pms_evidence.py`
- **Commit:** c42962e

**4. [Rule 1 - Bug] pyclamd.scan_stream() API differs from plan's clamd.instream() API**
- **Found during:** Task 1a implementation
- **Issue:** Plan referenced `clamd.ClamdNetworkSocket.instream()` returning `{'stream': ('OK', None)}` or `('FOUND', ...)`; actual `pyclamd.scan_stream()` returns `None` (clean) or `{'stream': ('FOUND', 'name')}`
- **Fix:** Adapted implementation: `None` return = clean, `FOUND` tuple = infected; eliminated the `('OK', None)` branch
- **Files modified:** `src/services/evidence_service.py`
- **Commit:** c42962e

None of these deviations required Rule 4 (architectural) decision — all were library API adaptation and test correctness fixes.

## Self-Check: PASSED
