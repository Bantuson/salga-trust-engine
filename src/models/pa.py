"""Performance Agreement (PA) ORM models.

Performance Agreements form the individual accountability layer of the PMS golden thread:
    SDBIPKpi -> PerformanceAgreement -> PAKpi -> PAQuarterlyScore

Each Section 57 manager (Municipal Manager or Director) has a Performance Agreement
for a financial year containing individual KPIs linked to organisational SDBIP KPIs.
The agreement follows a 4-state approval workflow:

    draft -> signed -> under_review -> assessed

Signing is role-gated per PA-06:
    - section57_director PAs: signed by the Municipal Manager (or admin/salga_admin bypass)
    - municipal_manager PA:   signed by the Executive Mayor (or admin/salga_admin bypass)

POPIA: assessed agreements set popia_retention_flag=True to trigger the 5-year
retention / departure-date cycle for personal performance data.

All models inherit TenantAwareModel for automatic RLS, audit trail, and
multi-tenant isolation.
"""
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from statemachine import State, StateMachine
from statemachine.exceptions import TransitionNotAllowed  # noqa: F401 (re-exported for callers)

from src.models.base import TenantAwareModel


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class PAStatus(StrEnum):
    """Approval lifecycle states for a Performance Agreement."""

    DRAFT = "draft"
    SIGNED = "signed"
    UNDER_REVIEW = "under_review"
    ASSESSED = "assessed"


class ManagerRole(StrEnum):
    """Section 57 manager role discriminator.

    Determines who must sign the Performance Agreement (PA-06):
    - SECTION57_DIRECTOR: signed by the Municipal Manager
    - MUNICIPAL_MANAGER:  signed by the Executive Mayor
    """

    SECTION57_DIRECTOR = "section57_director"
    MUNICIPAL_MANAGER = "municipal_manager"


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class PAWorkflow(StateMachine):
    """Performance Agreement approval workflow: draft -> signed -> under_review -> assessed.

    Allowed transitions:
    - sign:        draft       -> signed       (role-gated, see PA-06)
    - open_review: signed      -> under_review (mid-year assessment opens)
    - assess:      under_review -> assessed    (final score submitted; triggers POPIA flag)

    Usage with model binding (python-statemachine 3.x)::

        machine = PAWorkflow(model=agreement, state_field="status",
                             start_value=agreement.status)
        machine.send(event)   # modifies agreement.status in place
        # Catch TransitionNotAllowed for invalid transitions -> HTTP 409
    """

    draft = State(initial=True, value="draft")
    signed = State(value="signed")
    under_review = State(value="under_review")
    assessed = State(final=True, value="assessed")

    sign = draft.to(signed)             # Mayor / MM sign-off
    open_review = signed.to(under_review)  # Mid-year review opens
    assess = under_review.to(assessed)  # Final assessment submitted


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------


class PerformanceAgreement(TenantAwareModel):
    """Individual Performance Agreement for a Section 57 manager.

    A PA links a Section 57 manager to an organisational SDBIP KPI set for
    a given financial year, expressing the manager's personal performance
    commitments. One PA per (manager, financial_year, tenant).

    POPIA:
        popia_retention_flag is set True when the PA is assessed. The
        popia_departure_date is populated externally when the manager departs,
        triggering the 5-year personal data retention countdown.
    """

    __tablename__ = "performance_agreements"
    __table_args__ = (
        UniqueConstraint(
            "section57_manager_id",
            "financial_year",
            "tenant_id",
            name="uq_pa_manager_fy_tenant",
        ),
    )

    financial_year: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    section57_manager_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
        comment="FK to users.id for the Section 57 manager this PA belongs to",
    )
    manager_role: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="'section57_director' or 'municipal_manager'",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=PAStatus.DRAFT,
        server_default="draft",
        comment="PA lifecycle: draft -> signed -> under_review -> assessed",
    )
    annual_score: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 4),
        nullable=True,
        comment="Final annual performance score (0-100); set during assess transition",
    )
    popia_retention_flag: Mapped[bool] = mapped_column(  # POPIA
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="POPIA: True after assessment — triggers 5-year personal data retention",
    )
    popia_departure_date: Mapped[datetime | None] = mapped_column(  # POPIA
        DateTime(timezone=True),
        nullable=True,
        comment="POPIA: manager departure date; starts retention countdown",
    )

    # Relationships
    kpis: Mapped[list["PAKpi"]] = relationship(
        "PAKpi",
        back_populates="agreement",
        cascade="all, delete-orphan",
        lazy="select",
    )
    manager: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[section57_manager_id],
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<PerformanceAgreement manager={self.section57_manager_id} "
            f"FY={self.financial_year} role={self.manager_role} [{self.status}]>"
        )


