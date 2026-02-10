"""User model with role-based access control."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class UserRole(str, Enum):
    """User roles for RBAC."""

    CITIZEN = "citizen"
    FIELD_WORKER = "field_worker"
    MANAGER = "manager"
    WARD_COUNCILLOR = "ward_councillor"
    ADMIN = "admin"
    SAPS_LIAISON = "saps_liaison"


class User(TenantAwareModel):
    """User model with tenant isolation."""

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", "tenant_id", name="uq_user_email_tenant"),
    )

    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    preferred_language: Mapped[str] = mapped_column(
        String,
        default="en",
        nullable=False
    )
    role: Mapped[UserRole] = mapped_column(
        default=UserRole.CITIZEN,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    municipality_id: Mapped[UUID] = mapped_column(
        ForeignKey("municipalities.id"),
        nullable=False,
        index=True
    )

    # Proof of residence verification
    verification_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unverified"
    )
    verified_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verification_document_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
