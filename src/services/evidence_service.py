"""Evidence document service for portfolio of evidence (POE) uploads.

Responsibilities:
1. ClamAV virus scanning before storage upload (pyclamd library)
2. Upload to per-municipality Supabase Storage bucket
3. Database record creation for each evidence document
4. Signed URL generation for downloads

ClamAV behaviour:
  - CLAMAV_ENABLED=False (default/dev): skip scan, set scan_status="clean"
  - CLAMAV_ENABLED=True + daemon reachable: scan bytes, reject infected files (422)
  - CLAMAV_ENABLED=True + daemon unavailable:
      - development: fail-open (warn, allow upload, set scan_status="scan_failed")
      - production:  fail-closed (raise 422 — cannot accept unscanned files)

Bucket naming: salga-evidence-{tenant_id}
Storage path:  actuals/{actual_id}/{uuid_hex}_{original_filename}
"""
import io
import logging
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.models.evidence import EvidenceDocument
from src.models.user import User
from src.services.storage_service import StorageService

logger = logging.getLogger(__name__)

# pyclamd is an optional dependency: imported at module level so tests can patch it.
# If not installed, CLAMAV_ENABLED=True will raise an ImportError caught in _run_clamav_scan.
try:
    import pyclamd  # type: ignore[import-untyped]  # noqa: F401
except ImportError:  # pragma: no cover
    pyclamd = None  # type: ignore[assignment]


