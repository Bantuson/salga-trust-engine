"""Pydantic schemas for ticket data validation.

Schemas for ticket creation, updates, and responses. TicketData schema is used
by agents during intake to validate structured output before ticket creation.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.models.ticket import TicketCategory, TicketSeverity, TicketStatus


class TicketCreate(BaseModel):
    """Schema for creating a new ticket."""

    category: str
    description: str
    latitude: float | None = None
    longitude: float | None = None
    address: str | None = None
    severity: str | None = None
    language: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate category is a valid TicketCategory value."""
        valid_categories = [c.value for c in TicketCategory]
        if v.lower() not in valid_categories:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {', '.join(valid_categories)}"
            )
        return v.lower()

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str | None) -> str | None:
        """Validate severity is a valid TicketSeverity value."""
        if v is None:
            return v

        valid_severities = [s.value for s in TicketSeverity]
        if v.lower() not in valid_severities:
            raise ValueError(
                f"Invalid severity '{v}'. Must be one of: {', '.join(valid_severities)}"
            )
        return v.lower()


class TicketResponse(BaseModel):
    """Schema for ticket API responses."""

    id: UUID
    tracking_number: str
    category: str
    description: str
    latitude: float | None
    longitude: float | None
    address: str | None
    severity: str
    status: str
    language: str
    user_id: UUID
    is_sensitive: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketUpdate(BaseModel):
    """Schema for updating an existing ticket."""

    description: str | None = None
    severity: str | None = None
    status: str | None = None

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str | None) -> str | None:
        """Validate severity is a valid TicketSeverity value."""
        if v is None:
            return v

        valid_severities = [s.value for s in TicketSeverity]
        if v.lower() not in valid_severities:
            raise ValueError(
                f"Invalid severity '{v}'. Must be one of: {', '.join(valid_severities)}"
            )
        return v.lower()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        """Validate status is a valid TicketStatus value."""
        if v is None:
            return v

        valid_statuses = [s.value for s in TicketStatus]
        if v.lower() not in valid_statuses:
            raise ValueError(
                f"Invalid status '{v}'. Must be one of: {', '.join(valid_statuses)}"
            )
        return v.lower()


class TicketData(BaseModel):
    """Structured output schema for agent intake.

    Used by agents to validate collected ticket data before creating
    a ticket in the database.
    """

    category: str = Field(description="Ticket category (water/roads/electricity/waste/sanitation/gbv/other)")
    description: str = Field(min_length=20, description="Detailed description of the issue")
    latitude: float | None = Field(None, description="Latitude coordinate")
    longitude: float | None = Field(None, description="Longitude coordinate")
    address: str | None = Field(None, description="Human-readable address")
    severity: str = Field(description="Issue severity (low/medium/high/critical)")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """Validate category is a valid TicketCategory value."""
        valid_categories = [c.value for c in TicketCategory]
        if v.lower() not in valid_categories:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {', '.join(valid_categories)}"
            )
        return v.lower()

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        """Validate severity is a valid TicketSeverity value."""
        valid_severities = [s.value for s in TicketSeverity]
        if v.lower() not in valid_severities:
            raise ValueError(
                f"Invalid severity '{v}'. Must be one of: {', '.join(valid_severities)}"
            )
        return v.lower()
