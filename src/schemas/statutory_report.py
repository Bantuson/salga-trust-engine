"""Pydantic v2 schemas for Statutory Report CRUD and state machine transitions.

These schemas validate API request/response payloads for:
- StatutoryReport creation (Section 52/72/46/121 reports)
- StatutoryReport response serialisation
- Report state machine transitions
- Report snapshot response (for debugging/audit)
- StatutoryDeadline response (deadline calendar, REPORT-07)

Business rules enforced at schema level:
- financial_year must match YYYY/YY (e.g., "2025/26")
- quarter must be Q1-Q4 or None
- SECTION_52 reports require a quarter (enforced at service layer, noted here)

Role-gated transitions (REPORT-05) are enforced at the service layer, not here.
"""
import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.models.statutory_report import ReportType

# Financial year format: YYYY/YY (e.g., "2025/26")
_FINANCIAL_YEAR_PATTERN = re.compile(r"^\d{4}/\d{2}$")

# Valid transition events
_VALID_EVENTS = {"submit_for_review", "approve", "submit_external", "table"}


# ---------------------------------------------------------------------------
# StatutoryReport Create
# ---------------------------------------------------------------------------


class StatutoryReportCreate(BaseModel):
    """Schema for creating a new statutory report.

    financial_year must follow YYYY/YY format.
    quarter is required for SECTION_52; optional for other types.
    title is a human-readable report title (max 200 chars).

    Note: Quarter presence for SECTION_52 is validated at the service layer
    to produce clear 422 responses with the field name in the error detail.
    """

    report_type: ReportType = Field(
        ...,
        description="Report type: section_52, section_72, section_46, or section_121",
    )
    financial_year: str = Field(
        ...,
        description="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    quarter: str | None = Field(
        default=None,
        description="Quarter: Q1, Q2, Q3, or Q4. Required for SECTION_52; null for other types.",
    )
    title: str = Field(
        ...,
        max_length=200,
        description="Human-readable report title (max 200 characters)",
    )

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        """Validate YYYY/YY pattern (e.g., '2025/26')."""
        if not _FINANCIAL_YEAR_PATTERN.match(v):
            raise ValueError("financial_year must match pattern YYYY/YY (e.g., '2025/26')")
        return v

    @field_validator("quarter")
    @classmethod
    def validate_quarter(cls, v: str | None) -> str | None:
        """Validate quarter is Q1, Q2, Q3, Q4, or None."""
        if v is not None and v not in {"Q1", "Q2", "Q3", "Q4"}:
            raise ValueError("quarter must be one of: Q1, Q2, Q3, Q4 (or null)")
        return v

    @model_validator(mode="after")
    def validate_quarter_for_section_52(self) -> "StatutoryReportCreate":
        """Validate that quarter is provided when report_type is SECTION_52."""
        if self.report_type == ReportType.SECTION_52 and self.quarter is None:
            raise ValueError("quarter is required for SECTION_52 reports (must be Q1, Q2, Q3, or Q4)")
        return self


# ---------------------------------------------------------------------------
# StatutoryReport Response
# ---------------------------------------------------------------------------


class StatutoryReportResponse(BaseModel):
    """Schema for statutory report API responses.

    Serialises all statutory_reports table fields for frontend display.
    from_attributes=True enables Pydantic to read from ORM objects directly.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    report_type: str
    financial_year: str
    quarter: str | None
    period_start: datetime
    period_end: datetime
    title: str
    status: str
    generated_by: str | None
    generated_at: datetime | None
    approved_by: str | None
    approved_at: datetime | None
    pdf_storage_path: str | None
    docx_storage_path: str | None
    created_at: datetime
    updated_at: datetime | None


# ---------------------------------------------------------------------------
# Report Transition Request
# ---------------------------------------------------------------------------


class ReportTransitionRequest(BaseModel):
    """Schema for statutory report state machine transition requests.

    Valid events (REPORT-05):
    - "submit_for_review": drafting        -> internal_review
    - "approve":           internal_review -> mm_approved (triggers data snapshot)
    - "submit_external":   mm_approved     -> submitted
    - "table":             submitted       -> tabled
    """

    event: str = Field(
        ...,
        description=(
            "State machine event: 'submit_for_review', 'approve', "
            "'submit_external', or 'table'"
        ),
    )

    @field_validator("event")
    @classmethod
    def validate_event(cls, v: str) -> str:
        """Validate event is one of the allowed report transitions."""
        if v not in _VALID_EVENTS:
            raise ValueError(
                f"event must be one of: {sorted(_VALID_EVENTS)}"
            )
        return v


# ---------------------------------------------------------------------------
# Report Snapshot Response
# ---------------------------------------------------------------------------


class ReportSnapshotResponse(BaseModel):
    """Schema for report snapshot API responses.

    Note: snapshot_data (JSON blob) is intentionally excluded from this
    response as it can be very large. A separate dedicated endpoint should
    be used to retrieve raw snapshot data for debugging.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    report_id: UUID
    snapshot_at: datetime
    snapshot_reason: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Statutory Deadline Schemas (REPORT-07)
# ---------------------------------------------------------------------------


class StatutoryDeadlineResponse(BaseModel):
    """Schema for statutory deadline API responses.

    Serialises all statutory_deadlines table fields for the deadline calendar.
    from_attributes=True enables Pydantic to read from ORM objects directly.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    report_type: str
    financial_year: str
    quarter: str | None
    deadline_date: date
    description: str
    task_created: bool
    task_created_at: datetime | None
    report_id: UUID | None
    notification_30d_sent: bool
    notification_14d_sent: bool
    notification_7d_sent: bool
    notification_3d_sent: bool
    notification_overdue_sent: bool
    created_at: datetime
    updated_at: datetime | None


class DeadlineCalendarResponse(BaseModel):
    """Schema for a full deadline calendar for a given financial year.

    Returns the financial_year string and all associated deadline records.
    """

    financial_year: str
    deadlines: list[StatutoryDeadlineResponse]


class DeadlinePopulateRequest(BaseModel):
    """Schema for manually triggering deadline population for a financial year."""

    financial_year: str = Field(
        ...,
        description="Financial year in YYYY/YY format (e.g., '2025/26')",
    )

    @field_validator("financial_year")
    @classmethod
    def validate_financial_year(cls, v: str) -> str:
        """Validate YYYY/YY pattern."""
        if not re.compile(r"^\d{4}/\d{2}$").match(v):
            raise ValueError("financial_year must match pattern YYYY/YY (e.g., '2025/26')")
        return v
