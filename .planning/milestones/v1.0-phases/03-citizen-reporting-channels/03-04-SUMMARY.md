---
phase: 03-citizen-reporting-channels
plan: 04
subsystem: web-portal-reporting
tags: [api, frontend, s3-uploads, gps, geolocation, react, typescript]
completed: 2026-02-09T21:16:08Z
duration: 16.2m

dependency-graph:
  requires:
    - 03-01 (storage infrastructure, MediaAttachment model, S3 service)
    - 02-02 (IntakeFlow for AI classification)
    - 02-04 (guardrails engine for input validation)
  provides:
    - Presigned upload API for direct browser S3 uploads
    - Web portal report submission API with GPS/manual address
    - React frontend with FileUpload, GeolocationCapture, and ReportForm components
  affects:
    - MediaAttachment model (ticket_id now nullable for upload-first workflow)
    - IntakeFlow (called for AI classification when category not provided)
    - Ticket creation (supports web-sourced reports with GPS coordinates)

tech-stack:
  added:
    - React 18 with TypeScript and Vite
    - react-dropzone 14 for drag-and-drop file upload
    - axios 1.6 for HTTP client
    - HTML5 Geolocation API for GPS capture
  patterns:
    - Presigned POST URLs for direct browser-to-S3 uploads (reduces server load)
    - Upload-first workflow (create MediaAttachment before ticket exists, link later)
    - GPS with manual address fallback (either/or validation via Pydantic)
    - GBV consent dialog with emergency contact numbers

key-files:
  created:
    - src/schemas/report.py (LocationData, ReportSubmitRequest, ReportSubmitResponse)
    - src/api/v1/uploads.py (presigned URL generation, upload confirmation)
    - src/api/v1/reports.py (submit, get by tracking number, get my reports)
    - frontend/src/services/api.ts (API client with presigned upload flow)
    - frontend/src/hooks/useGeolocation.ts (HTML5 Geolocation wrapper with error handling)
    - frontend/src/components/FileUpload.tsx (drag-drop with presigned S3 upload)
    - frontend/src/components/GeolocationCapture.tsx (GPS or manual address)
    - frontend/src/components/ReportForm.tsx (complete report submission form)
  modified:
    - src/models/media.py (ticket_id nullable, file_id indexed)

decisions:
  - "Use presigned POST URLs for direct browser uploads (not multipart to backend)"
  - "Upload-first workflow: MediaAttachment created without ticket_id, linked on report submission"
  - "GPS coordinates captured with 10s timeout and high accuracy enabled"
  - "Manual address as fallback when GPS unavailable (Pydantic validator requires one of location or manual_address)"
  - "AI classification optional: user can pre-select category or let IntakeFlow classify"
  - "GBV consent dialog shows emergency numbers (10111, 0800 150 150) before submission"
  - "Tracking number lookup and my-reports endpoints for status checking"

metrics:
  tasks: 2
  commits: 2
  files: 26
  duration: 16.2m (971s)
---

# Phase 03 Plan 04: Web Portal Report Submission Summary

JWT-authenticated web portal API and React frontend for citizen reporting with presigned S3 uploads and HTML5 GPS geolocation

## What was Built

**Backend API:**
- Presigned upload endpoint generates S3 POST URLs for direct browser uploads (10MB images, 5MB PDFs)
- Upload confirmation endpoint creates MediaAttachment records without ticket_id (linked later)
- Report submission endpoint validates via guardrails, optionally runs IntakeFlow for AI classification, creates ticket with GPS/address, links media, triggers SAPS notification for GBV
- Tracking number lookup endpoint returns ticket details (GBV description masked for non-SAPS users)
- My-reports endpoint returns paginated user tickets (most recent first)

**Frontend Components:**
- API service with presigned upload flow (request URL -> upload to S3 -> confirm completion)
- useGeolocation hook wraps HTML5 Geolocation API with 10s timeout and error handling
- FileUpload component with react-dropzone for drag-and-drop, presigned S3 upload, and progress tracking
- GeolocationCapture component requests GPS coordinates, falls back to manual address input on error
- ReportForm combines all components with description (10-5000 chars), optional category, location, optional media (max 3), language selector, GBV toggle with consent dialog

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Consumes:**
- StorageService.generate_presigned_post() for S3 upload URLs (from 03-01)
- IntakeFlow for AI classification when category not provided (from 02-02)
- guardrails_engine.process_input() for description validation (from 02-04)
- MediaAttachment model for linking uploaded files to tickets (from 03-01)
- Ticket model for report creation with GPS coordinates (from 02-01)

**Produces:**
- Presigned upload API consumed by React FileUpload component
- Report submission API creates tickets with web source and GPS metadata
- Tracking number API for citizen status checking
- React frontend for web-based report submission

## Verification Results

**Passed:**
- Upload and Report routes registered in FastAPI app
- TypeScript compilation passed with no errors
- All endpoints accept required authentication (get_current_user dependency)
- GBV encryption handled correctly (encrypted_description field, is_sensitive flag)
- MediaAttachment.ticket_id nullable for upload-first workflow

**Not Tested:**
- End-to-end integration test (would require database, S3, and Redis)
- pytest suite not run (focused on API/frontend creation per plan scope)

## Follow-up Tasks

None - plan complete. Next plan (03-05 or 04-01) can build on this foundation.

## Self-Check: PASSED

**Created files exist:**
- FOUND: src/schemas/report.py
- FOUND: src/api/v1/uploads.py
- FOUND: src/api/v1/reports.py
- FOUND: frontend/src/services/api.ts
- FOUND: frontend/src/hooks/useGeolocation.ts
- FOUND: frontend/src/components/FileUpload.tsx
- FOUND: frontend/src/components/GeolocationCapture.tsx
- FOUND: frontend/src/components/ReportForm.tsx

**Commits exist:**
- FOUND: 8539987 (feat(03-04): add web portal report submission API with presigned uploads)
- FOUND: c6993c1 (feat(03-04): add React frontend for web report submission)

All files and commits verified successfully.
