"""User model with role-based access control."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class UserRole(str, Enum):
    """User roles for RBAC — 4-tier hierarchy (18 roles).

    Tier 1 (Executive): executive_mayor, municipal_manager, cfo, speaker, admin, salga_admin
    Tier 2 (Directors): section56_director, ward_councillor
    Tier 3 (Operational): department_manager, pms_officer, audit_committee_member,
                          internal_auditor, mpac_member, saps_liaison, manager
    Tier 4 (Frontline): field_worker, citizen
    """

    # --- Tier 1: Executive ---
    EXECUTIVE_MAYOR = "executive_mayor"
    MUNICIPAL_MANAGER = "municipal_manager"
    CFO = "cfo"
    SPEAKER = "speaker"
    ADMIN = "admin"              # existing — kept identical
    SALGA_ADMIN = "salga_admin"

    # --- Tier 2: Directors ---
    SECTION56_DIRECTOR = "section56_director"
    WARD_COUNCILLOR = "ward_councillor"   # existing — kept identical
    CHIEF_WHIP = "chief_whip"

    # --- Tier 3: Operational ---
    DEPARTMENT_MANAGER = "department_manager"
    PMS_OFFICER = "pms_officer"
    AUDIT_COMMITTEE_MEMBER = "audit_committee_member"
    INTERNAL_AUDITOR = "internal_auditor"
    MPAC_MEMBER = "mpac_member"
    SAPS_LIAISON = "saps_liaison"         # existing — kept identical
    MANAGER = "manager"                   # existing — kept identical

    # --- Tier 4: Frontline ---
    FIELD_WORKER = "field_worker"         # existing — kept identical
    CITIZEN = "citizen"                   # existing — kept identical


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
    ward_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
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
