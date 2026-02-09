"""Media Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PresignedUploadRequest(BaseModel):
    """Schema for requesting a presigned upload URL."""

    filename: str
    content_type: str
    file_size: int
    purpose: Literal["evidence", "proof_of_residence"]


class PresignedUploadResponse(BaseModel):
    """Schema for presigned upload response."""

    url: str
    fields: dict
    file_id: str


class MediaAttachmentResponse(BaseModel):
    """Schema for media attachment response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_id: str
    filename: str
    content_type: str
    file_size: int
    purpose: str
    source: str
    created_at: datetime
