"""Pydantic schemas for evidence document upload and retrieval.

Schemas:
- EvidenceUploadResponse: Single evidence document (after upload)
- EvidenceListResponse:   List of evidence documents for an actual
- EvidenceDownloadResponse: Signed URL for secure document download
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EvidenceUploadResponse(BaseModel):
    """Response schema for a successfully uploaded evidence document.

    Returned by POST /actuals/{actual_id}/evidence after virus scan + storage upload.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actual_id: UUID
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    storage_path: str
    scan_status: str
    uploaded_by: str | None
    created_at: datetime


class EvidenceListResponse(BaseModel):
    """Response schema for listing evidence documents for an actual.

    Returned by GET /actuals/{actual_id}/evidence.
    """

    documents: list[EvidenceUploadResponse]
    total: int


class EvidenceDownloadResponse(BaseModel):
    """Response schema for evidence document download URL.

    Returned by GET /evidence/{doc_id}/download.
    """

    signed_url: str
    expires_in: int  # seconds
