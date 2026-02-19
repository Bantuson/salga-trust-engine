"""Pydantic schemas for Team model."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from src.models.ticket import TicketCategory


class TeamCreate(BaseModel):
    """Schema for creating a new team."""

    name: str
    category: str
    manager_id: UUID | None = None
    is_saps: bool = False

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate category against TicketCategory values."""
        valid_categories = [cat.value for cat in TicketCategory]
        if v not in valid_categories:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {', '.join(valid_categories)}"
            )
        return v


class TeamUpdate(BaseModel):
    """Schema for partial update of a team."""

    name: str | None = None
    category: str | None = None
    manager_id: UUID | None = None
    is_active: bool | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        """Validate category against TicketCategory values if provided."""
        if v is None:
            return v
        valid_categories = [cat.value for cat in TicketCategory]
        if v not in valid_categories:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {', '.join(valid_categories)}"
            )
        return v


class TeamResponse(BaseModel):
    """Schema for team response with computed fields."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    category: str
    manager_id: UUID | None
    is_active: bool
    is_saps: bool
    created_at: datetime
    # Computed fields (populated in API layer, not stored in DB)
    member_count: int = 0
    manager_name: str | None = None
    active_ticket_count: int = 0


class TeamMemberResponse(BaseModel):
    """Schema for a team member (accepted invitation with user details)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None = None
    role: str
    joined_at: datetime | None = None
