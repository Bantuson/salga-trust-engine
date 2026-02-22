"""Proof of residence verification endpoints.

Provides endpoints for uploading proof of residence documents, running OCR extraction,
and checking verification status.
"""
import logging
from datetime import datetime
from io import BytesIO
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db
from src.core.supabase import get_supabase_admin
from src.middleware.rate_limit import SENSITIVE_READ_RATE_LIMIT, VERIFICATION_RATE_LIMIT, limiter
from src.models.media import MediaAttachment
from src.models.user import User
from src.schemas.media import PresignedUploadResponse
from src.schemas.user import UserVerificationRequest, UserVerificationResponse
from src.services.image_utils import strip_exif_metadata, validate_image_quality
from src.services.ocr_service import OCRService
from src.services.storage_service import StorageService, StorageServiceError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/verification", tags=["verification"])


class VerificationResult(BaseModel):
    """Response schema for proof of residence verification."""

    status: str
    address: str | None = None
    confidence: float
    document_type: str | None = None
    message: str


class UploadURLRequest(BaseModel):
    """Request schema for presigned upload URL generation."""

    filename: str
    content_type: str


@router.post("/upload-url", response_model=PresignedUploadResponse)
@limiter.limit(VERIFICATION_RATE_LIMIT)
async def generate_upload_url(
    request: Request,
    upload_url_request: UploadURLRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate presigned POST URL for proof of residence document upload.

    POPIA Compliance: By uploading this document, users consent to automated
    processing of their proof of residence for account verification. Documents
    may contain biometric data (facial images) and will be deleted within 90 days
    of verification.

    Args:
        upload_url_request: Upload request with filename and content type
        current_user: Authenticated user

    Returns:
        Presigned POST URL with fields for direct browser upload

    Raises:
        HTTPException: 400 if content type not supported, 503 if S3 not configured
    """
    # Validate content type
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if upload_url_request.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type must be one of: {', '.join(allowed_types)}"
        )

    # Generate file_id
    file_id = str(uuid4())

    # Generate presigned POST URL
    storage_service = StorageService()
    try:
        presigned_data = storage_service.generate_presigned_post(
            purpose="proof_of_residence",
            tenant_id=str(current_user.tenant_id),
            user_id=str(current_user.id),
            file_id=file_id,
            filename=upload_url_request.filename,
            content_type=upload_url_request.content_type,
            max_size=5 * 1024 * 1024  # 5MB max for documents
        )

        return PresignedUploadResponse(
            url=presigned_data["url"],
            fields=presigned_data["fields"],
            file_id=presigned_data["file_id"]
        )
    except StorageServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


@router.post("/proof-of-residence", response_model=VerificationResult)
@limiter.limit(VERIFICATION_RATE_LIMIT)
async def verify_proof_of_residence(
    request: Request,
    verification_request: UserVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify proof of residence using OCR extraction.

    Workflow:
    1. Check user not already verified
    2. Lookup document by file_id in MediaAttachment
    3. Download document from S3
    4. Strip EXIF metadata (privacy)
    5. Validate image quality
    6. Run OCR extraction
    7. Determine verification result (auto-verify, pending, rejected)
    8. Update user verification status and address

    Args:
        verification_request: Verification request with document_file_id
        current_user: Authenticated user
        db: Database session

    Returns:
        Verification result with status, address, confidence, document type

    Raises:
        HTTPException: 400 if already verified, 404 if document not found,
                      422 if image quality insufficient, 503 if S3 not configured
    """
    # Check user not already verified
    if current_user.verification_status == "verified":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already verified. Re-verification not allowed."
        )

    # Lookup MediaAttachment by file_id
    result = await db.execute(
        select(MediaAttachment).where(
            MediaAttachment.file_id == verification_request.document_file_id,
            MediaAttachment.tenant_id == current_user.tenant_id
        )
    )
    media = result.scalar_one_or_none()

    if not media:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found. Upload document first via /upload-url endpoint."
        )

    # Download document from S3
    storage_service = StorageService()
    try:
        # Generate presigned GET URL
        download_url = storage_service.generate_presigned_get(
            bucket=media.s3_bucket,
            key=media.s3_key,
            expiry=300  # 5 minutes
        )

        # Download document bytes
        async with httpx.AsyncClient() as client:
            response = await client.get(download_url, timeout=30.0)
            response.raise_for_status()
            image_bytes = response.content

    except StorageServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service error: {e}"
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to download document: {e}"
        )

    # Strip EXIF metadata (privacy compliance)
    try:
        image_bytes = strip_exif_metadata(image_bytes)
    except Exception as e:
        # If EXIF stripping fails, continue with original (better to process than fail)
        pass

    # Validate image quality
    quality_check = validate_image_quality(image_bytes)
    if not quality_check["valid"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=quality_check["reason"]
        )

    # Run OCR extraction
    ocr_service = OCRService()
    ocr_data = ocr_service.extract_proof_of_residence(image_bytes)

    # Determine verification result
    verification_result = ocr_service.determine_verification_result(ocr_data)

    # Update user verification status
    current_user.verification_status = verification_result["status"]
    current_user.verified_address = ocr_data.address
    current_user.verification_document_id = verification_request.document_file_id

    if verification_result["status"] == "verified":
        current_user.verified_at = datetime.utcnow()

    await db.commit()

    # Sync residence_verified flag to Supabase user_metadata
    # This bridges the DB verification status to the frontend session gate
    if verification_result["status"] == "verified":
        supabase_admin = get_supabase_admin()
        if supabase_admin:
            try:
                supabase_admin.auth.admin.update_user_by_id(
                    str(current_user.id),
                    {
                        "user_metadata": {
                            "residence_verified": True,
                            "residence_verified_at": datetime.utcnow().isoformat(),
                        }
                    }
                )
                logger.info(
                    f"Synced residence_verified=True to Supabase for user {current_user.id}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to sync residence_verified to Supabase for user {current_user.id}: {e}",
                    exc_info=True
                )
                # Do NOT raise — DB is already committed, user is verified locally
        else:
            logger.warning(
                f"Supabase admin client not configured. residence_verified not synced to Supabase "
                f"for user {current_user.id}. Frontend gate will not unlock until Supabase is configured."
            )

    await db.refresh(current_user)

    # Build response message
    if verification_result["status"] == "verified":
        message = "Proof of residence verified successfully."
    elif verification_result["status"] == "pending":
        message = verification_result.get("reason", "Manual review required.")
    else:
        message = verification_result.get(
            "reason",
            "Verification rejected. Please upload a clearer document."
        )

    return VerificationResult(
        status=verification_result["status"],
        address=ocr_data.address,
        confidence=ocr_data.confidence,
        document_type=ocr_data.document_type,
        message=message
    )


@router.get("/status", response_model=UserVerificationResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_verification_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get current user's verification status.

    Args:
        current_user: Authenticated user

    Returns:
        User verification status with address and verified timestamp
    """
    return UserVerificationResponse(
        verification_status=current_user.verification_status,
        verified_address=current_user.verified_address,
        verified_at=current_user.verified_at
    )
