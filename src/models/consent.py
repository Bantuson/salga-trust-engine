"""ConsentRecord model for POPIA compliance."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class ConsentRecord(TenantAwareModel):
    """POPIA consent tracking for user data processing."""

    __tablename__ = "consent_records"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    purpose_description: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String, default="en", nullable=False)
    consented: Mapped[bool] = mapped_column(Boolean, nullable=False)
    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    withdrawn: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
