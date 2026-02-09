---
phase: 03-citizen-reporting-channels
plan: 03
subsystem: ocr-verification
tags:
  - ocr
  - tesseract
  - proof-of-residence
  - document-verification
  - image-processing
  - privacy
  - popia
dependency_graph:
  requires:
    - 03-01-storage-infrastructure
  provides:
    - proof_of_residence_verification
    - ocr_extraction_service
    - document_upload_urls
  affects:
    - user_verification_flow
    - account_municipality_binding
tech_stack:
  added:
    - pytesseract
    - exifread
    - Pillow (PIL)
  patterns:
    - OCR preprocessing pipeline
    - EXIF metadata stripping
    - Confidence-based verification
    - Presigned S3 URLs
key_files:
  created:
    - src/services/image_utils.py
    - src/services/ocr_service.py
    - src/api/v1/verification.py
  modified:
    - src/main.py
decisions:
  - title: Tesseract OCR with graceful degradation
    rationale: Tesseract is industry-standard for document OCR. Graceful degradation allows application to run in CI/testing without Tesseract installed.
    alternatives: Cloud OCR APIs (Google Vision, AWS Textract) - rejected due to cost and privacy concerns for document processing.
  - title: Confidence-based verification thresholds
    rationale: "Auto-verify at >= 0.7 confidence balances automation with accuracy. Manual review at >= 0.5 prevents false rejections. Reject < 0.5 to avoid poor quality documents."
    alternatives: Fixed thresholds per document type - deferred to future optimization.
  - title: EXIF stripping for privacy
    rationale: POPIA compliance requires removing GPS coordinates and device metadata from uploaded images before storage/processing.
    alternatives: Selective EXIF preservation - rejected as full stripping is safest for privacy.
  - title: South African address patterns
    rationale: Regex patterns optimized for SA address formats (street addresses, PO Box, postal codes). Covers common utility bill and bank statement layouts.
    alternatives: ML-based address extraction - deferred to future enhancement.
metrics:
  duration: 543s
  completed_date: "2026-02-09T21:09:04Z"
---

# Phase 03 Plan 03: OCR Proof of Residence Verification Summary

**One-liner:** Tesseract OCR extracts address and name from South African proof of residence documents with confidence-based auto-verification (>= 0.7), manual review fallback (>= 0.5), and EXIF metadata stripping for privacy compliance.

## Tasks Completed

| Task | Name                                       | Commit  | Files                                                     |
| ---- | ------------------------------------------ | ------- | --------------------------------------------------------- |
| 1    | Image Utilities and OCR Service            | b7c551d | src/services/image_utils.py, src/services/ocr_service.py  |
| 2    | Proof of Residence Verification API        | dc09a53 | src/api/v1/verification.py, src/main.py                   |

## What Was Built

### Image Preprocessing and Privacy Utilities

**src/services/image_utils.py** provides:
- **preprocess_image_for_ocr**: Converts images to grayscale, increases contrast (2.0x), applies binary threshold (128), and denoises with MedianFilter for improved OCR accuracy
- **strip_exif_metadata**: Removes all EXIF metadata (GPS, device info, timestamps) from images for POPIA privacy compliance
- **extract_gps_from_exif**: Extracts GPS coordinates from EXIF data before stripping (useful for field worker evidence photos in future)
- **validate_image_quality**: Checks minimum dimensions (800x600) and file size (50KB) to ensure images are suitable for OCR

### OCR Extraction Service

**src/services/ocr_service.py** provides:
- **OCRService class** with Tesseract OCR integration
- **extract_proof_of_residence**: Preprocesses image, runs OCR, calculates confidence scores, extracts address/name/document type
- **South African address pattern recognition**: Regex patterns for street addresses, PO Box addresses, and postal codes (4-digit SA format)
- **Name extraction**: Patterns for titles (Mr/Mrs/Ms/Dr), account holder labels, and capitalized name sequences
- **Document type detection**: Identifies utility bills, bank statements, lease agreements, and municipal accounts based on keywords
- **Confidence-based verification logic**:
  - confidence >= 0.7 AND address AND name found → auto-verify
  - confidence >= 0.5 AND (address OR name) found → pending (manual review)
  - confidence < 0.5 → reject (poor quality)
- **Graceful degradation**: If Tesseract not installed, service returns low confidence scores instead of crashing (enables CI/testing)

### Verification API Endpoints

**src/api/v1/verification.py** provides three endpoints:

1. **POST /api/v1/verification/upload-url**: Generates presigned S3 POST URL for document uploads
   - Accepts image/jpeg, image/png, or application/pdf
   - Max 5MB file size
   - Returns presigned URL with file_id for direct browser upload
   - Includes POPIA consent message about biometric data processing and 90-day retention

