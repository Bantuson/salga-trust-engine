"""Team invitation model for onboarding team member invites."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class TeamInvitation(TenantAwareModel):
    """Pending team member invitations from onboarding wizard.

    During onboarding (and later from the municipal dashboard), admins/managers
    invite team members via email. The invitation contains a signup link with
    a token. When the invitee accepts, they register and are assigned the role
    specified in the invitation.

    Uses TenantAwareModel since invitations are tenant-scoped (invites are for
    specific municipalities, not cross-tenant).

    Status lifecycle:
    - pending: Invitation sent, not yet accepted
    - accepted: User registered and joined the team
    - expired: Invitation expired (7 days default)
    """

    __tablename__ = "team_invitations"

    municipality_id: Mapped[UUID] = mapped_column(
        ForeignKey("municipalities.id"),
        nullable=False,
        index=True
    )
    email: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    invited_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
