"""Consent Pydantic schemas for POPIA compliance."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConsentCreate(BaseModel):
    """Schema for creating a consent record."""

    purpose: str
    purpose_description: str
    language: str = Field(default="en")
    consented: bool


class ConsentResponse(BaseModel):
    """Schema for consent record response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    purpose: str
    consented: bool
    consented_at: datetime
    withdrawn: bool
