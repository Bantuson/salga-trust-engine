"""Media attachment model for ticket evidence and proof of residence documents.

MediaAttachment tracks files stored in S3 (evidence photos from WhatsApp/web, proof of residence).
Links to tickets via ticket_id. Contains S3 metadata (bucket, key, filename, content type, size).
"""
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class MediaAttachment(TenantAwareModel):
    """Media attachment model for ticket evidence and proof of residence.

    Inherits tenant_id, created_at, updated_at, created_by, updated_by from TenantAwareModel.
    """

    __tablename__ = "media_attachments"

    ticket_id: Mapped[UUID | None] = mapped_column(ForeignKey("tickets.id"), nullable=True, index=True)
    file_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    s3_bucket: Mapped[str] = mapped_column(String(100), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="web")
    is_processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<MediaAttachment {self.file_id} - {self.purpose} - {self.filename}>"
