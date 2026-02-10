"""Pydantic schemas for TicketAssignment model."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AssignmentCreate(BaseModel):
    """Schema for creating a new ticket assignment."""

    ticket_id: UUID
    team_id: UUID | None = None
    assigned_to: UUID | None = None
    reason: str | None = None


class AssignmentResponse(BaseModel):
    """Schema for ticket assignment response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    team_id: UUID | None
    assigned_to: UUID | None
    assigned_by: str | None
    reason: str | None
    is_current: bool
    created_at: datetime
