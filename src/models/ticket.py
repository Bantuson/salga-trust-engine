"""Ticket model for citizen service requests and GBV reports.

Tickets represent citizen-reported issues: municipal services (water, roads, etc.)
and GBV incidents routed to SAPS. Uses tenant-aware base model for multi-municipality
isolation.

Key decisions:
- Separate lat/lng columns (PostGIS geospatial queries deferred to Phase 4)
- Tracking number format: TKT-YYYYMMDD-{6_random_hex}
- is_sensitive flag for GBV tickets (triggers SAPS routing)
- severity defaults to MEDIUM if not specified by agent
"""
import secrets
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.models.base import TenantAwareModel


class TicketCategory(StrEnum):
    """Ticket category for routing to appropriate municipal department or SAPS."""
    WATER = "water"
    ROADS = "roads"
    ELECTRICITY = "electricity"
    WASTE = "waste"
    SANITATION = "sanitation"
    GBV = "gbv"
    OTHER = "other"


class TicketStatus(StrEnum):
    """Ticket lifecycle status."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketSeverity(StrEnum):
    """Ticket severity for prioritization."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


def generate_tracking_number() -> str:
    """Generate unique tracking number: TKT-YYYYMMDD-{6_random_hex}."""
    date_part = datetime.now().strftime("%Y%m%d")
    random_part = secrets.token_hex(3)  # 3 bytes = 6 hex chars
    return f"TKT-{date_part}-{random_part.upper()}"


class Ticket(TenantAwareModel):
    """Ticket model for citizen service requests and GBV reports.

    Inherits tenant_id, created_at, updated_at, created_by, updated_by from TenantAwareModel.
    """

    __tablename__ = "tickets"

    tracking_number: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        default=generate_tracking_number
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # Location fields (PostGIS deferred to Phase 4)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Metadata
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=TicketSeverity.MEDIUM
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=TicketStatus.OPEN
    )
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="en")

    # Relationships
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    # Resolution tracking
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Security flag for GBV tickets
    is_sensitive: Mapped[bool] = mapped_column(nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<Ticket {self.tracking_number} - {self.category} - {self.status}>"
