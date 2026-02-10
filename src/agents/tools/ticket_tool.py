"""Ticket creation tool for CrewAI agents.

This module provides a tool for agents to create tickets in the database
after completing structured intake. Uses synchronous database access as
required by CrewAI tools.
"""
import secrets
from datetime import date
from typing import Any

from crewai.tools import tool
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.core.config import settings
from src.models.ticket import Ticket, TicketCategory, TicketSeverity, TicketStatus

# Module-level sync engine cache (for tests, this will be mocked)
_sync_engine = None


def _get_sync_engine():
    """Get or create synchronous database engine.

    Converts the async DATABASE_URL to sync format by replacing
    postgresql+psycopg with postgresql+psycopg2.

    Returns:
        SQLAlchemy Engine for synchronous operations
    """
    global _sync_engine

    if _sync_engine is None:
        # Convert async URL to sync URL
        sync_url = settings.DATABASE_URL.replace(
            "postgresql+psycopg://",
            "postgresql+psycopg2://"
        ).replace(
            "postgresql+asyncpg://",
            "postgresql+psycopg2://"
        )

        _sync_engine = create_engine(sync_url, pool_pre_ping=True)

    return _sync_engine


def _create_ticket_impl(
    category: str,
    description: str,
    user_id: str,
    tenant_id: str,
    language: str,
    severity: str = "medium",
    latitude: float | None = None,
    longitude: float | None = None,
    address: str | None = None,
) -> dict[str, Any]:
    """Create a municipal service ticket in the database.

    Args:
        category: Ticket category (water/roads/electricity/waste/sanitation/other)
        description: Detailed description of the issue (min 20 characters)
        user_id: UUID of the reporting user
        tenant_id: UUID of the municipality tenant
        language: Language code (en/zu/af)
        severity: Issue severity (low/medium/high/critical), defaults to medium
        latitude: Optional GPS latitude coordinate
        longitude: Optional GPS longitude coordinate
        address: Optional human-readable address

    Returns:
        Dictionary with ticket ID, tracking number, and status

    Raises:
        ValueError: If category or severity is invalid
    """
    # Validate category
    category_lower = category.lower()
    valid_categories = [c.value for c in TicketCategory]
    if category_lower not in valid_categories:
        raise ValueError(
            f"Invalid category '{category}'. Must be one of: {', '.join(valid_categories)}"
        )

    # Validate severity
    severity_lower = severity.lower()
    valid_severities = [s.value for s in TicketSeverity]
    if severity_lower not in valid_severities:
        raise ValueError(
            f"Invalid severity '{severity}'. Must be one of: {', '.join(valid_severities)}"
        )

    # Generate tracking number: TKT-YYYYMMDD-XXXXXX
    date_part = date.today().strftime("%Y%m%d")
    random_part = secrets.token_hex(3).upper()  # 3 bytes = 6 hex chars
    tracking_number = f"TKT-{date_part}-{random_part}"

    # Create PostGIS location from lat/lng if provided
    location = None
    if latitude is not None and longitude is not None:
        try:
            # Try to create PostGIS geometry (production)
            from geoalchemy2.shape import from_shape
            from shapely.geometry import Point
            point = Point(longitude, latitude)  # PostGIS uses (x, y) = (lng, lat)
            location = from_shape(point, srid=4326)
        except ImportError:
            # Graceful degradation for unit tests without geoalchemy2
            # Store as TEXT in SQLite tests
            location = f"POINT({longitude} {latitude})"

    # Create ticket
    engine = _get_sync_engine()
    session = Session(engine)

    try:
        # Set is_sensitive for GBV tickets
        is_sensitive = category_lower == "gbv"

        ticket = Ticket(
            tracking_number=tracking_number,
            category=category_lower,
            description=description,
            user_id=user_id,
            tenant_id=tenant_id,
            language=language,
            severity=severity_lower,
            status=TicketStatus.OPEN,
            location=location,
            address=address,
            is_sensitive=is_sensitive,
            created_by=user_id,
            updated_by=user_id
        )

        session.add(ticket)
        session.commit()
        session.refresh(ticket)

        return {
            "id": str(ticket.id),
            "tracking_number": ticket.tracking_number,
            "status": ticket.status,
            "category": ticket.category,
            "severity": ticket.severity
        }

    except Exception as e:
        session.rollback()
        raise RuntimeError(f"Failed to create ticket: {str(e)}")

    finally:
        session.close()


# Wrap the implementation as a CrewAI tool
create_municipal_ticket = tool("create_municipal_ticket")(_create_ticket_impl)
