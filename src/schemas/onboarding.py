"""Pydantic schemas for onboarding wizard API."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OnboardingStepID(str):
    """Valid onboarding step identifiers."""
    PROFILE = "profile"
    TEAM = "team"
    WARDS = "wards"
    SLA = "sla"
    COMPLETE = "complete"


class OnboardingStepSave(BaseModel):
    """Schema for saving onboarding step data (upsert)."""
    step_id: str = Field(..., pattern="^(profile|team|wards|sla|complete)$")
    step_data: dict | None = Field(None, description="Step form data as JSON object")
    is_completed: bool = Field(False, description="Whether this step was completed (not skipped)")


class OnboardingStepResponse(BaseModel):
    """Schema for onboarding step response."""
    step_id: str
    step_data: dict | None
    is_completed: bool
    completed_at: datetime | None

    class Config:
        from_attributes = True


class OnboardingProgressResponse(BaseModel):
    """Schema for full onboarding progress."""
    municipality_id: UUID
    steps: list[OnboardingStepResponse]
    overall_progress: float = Field(..., ge=0.0, le=100.0, description="Percentage of completed steps (0-100)")
