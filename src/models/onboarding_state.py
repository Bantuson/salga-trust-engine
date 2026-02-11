"""Onboarding state model for tracking municipality setup wizard progress."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class OnboardingState(NonTenantModel):
    """Tracks municipality onboarding wizard progress.

    After a municipality is approved, the admin completes a guided onboarding wizard:
    1. Profile setup (municipality details, logo, contact info)
    2. Team setup (invite managers, ward councillors, field workers)
    3. Ward configuration (upload ward boundaries, assign councillors)
    4. SLA targets (set response/resolution times per category)
    5. Complete (finalize setup, activate municipality)

    Each step's form data is saved as JSON, allowing the wizard to be resumed
    if interrupted. Uses (municipality_id, step_id) unique constraint to enable
    upsert pattern in the API.

    Uses NonTenantModel since onboarding is municipality-level configuration,
    not tenant-scoped operational data.
    """

    __tablename__ = "onboarding_state"
    __table_args__ = (
        UniqueConstraint("municipality_id", "step_id", name="uq_onboarding_municipality_step"),
    )

    municipality_id: Mapped[UUID] = mapped_column(
        ForeignKey("municipalities.id"),
        nullable=False,
        index=True
    )
    step_id: Mapped[str] = mapped_column(String(50), nullable=False)
    step_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string with step form data
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
