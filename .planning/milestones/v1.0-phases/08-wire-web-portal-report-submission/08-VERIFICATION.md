---
phase: 08-wire-web-portal-report-submission
verified: 2026-02-22T17:00:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 08: Wire Web Portal Report Submission — Verification Report

**Phase Goal:** Replace mock submit in ReportIssuePage.tsx with real API call to POST /api/v1/reports/submit. Fix reports.py to use ManagerCrew API instead of removed IntakeFlow methods. When tickets actually create: photos link (RPT-03), GPS saves (RPT-04), tracking numbers issue (RPT-05), GBV tickets create (RPT-06), encryption exercises (RPT-08).
**Verified:** 2026-02-22T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GPS coordinates are persisted as PostGIS location field when a report is submitted with lat/lng | VERIFIED | `from_shape(Point(lng, lat), srid=4326)` at line 138 of reports.py under `USE_POSTGIS` guard; `location=location_value` in Ticket constructor at line 159 |
| 2  | Route GET /reports/my is matched before GET /reports/{tracking_number} so /my does not 404 | VERIFIED | `get_my_reports` defined at line 239, `get_report_by_tracking` defined at line 283 — correct registration order confirmed |
| 3  | Unit tests mock ManagerCrew instead of removed IntakeFlow | VERIFIED | `grep -c "IntakeFlow" tests/test_reports_api.py` returns 0; `grep -c "ManagerCrew" tests/test_reports_api.py` returns 4; `AsyncMock(return_value={"routing_phase": "municipal"})` pattern present |
| 4  | GBV encryption path activates when is_gbv=True and a real ticket is created | VERIFIED | Lines 149-165 of reports.py: `encrypted_description = sanitized_description`, `ticket_description = "GBV incident report"`, `is_sensitive=True` all conditional on `category == "gbv" or report.is_gbv` |
| 5  | Citizen submitting a report via web portal calls POST /api/v1/reports/submit with real Supabase auth token | VERIFIED | `fetch(\`${apiUrl}/api/v1/reports/submit\`, ...)` at line 323 with `Authorization: Bearer ${submitSession.access_token}` at line 326; `supabase.auth.getSession()` called fresh at line 318 |
| 6  | Receipt card displays real tracking number from backend response (TKT-YYYYMMDD-xxxxxx format) | VERIFIED | `trackingNumber: data.tracking_number` at line 341; backend `generate_tracking_number()` used at line 143 of reports.py; test asserts `data["tracking_number"].startswith("TKT-")` |
| 7  | Frontend maps display category strings to backend enum values before submitting | VERIFIED | `CATEGORY_MAP` constant at lines 38-47 of ReportIssuePage.tsx maps "Water & Sanitation" -> "water", "Roads & Potholes" -> "roads" etc.; `backendCategory = isGbv ? 'gbv' : (CATEGORY_MAP[category] ?? 'other')` at line 300 |
| 8  | GPS accuracy is captured and sent in the location payload | VERIFIED | `LocationData` interface includes `accuracy: number` at line 29; `accuracy: position.coords.accuracy` captured at line 125; `accuracy: location.accuracy` sent in payload at line 308; backend schema enforces `Field(gt=0)` |
| 9  | GBV reports send is_gbv: true in request body | VERIFIED | `is_gbv: isGbv` in payload at line 314; `isGbv` state set to `true` on GBV consent accept (line 99); backend overrides category to "gbv" when `report.is_gbv` is true (line 128) |
| 10 | Upload confirm endpoint is called after each file upload to create MediaAttachment DB records | VERIFIED | `fetch(\`${apiUrl}/api/v1/uploads/confirm?file_id=${fileId}...\`, { method: 'POST', ... })` at lines 209-224; confirmed `/api/v1/uploads/confirm` endpoint exists in uploads.py at line 102 and creates MediaAttachment records |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/api/v1/reports.py` | PostGIS location assignment via from_shape, route ordering fix, USE_POSTGIS guard | VERIFIED | 331 lines; contains `from_shape`, `USE_POSTGIS`, `location=location_value`, route `/my` at line 237 before `/{tracking_number}` at line 281; no stale `latitude=`/`longitude=` kwargs |
| `tests/test_reports_api.py` | Updated test mocks for ManagerCrew pipeline | VERIFIED | 440 lines; 4 ManagerCrew references, 0 IntakeFlow references; 12 tests collect cleanly; `AsyncMock(return_value={"routing_phase": "municipal"})` pattern; Ticket constructors use `location=None` |
| `frontend-public/src/pages/ReportIssuePage.tsx` | Real API integration for report submission | VERIFIED | 840 lines; contains `api/v1/reports/submit`, `CATEGORY_MAP`, `accuracy`, `is_gbv`, `data.tracking_number`, `api/v1/uploads/confirm`; mock `setTimeout` removed (grep returns 0) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/api/v1/reports.py` | `src/models/ticket.py` | `Ticket(location=location_value)` using WKBElement from from_shape | WIRED | `location=location_value` at line 159; `from_shape(Point(lng, lat), srid=4326)` at line 138 produces WKBElement |
| `tests/test_reports_api.py` | `src/api/v1/reports.py` | `patch('src.api.v1.reports.ManagerCrew')` | WIRED | Two test methods patch at correct module path; `mock_crew_class.assert_not_called()` and `mock_crew.kickoff = AsyncMock(...)` patterns present |
| `frontend-public/src/pages/ReportIssuePage.tsx` | `POST /api/v1/reports/submit` | fetch with Bearer token from `supabase.auth.getSession()` | WIRED | `fetch(\`${apiUrl}/api/v1/reports/submit\`, { method: 'POST', headers: { Authorization: Bearer ... } })` with fresh session obtained at submit time |
| `frontend-public/src/pages/ReportIssuePage.tsx` | `POST /api/v1/uploads/confirm` | fetch after Supabase Storage upload to create MediaAttachment record | WIRED | Called inside `handlePhotoUpload` after successful storage upload; non-fatal on failure (warn + continue) |
| `frontend-public/src/pages/ReportIssuePage.tsx` | `ReportReceipt` component | `setReceiptData` with `data.tracking_number` from API response | WIRED | `trackingNumber: data.tracking_number` at line 341; `ReportReceipt` rendered at line 390 with `trackingNumber={receiptData.trackingNumber}` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| RPT-02 | 08-02-PLAN.md | Citizen can report service issues via web portal | SATISFIED | Real `POST /api/v1/reports/submit` call replaces mock; no `setTimeout` mock remains; 3 routes registered in reports.py |
| RPT-03 | 08-02-PLAN.md | Citizen can upload photos with report for visual evidence | SATISFIED | `media_file_ids: uploadedFiles.map(f => f.id)` sent in payload; upload confirm endpoint creates MediaAttachment DB records linking files to ticket at submit time |
| RPT-04 | 08-01-PLAN.md | System captures GPS geolocation automatically (with manual address fallback) | SATISFIED | `from_shape(Point(lng, lat), srid=4326)` under `USE_POSTGIS` guard; `address` fallback when no GPS; schema `@model_validator` requires location OR manual_address |
| RPT-05 | 08-02-PLAN.md | Citizen receives unique tracking number for each report | SATISFIED | `generate_tracking_number()` called in backend at line 143; `data.tracking_number` used in receipt; test asserts `startswith("TKT-")` |
| RPT-06 | 08-02-PLAN.md | Citizen can report GBV/domestic violence/abuse as a dedicated category | SATISFIED | `is_gbv: isGbv` sent in payload; backend overrides category to "gbv"; SAPS notification triggered; `is_sensitive=True` set on ticket |
| RPT-08 | 08-01-PLAN.md | GBV report data stored with enhanced encryption and access controls | SATISFIED | `encrypted_description = sanitized_description` and public `ticket_description = "GBV incident report"` set for GBV; `is_sensitive` flag set; GBV redaction in `get_my_reports` and `get_report_by_tracking` for non-SAPS roles |

