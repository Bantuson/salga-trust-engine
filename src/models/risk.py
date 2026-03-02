"""Risk Register ORM models.

Risk items link to SDBIP KPIs and track likelihood/impact/rating using the
ISO 31000 5x5 risk matrix. Each risk item can have multiple mitigation strategies.

Auto-flagging: when a KPI's quarterly actual turns red (traffic_light_status="red"),
the Celery task `flag_risk_items_for_kpi` auto-flags all linked non-critical risk items
to "high" priority.

Governance chain:
    SDBIPKpi -> RiskItem -> RiskMitigation
"""
from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models.base import TenantAwareModel


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class RiskRating(StrEnum):
    """ISO 31000 risk rating levels based on likelihood x impact score.

    Thresholds:
    - CRITICAL: score >= 15 (e.g., 3x5, 5x3, 5x5)
    - HIGH:     score >= 8  (e.g., 3x3=9, 2x4=8)
    - MEDIUM:   score >= 4  (e.g., 2x2=4)
    - LOW:      score < 4   (e.g., 1x1=1, 1x2=2)
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------------------------------------------------------------------------
# Rating computation helper
# ---------------------------------------------------------------------------


def compute_risk_rating(likelihood: int, impact: int) -> str:
    """Compute risk rating from likelihood (1-5) and impact (1-5) using ISO 31000 5x5 matrix.

    Args:
        likelihood: Integer 1-5 (1=rare, 5=almost certain)
        impact:     Integer 1-5 (1=negligible, 5=catastrophic)

    Returns:
        RiskRating string value: "low", "medium", "high", or "critical"

    Examples:
        compute_risk_rating(1, 1) -> "low"      (score=1)
        compute_risk_rating(2, 2) -> "medium"   (score=4)
        compute_risk_rating(3, 3) -> "high"     (score=9)
        compute_risk_rating(3, 5) -> "critical" (score=15)
        compute_risk_rating(5, 5) -> "critical" (score=25)
    """
    score = likelihood * impact
    if score >= 15:
        return RiskRating.CRITICAL
    elif score >= 8:
        return RiskRating.HIGH
    elif score >= 4:
        return RiskRating.MEDIUM
    else:
        return RiskRating.LOW


# ---------------------------------------------------------------------------
# ORM models
# ---------------------------------------------------------------------------


class RiskItem(TenantAwareModel):
    """A risk item linked to an SDBIP KPI.

    Risk items represent identified risks to KPI achievement. Each item has:
    - A likelihood (1-5) and impact (1-5) score from which risk_rating is computed
    - Optional department scope for filtering in CFO/MM views
    - Auto-flagging state when the linked KPI turns red

    Governance:
        CFO and Municipal Manager can view all risk items, filtered by department.
        Section 56 Directors and above can create/update risk items (Tier 2+).
        Auto-flagging fires automatically when a KPI's actual submission is RED.
    """

    __tablename__ = "risk_items"

    kpi_id: Mapped[UUID] = mapped_column(
        ForeignKey("sdbip_kpis.id"),
        nullable=False,
        index=True,
        comment="FK to the SDBIP KPI this risk is associated with",
    )
    department_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("departments.id"),
        nullable=True,
        index=True,
        comment="Optional department scope for filtering in CFO/MM risk views",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        comment="Brief title for the risk item",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full description of the risk and its potential consequences",
    )
    likelihood: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Likelihood score 1-5 (1=rare, 5=almost certain)",
    )
    impact: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Impact score 1-5 (1=negligible, 5=catastrophic)",
    )
    risk_rating: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=RiskRating.MEDIUM,
        server_default="medium",
        comment="Computed ISO 31000 risk rating: low/medium/high/critical",
    )
    responsible_person_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        comment="User responsible for managing this risk",
    )
    is_auto_flagged: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="True when auto-flagged by red KPI actual submission",
    )
    auto_flagged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when auto-flagging occurred",
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Soft delete flag",
    )

    # Relationships
    mitigations: Mapped[list["RiskMitigation"]] = relationship(
        "RiskMitigation",
        back_populates="risk_item",
        cascade="all, delete-orphan",
        order_by="RiskMitigation.created_at",
    )
    # String reference to SDBIPKpi to avoid circular import
    kpi: Mapped["SDBIPKpi"] = relationship(  # type: ignore[name-defined]
        "SDBIPKpi",
        foreign_keys=[kpi_id],
        lazy="select",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<RiskItem '{self.title}' rating={self.risk_rating} "
            f"auto_flagged={self.is_auto_flagged}>"
        )


class RiskMitigation(TenantAwareModel):
    """A mitigation strategy for a risk item.

    Each risk item can have multiple mitigation records tracking:
    - The strategy/action to be taken
    - Who is responsible
    - Target completion date
    - Current status (open, in_progress, completed)
    """

    __tablename__ = "risk_mitigations"

    risk_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("risk_items.id"),
        nullable=False,
        index=True,
        comment="FK to parent risk item",
    )
    strategy: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Description of the mitigation strategy or action",
    )
    responsible_person_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
        comment="User responsible for implementing this mitigation",
    )
    target_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        comment="Target completion date for this mitigation action",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        server_default="open",
        comment="Mitigation status: open, in_progress, completed",
    )

    # Relationship back to risk item
    risk_item: Mapped["RiskItem"] = relationship(
        "RiskItem",
        back_populates="mitigations",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<RiskMitigation risk_item={self.risk_item_id} status={self.status}>"
