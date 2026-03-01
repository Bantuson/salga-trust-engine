"""Statutory Report ORM models and approval workflow state machine.

Statutory reports are formal legal accountability documents submitted to Council,
National Treasury, and/or the Auditor-General under the MFMA:

    Section 52  — Quarterly performance report (submitted within 30 days of quarter end)
    Section 72  — Mid-year budget and performance assessment (by 25 January)
    Section 46  — Annual performance report (30 days after audit outcome)
    Section 121 — Annual financial statements

Report lifecycle (5-stage approval chain):
    drafting -> internal_review -> mm_approved -> submitted -> tabled

REPORT-06 (Data Snapshot):
    Source data is snapshotted as JSON at mm_approved status. All subsequent
    exports render from the snapshot, not live data, to ensure the auditable
    record matches what was approved by the Municipal Manager.

REPORT-08 (Branded Export):
    Municipality logo_url is stored on the Municipality model and passed to
    Jinja2 templates for PDF/DOCX rendering.

All models inherit TenantAwareModel for automatic RLS, audit trail, and
multi-tenant isolation.
"""
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from statemachine import State, StateMachine
from statemachine.exceptions import TransitionNotAllowed  # noqa: F401 (re-exported for callers)

from src.models.base import TenantAwareModel


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class ReportType(StrEnum):
    """Statutory report types under the Municipal Finance Management Act (MFMA).

    Section 52:  Quarterly performance report
    Section 72:  Mid-year budget and performance assessment
    Section 46:  Annual performance report
    Section 121: Annual financial statements
    """

    SECTION_52 = "section_52"
    SECTION_72 = "section_72"
    SECTION_46 = "section_46"
    SECTION_121 = "section_121"


class ReportStatus(StrEnum):
    """Approval lifecycle states for a statutory report.

    5-stage chain per REPORT-05:
    1. drafting        — Initial creation, report is being compiled
    2. internal_review — Submitted for internal quality review (CFO/directors)
    3. mm_approved     — Approved by Municipal Manager; triggers data snapshot
    4. submitted       — Submitted externally (to National Treasury / AG)
    5. tabled          — Tabled at Council meeting (final)
    """

    DRAFTING = "drafting"
    INTERNAL_REVIEW = "internal_review"
    MM_APPROVED = "mm_approved"
    SUBMITTED = "submitted"
    TABLED = "tabled"


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class ReportWorkflow(StateMachine):
    """Statutory report approval workflow: drafting -> tabled (5 states, 4 transitions).

    Allowed transitions:
    - submit_for_review: drafting        -> internal_review
    - approve:           internal_review -> mm_approved     (triggers data snapshot)
    - submit_external:   mm_approved     -> submitted
    - table:             submitted       -> tabled          (final state)

    Usage with model binding (python-statemachine 3.x)::

        machine = ReportWorkflow(model=report, state_field="status",
                                 start_value=report.status)
        machine.send(event)   # modifies report.status in place
        # Catch TransitionNotAllowed for invalid transitions -> HTTP 409
    """

    # States
    drafting = State(initial=True, value="drafting")
    internal_review = State(value="internal_review")
    mm_approved = State(value="mm_approved")
    submitted = State(value="submitted")
    tabled = State(final=True, value="tabled")

    # Transitions
    submit_for_review = drafting.to(internal_review)
    approve = internal_review.to(mm_approved)
    submit_external = mm_approved.to(submitted)
    table = submitted.to(tabled)


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------


class StatutoryReport(TenantAwareModel):
    """A statutory report produced by the municipality under the MFMA.

    Each combination of (report_type, financial_year, quarter, tenant_id)
    must be unique — municipalities produce one report per period per type.
    For Section 72/46/121, quarter is NULL (covers full period, not one quarter).

    REPORT-06 (Data Snapshot):
        When the report transitions to mm_approved, a StatutoryReportSnapshot
        is created containing all SDBIP KPI data at that moment. Subsequent
        PDF/DOCX exports render from the snapshot, not live data.
    """

    __tablename__ = "statutory_reports"
    __table_args__ = (
        UniqueConstraint(
            "report_type",
            "financial_year",
            "quarter",
            "tenant_id",
            name="uq_statutory_report_type_fy_q",
        ),
    )

    report_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Report type: section_52, section_72, section_46, or section_121",
    )
    financial_year: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    quarter: Mapped[str | None] = mapped_column(
        String(2),
        nullable=True,
        comment="Q1-Q4 for Section 52 only; NULL for Section 72/46/121",
    )
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        comment="Start date of the reporting period (e.g., 1 July 2025)",
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        nullable=False,
        comment="End date of the reporting period (e.g., 30 September 2025)",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Human-readable report title (e.g., 'Q1 2025/26 Section 52 Report')",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ReportStatus.DRAFTING,
        server_default="drafting",
        comment="Approval lifecycle: drafting -> internal_review -> mm_approved -> submitted -> tabled",
    )
    generated_by: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="User ID (str) who triggered PDF/DOCX generation",
    )
    generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when PDF/DOCX generation completed",
    )
    approved_by: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="User ID (str) of the Municipal Manager who approved (mm_approved transition)",
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when Municipal Manager approved the report",
    )
    pdf_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Storage path for the generated PDF file",
    )
    docx_storage_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Storage path for the generated DOCX file",
    )

    # Relationships
    snapshots: Mapped[list["StatutoryReportSnapshot"]] = relationship(
        "StatutoryReportSnapshot",
        back_populates="report",
        cascade="all, delete-orphan",
        order_by="StatutoryReportSnapshot.snapshot_at",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<StatutoryReport {self.report_type} {self.financial_year} "
            f"Q={self.quarter} [{self.status}]>"
        )


class StatutoryReportSnapshot(TenantAwareModel):
    """Immutable data snapshot taken at mm_approved transition (REPORT-06).

    When the Municipal Manager approves a report, all SDBIP KPI data
    (targets, actuals, achievement percentages, traffic lights) is serialised
    to JSON and stored here. All subsequent PDF/DOCX exports render from this
    snapshot to ensure the exported document matches the approved source data.

    snapshot_reason tracks why the snapshot was created (always "mm_approved"
    for the primary snapshot; future revisions could create "revised" snapshots).
    """

    __tablename__ = "statutory_report_snapshots"

    report_id: Mapped[UUID] = mapped_column(
        ForeignKey("statutory_reports.id"),
        nullable=False,
        index=True,
        comment="FK to the StatutoryReport this snapshot belongs to",
    )
    snapshot_data: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="JSON-serialised SDBIP KPI data at the time of approval",
    )
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        comment="Timestamp when the snapshot was created",
    )
    snapshot_reason: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Reason for snapshot creation (e.g., 'mm_approved')",
    )

    # Relationships
    report: Mapped["StatutoryReport"] = relationship(
        "StatutoryReport",
        back_populates="snapshots",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<StatutoryReportSnapshot report={self.report_id} "
            f"reason={self.snapshot_reason} at={self.snapshot_at}>"
        )
