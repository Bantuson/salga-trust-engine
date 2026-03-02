"""Pydantic v2 schemas for the risk register feature.

Provides request and response models for:
- RiskItem CRUD (RISK-01)
- RiskMitigation management (RISK-02)
- Risk register summary counts
"""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Mitigation schemas
# ---------------------------------------------------------------------------


class RiskMitigationCreate(BaseModel):
    """Schema for creating a risk mitigation strategy."""

    model_config = ConfigDict(from_attributes=True)

    strategy: str = Field(..., min_length=1, description="Mitigation strategy description")
    responsible_person_id: UUID | None = Field(
        default=None,
        description="User ID of person responsible for this mitigation",
    )
    target_date: date | None = Field(
        default=None,
        description="Target completion date for the mitigation action",
    )


class RiskMitigationResponse(BaseModel):
    """Schema for returning a risk mitigation strategy."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    risk_item_id: UUID
    strategy: str
    responsible_person_id: UUID | None
    target_date: date | None
    status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Risk item schemas
# ---------------------------------------------------------------------------


class RiskItemCreate(BaseModel):
    """Schema for creating a risk item."""

    model_config = ConfigDict(from_attributes=True)

    kpi_id: UUID = Field(..., description="FK to SDBIP KPI this risk is linked to")
    department_id: UUID | None = Field(
        default=None,
        description="Optional department scope for CFO/MM filtering",
    )
    title: str = Field(..., min_length=1, max_length=200, description="Brief risk title")
    description: str = Field(..., min_length=1, description="Full risk description")
    likelihood: int = Field(..., ge=1, le=5, description="Likelihood 1-5 (1=rare, 5=almost certain)")
    impact: int = Field(..., ge=1, le=5, description="Impact 1-5 (1=negligible, 5=catastrophic)")
    responsible_person_id: UUID | None = Field(
        default=None,
        description="User responsible for managing this risk",
    )
    mitigations: list[RiskMitigationCreate] = Field(
        default=[],
        description="Optional initial mitigation strategies to create with the risk item",
    )


class RiskItemUpdate(BaseModel):
    """Schema for updating a risk item (partial update)."""

    model_config = ConfigDict(from_attributes=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    likelihood: int | None = Field(default=None, ge=1, le=5)
    impact: int | None = Field(default=None, ge=1, le=5)
    responsible_person_id: UUID | None = None


class RiskItemResponse(BaseModel):
    """Schema for returning a risk item with its mitigations."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kpi_id: UUID
    department_id: UUID | None
    title: str
    description: str
    likelihood: int
    impact: int
    risk_rating: str
    responsible_person_id: UUID | None
    is_auto_flagged: bool
    auto_flagged_at: datetime | None
    mitigations: list[RiskMitigationResponse]
    created_at: datetime
    updated_at: datetime | None


# ---------------------------------------------------------------------------
# Summary schema
# ---------------------------------------------------------------------------


class RiskRegisterSummary(BaseModel):
    """Aggregate counts for the risk register dashboard widget."""

    model_config = ConfigDict(from_attributes=True)

    total: int = Field(..., description="Total active risk items")
    critical: int = Field(..., description="Count of critical-rated items")
    high: int = Field(..., description="Count of high-rated items")
    medium: int = Field(..., description="Count of medium-rated items")
    low: int = Field(..., description="Count of low-rated items")
    auto_flagged: int = Field(..., description="Count of auto-flagged items")