All 6 requirements from Phase 8 plan frontmatter are satisfied with direct code evidence.

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, RPT-08 to Phase 8. All 6 appear in plan frontmatter and are verified. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend-public/src/pages/ReportIssuePage.tsx` | 796 | `href="https://wa.me/27XXXXXXXXX"` — hardcoded placeholder WhatsApp number | Info | Visual issue only — UX concern, does not affect report submission flow or any RPT requirements. Not a blocker. |
| `src/api/v1/reports.py` | 150 | `# Encrypt actual description and use placeholder for public field` comment uses word "placeholder" | Info | Comment accurately describes the GBV privacy pattern (masking real description with "GBV incident report"); not a code stub |

No blocker anti-patterns found. The `placeholder` occurrences in tests and reports.py refer to legitimate GBV privacy design (public description masked with "GBV incident report").

---

### Human Verification Required

#### 1. End-to-End Submission Flow

**Test:** Log in as a citizen with `residence_verified: true` in user_metadata. Navigate to /report. Select "Water & Sanitation", enter 20+ character description, capture GPS or enter address, click Submit.
**Expected:** Spinner shows, receipt card appears with a real tracking number in TKT-YYYYMMDD-xxxxxx format (not a fake client-generated one).
**Why human:** Requires running backend (PostgreSQL+PostGIS), frontend, and a Supabase auth session simultaneously.

#### 2. Photo Upload and MediaAttachment Linking

**Test:** Upload 1-2 photos during report submission. Submit report. Check DB for MediaAttachment records with the ticket_id populated.
**Expected:** Photos visible in Supabase Storage and MediaAttachment rows have `ticket_id` matching the created ticket.
**Why human:** Requires live Supabase Storage bucket configured and DB access to verify FK linkage.

#### 3. GBV Report Full Flow

**Test:** Select "GBV/Abuse", accept consent dialog, enter description, submit. Check DB.
**Expected:** Ticket created with `category="gbv"`, `is_sensitive=True`, `description="GBV incident report"` (not actual details), `encrypted_description` contains real description. SAPS notification logged.
**Why human:** Requires live DB with PostGIS and SAPS tool import path resolvable.

#### 4. GPS Accuracy Rejection at Schema Level

**Test:** Submit a report with `accuracy: 0` in the location payload via curl.
**Expected:** Backend returns 422 Unprocessable Entity (Pydantic `Field(gt=0)` validation).
**Why human:** Schema validation behavior; requires live API call.

---

### Gaps Summary

No gaps found. All 10 must-have truths are verified with direct code evidence. All 6 phase requirements have implementation evidence. All 3 artifacts are substantive and wired. Frontend production build succeeds with zero TypeScript errors (`npm run build` and `npm run build:check` both pass). 12 tests collect cleanly under `USES_SQLITE_TESTS=1`. All commits claimed in summaries (d812f52, 730a11b, 891e480) exist in git log.

The one notable info-level item — the hardcoded `wa.me/27XXXXXXXXX` WhatsApp link — is a pre-existing placeholder unrelated to Phase 8 scope and does not affect any RPT requirement.

---

_Verified: 2026-02-22T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