2. **POST /api/v1/verification/proof-of-residence**: Runs OCR verification workflow
   - Checks user not already verified
   - Looks up MediaAttachment by file_id
   - Downloads document from S3 using presigned GET URL
   - Strips EXIF metadata for privacy
   - Validates image quality
   - Runs OCR extraction
   - Determines verification result (verified/pending/rejected)
   - Updates user fields: verification_status, verified_address, verification_document_id, verified_at
   - Returns verification result with status, address, confidence, document type, and message

3. **GET /api/v1/verification/status**: Returns current user verification status
   - Returns verification_status, verified_address, verified_at from user record

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] OCR service returns ProofOfResidenceData with address, name, type, confidence
- [x] Image preprocessing improves OCR output (grayscale, contrast, threshold, denoise)
- [x] EXIF stripping removes GPS and device metadata for privacy
- [x] Verification endpoint accepts document_file_id and returns verification result
- [x] User verification_status updated in database (verified/pending/rejected)
- [x] Upload URL endpoint returns presigned POST for proof_of_residence purpose
- [x] Routes registered in FastAPI app (/upload-url, /proof-of-residence, /status)
- [x] OCR extracts South African addresses from document images (street, PO Box, postal code patterns)
- [x] Confidence scoring determines auto-verify (>= 0.7) vs manual review (>= 0.5)
- [x] User accounts updated with verification status and extracted address
- [x] Presigned upload URLs generated for document uploads (5MB max)
- [x] POPIA consent captured before document processing (90-day retention notice)
- [x] Graceful degradation when Tesseract not installed (service returns confidence=0 instead of crashing)

## Testing Notes

- Tesseract OCR is optional dependency - when not installed, OCR service logs warning and returns low confidence scores (allows CI/testing to run)
- Manual testing requires Tesseract installation: `pip install pytesseract` and system installation of tesseract-ocr binary
- Image quality validation prevents processing of low-resolution screenshots or thumbnails
- EXIF stripping tested with sample images containing GPS metadata
- Verification routes successfully registered in FastAPI application

## Technical Implementation Details

### OCR Preprocessing Pipeline
1. Convert to grayscale (removes color noise)
2. Increase contrast (2.0x factor)
3. Apply binary threshold (128) for sharp edges
4. Denoise with MedianFilter (size 3)

This pipeline significantly improves OCR accuracy for documents with:
- Poor lighting conditions
- Wrinkled or folded paper
- Low contrast printing
- Smartphone photos (non-scanner)

### South African Address Patterns

**Pattern 1 (Street addresses):**
```regex
\d+\s+[A-Za-z\s]+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Crescent|Cres),?\s*[A-Za-z\s]+,?\s*\d{4}
```
Matches: "123 Main Street, Johannesburg, 2001"

**Pattern 2 (PO Box):**
```regex
P\.?O\.?\s*Box\s+\d+,?\s*[A-Za-z\s]+,?\s*\d{4}
```
Matches: "P.O. Box 1234, Cape Town, 8000"

**Pattern 3 (Generic with postal code):**
```regex
([A-Za-z0-9\s,]+\d{4})
```
Matches any address line containing a 4-digit SA postal code

### Document Type Detection Keywords

| Document Type      | Keywords                                                           |
| ------------------ | ------------------------------------------------------------------ |
| utility_bill       | electricity, eskom, prepaid, kilowatt, kwh                         |
| bank_statement     | bank statement, capitec, fnb, absa, standard bank, nedbank         |
| lease_agreement    | lease agreement, rental, tenancy, landlord, tenant                 |
| municipal_account  | municipal, water, sewerage, refuse, rates, municipality            |

## Integration Points

**Depends on:**
- 03-01 Storage Infrastructure (S3 service, MediaAttachment model)
- User model verification fields (verification_status, verified_address, verification_document_id, verified_at)

**Provides for:**
- Account-municipality binding (PLAT-03 requirement)
- Citizen onboarding workflow
- Trust establishment before ticket creation

**Future integration:**
- Manual review dashboard for pending verifications (Phase 5)
- Re-verification workflow for address changes
- Document expiry handling (utility bills older than 3 months)

## Self-Check: PASSED

**Created files:**
- [x] src/services/image_utils.py exists
- [x] src/services/ocr_service.py exists
- [x] src/api/v1/verification.py exists

**Modified files:**
- [x] src/main.py includes verification router import
- [x] src/main.py includes router registration with prefix="/api/v1"

**Commits:**
- [x] b7c551d exists: feat(03-03): add image utilities and OCR service for proof of residence
- [x] dc09a53 exists: feat(03-03): add proof of residence verification API endpoint

**Verification routes:**
- [x] /api/v1/verification/upload-url registered
- [x] /api/v1/verification/proof-of-residence registered
- [x] /api/v1/verification/status registered

All verification checks passed.
