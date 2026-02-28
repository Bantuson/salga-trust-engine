"""Pydantic v2 schemas for IDP (Integrated Development Plan) CRUD.

These schemas validate API request/response payloads for the IDP hierarchy:
    IDPCycle -> IDPGoal -> IDPObjective -> (future) SDBIPKpi

Request schemas validate incoming data; Response schemas serialize ORM objects.
"""
import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from src.models.idp import NationalKPA


# ---------------------------------------------------------------------------
# IDP Cycle
# ---------------------------------------------------------------------------

class IDPCycleCreate(BaseModel):
    """Schema for creating an IDP cycle."""

    title: str
    vision: str | None = None
    mission: str | None = None
    start_year: int
    end_year: int

    @model_validator(mode="after")
    def validate_year_range(self) -> "IDPCycleCreate":
        """Validate that end_year is exactly start_year + 5 (5-year IDP)."""
        if self.end_year <= self.start_year:
            raise ValueError("end_year must be greater than start_year")
        if self.end_year - self.start_year != 5:
            raise ValueError("IDP cycle must span exactly 5 years (end_year = start_year + 5)")
        return self

    @field_validator("start_year", "end_year", mode="before")
    @classmethod
    def validate_year_range_values(cls, v: int) -> int:
        if not (2000 <= v <= 2100):
            raise ValueError("Year must be between 2000 and 2100")
        return v


class IDPCycleResponse(BaseModel):
    """Schema for IDP cycle API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    vision: str | None
    mission: str | None
    start_year: int
    end_year: int
    status: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# IDP Goal
# ---------------------------------------------------------------------------

class IDPGoalCreate(BaseModel):
    """Schema for adding a strategic goal to an IDP cycle."""

    title: str
    description: str | None = None
    national_kpa: NationalKPA

    @field_validator("national_kpa", mode="before")
    @classmethod
    def validate_national_kpa(cls, v: str) -> NationalKPA:
        """Ensure the national_kpa value is a valid NationalKPA enum member."""
        try:
            return NationalKPA(v)
        except ValueError:
            valid = [e.value for e in NationalKPA]
            raise ValueError(f"Invalid national_kpa. Must be one of: {valid}")


class IDPGoalResponse(BaseModel):
    """Schema for IDP goal API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cycle_id: UUID
    title: str
    description: str | None
    national_kpa: str
    display_order: int
    created_at: datetime


# ---------------------------------------------------------------------------
# IDP Objective
# ---------------------------------------------------------------------------

class IDPObjectiveCreate(BaseModel):
    """Schema for adding an objective under an IDP goal."""

    title: str
    description: str | None = None


class IDPObjectiveResponse(BaseModel):
    """Schema for IDP objective API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    goal_id: UUID
    title: str
    description: str | None
    display_order: int
    created_at: datetime


# ---------------------------------------------------------------------------
# IDP Version
# ---------------------------------------------------------------------------

_FINANCIAL_YEAR_PATTERN = re.compile(r"^\d{4}/\d{2}$")


class IDPVersionCreate(BaseModel):
    """Schema for creating an annual IDP review version."""

    version_number: int
    financial_year: str
    notes: str | None = None

    @field_validator("version_number")
    @classmethod
    def validate_version_number(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("version_number must be between 1 and 5")
        return v

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        if not _FINANCIAL_YEAR_PATTERN.match(v):
            raise ValueError("financial_year must match pattern YYYY/YY (e.g., '2025/26')")
        return v


class IDPVersionResponse(BaseModel):
    """Schema for IDP version API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    cycle_id: UUID
    version_number: int
    financial_year: str
    notes: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Transition
# ---------------------------------------------------------------------------

class IDPTransitionRequest(BaseModel):
    """Schema for IDP cycle state transition requests."""

    event: str  # "submit" | "open_review" | "re_approve"
