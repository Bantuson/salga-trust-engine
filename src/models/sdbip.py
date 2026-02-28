"""SDBIP (Service Delivery and Budget Implementation Plan) ORM models.

SDBIP KPIs form the measurable heart of the PMS golden thread:
    IDPCycle -> IDPGoal -> IDPObjective -> SDBIPScorecard -> SDBIPKpi -> SDBIPQuarterlyTarget
                                                                             |
                                                                     SDBIPActual (quarterly actuals)

Each KPI links upward to an IDP objective (golden thread) and downward to quarterly
actuals (performance monitoring). Budget codes use the mSCOA reference table to
ensure National Treasury-standardized classification.

All scorecard/KPI models inherit TenantAwareModel for automatic RLS, audit trail,
and multi-tenant isolation.

Layer hierarchy:
- Top Layer:        SDBIPScorecard (layer="top", no department) -> SDBIPKpi
- Departmental:     SDBIPScorecard (layer="departmental", dept FK) -> SDBIPKpi
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


class TrafficLight(StrEnum):
    """Traffic-light performance status for quarterly actuals.

    Thresholds (per MFMA Section 52 reporting standards):
    - GREEN:  achievement >= 80% of target
    - AMBER:  50% <= achievement < 80%
    - RED:    achievement < 50% (or target = 0)
    """

    GREEN = "green"
    AMBER = "amber"
    RED = "red"


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


class SDBIPWorkflow(StateMachine):
    """SDBIP approval workflow: draft -> approved -> revised -> approved.

    Allowed transitions:
    - submit:     draft    -> approved  (Mayor sign-off required)
    - revise:     approved -> revised   (Open for mid-year revision)
    - resubmit:   revised  -> approved  (Re-approve after revision)

    Usage with model binding (python-statemachine 3.x)::

        machine = SDBIPWorkflow(model=scorecard, state_field="status",
                                start_value=scorecard.status)
        machine.send(event)   # modifies scorecard.status in place
        # Catch TransitionNotAllowed for invalid transitions -> HTTP 409
    """

    draft = State(initial=True, value="draft")
    approved = State(value="approved")
    revised = State(value="revised")

    submit = draft.to(approved)      # Mayor sign-off
    revise = approved.to(revised)    # Open for revision
    resubmit = revised.to(approved)  # Re-approve after revision


# ---------------------------------------------------------------------------
# Achievement computation helper
# ---------------------------------------------------------------------------


def compute_achievement(
    actual: Decimal, target: Decimal
) -> tuple[Decimal, str]:
    """Compute achievement percentage and traffic-light status for an actual.

    Args:
        actual: The actual value submitted by the director.
        target: The quarterly target value.

    Returns:
        Tuple of (achievement_pct, traffic_light_status).
        - achievement_pct: (actual / target) * 100, or 0 if target == 0.
        - traffic_light_status: TrafficLight enum value string.

    Notes:
        - Division by zero (target=0) is handled gracefully: returns (0, RED).
        - All arithmetic uses Decimal to avoid float precision errors.
        - Thresholds: green >= 80%, amber 50-79%, red < 50%.
    """
    if target == Decimal("0"):
        return Decimal("0"), TrafficLight.RED

    pct = (actual / target) * Decimal("100")
    if pct >= Decimal("80"):
        return pct, TrafficLight.GREEN
    elif pct >= Decimal("50"):
        return pct, TrafficLight.AMBER
    else:
        return pct, TrafficLight.RED


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
    actuals: Mapped[list["SDBIPActual"]] = relationship(
        "SDBIPActual",
        back_populates="kpi",
        cascade="all, delete-orphan",
        order_by="SDBIPActual.quarter",
        foreign_keys="SDBIPActual.kpi_id",
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


class SDBIPActual(TenantAwareModel):
    """Quarterly actual performance value submitted against an SDBIP KPI target.

    Directors submit their actual achievement each quarter. The system automatically
    computes the achievement percentage and traffic-light status on write.

    Immutability:
        Once validated by a PMS officer (is_validated=True), actuals become immutable.
        PUT/PATCH on a validated actual returns 422. Corrections create new SDBIPActual
        records with corrects_actual_id pointing to the original (audit chain).

    Traffic-light thresholds (MFMA Section 52 reporting standards):
        - GREEN:  achievement >= 80% of target
        - AMBER:  50% <= achievement < 80%
        - RED:    achievement < 50% (including division-by-zero case)

    Auto-population:
        is_auto_populated=True marks actuals populated by the system query engine
        rather than manually submitted by a director.
    """

    __tablename__ = "sdbip_actuals"

    kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_kpis.id"),
        nullable=False,
        index=True,
        comment="FK to SDBIP KPI this actual is measured against",
    )
    quarter: Mapped[str] = mapped_column(
        String(2),
        nullable=False,
        comment="Q1, Q2, Q3, or Q4 (South African financial year: July-June)",
    )
    financial_year: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Financial year in YYYY/YY format (e.g., '2025/26')",
    )
    actual_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 4),
        nullable=False,
        comment="Actual performance value submitted by the director",
    )
    achievement_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 4),
        nullable=True,
        comment="(actual / target) * 100 — computed on write by compute_achievement()",
    )
    traffic_light_status: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="green >= 80%, amber 50-79%, red < 50% — computed on write",
    )
    submitted_by: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="User ID (str) of the director who submitted the actual",
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the actual was submitted",
    )
    is_validated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="True = validated by PMS officer; immutable thereafter",
    )
    validated_by: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="User ID (str) of the PMS officer who validated the actual",
    )
    validated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the actual was validated",
    )
    corrects_actual_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("sdbip_actuals.id"),
        nullable=True,
        index=True,
        comment="FK to original SDBIPActual this record corrects (correction chain)",
    )
    is_auto_populated: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="True = populated by the system query engine, not manually submitted",
    )
    source_query_ref: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Reference to the auto-population query that produced this actual",
    )

    # Relationships
    kpi: Mapped["SDBIPKpi"] = relationship(
        "SDBIPKpi",
        back_populates="actuals",
        foreign_keys=[kpi_id],
    )
    corrected_actual: Mapped["SDBIPActual | None"] = relationship(
        "SDBIPActual",
        foreign_keys=[corrects_actual_id],
        remote_side="SDBIPActual.id",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<SDBIPActual kpi={self.kpi_id} {self.quarter}/{self.financial_year} "
            f"actual={self.actual_value} [{self.traffic_light_status}] "
            f"validated={self.is_validated}>"
        )
