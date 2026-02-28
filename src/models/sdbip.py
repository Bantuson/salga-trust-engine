"""SDBIP (Service Delivery and Budget Implementation Plan) ORM models.

SDBIP KPIs form the measurable heart of the PMS golden thread:
    IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi -> SDBIPQuarterlyTarget

Each KPI links upward to an IDP objective (golden thread) and downward to quarterly
actuals (performance monitoring). Budget codes use the mSCOA reference table to
ensure National Treasury-standardized classification.

All scorecard/KPI models inherit TenantAwareModel for automatic RLS, audit trail,
and multi-tenant isolation.

Layer hierarchy:
- Top Layer:        SDBIPScorecard (layer="top", no department) -> SDBIPKpi
- Departmental:     SDBIPScorecard (layer="departmental", dept FK) -> SDBIPKpi
"""
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import TenantAwareModel


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class SDBIPLayer(StrEnum):
    """Layer of SDBIP scorecard — top (municipal) or departmental."""

    TOP = "top"
    DEPARTMENTAL = "departmental"


class SDBIPStatus(StrEnum):
    """Approval lifecycle states for an SDBIP scorecard."""

    DRAFT = "draft"
    APPROVED = "approved"
    REVISED = "revised"


class Quarter(StrEnum):
    """Financial year quarters (South African municipalities: July to June)."""

    Q1 = "Q1"  # July - September
    Q2 = "Q2"  # October - December
    Q3 = "Q3"  # January - March
    Q4 = "Q4"  # April - June


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------


class SDBIPScorecard(TenantAwareModel):
    """SDBIP scorecard for a financial year (top layer or departmental).

    A municipality produces one Top Layer SDBIP scorecard per financial year,
    and one Departmental scorecard per department. Both types are represented
    here; layer discriminates between them.

    Uniqueness:
        (financial_year, layer, department_id, tenant_id) must be unique.
        For top-layer scorecards: department_id is NULL (one per municipality per year).
        For departmental scorecards: one per (dept, year) per municipality.
    """

    __tablename__ = "sdbip_scorecards"
    __table_args__ = (
        UniqueConstraint(
            "financial_year",
            "layer",
            "department_id",
            "tenant_id",
            name="uq_sdbip_scorecard_fy_layer_dept",
        ),
    )

    financial_year: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    layer: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="'top' = municipal-level scorecard; 'departmental' = dept-level",
    )
    department_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True,
        index=True,
        comment="NULL for top-layer scorecards; required for departmental scorecards",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SDBIPStatus.DRAFT,
        server_default="draft",
        comment="Approval lifecycle: draft -> approved -> revised",
    )
    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        comment="Optional descriptive title for the scorecard",
    )

    # Relationships
    kpis: Mapped[list["SDBIPKpi"]] = relationship(
        "SDBIPKpi",
        back_populates="scorecard",
        cascade="all, delete-orphan",
        order_by="SDBIPKpi.kpi_number",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<SDBIPScorecard {self.financial_year} [{self.layer}] "
            f"dept={self.department_id} [{self.status}]>"
        )


class SDBIPKpi(TenantAwareModel):
    """A Key Performance Indicator (KPI) within an SDBIP scorecard.

    KPIs are the measurable commitments in the SDBIP. Each KPI must:
    - Belong to a scorecard
    - Optionally link to an IDP objective (golden thread)
    - Optionally reference an mSCOA budget code (for budget alignment)
    - Have 4 quarterly targets (Q1-Q4) set separately

    Weight (0-100): percentage contribution of this KPI to the scorecard total.
    The sum of weights per scorecard should equal 100, but this is enforced
    at the service/API level, not the database level.
    """

    __tablename__ = "sdbip_kpis"

    scorecard_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_scorecards.id"),
        nullable=False,
        index=True,
    )
    idp_objective_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("idp_objectives.id"),
        nullable=True,
        index=True,
        comment="Golden thread link to IDP objective; null for administrative KPIs",
    )
    department_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True,
        index=True,
        comment="Responsible department (mirrors scorecard.department_id for departmental KPIs)",
    )
    mscoa_code_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("mscoa_reference.id"),
        nullable=True,
        index=True,
        comment="FK to mscoa_reference for budget code alignment; validated at service layer",
    )
    responsible_director_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        comment="Section 56 director accountable for this KPI",
    )
    kpi_number: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Sequential identifier within scorecard (e.g., 'KPI-001')",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full description of what this KPI measures",
    )
    unit_of_measurement: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Unit type: 'percentage', 'number', 'rand', 'days', etc.",
    )
    baseline: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        comment="Prior-year baseline performance value",
    )
    annual_target: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        comment="Target value for the full financial year",
    )
    weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        comment="Percentage weight of this KPI in the scorecard (0-100; sum = 100)",
    )

    # Relationships
    scorecard: Mapped["SDBIPScorecard"] = relationship(
        "SDBIPScorecard",
        back_populates="kpis",
    )
    quarterly_targets: Mapped[list["SDBIPQuarterlyTarget"]] = relationship(
        "SDBIPQuarterlyTarget",
        back_populates="kpi",
        cascade="all, delete-orphan",
        order_by="SDBIPQuarterlyTarget.quarter",
    )
    # String reference to IDPObjective (avoids circular import; model loaded first)
    objective: Mapped["IDPObjective | None"] = relationship(  # type: ignore[name-defined]
        "IDPObjective",
        foreign_keys=[idp_objective_id],
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SDBIPKpi {self.kpi_number}: {self.description[:40]} (weight={self.weight}%)>"


class SDBIPQuarterlyTarget(TenantAwareModel):
    """Quarterly breakdown target for a single SDBIP KPI.

    Each KPI must have exactly 4 quarterly targets (Q1-Q4 per financial year).
    These are stored as separate records to allow individual reporting against
    each quarter's actual performance.

    The sum of quarterly targets does NOT have to equal the annual_target because
    some KPIs measure cumulative progress (e.g., "25% per quarter = 100% annual")
    while others measure year-end outcomes (e.g., "complete by Q4 = Q4 target only").
    """

    __tablename__ = "sdbip_quarterly_targets"
    __table_args__ = (
        UniqueConstraint("kpi_id", "quarter", name="uq_sdbip_qt_kpi_quarter"),
    )

    kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_kpis.id"),
        nullable=False,
        index=True,
    )
    quarter: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
        comment="Q1, Q2, Q3, or Q4 (South African financial year: July-June)",
    )
    target_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        comment="Performance target for this quarter",
    )

    # Relationships
    kpi: Mapped["SDBIPKpi"] = relationship(
        "SDBIPKpi",
        back_populates="quarterly_targets",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SDBIPQuarterlyTarget {self.quarter}={self.target_value} for kpi={self.kpi_id}>"
