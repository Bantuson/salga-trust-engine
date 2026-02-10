"""Ticket model for citizen service requests and GBV reports.

Tickets represent citizen-reported issues: municipal services (water, roads, etc.)
and GBV incidents routed to SAPS. Uses tenant-aware base model for multi-municipality
isolation.

Key decisions:
- PostGIS GEOMETRY(Point, 4326) for location (migrated from lat/lng in Phase 4)
- Backward-compatible lat/lng properties for Phase 2-3 code
- Tracking number format: TKT-YYYYMMDD-{6_random_hex}
- is_sensitive flag for GBV tickets (triggers SAPS routing)
- severity defaults to MEDIUM if not specified by agent
"""
import secrets
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.encryption import EncryptedString
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
    encrypted_description: Mapped[str | None] = mapped_column(
        EncryptedString(5000),
        nullable=True
    )

    # Location field (PostGIS POINT geometry)
    location: Mapped[str | None] = mapped_column(
        Geometry("POINT", srid=4326),
        nullable=True
    )
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
    assigned_team_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("teams.id"),
        nullable=True
    )

    # Resolution tracking
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Escalation tracking
    escalated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    escalation_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # SLA tracking
    first_responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    sla_response_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    sla_resolution_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Security flag for GBV tickets
    is_sensitive: Mapped[bool] = mapped_column(nullable=False, default=False)

    # Media attachments (denormalized field, MediaAttachment is source of truth)
    media_urls: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def latitude(self) -> float | None:
        """Backward-compatible property to extract latitude from PostGIS location.

        Returns None if location is not set or geoalchemy2 is unavailable (unit tests).
        """
        if self.location is None:
            return None
        try:
            from geoalchemy2.shape import to_shape
            # Handle test scenarios where location might be a raw string
            if isinstance(self.location, str):
                return None
            point = to_shape(self.location)
            return point.y
        except (ImportError, Exception):
            return None

    @property
    def longitude(self) -> float | None:
        """Backward-compatible property to extract longitude from PostGIS location.

        Returns None if location is not set or geoalchemy2 is unavailable (unit tests).
        """
        if self.location is None:
            return None
        try:
            from geoalchemy2.shape import to_shape
            # Handle test scenarios where location might be a raw string
            if isinstance(self.location, str):
                return None
            point = to_shape(self.location)
            return point.x
        except (ImportError, Exception):
            return None

    def __repr__(self) -> str:
        return f"<Ticket {self.tracking_number} - {self.category} - {self.status}>"
