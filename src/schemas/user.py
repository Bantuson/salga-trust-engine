"""User Pydantic schemas for request/response validation."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str | None = None
    preferred_language: str = Field(default="en")
    municipality_code: str


class UserResponse(BaseModel):
    """Schema for user response (excludes sensitive data)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    phone: str | None
    preferred_language: str
    role: str
    is_active: bool
    created_at: datetime


class UserInDB(UserResponse):
    """Schema for user in database (includes hashed password)."""

    hashed_password: str
