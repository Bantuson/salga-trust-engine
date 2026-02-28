"""Pydantic schemas for Department CRUD, organogram, and municipality PMS settings."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    """Schema for creating a new department."""

    name: str = Field(..., min_length=2, max_length=150)
    code: str = Field(
        ...,
        min_length=2,
        max_length=20,
        pattern="^[A-Z][A-Z0-9_]*$"
    )  # e.g., "FIN", "INFRA", "COMM_SAFETY"
    parent_department_id: UUID | None = None
    assigned_director_id: UUID | None = None
    display_order: int = 0


class DepartmentUpdate(BaseModel):
    """Schema for partially updating a department."""

    name: str | None = Field(None, min_length=2, max_length=150)
    code: str | None = Field(None, min_length=2, max_length=20, pattern="^[A-Z][A-Z0-9_]*$")
    parent_department_id: UUID | None = None
    assigned_director_id: UUID | None = None
    display_order: int | None = None
    is_active: bool | None = None


class DepartmentResponse(BaseModel):
    """Schema for department in API responses."""

    id: UUID
    tenant_id: str
    name: str
    code: str
    parent_department_id: UUID | None
    assigned_director_id: UUID | None
    assigned_director_name: str | None = None  # Joined from users table
    is_active: bool
    display_order: int
    is_valid: bool  # True if assigned_director_id is not None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class OrganogramNode(BaseModel):
    """Recursive tree node for organogram (department hierarchy) visualization."""

    id: UUID
    name: str
    code: str
    director_name: str | None = None
    director_role: str | None = None
    children: list["OrganogramNode"] = []


class TicketCategoryMappingCreate(BaseModel):
    """Schema for creating a ticket category to department mapping."""

    department_id: UUID
    ticket_category: str = Field(..., min_length=1, max_length=50)


class TicketCategoryMappingResponse(BaseModel):
    """Schema for ticket category mapping in API responses."""

    id: UUID
    department_id: UUID
    department_name: str | None = None
    ticket_category: str

    model_config = {"from_attributes": True}


class MunicipalitySettingsUpdate(BaseModel):
    """Schema for updating municipality PMS settings."""

    category: str | None = Field(None, pattern="^[ABC]$")  # A, B, or C
    demarcation_code: str | None = Field(None, max_length=20)
    sdbip_layers: int | None = Field(None, ge=1, le=5)
    scoring_method: str | None = Field(None, pattern="^percentage$")  # Only valid value in v2.0


class MunicipalitySettingsResponse(BaseModel):
    """Schema for municipality PMS settings in API responses."""

    id: UUID
    name: str
    code: str
    province: str
    category: str | None
    demarcation_code: str | None
    sdbip_layers: int
    scoring_method: str
    settings_locked: bool
    financial_year_start_month: int

    model_config = {"from_attributes": True}


class UnlockConfirm(BaseModel):
    """Confirmation body for unlocking municipality settings."""

    confirm: bool = Field(..., description="Must be true to confirm the unlock action")