class PAKpi(TenantAwareModel):
    """Individual KPI within a Performance Agreement.

    Links an organisational SDBIP KPI to a Section 57 manager's PA with
    individual targets and weight. The sum of weights per PA should total 100
    (enforced at the service layer, not DB level, for SQLite compatibility).

    Uniqueness:
        One PAKpi per (agreement_id, sdbip_kpi_id) — prevents duplicate SDBIP
        KPI references within a single PA.
    """

    __tablename__ = "pa_kpis"
    __table_args__ = (
        UniqueConstraint(
            "agreement_id",
            "sdbip_kpi_id",
            name="uq_pa_kpi_agreement_sdbip",
        ),
    )

    agreement_id: Mapped[UUID] = mapped_column(
        ForeignKey("performance_agreements.id"),
        nullable=False,
        index=True,
        comment="FK to PerformanceAgreement this KPI belongs to",
    )
    sdbip_kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_kpis.id"),
        nullable=False,
        index=True,
        comment="FK to organisational SDBIP KPI this PA KPI is derived from",
    )
    individual_target: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        comment="Individual target for this manager's KPI (may differ from SDBIP target)",
    )
    weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Percentage weight of this KPI in the PA (0-100; sum = 100)",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional description overriding or supplementing the SDBIP KPI description",
    )

    # Relationships
    agreement: Mapped["PerformanceAgreement"] = relationship(
        "PerformanceAgreement",
        back_populates="kpis",
    )
    quarterly_scores: Mapped[list["PAQuarterlyScore"]] = relationship(
        "PAQuarterlyScore",
        back_populates="pa_kpi",
        cascade="all, delete-orphan",
        order_by="PAQuarterlyScore.quarter",
    )
    sdbip_kpi: Mapped["SDBIPKpi"] = relationship(  # type: ignore[name-defined]
        "SDBIPKpi",
        foreign_keys=[sdbip_kpi_id],
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<PAKpi agreement={self.agreement_id} sdbip_kpi={self.sdbip_kpi_id} "
            f"weight={self.weight}% target={self.individual_target}>"
        )


class PAQuarterlyScore(TenantAwareModel):
    """Quarterly score submitted for a PA KPI.

    A PMS officer or assessor submits quarterly scores (Q1-Q4) for each
    PA KPI. One score per (pa_kpi_id, quarter) is enforced by unique constraint.

    score: 0-100 performance score for the quarter.
    scored_by: user ID string of the assessor (not a FK — denormalised for audit).
    """

    __tablename__ = "pa_quarterly_scores"
    __table_args__ = (
        UniqueConstraint(
            "pa_kpi_id",
            "quarter",
            name="uq_pa_score_kpi_quarter",
        ),
    )

    pa_kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("pa_kpis.id"),
        nullable=False,
        index=True,
        comment="FK to PAKpi this score is submitted for",
    )
    quarter: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
        comment="Q1, Q2, Q3, or Q4 (South African financial year: July-June)",
    )
    score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Performance score for the quarter (0-100)",
    )
    scored_by: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="User ID (str) of the assessor who submitted the score",
    )
    scored_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the score was submitted",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Optional assessor notes or evidence references for this quarter's score",
    )

    # Relationships
    pa_kpi: Mapped["PAKpi"] = relationship(
        "PAKpi",
        back_populates="quarterly_scores",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<PAQuarterlyScore pa_kpi={self.pa_kpi_id} "
            f"{self.quarter}={self.score} by={self.scored_by}>"
        )
