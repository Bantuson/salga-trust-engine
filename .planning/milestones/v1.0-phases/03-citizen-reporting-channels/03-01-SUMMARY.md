---
phase: 03-citizen-reporting-channels
plan: 01
subsystem: storage-infrastructure
tags: [s3, encryption, media, gbv-security, foundational]
dependency_graph:
  requires: [phase-01-foundation, phase-02-agentic-ai]
  provides: [media-attachments, s3-storage, field-encryption, user-verification]
  affects: [whatsapp-media, web-uploads, ocr-processing, gbv-routing]
tech_stack:
  added: [boto3, cryptography, Pillow, pytesseract, exifread, twilio, httpx]
  patterns: [presigned-urls, field-level-encryption, key-rotation, async-http]
key_files:
  created:
    - src/models/media.py
    - src/services/storage_service.py
    - src/core/encryption.py
    - src/schemas/media.py
    - src/services/__init__.py
  modified:
    - src/core/config.py
    - src/models/user.py
    - src/models/ticket.py
    - src/schemas/user.py
    - pyproject.toml
decisions:
  - AWS S3 for media storage with separate buckets for evidence and documents
  - Fernet symmetric encryption with key rotation support via MultiFernet
  - Presigned POST URLs for direct browser uploads (reduces server load)
  - Plaintext mode when encryption keys absent (enables testing without credentials)
  - MediaAttachment.is_processed flag for OCR workflow tracking
  - Ticket.encrypted_description only for GBV tickets (is_sensitive=True)
  - User verification via proof of residence with OCR-extracted address
metrics:
  duration_seconds: 158
  duration_formatted: "2.6 minutes"
  tasks_completed: 2
  files_created: 5
  files_modified: 5
  commits: 2
  completed_date: "2026-02-09"
---

# Phase 03 Plan 01: Storage Infrastructure & Media Foundation Summary

S3 storage service with presigned URLs, MediaAttachment model for ticket evidence, Fernet field-level encryption for GBV sensitive data, and user verification infrastructure for proof of residence.

## Tasks Completed

### Task 1: Media Attachment Model, S3 Storage Service, and Config

**Status:** Complete
**Commit:** 73b147e6c6a1d1fc5d32343d9481ea7c63c50281
**Duration:** ~1.5 minutes

#### What was built

1. **Dependencies added to pyproject.toml:**
   - `boto3>=1.34.0` - AWS S3 client for media storage
   - `cryptography>=42.0.0` - Fernet encryption for GBV data
   - `Pillow>=10.0.0` - Image preprocessing for OCR
   - `pytesseract>=0.3.10` - OCR engine for proof of residence
   - `exifread>=3.0.0` - EXIF metadata extraction/stripping
   - `twilio>=9.0.0` - WhatsApp Business API integration
   - `httpx>=0.28.0` - Async HTTP client (moved from dev to main deps)

