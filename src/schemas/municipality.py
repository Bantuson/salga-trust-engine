"""Municipality Pydantic schemas for API requests and responses."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# Valid South African provinces
SA_PROVINCES = [
    "Eastern Cape",
    "Free State",
    "Gauteng",
    "KwaZulu-Natal",
    "Limpopo",
    "Mpumalanga",
    "Northern Cape",
    "North West",
    "Western Cape",
]


class MunicipalityCreate(BaseModel):
    """Schema for creating a new municipality."""

    name: str = Field(..., min_length=3, max_length=100)
    code: str = Field(..., min_length=2, max_length=10)
    province: str
    population: int | None = Field(None, ge=0)
    contact_email: EmailStr | None = None

    @field_validator("code")
    @classmethod
    def code_must_be_uppercase(cls, v: str) -> str:
        """Ensure municipality code is uppercase."""
        return v.upper()

    @field_validator("province")
    @classmethod
    def province_must_be_valid(cls, v: str) -> str:
        """Validate province is a valid South African province."""
        if v not in SA_PROVINCES:
            raise ValueError(
                f"Invalid province. Must be one of: {', '.join(SA_PROVINCES)}"
            )
        return v


class MunicipalityUpdate(BaseModel):
    """Schema for updating an existing municipality."""

    name: str | None = Field(None, min_length=3, max_length=100)
    contact_email: EmailStr | None = None
    is_active: bool | None = None
    population: int | None = Field(None, ge=0)


class MunicipalityResponse(BaseModel):
    """Schema for municipality API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    code: str
    province: str
    population: int | None
    is_active: bool
    contact_email: str | None
    created_at: datetime
