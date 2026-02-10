"""TicketAssignment model for tracking ticket routing and assignment history.

Tracks which team and/or user is assigned to a ticket, who made the assignment,
and the reason (geospatial routing, manual override, escalation, SLA breach).

Key decisions:
- is_current flag ensures only one active assignment per ticket
- assigned_by can be "system" (auto-routing) or user_id (manual override)
- team_id and assigned_to are both nullable (initial auto-route may be team-only)
- Full assignment history maintained for audit trail
"""
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class TicketAssignment(TenantAwareModel):
    """Ticket assignment history model.

    Inherits tenant_id, created_at, updated_at, created_by, updated_by from TenantAwareModel.
    """

    __tablename__ = "ticket_assignments"

    ticket_id: Mapped[UUID] = mapped_column(
        ForeignKey("tickets.id"),
        nullable=False,
        index=True
    )
    team_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True
    )
    assigned_to: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )
    assigned_by: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<TicketAssignment ticket={self.ticket_id} team={self.team_id} current={self.is_current}>"
