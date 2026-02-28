"""Pydantic v2 schemas for SDBIP (Service Delivery and Budget Implementation Plan) CRUD.

These schemas validate API request/response payloads for:
- SDBIP Scorecards (top-layer and departmental)
- SDBIP KPIs (with IDP objective links and mSCOA budget codes)
- Quarterly Targets (must be set for all 4 quarters at once)
- mSCOA reference lookup results

Request schemas validate incoming data; Response schemas serialize ORM objects.
"""
import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.models.sdbip import Quarter, SDBIPLayer, SDBIPStatus


# Financial year format: YYYY/YY (e.g., "2025/26")
_FINANCIAL_YEAR_PATTERN = re.compile(r"^\d{4}/\d{2}$")


# ---------------------------------------------------------------------------
# SDBIP Scorecard
# ---------------------------------------------------------------------------


class SDBIPScorecardCreate(BaseModel):
    """Schema for creating an SDBIP scorecard (top-layer or departmental)."""

    financial_year: str = Field(..., description="Financial year in YYYY/YY format (e.g., '2025/26')")
    layer: SDBIPLayer = Field(..., description="'top' for municipal-level; 'departmental' for dept-level")
    department_id: UUID | None = Field(
        default=None,
        description="Required when layer='departmental'; must be null for layer='top'",
    )
    title: str | None = Field(
        default=None,
        max_length=200,
        description="Optional descriptive title for the scorecard",
    )

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        """Validate YYYY/YY pattern (e.g., '2025/26')."""
        if not _FINANCIAL_YEAR_PATTERN.match(v):
            raise ValueError("financial_year must match pattern YYYY/YY (e.g., '2025/26')")
        return v


class SDBIPScorecardResponse(BaseModel):
    """Schema for SDBIP scorecard API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    financial_year: str
    layer: str
    department_id: UUID | None
    status: str
    title: str | None
    tenant_id: str
    created_at: datetime
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# SDBIP KPI
# ---------------------------------------------------------------------------


class SDBIPKpiCreate(BaseModel):
    """Schema for creating an SDBIP KPI within a scorecard."""

    kpi_number: str = Field(
        ...,
        max_length=20,
        description="Sequential identifier (e.g., 'KPI-001')",
    )
    description: str = Field(
        ...,
        description="Full description of what this KPI measures",
    )
    unit_of_measurement: str = Field(
        ...,
        max_length=50,
        description="Unit type: 'percentage', 'number', 'rand', 'days', etc.",
    )
    baseline: Decimal = Field(
        ...,
        description="Prior-year baseline performance value",
    )
    annual_target: Decimal = Field(
        ...,
        description="Target value for the full financial year",
    )
    weight: Decimal = Field(
        ...,
        ge=Decimal("0"),
        le=Decimal("100"),
        description="Percentage weight of this KPI in the scorecard (0-100)",
    )
    idp_objective_id: UUID | None = Field(
        default=None,
        description="Optional IDP objective for golden thread linkage",
    )
    department_id: UUID | None = Field(
        default=None,
        description="Responsible department (for departmental KPIs)",
    )
    mscoa_code_id: UUID | None = Field(
        default=None,
        description="mSCOA budget code FK (validated against mscoa_reference table)",
    )
    responsible_director_id: UUID | None = Field(
        default=None,
        description="Section 56 director accountable for this KPI",
    )


class SDBIPKpiResponse(BaseModel):
    """Schema for SDBIP KPI API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    scorecard_id: UUID
    kpi_number: str
    description: str
    unit_of_measurement: str
    baseline: Decimal
    annual_target: Decimal
    weight: Decimal
    idp_objective_id: UUID | None
    department_id: UUID | None
    mscoa_code_id: UUID | None
    responsible_director_id: UUID | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Quarterly Targets
# ---------------------------------------------------------------------------


class QuarterlyTargetCreate(BaseModel):
    """Schema for a single quarterly target entry."""

    quarter: Quarter = Field(..., description="Quarter: Q1, Q2, Q3, or Q4")
    target_value: Decimal = Field(..., description="Performance target for this quarter")


class QuarterlyTargetBulkCreate(BaseModel):
    """Schema for setting all 4 quarterly targets at once.

    Enforces that exactly 4 targets are provided (one per quarter Q1-Q4).
    This replaces any existing quarterly targets for the KPI.
    """

    targets: list[QuarterlyTargetCreate] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Exactly 4 quarterly targets (Q1, Q2, Q3, Q4 — all required)",
    )

    @model_validator(mode="after")
    def validate_all_four_quarters(self) -> "QuarterlyTargetBulkCreate":
        """Ensure all 4 quarters are present exactly once."""
        quarters_provided = {t.quarter for t in self.targets}
        required = {Quarter.Q1, Quarter.Q2, Quarter.Q3, Quarter.Q4}
        if quarters_provided != required:
            missing = required - quarters_provided
            duplicates = len(self.targets) - len(quarters_provided)
            if duplicates > 0:
                raise ValueError(f"Duplicate quarters detected in targets")
            raise ValueError(
                f"All 4 quarters required. Missing: {[q.value for q in sorted(missing)]}"
            )
        return self


class QuarterlyTargetResponse(BaseModel):
    """Schema for quarterly target API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kpi_id: UUID
    quarter: str
    target_value: Decimal


# ---------------------------------------------------------------------------
# mSCOA reference lookup
# ---------------------------------------------------------------------------


class MscoaSearchResponse(BaseModel):
    """Schema for mSCOA reference code search results."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    segment: str
    code: str
    description: str
    is_active: bool
