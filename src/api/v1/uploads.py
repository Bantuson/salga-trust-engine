"""Upload endpoints for presigned S3 URL generation and upload confirmation.

Provides endpoints for citizens to upload evidence photos and documents:
1. Request presigned POST URL for direct browser upload
2. Confirm upload completed and create MediaAttachment record
"""
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db
from src.models.media import MediaAttachment
from src.models.user import User
from src.schemas.media import (
    MediaAttachmentResponse,
    PresignedUploadRequest,
    PresignedUploadResponse,
)
from src.services.storage_service import StorageService, StorageServiceError

router = APIRouter(prefix="/uploads", tags=["uploads"])


# Allowed content types and size limits
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": 10 * 1024 * 1024,  # 10MB for images
    "image/png": 10 * 1024 * 1024,
    "image/webp": 10 * 1024 * 1024,
    "application/pdf": 5 * 1024 * 1024,  # 5MB for PDFs
}


@router.post("/presigned", response_model=PresignedUploadResponse)
async def generate_presigned_upload(
    request: PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
) -> PresignedUploadResponse:
    """Generate Supabase Storage upload path for direct browser upload.

    Frontend uses the returned bucket and path with Supabase JS SDK:
    supabase.storage.from(bucket).upload(path, file)

    Args:
        request: Upload request with filename, content_type, file_size, purpose
        current_user: Authenticated user

    Returns:
        Bucket name, storage path, and file_id

    Raises:
        HTTPException: 400 if content type not allowed or file too large
        HTTPException: 503 if Supabase Storage unavailable
    """
    # Validate content type
    if request.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type '{request.content_type}' not allowed. Allowed types: {', '.join(ALLOWED_CONTENT_TYPES.keys())}"
        )

    # Validate file size
    max_size = ALLOWED_CONTENT_TYPES[request.content_type]
    if request.file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size {request.file_size} exceeds maximum {max_size} bytes for {request.content_type}"
        )

    # Generate file_id
    file_id = str(uuid4())

    # Initialize storage service
    storage_service = StorageService()

    # Generate Supabase Storage upload path
    try:
        upload_info = storage_service.generate_upload_url(
            purpose=request.purpose,
            tenant_id=str(current_user.tenant_id),
            file_id=file_id,
            filename=request.filename,
            content_type=request.content_type
        )
    except StorageServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Storage service unavailable: {str(e)}"
        )

    return PresignedUploadResponse(
        bucket=upload_info["bucket"],
        path=upload_info["path"],
        file_id=upload_info["file_id"]
    )


@router.post("/confirm", response_model=MediaAttachmentResponse)
async def confirm_upload(
    file_id: str,
    purpose: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaAttachmentResponse:
    """Confirm upload completed and create MediaAttachment record.

    This endpoint is called after the client successfully uploads to S3 using
    the presigned URL. It creates a MediaAttachment record in the database
    without a ticket_id (will be linked when report is submitted).

    Args:
        file_id: File identifier from presigned upload
        purpose: Upload purpose (evidence or proof_of_residence)
        current_user: Authenticated user
        db: Database session

    Returns:
        MediaAttachment response

    Raises:
        HTTPException: 400 if invalid purpose
    """
    # Validate purpose
    if purpose not in ["evidence", "proof_of_residence"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid purpose '{purpose}'. Must be 'evidence' or 'proof_of_residence'"
        )

    # Determine bucket and construct storage path
    storage_service = StorageService()
    bucket = storage_service._get_bucket_from_purpose(purpose)
    storage_path = f"{current_user.tenant_id}/{file_id}/uploaded-file"

    # Create MediaAttachment record (without ticket_id - will be linked later)
    media_attachment = MediaAttachment(
        ticket_id=None,  # Will be set when report is submitted
        file_id=file_id,
        s3_bucket=bucket,  # Reusing s3_bucket column for Supabase bucket
        s3_key=storage_path,  # Reusing s3_key column for Supabase path
        filename="uploaded-file",  # Placeholder - would get from Supabase metadata in production
        content_type="image/jpeg",  # Placeholder - would get from Supabase metadata
        file_size=0,  # Placeholder - would get from Supabase metadata
        purpose=purpose,
        source="web",
        is_processed=False,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(media_attachment)
    await db.commit()
    await db.refresh(media_attachment)

    return MediaAttachmentResponse.model_validate(media_attachment)
