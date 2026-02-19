"""Pydantic schemas for team invitation API."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class InvitationRole(str, Enum):
    """Valid team member roles for invitations."""
    MANAGER = "manager"
    WARD_COUNCILLOR = "ward_councillor"
    FIELD_WORKER = "field_worker"


class InvitationStatus(str, Enum):
    """Team invitation status."""
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"


class TeamInvitationCreate(BaseModel):
    """Schema for creating a single team invitation."""
    email: EmailStr
    role: InvitationRole
    team_id: UUID | None = None


class TeamInvitationBulkCreate(BaseModel):
    """Schema for creating multiple team invitations at once."""
    invitations: list[TeamInvitationCreate] = Field(..., min_length=1, max_length=50)


class TeamInvitationResponse(BaseModel):
    """Schema for team invitation response."""
    id: UUID
    municipality_id: UUID
    team_id: UUID | None = None
    email: str
    role: str
    invited_by: UUID
    status: str
    accepted_at: datetime | None
    expires_at: datetime | None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True
