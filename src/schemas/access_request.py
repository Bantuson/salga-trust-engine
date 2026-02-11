"""Pydantic schemas for access request API."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SouthAfricanProvince(str, Enum):
    """South African provinces (9 total)."""
    EASTERN_CAPE = "Eastern Cape"
    FREE_STATE = "Free State"
    GAUTENG = "Gauteng"
    KWAZULU_NATAL = "KwaZulu-Natal"
    LIMPOPO = "Limpopo"
    MPUMALANGA = "Mpumalanga"
    NORTHERN_CAPE = "Northern Cape"
    NORTH_WEST = "North West"
    WESTERN_CAPE = "Western Cape"


class AccessRequestStatus(str, Enum):
    """Access request status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class AccessRequestCreate(BaseModel):
    """Schema for creating a new access request (public form submission)."""
    municipality_name: str = Field(..., min_length=1, max_length=200)
    province: SouthAfricanProvince
    municipality_code: str | None = Field(None, max_length=20)
    contact_name: str = Field(..., min_length=1, max_length=200)
    contact_email: EmailStr
    contact_phone: str | None = Field(None, max_length=20)
    notes: str | None = Field(None, max_length=2000)


class AccessRequestResponse(BaseModel):
    """Schema for access request response."""
    id: UUID
    municipality_name: str
    province: str
    municipality_code: str | None
    contact_name: str
    contact_email: str
    contact_phone: str | None
    supporting_docs: str | None
    notes: str | None
    status: str
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    review_notes: str | None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class AccessRequestReview(BaseModel):
    """Schema for admin reviewing an access request."""
    status: AccessRequestStatus
    review_notes: str | None = Field(None, max_length=2000)
