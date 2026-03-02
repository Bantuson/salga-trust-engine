"""EvidenceDocument ORM model for portfolio of evidence (POE) uploads.

Each quarterly actual (SDBIPActual) requires portfolio of evidence documents
per MFMA quarterly reporting requirements. Evidence documents are:
  1. Scanned with ClamAV (virus detection) before upload
  2. Stored in per-municipality Supabase Storage buckets
  3. Served via signed URLs (1-hour expiry)

Scan status lifecycle:
  pending   -> Not yet scanned (initial state, overwritten synchronously)
  clean     -> ClamAV returned OK; document accepted
  infected  -> ClamAV returned FOUND; document rejected (422 to caller)
  scan_failed -> ClamAV unavailable; fail-open in dev, fail-closed in production

Bucket naming pattern: salga-evidence-{municipality_tenant_id}
Storage path pattern:  actuals/{actual_id}/{unique_filename}
"""
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import TenantAwareModel


class EvidenceDocument(TenantAwareModel):
    """Portfolio of evidence document attached to an SDBIP quarterly actual.

    Represents a single uploaded file (PDF, image, spreadsheet, etc.) that
    serves as supporting documentation for a quarterly actual submission.

    Uniqueness: Not enforced — multiple documents may be attached to the same actual.

    Immutability: Documents are not deleted once uploaded. PMS officer validation
    of the parent actual (is_validated=True on SDBIPActual) freezes the entire
    portfolio. No cascade delete from actuals to evidence (audit trail).
    """

    __tablename__ = "evidence_documents"

    actual_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_actuals.id"),
        nullable=False,
        index=True,
        comment="FK to SDBIPActual this evidence supports",
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Unique storage filename (uuid_originalname pattern to prevent collisions)",
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original filename as uploaded by user",
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="MIME type of the uploaded file (e.g., application/pdf, image/jpeg)",
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes; max 50MB enforced at API layer",
    )
    storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Full bucket path: actuals/{actual_id}/{filename}",
    )
    scan_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="clean",
        server_default="clean",
        comment=(
            "ClamAV scan result: 'clean', 'infected' (rejected 422), "
            "'scan_failed' (fail-open dev / fail-closed prod), 'pending'"
        ),
    )
    verification_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unverified",
        server_default="unverified",
        comment=(
            "Internal Auditor POE review status. "
            "Values: 'unverified' (pending review), 'verified' (accepted), "
            "'insufficient' (rejected — insufficient evidence)"
        ),
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="User ID (str) of the user who uploaded this document",
    )

    # Relationship back to the actual (no cascade delete — evidence is audit trail)
    actual: Mapped["SDBIPActual"] = relationship(  # type: ignore[name-defined]
        "SDBIPActual",
        foreign_keys=[actual_id],
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<EvidenceDocument {self.original_filename} [{self.scan_status}] "
            f"actual={self.actual_id} size={self.file_size}B>"
        )
