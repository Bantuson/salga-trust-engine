"""Authentication Pydantic schemas."""
from pydantic import BaseModel, EmailStr, Field, field_validator

from src.schemas.consent import ConsentCreate
from src.schemas.user import UserCreate


class RegisterRequest(UserCreate):
    """Schema for user registration with mandatory POPIA consent."""

    consent: ConsentCreate = Field(..., description="POPIA consent (required)")

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, v: ConsentCreate) -> ConsentCreate:
        """Validate that consent has been given."""
        if not v.consented:
            raise ValueError("User must consent to data processing")
        return v


class LoginRequest(BaseModel):
    """Schema for login request."""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Schema for refresh token request."""

    refresh_token: str


class TokenResponse(BaseModel):
    """Schema for token response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Schema for JWT token payload."""

    sub: str  # User ID
    tenant_id: str
    role: str
    exp: int
