"""IDP (Integrated Development Plan) ORM models.

IDP cycles form the top of the "golden thread" hierarchy:
    IDPCycle -> IDPGoal -> IDPObjective -> (future) SDBIPKpi

All models inherit TenantAwareModel for automatic RLS, audit trail,
and multi-tenant isolation.

State machine:  draft -> approved -> under_review -> approved (cycle)
"""
from enum import StrEnum
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from statemachine import State, StateMachine
from statemachine.exceptions import TransitionNotAllowed  # noqa: F401 (re-exported for callers)

from src.models.base import TenantAwareModel


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class IDPStatus(StrEnum):
    """Lifecycle states for an IDP cycle."""

    DRAFT = "draft"
    APPROVED = "approved"
    UNDER_REVIEW = "under_review"


class NationalKPA(StrEnum):
    """National Key Performance Areas defined by SALGA / COGTA.

    All IDP strategic goals must be aligned to one of these five KPAs.
    """

    BASIC_SERVICE_DELIVERY = "basic_service_delivery"
    LOCAL_ECONOMIC_DEVELOPMENT = "local_economic_development"
    MUNICIPAL_FINANCIAL_VIABILITY = "municipal_financial_viability"
    GOOD_GOVERNANCE = "good_governance"
    MUNICIPAL_TRANSFORMATION = "municipal_transformation"


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------

class IDPWorkflow(StateMachine):
    """Approval workflow for IDP cycles.

    Allowed transitions:
    - submit:       draft       -> approved
    - open_review:  approved    -> under_review
    - re_approve:   under_review -> approved

    Usage with model binding (python-statemachine 3.x)::

        machine = IDPWorkflow(model=cycle, state_field="status",
                              start_value=cycle.status)
        machine.send(event)   # modifies cycle.status in place
        # Catch TransitionNotAllowed for invalid transitions -> HTTP 409
    """

    draft = State(initial=True, value="draft")
    approved = State(value="approved")
    under_review = State(value="under_review")

    submit = draft.to(approved)
    open_review = approved.to(under_review)
    re_approve = under_review.to(approved)


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------

class IDPCycle(TenantAwareModel):
    """A 5-year Integrated Development Plan cycle for a municipality.

    Each municipality typically has one active IDP cycle at a time.
    Uniqueness is enforced per (title, tenant_id) so the same name cannot
    be reused within a municipality.
    """

    __tablename__ = "idp_cycles"
    __table_args__ = (
        UniqueConstraint("title", "tenant_id", name="uq_idp_cycle_title_tenant"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    vision: Mapped[str | None] = mapped_column(Text, nullable=True)
    mission: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)
    end_year: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=IDPStatus.DRAFT,
        server_default="draft",
    )

    # Relationships
    goals: Mapped[list["IDPGoal"]] = relationship(
        "IDPGoal",
        back_populates="cycle",
        cascade="all, delete-orphan",
        order_by="IDPGoal.display_order",
    )
    versions: Mapped[list["IDPVersion"]] = relationship(
        "IDPVersion",
        back_populates="cycle",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<IDPCycle {self.title} ({self.start_year}-{self.end_year}) [{self.status}]>"


class IDPGoal(TenantAwareModel):
    """A strategic goal within an IDP cycle, aligned to a National KPA."""

    __tablename__ = "idp_goals"

    cycle_id: Mapped[UUID] = mapped_column(
        ForeignKey("idp_cycles.id"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    national_kpa: Mapped[str] = mapped_column(String(50), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    cycle: Mapped["IDPCycle"] = relationship("IDPCycle", back_populates="goals")
    objectives: Mapped[list["IDPObjective"]] = relationship(
        "IDPObjective",
        back_populates="goal",
        cascade="all, delete-orphan",
        order_by="IDPObjective.display_order",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<IDPGoal {self.title} [{self.national_kpa}]>"


class IDPObjective(TenantAwareModel):
    """A specific objective under an IDP strategic goal.

    Objectives serve as the anchor points for SDBIP KPIs (linked in Wave 3+).
    """

    __tablename__ = "idp_objectives"

    goal_id: Mapped[UUID] = mapped_column(
        ForeignKey("idp_goals.id"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    goal: Mapped["IDPGoal"] = relationship("IDPGoal", back_populates="objectives")
    # TODO: populated after 28-04 — SDBIP KPI FK not yet created
    sdbip_kpis: Mapped[list["SDBIPKpi"]] = relationship(  # type: ignore[name-defined]
        "SDBIPKpi",
        back_populates="idp_objective",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<IDPObjective {self.title}>"


class IDPVersion(TenantAwareModel):
    """An annual review version within an IDP cycle.

    Tracks year-by-year iterations of the same IDP cycle.
    Version numbers 1-5 within a cycle, enforced by UniqueConstraint.
    """

    __tablename__ = "idp_versions"
    __table_args__ = (
        UniqueConstraint("cycle_id", "version_number", name="uq_idp_version_cycle"),
    )

    cycle_id: Mapped[UUID] = mapped_column(
        ForeignKey("idp_cycles.id"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g., "2025/26"
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    cycle: Mapped["IDPCycle"] = relationship("IDPCycle", back_populates="versions")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<IDPVersion {self.financial_year} v{self.version_number}>"
