"""Pydantic schemas for citizen portal API."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class CitizenTicketResponse(BaseModel):
    """Schema for citizen's own ticket (non-sensitive, full details)."""
    tracking_number: str
    category: str
    status: str
    created_at: datetime
    address: str | None
    severity: str
    assigned_to_name: str | None = Field(None, description="Name of assigned field worker/manager")
    assigned_team_name: str | None = Field(None, description="Name of assigned team")
    media_count: int = Field(0, description="Number of attached photos/videos")
    is_sensitive: bool

    class Config:
        from_attributes = True


class CitizenGBVTicketResponse(BaseModel):
    """Schema for citizen's own GBV ticket (limited fields for privacy).

    GBV tickets show minimal information to protect victim privacy while
    allowing them to track case status and contact their assigned SAPS officer.
    """
    tracking_number: str
    status: str
    assigned_officer_name: str | None = Field(None, description="Name of assigned SAPS liaison officer")
    station_name: str | None = Field(None, description="SAPS station handling the case")
    station_phone: str | None = Field(None, description="SAPS station contact number")
    is_sensitive: Literal[True] = True

    class Config:
        from_attributes = True


class CitizenMyReportsResponse(BaseModel):
    """Schema for citizen's full report list (mixed municipal + GBV tickets)."""
    tickets: list[CitizenTicketResponse | CitizenGBVTicketResponse]
    total: int


class CitizenStatsResponse(BaseModel):
    """Schema for citizen's personal analytics."""
    total_reports: int = Field(..., ge=0)
    resolved_count: int = Field(..., ge=0)
    avg_resolution_days: float | None = Field(None, ge=0.0, description="Average days to resolve user's tickets")
    municipality_avg_resolution_days: float | None = Field(None, ge=0.0, description="Municipality average for comparison")