class EvidenceService:
    """Service for virus-scanned evidence document upload and retrieval."""

    # Maximum allowed file size: 50 MB
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024

    # ------------------------------------------------------------------
    # Core upload: scan then store
    # ------------------------------------------------------------------

    async def scan_and_upload(
        self,
        file_content: bytes,
        filename: str,
        content_type: str,
        actual_id: UUID,
        user: User,
        db: AsyncSession,
    ) -> EvidenceDocument:
        """Scan file with ClamAV, upload to Supabase Storage, persist DB record.

        Args:
            file_content:  Raw file bytes to scan and upload.
            filename:      Original filename provided by the uploader.
            content_type:  MIME type of the file.
            actual_id:     UUID of the SDBIPActual this evidence supports.
            user:          Authenticated requesting user (for tenant + audit trail).
            db:            Async database session.

        Returns:
            Newly created EvidenceDocument record.

        Raises:
            HTTPException 422: File infected by virus (always), or scan failure in production.
            HTTPException 422: File exceeds 50 MB size limit.
        """
        # Enforce file size limit
        if len(file_content) > self.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=422,
                detail=f"File exceeds maximum size of 50MB ({len(file_content)} bytes)",
            )

        # -------------------------------------------------------------------
        # Step 1: ClamAV virus scan
        # -------------------------------------------------------------------
        scan_status = "clean"  # default when ClamAV is disabled

        if settings.CLAMAV_ENABLED:
            scan_status = await self._run_clamav_scan(file_content)

        # -------------------------------------------------------------------
        # Step 2: Generate unique storage path
        # -------------------------------------------------------------------
        unique_filename = f"{uuid4().hex}_{filename}"
        bucket = f"salga-evidence-{user.tenant_id}"
        storage_path = f"actuals/{actual_id}/{unique_filename}"

        # -------------------------------------------------------------------
        # Step 3: Upload to Supabase Storage (best-effort — log failures)
        # -------------------------------------------------------------------
        await self._upload_to_storage(
            bucket=bucket,
            storage_path=storage_path,
            file_content=file_content,
            content_type=content_type,
        )

        # -------------------------------------------------------------------
        # Step 4: Create DB record
        # -------------------------------------------------------------------
        doc = EvidenceDocument(
            tenant_id=user.tenant_id,
            actual_id=actual_id,
            filename=unique_filename,
            original_filename=filename,
            content_type=content_type,
            file_size=len(file_content),
            storage_path=storage_path,
            scan_status=scan_status,
            uploaded_by=str(user.id),
            created_by=str(user.id),
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        logger.info(
            "EvidenceDocument uploaded: id=%s actual=%s file=%s size=%d scan=%s by=%s",
            doc.id, actual_id, filename, len(file_content), scan_status, user.id,
        )
        return doc

    # ------------------------------------------------------------------
    # List evidence for an actual
    # ------------------------------------------------------------------

    async def list_evidence(
        self,
        actual_id: UUID,
        db: AsyncSession,
    ) -> list[EvidenceDocument]:
        """Return all evidence documents for a given actual, ordered by creation time.

        Args:
            actual_id: UUID of the parent SDBIPActual.
            db:        Async database session.

        Returns:
            List of EvidenceDocument instances, newest last.
        """
        result = await db.execute(
            select(EvidenceDocument)
            .where(EvidenceDocument.actual_id == actual_id)
            .order_by(EvidenceDocument.created_at)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Generate signed download URL
    # ------------------------------------------------------------------

    async def get_signed_url(
        self,
        doc_id: UUID,
        db: AsyncSession,
    ) -> str:
        """Generate a signed download URL for an evidence document.

        Returns a Supabase Storage signed URL (1-hour expiry) if storage is
        available, or a fallback API path for local/dev environments.

        Args:
            doc_id: UUID of the EvidenceDocument.
            db:     Async database session.

        Returns:
            Signed URL string (or fallback path).

        Raises:
            HTTPException 404: Document not found.
        """
        doc = await db.get(EvidenceDocument, doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail="Evidence document not found")

        try:
            storage_service = StorageService()
            if storage_service._storage_available:
                bucket = f"salga-evidence-{doc.tenant_id}"
                signed_url = storage_service.get_signed_url(
                    bucket=bucket,
                    path=doc.storage_path,
                    expiry=3600,
                )
                return signed_url
        except Exception as exc:
            logger.warning(
                "Failed to generate signed URL for evidence %s: %s — using fallback path",
                doc_id, exc,
            )

        # Fallback: return API download path
        return f"/api/v1/sdbip/evidence/{doc_id}/download"

    # ------------------------------------------------------------------
    # Private: ClamAV scan
    # ------------------------------------------------------------------

    async def _run_clamav_scan(self, file_content: bytes) -> str:
        """Run ClamAV scan on file bytes. Returns scan_status string.

        Args:
            file_content: Raw bytes to scan.

        Returns:
            "clean" if scan passed, "scan_failed" if scanner unavailable in dev.

        Raises:
            HTTPException 422: If virus found (always), or scan failure in production.
        """
        if pyclamd is None:
            # pyclamd not installed at module level
            logger.warning("pyclamd not installed — cannot perform virus scan")
            if settings.ENVIRONMENT == "production":
                raise HTTPException(
                    status_code=422,
                    detail="Virus scan unavailable — upload blocked in production",
                )
            return "scan_failed"

        try:
            cd = pyclamd.ClamdNetworkSocket(
                host=settings.CLAMAV_HOST,
                port=settings.CLAMAV_PORT,
                timeout=30,
            )
            # scan_stream returns None (clean) or {'stream': ('FOUND', 'virusname')}
            result = cd.scan_stream(io.BytesIO(file_content))

            if result is None:
                # Clean — no virus found
                return "clean"

            # Virus found in stream
            stream_result = result.get("stream")
            if stream_result and stream_result[0] == "FOUND":
                virus_name = stream_result[1] if len(stream_result) > 1 else "unknown"
                raise HTTPException(
                    status_code=422,
                    detail=f"File rejected by virus scanner: {virus_name}",
                )

            # Unexpected result format — treat as scan failure
            logger.warning("ClamAV returned unexpected result format: %s", result)
            return "scan_failed"

        except HTTPException:
            raise  # Always propagate our own 422s

        except Exception as exc:
            # ClamAV daemon not reachable or other error
            logger.warning("ClamAV scan failed: %s", exc)
            if settings.ENVIRONMENT == "production":
                raise HTTPException(
                    status_code=422,
                    detail=f"Virus scan unavailable — upload blocked in production: {exc}",
                )
            # Fail-open in development: allow upload with scan_failed status
            logger.warning("ClamAV unavailable (fail-open in dev): %s", exc)
            return "scan_failed"

    # ------------------------------------------------------------------
    # Private: Supabase Storage upload (best-effort)
    # ------------------------------------------------------------------

    async def _upload_to_storage(
        self,
        bucket: str,
        storage_path: str,
        file_content: bytes,
        content_type: str,
    ) -> None:
        """Upload file to Supabase Storage. Logs failures but does not raise.

        Evidence DB record is created regardless of storage outcome. In dev/test
        environments where Supabase is not configured, this is a no-op.

        Args:
            bucket:       Supabase Storage bucket name (e.g., salga-evidence-{tenant_id}).
            storage_path: Path within bucket (e.g., actuals/{actual_id}/{filename}).
            file_content: Raw bytes to upload.
            content_type: MIME type for storage metadata.
        """
        try:
            storage_service = StorageService()
            if storage_service._storage_available:
                await storage_service.upload_file(
                    bucket=bucket,
                    path=storage_path,
                    content=file_content,
                    content_type=content_type,
                )
        except Exception as exc:
            logger.warning(
                "Storage upload failed for bucket=%s path=%s (DB record still created): %s",
                bucket, storage_path, exc,
            )
