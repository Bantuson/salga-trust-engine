"""Role assignment models for multi-role RBAC with tier-based hierarchy.

Provides:
- UserRoleAssignment: Maps users to roles (multi-role support)
- Tier1ApprovalRequest: Pending approval workflow for Tier 1 (executive) roles
- ApprovalStatus: Lifecycle state of a Tier 1 approval request
"""
from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel
from src.models.user import UserRole


class ApprovalStatus(str, Enum):
    """Status of a Tier 1 role-assignment approval request."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class UserRoleAssignment(TenantAwareModel):
    """Tracks which roles are assigned to a user.

    A user may hold multiple active roles simultaneously.  The *effective* role
    is the one with the lowest tier number (highest authority) and is mirrored
    on users.role for JWT claim injection via the custom access token hook.

    Tenant isolation: RLS policy `tenant_isolation_user_role_assignments` on the
    PostgreSQL table ensures cross-tenant data is never visible.

    Security: UniqueConstraint prevents duplicate (user, role, tenant) rows so that
    a revoke-then-reassign cycle is idempotent.
    """

    __tablename__ = "user_role_assignments"
    __table_args__ = (
        UniqueConstraint("user_id", "role", "tenant_id", name="uq_user_role_tenant"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[UserRole] = mapped_column(nullable=False)
    assigned_by: Mapped[str] = mapped_column(
        String,
        nullable=False,
        comment="User ID (string) of the admin who created this assignment",
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )


class Tier1ApprovalRequest(TenantAwareModel):
    """Approval workflow for Tier 1 (executive) role assignments.

    Any attempt to assign an executive-tier role (executive_mayor, municipal_manager,
    cfo, speaker) triggers the creation of one of these records instead of an
    immediate role change.  A SALGA admin must explicitly approve or reject it.

    Note: `admin` and `salga_admin` are also Tier 1 but bypass this workflow
    because they are assigned by existing SALGA admins directly.
    """

    __tablename__ = "tier1_approval_requests"

    requesting_admin_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
        comment="Admin who submitted the role-elevation request",
    )
    target_user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User whose role is to be elevated",
    )
    requested_role: Mapped[UserRole] = mapped_column(
        nullable=False,
        comment="The Tier 1 role being requested",
    )
    current_role: Mapped[UserRole] = mapped_column(
        nullable=False,
        comment="Snapshot of the user's role at time of request",
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        default=ApprovalStatus.PENDING,
        nullable=False,
    )
    salga_admin_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="SALGA admin who made the decision (null if still pending)",
    )
    decision_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason provided by SALGA admin (required on rejection)",
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Request expires if not decided by this timestamp",
    )
    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of the approval/rejection decision",
    )
