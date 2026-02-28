"""Pydantic v2 schemas for SDBIP (Service Delivery and Budget Implementation Plan) CRUD.

These schemas validate API request/response payloads for:
- SDBIP Scorecards (top-layer and departmental)
- SDBIP KPIs (with IDP objective links and mSCOA budget codes)
- Quarterly Targets (must be set for all 4 quarters at once)
- Quarterly Actuals (submission, correction, response)
- mSCOA reference lookup results

Request schemas validate incoming data; Response schemas serialize ORM objects.
"""
import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.models.sdbip import AggregationType, Quarter, SDBIPLayer, SDBIPStatus


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


class SDBIPTransitionRequest(BaseModel):
    """Schema for SDBIP scorecard state machine transition requests."""

    event: str = Field(
        ...,
        description="State machine event: 'submit' (draft->approved), 'revise' (approved->revised), 'resubmit' (revised->approved)",
    )


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
# Quarterly Actuals
# ---------------------------------------------------------------------------


class SDBIPActualCreate(BaseModel):
    """Schema for submitting a quarterly actual performance value against a KPI target.

    The achievement percentage and traffic-light status are computed server-side
    on submission — do not include them in the request body.
    """

    kpi_id: UUID = Field(..., description="UUID of the SDBIP KPI this actual is submitted for")
    quarter: Quarter = Field(..., description="Quarter the actual covers: Q1, Q2, Q3, or Q4")
    financial_year: str = Field(
        ...,
        description="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    actual_value: Decimal = Field(
        ...,
        description="Actual performance value achieved by the department this quarter",
    )

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        """Validate YYYY/YY pattern (e.g., '2025/26')."""
        if not _FINANCIAL_YEAR_PATTERN.match(v):
            raise ValueError("financial_year must match pattern YYYY/YY (e.g., '2025/26')")
        return v


class SDBIPActualResponse(BaseModel):
    """Schema for quarterly actual API responses.

    Includes auto-computed fields (achievement_pct, traffic_light_status) and
    the full audit trail (submitted_by/at, validated_by/at, correction chain).
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kpi_id: UUID
    quarter: str
    financial_year: str
    actual_value: Decimal
    achievement_pct: Decimal | None
    traffic_light_status: str | None
    submitted_by: str | None
    submitted_at: datetime | None
    is_validated: bool
    validated_by: str | None
    validated_at: datetime | None
    corrects_actual_id: UUID | None
    is_auto_populated: bool
    source_query_ref: str | None
    created_at: datetime


class SDBIPActualCorrectionCreate(BaseModel):
    """Schema for submitting a correction to a validated actual.

    Corrections create a new SDBIPActual record with corrects_actual_id pointing
    to the original. The original validated record remains immutable.

    A reason (min 10 characters) is required to maintain an audit trail
    of why the correction was necessary.
    """

    actual_value: Decimal = Field(
        ...,
        description="Corrected actual performance value",
    )
    reason: str = Field(
        ...,
        min_length=10,
        description="Reason for the correction (minimum 10 characters for audit trail)",
    )


# ---------------------------------------------------------------------------
# Aggregation rules (auto-population)
# ---------------------------------------------------------------------------


class AggregationRuleCreate(BaseModel):
    """Schema for creating an SDBIP ticket aggregation rule.

    Aggregation rules configure how the AutoPopulationEngine derives SDBIP actuals
    from resolved ticket counts. Each rule maps a KPI to a ticket category and
    aggregation type.

    SEC-05: The is_sensitive=FALSE GBV exclusion filter is enforced unconditionally
    by the engine — it is NOT configurable here.
    """

    ticket_category: str = Field(
        ...,
        max_length=50,
        description="Ticket category to aggregate (e.g., 'water', 'roads', 'electricity')",
    )
    aggregation_type: AggregationType = Field(
        ...,
        description="Aggregation function: 'count', 'sum', or 'avg'",
    )
    formula_description: str | None = Field(
        default=None,
        description="Human-readable description of what this rule measures",
    )


class AggregationRuleResponse(BaseModel):
    """Schema for SDBIP aggregation rule API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kpi_id: UUID
    ticket_category: str
    aggregation_type: str
    formula_description: str | None
    source_query_ref: str | None
    is_active: bool
    created_at: datetime


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
