"""Access request model for municipality onboarding applications."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class AccessRequest(NonTenantModel):
    """Municipality access request - not tenant-scoped since municipality doesn't exist yet.

    When a municipality wants to join the SALGA Trust Engine platform, they submit
    an access request via a public web form. Platform admins review and approve/reject
    the request. On approval, the municipality is created and the admin receives
    an onboarding invitation.

    Uses NonTenantModel as base since the request exists before a municipality tenant
    is created (similar to Municipality and SLAConfig models).
    """

    __tablename__ = "access_requests"

    municipality_name: Mapped[str] = mapped_column(String(200), nullable=False)
    province: Mapped[str] = mapped_column(String(50), nullable=False)
    municipality_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contact_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_email: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    supporting_docs: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of Supabase Storage paths
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Review tracking
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    reviewed_by: Mapped[UUID | None] = mapped_column(nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
