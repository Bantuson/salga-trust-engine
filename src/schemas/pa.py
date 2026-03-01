"""Pydantic v2 schemas for Performance Agreement (PA) CRUD.

These schemas validate API request/response payloads for:
- Performance Agreements (Section 57 manager agreements per financial year)
- PA KPIs (individual KPIs linked to organisational SDBIP KPIs)
- PA Quarterly Scores (quarterly performance scores for PA KPIs)
- PA State Machine Transitions (draft -> signed -> under_review -> assessed)

Request schemas validate incoming data; Response schemas serialize ORM objects.

Role-gated signing (PA-06) is enforced at the service layer, not here.
"""
import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# Financial year format: YYYY/YY (e.g., "2025/26")
_FINANCIAL_YEAR_PATTERN = re.compile(r"^\d{4}/\d{2}$")


# ---------------------------------------------------------------------------
# Performance Agreement
# ---------------------------------------------------------------------------


class PACreate(BaseModel):
    """Schema for creating a Performance Agreement.

    financial_year must follow YYYY/YY format (e.g., "2025/26").
    manager_role must be "section57_director" or "municipal_manager".
    """

    financial_year: str = Field(
        ...,
        description="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    section57_manager_id: UUID = Field(
        ...,
        description="UUID of the Section 57 manager this PA is created for",
    )
    manager_role: str = Field(
        ...,
        description="Manager category: 'section57_director' or 'municipal_manager'",
    )

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        """Validate YYYY/YY pattern (e.g., '2025/26')."""
        if not _FINANCIAL_YEAR_PATTERN.match(v):
            raise ValueError("financial_year must match pattern YYYY/YY (e.g., '2025/26')")
        return v

    @field_validator("manager_role")
    @classmethod
    def validate_manager_role(cls, v: str) -> str:
        """Validate manager_role is one of the allowed ManagerRole values."""
        allowed = {"section57_director", "municipal_manager"}
        if v not in allowed:
            raise ValueError(
                f"manager_role must be one of: {sorted(allowed)}"
            )
        return v


class PAResponse(BaseModel):
    """Schema for Performance Agreement API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    financial_year: str
    section57_manager_id: UUID
    manager_role: str
    status: str
    annual_score: Decimal | None
    popia_retention_flag: bool
    tenant_id: str
    created_at: datetime
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# PA KPIs
# ---------------------------------------------------------------------------


class PAKpiCreate(BaseModel):
    """Schema for adding a KPI to a Performance Agreement.

    individual_target must be >= 0.
    weight must be between 0 and 100.
    The sum of all KPI weights per PA must not exceed 100 (enforced at service layer).
    """

    sdbip_kpi_id: UUID = Field(
        ...,
        description="UUID of the organisational SDBIP KPI this PA KPI is derived from",
    )
    individual_target: Decimal = Field(
        ...,
        ge=Decimal("0"),
        description="Individual target for this manager's KPI (>= 0)",
    )
    weight: Decimal = Field(
        ...,
        ge=Decimal("0"),
        le=Decimal("100"),
        description="Percentage weight of this KPI in the PA (0-100)",
    )
    description: str | None = Field(
        default=None,
        description="Optional description overriding the SDBIP KPI description",
    )


class PAKpiBulkCreate(BaseModel):
    """Schema for batch-adding KPIs to a Performance Agreement."""

    kpis: list[PAKpiCreate] = Field(
        ...,
        min_length=1,
        description="One or more PA KPIs to add to the agreement",
    )


class PAKpiResponse(BaseModel):
    """Schema for PA KPI API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agreement_id: UUID
    sdbip_kpi_id: UUID
    individual_target: Decimal
    weight: Decimal
    description: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# PA Quarterly Scores
# ---------------------------------------------------------------------------


class PAScoreCreate(BaseModel):
    """Schema for submitting a quarterly score for a PA KPI.

    quarter must be one of: Q1, Q2, Q3, Q4.
    score must be between 0 and 100.
    """

    quarter: str = Field(
        ...,
        description="Quarter: Q1, Q2, Q3, or Q4 (South African financial year: July-June)",
    )
    score: Decimal = Field(
        ...,
        ge=Decimal("0"),
        le=Decimal("100"),
        description="Performance score for the quarter (0-100)",
    )
    notes: str | None = Field(
        default=None,
        description="Optional assessor notes or evidence references",
    )

    @field_validator("quarter")
    @classmethod
    def validate_quarter(cls, v: str) -> str:
        """Validate quarter is Q1, Q2, Q3, or Q4."""
        if v not in {"Q1", "Q2", "Q3", "Q4"}:
            raise ValueError("quarter must be one of: Q1, Q2, Q3, Q4")
        return v


class PAScoreResponse(BaseModel):
    """Schema for PA quarterly score API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pa_kpi_id: UUID
    quarter: str
    score: Decimal
    scored_by: str | None
    scored_at: datetime | None
    notes: str | None


# ---------------------------------------------------------------------------
# PA State Machine Transitions
# ---------------------------------------------------------------------------


class PATransitionRequest(BaseModel):
    """Schema for PA state machine transition requests.

    Valid events:
    - "sign":        draft -> signed       (role-gated per PA-06)
    - "open_review": signed -> under_review
    - "assess":      under_review -> assessed (sets popia_retention_flag=True)
    """

    event: str = Field(
        ...,
        description="State machine event: 'sign', 'open_review', or 'assess'",
    )

    @field_validator("event")
    @classmethod
    def validate_event(cls, v: str) -> str:
        """Validate event is one of the allowed PA transitions."""
        allowed = {"sign", "open_review", "assess"}
        if v not in allowed:
            raise ValueError(
                f"event must be one of: {sorted(allowed)}"
            )
        return v
