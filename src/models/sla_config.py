"""SLA configuration model for municipality-level service level agreements.

Defines response and resolution time targets per municipality, with optional
category-specific overrides (e.g., water = 12h, roads = 48h).

Key decisions:
- Uses NonTenantModel (admins configure cross-tenant SLA policies)
- Null category = default SLA for municipality
- warning_threshold_pct triggers proactive notifications before full breach
- UniqueConstraint on (municipality_id, category) prevents duplicate configs
"""
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import NonTenantModel


class SLAConfig(NonTenantModel):
    """SLA configuration per municipality and category.

    Inherits id, created_at, updated_at from NonTenantModel (no tenant_id).
    """

    __tablename__ = "sla_configs"

    municipality_id: Mapped[UUID] = mapped_column(
        ForeignKey("municipalities.id"),
        nullable=False
    )
    category: Mapped[str | None] = mapped_column(String(20), nullable=True)
    response_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    resolution_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=168)
    warning_threshold_pct: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=80
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint(
            "municipality_id",
            "category",
            name="uq_sla_config_municipality_category"
        ),
    )

    def __repr__(self) -> str:
        cat = self.category or "default"
        return f"<SLAConfig {cat} - Response:{self.response_hours}h Resolution:{self.resolution_hours}h>"
