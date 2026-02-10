"""Team model for municipal service teams.

Teams represent municipal service delivery units that handle specific categories
of citizen reports (water, roads, electricity, etc.). Each team has a service area
(geographic coverage polygon) and is assigned to a single municipality.

Key decisions:
- service_area uses PostGIS POLYGON for geospatial routing in Phase 4
- is_saps flag identifies SAPS liaison teams (handle GBV reports only)
- category matches TicketCategory values for routing logic
"""
from uuid import UUID

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class Team(TenantAwareModel):
    """Municipal team model for service delivery.

    Inherits tenant_id, created_at, updated_at, created_by, updated_by from TenantAwareModel.
    """

    __tablename__ = "teams"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    service_area: Mapped[str | None] = mapped_column(
        Geometry("POLYGON", srid=4326),
        nullable=True
    )
    manager_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_saps: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<Team {self.name} - {self.category} - SAPS={self.is_saps}>"
