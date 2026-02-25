"""User Pydantic schemas for request/response validation."""
import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Schema for user registration."""

    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str | None = None
    preferred_language: str = Field(default="en")
    municipality_code: str

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """Enforce password complexity: uppercase, lowercase, and digit required.

        Symbols are NOT required — usability tradeoff for citizens.
        Reports all missing requirements in a single error message.
        """
        missing = []

        if not re.search(r"[A-Z]", v):
            missing.append("at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            missing.append("at least one lowercase letter")
        if not re.search(r"\d", v):
            missing.append("at least one digit")

        if missing:
            raise ValueError(f"Password must contain: {', '.join(missing)}")

        return v


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


class UserVerificationRequest(BaseModel):
    """Schema for requesting user verification via proof of residence."""

    document_file_id: str


class UserVerificationResponse(BaseModel):
    """Schema for user verification status response."""

    model_config = ConfigDict(from_attributes=True)

    verification_status: str
    verified_address: str | None = None
    verified_at: datetime | None = None