2. **Config settings (src/core/config.py):**
   - AWS S3: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_EVIDENCE`, `S3_BUCKET_DOCUMENTS`
   - Encryption: `ENCRYPTION_KEY_CURRENT`, `ENCRYPTION_KEY_PREVIOUS` (for key rotation)
   - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
   - All settings default to empty strings for dev/test environments

3. **MediaAttachment model (src/models/media.py):**
   - Inherits `TenantAwareModel` for multi-tenant isolation
   - Fields: `ticket_id` (FK to tickets), `file_id` (UUID for S3 key), `s3_bucket`, `s3_key`, `filename`, `content_type`, `file_size`, `purpose` (evidence/proof_of_residence), `source` (web/whatsapp), `is_processed` (OCR flag)
   - Unique constraint on `file_id` for S3 key lookups

4. **StorageService class (src/services/storage_service.py):**
   - **Dev mode support:** If AWS credentials empty, `_client = None` (graceful degradation)
   - `generate_presigned_post()`: Creates presigned POST URLs for direct browser uploads with Content-Type and size validation (15-minute expiry)
   - `download_and_upload_media()`: Async method to download from Twilio MediaUrl and upload to S3 with AES256 server-side encryption
   - `generate_presigned_get()`: Creates presigned GET URLs for secure file downloads (1-hour expiry)
   - `StorageServiceError` exception for configuration/operational failures

5. **Media schemas (src/schemas/media.py):**
   - `PresignedUploadRequest`: Validates upload requests (filename, content_type, file_size, purpose)
   - `PresignedUploadResponse`: Returns presigned URL with fields and file_id
   - `MediaAttachmentResponse`: Returns media metadata with ConfigDict(from_attributes=True)

#### Files modified
- `pyproject.toml` (added 7 dependencies)
- `src/core/config.py` (added 16 settings fields)
- `src/models/media.py` (created, 35 lines)
- `src/services/storage_service.py` (created, 204 lines)
- `src/schemas/media.py` (created, 39 lines)
- `src/services/__init__.py` (created, 2 lines)

#### Verification
```bash
python -c "from src.models.media import MediaAttachment; from src.services.storage_service import StorageService; from src.schemas.media import PresignedUploadRequest, PresignedUploadResponse; print('OK')"
# Output: OK
```

---

### Task 2: Fernet Field-Level Encryption and User Verification Fields

**Status:** Complete
**Commit:** a20b445d3d79696cb4b391d4fe2325e0034d6512
**Duration:** ~1.1 minutes

#### What was built

1. **EncryptedString TypeDecorator (src/core/encryption.py):**
   - SQLAlchemy `TypeDecorator` wrapping `String` type
   - Uses Fernet symmetric encryption with MultiFernet for key rotation
   - Supports two keys: `ENCRYPTION_KEY_CURRENT` (primary) and `ENCRYPTION_KEY_PREVIOUS` (for decrypting legacy data)
   - **Plaintext mode:** When `ENCRYPTION_KEY_CURRENT` is empty, stores values as plaintext (enables testing without real keys)
   - `process_bind_param()`: Encrypts on write
   - `process_result_value()`: Decrypts on read
   - `cache_ok = True` for SQLAlchemy caching

2. **Ticket model updates (src/models/ticket.py):**
   - `encrypted_description: Mapped[str | None] = mapped_column(EncryptedString(5000), nullable=True)` - Stores sensitive GBV incident details
   - **Pattern:** For GBV tickets (is_sensitive=True), plain `description` holds generic summary ("GBV incident report"), while `encrypted_description` holds actual sensitive details
   - `media_urls: Mapped[str | None] = mapped_column(Text, nullable=True)` - JSON-serialized list of media file_ids (denormalized convenience field, MediaAttachment is source of truth)

3. **User model updates (src/models/user.py):**
   - `verification_status: Mapped[str] = mapped_column(String(20), nullable=False, default="unverified")` - Values: unverified, pending, verified, rejected
   - `verified_address: Mapped[str | None] = mapped_column(String(500), nullable=True)` - OCR-extracted address from proof of residence
   - `verification_document_id: Mapped[str | None] = mapped_column(String(36), nullable=True)` - file_id of uploaded proof of residence in S3
   - `verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)` - Timestamp of verification approval

4. **User schemas (src/schemas/user.py):**
   - `UserVerificationRequest(BaseModel)`: Contains `document_file_id` (str) for OCR processing request
   - `UserVerificationResponse(BaseModel)`: Returns `verification_status`, `verified_address`, `verified_at` with ConfigDict(from_attributes=True)

#### Files modified
- `src/core/encryption.py` (created, 88 lines)
- `src/models/ticket.py` (modified, added 2 fields)
- `src/models/user.py` (modified, added 4 fields)
- `src/schemas/user.py` (modified, added 2 schemas)

#### Verification
```bash
python -c "from src.core.encryption import EncryptedString; from src.models.ticket import Ticket; from src.models.user import User; print('Ticket has encrypted_description:', hasattr(Ticket, 'encrypted_description')); print('User has verification_status:', hasattr(User, 'verification_status'))"
# Output:
# Ticket has encrypted_description: True
# User has verification_status: True
```

---

## Deviations from Plan

None - plan executed exactly as written. Both tasks completed without modifications or blockers.

---

## Integration Notes

### AWS S3 Setup Required (User Action)

The storage infrastructure is **code-complete** but requires AWS S3 configuration before use:

1. **Create S3 buckets:**
   - Evidence bucket (e.g., `salga-evidence-pilot`) with AES256 default encryption
   - Documents bucket (e.g., `salga-documents-pilot`) with AES256 default encryption
   - Set CORS policy on evidence bucket for browser uploads

2. **Generate IAM credentials:**
   - Create IAM user with S3 read/write permissions
   - Generate access key and secret key

3. **Set environment variables:**
   ```
   AWS_ACCESS_KEY_ID=<from IAM>
   AWS_SECRET_ACCESS_KEY=<from IAM>
   AWS_REGION=af-south-1  # Or eu-west-1 for SA proximity
   S3_BUCKET_EVIDENCE=salga-evidence-pilot
   S3_BUCKET_DOCUMENTS=salga-documents-pilot
   ```

4. **Generate encryption keys:**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   # Set output as ENCRYPTION_KEY_CURRENT
   ```

**Dev Mode:** Without AWS credentials, StorageService raises `StorageServiceError` when methods called. Models import successfully, allowing tests to run without S3.

### Twilio Setup (Deferred to Phase 3 Plan 2)

Twilio credentials added to config but not yet used. Plan 03-02 (WhatsApp integration) will consume these settings.

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Separate S3 buckets for evidence and documents | Different lifecycle policies, access controls, and retention requirements |
| Presigned POST URLs | Direct browser-to-S3 upload reduces server bandwidth, improves upload speed, and simplifies infrastructure |
| Fernet symmetric encryption | Fast, NIST-approved, Python standard library support, simpler key management than asymmetric |
| MultiFernet for key rotation | Zero-downtime key rotation: new data encrypted with current key, old data decrypts with previous key |
| Plaintext mode when keys absent | Allows model imports and testing without real encryption keys (dev/test environments) |
| MediaAttachment.is_processed flag | OCR processing is async; flag tracks completion for downstream workflows |
| Ticket.encrypted_description pattern | Plain description shows generic "GBV incident report" to municipal users without SAPS liaison role; encrypted_description holds actual sensitive details |
| User verification via file_id reference | Proof of residence document stored in S3, file_id reference avoids storing large blobs in PostgreSQL |

---

## Dependency Graph

**This plan provides:**
- `MediaAttachment` model for ticket evidence tracking
- `StorageService` for S3 presigned URLs and Twilio media downloads
- `EncryptedString` type for GBV sensitive data encryption
- User verification fields for proof of residence workflow

**Consumed by:**
- Plan 03-02: WhatsApp media upload (uses `download_and_upload_media()`)
- Plan 03-03: Web portal uploads (uses `generate_presigned_post()`)
- Plan 03-04: OCR processing (uses `MediaAttachment.is_processed` flag and `verified_address` extraction)
- Phase 04: Ticket routing (checks `User.verification_status` before accepting tickets)
- Phase 06: GBV reports (uses `Ticket.encrypted_description` for SAPS-only access)

**Blocks (unblocked now):**
- All Phase 3 Wave 2 plans (03-02, 03-03, 03-04, 03-05) can now proceed in parallel

---

## Testing Notes

All imports verified successfully:
```bash
# Task 1 verification
python -c "from src.models.media import MediaAttachment; from src.services.storage_service import StorageService; from src.schemas.media import PresignedUploadRequest, PresignedUploadResponse; print('OK')"
# Output: OK

# Task 2 verification
python -c "from src.core.encryption import EncryptedString; from src.models.ticket import Ticket; from src.models.user import User; print('Ticket has encrypted_description:', hasattr(Ticket, 'encrypted_description')); print('User has verification_status:', hasattr(User, 'verification_status'))"
# Output: Ticket has encrypted_description: True, User has verification_status: True

# Regression check
python -c "from src.main import app; print('App OK')"
# Output: App OK
```

**Test coverage:** Unit tests for StorageService and EncryptedString can run without AWS credentials (dev mode). Integration tests for actual S3 uploads require AWS credentials and should be marked `@pytest.mark.integration`.

---

## Self-Check: PASSED

### Files Created
- [x] `src/models/media.py` - FOUND
- [x] `src/services/storage_service.py` - FOUND
- [x] `src/core/encryption.py` - FOUND
- [x] `src/schemas/media.py` - FOUND
- [x] `src/services/__init__.py` - FOUND

### Files Modified
- [x] `src/core/config.py` - AWS/encryption/Twilio settings present
- [x] `src/models/user.py` - Verification fields present
- [x] `src/models/ticket.py` - encrypted_description and media_urls present
- [x] `src/schemas/user.py` - Verification schemas present
- [x] `pyproject.toml` - All dependencies added

### Commits Verified
```bash
git log --oneline | grep -q "73b147e" && echo "FOUND: 73b147e (Task 1)" || echo "MISSING: 73b147e"
# FOUND: 73b147e (Task 1)

git log --oneline | grep -q "a20b445" && echo "FOUND: a20b445 (Task 2)" || echo "MISSING: a20b445"
# FOUND: a20b445 (Task 2)
```

### Imports Work
- [x] MediaAttachment model imports successfully
- [x] StorageService imports successfully
- [x] EncryptedString imports successfully
- [x] Media schemas import successfully
- [x] User verification schemas import successfully
- [x] Main app imports without errors (no regressions)

All verifications passed. Plan complete.
