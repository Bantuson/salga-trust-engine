"""Ticket creation tool for MunicipalIntakeCrew.

Allows the municipal intake agent to create a service ticket in the database
after collecting all required information from the citizen.

Architecture: Phase 10.3 rebuild — copied from agents_old/tools/ticket_tool.py
and adapted to use the BaseTool pattern consistent with auth_tool.py.

Security:
- Uses Supabase admin client (PostgREST) for insertion — same pattern as auth_tool.py.
- _create_ticket_impl() is separated from the @BaseTool wrapper for testability.
- Returns dict with 'error' key on failure (never raises — LLM agent consumes the error).

# SEC-05: GBV tickets routed via GBVCrew, NOT this tool. Municipal ticket categories
# are explicitly validated against non-GBV categories.
"""
import logging
import secrets
from datetime import date
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from src.models.ticket import TicketCategory, TicketSeverity, TicketStatus

logger = logging.getLogger(__name__)

# USE_POSTGIS guard — PostGIS not available in SQLite unit test environments
try:
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    USE_POSTGIS = True
except ImportError:
    USE_POSTGIS = False


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

    Uses Supabase PostgREST API (via admin client) for persistence.
    Same connection pattern as auth_tool.py — no direct PostgreSQL connection needed.

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
        Dictionary with ticket ID, tracking number, and status on success.
        Dictionary with 'error' key on failure (never raises).
    """
    logger.info(
        "create_municipal_ticket called: category=%s, tenant_id=%s, severity=%s",
        category, tenant_id, severity
    )

    # Validate category
    category_lower = category.lower()
    valid_categories = [c.value for c in TicketCategory]
    if category_lower not in valid_categories:
        return {
            "error": (
                f"Invalid category '{category}'. "
                f"Must be one of: {', '.join(valid_categories)}"
            )
        }

    # Validate severity
    severity_lower = severity.lower()
    valid_severities = [s.value for s in TicketSeverity]
    if severity_lower not in valid_severities:
        return {
            "error": (
                f"Invalid severity '{severity}'. "
                f"Must be one of: {', '.join(valid_severities)}"
            )
        }

    # Generate tracking number: TKT-YYYYMMDD-XXXXXX
    date_part = date.today().strftime("%Y%m%d")
    random_part = secrets.token_hex(3).upper()  # 3 bytes = 6 hex chars
    tracking_number = f"TKT-{date_part}-{random_part}"

    # Build row for insertion
    is_sensitive = category_lower == "gbv"
    row: dict[str, Any] = {
        "tracking_number": tracking_number,
        "category": category_lower,
        "description": description,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "language": language,
        "severity": severity_lower,
        "status": TicketStatus.OPEN.value,
        "is_sensitive": is_sensitive,
        "created_by": user_id,
        "updated_by": user_id,
    }

    if address:
        row["address"] = address

    # PostGIS location via from_shape(Point(lng, lat), srid=4326)
    # Longitude first per WGS84/GeoJSON convention (Phase 08 locked decision)
    if USE_POSTGIS and latitude is not None and longitude is not None:
        try:
            geom = from_shape(Point(longitude, latitude), srid=4326)
            row["location"] = str(geom)
        except Exception as e:
            logger.warning("PostGIS location encoding failed: %s", str(e))
            # Non-fatal: ticket created without location

    try:
        from src.core.supabase import get_supabase_admin

        client = get_supabase_admin()
        if client is None:
            return {
                "error": (
                    "Supabase admin client not configured. "
                    "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
                )
            }

        result = client.table("tickets").insert(row).execute()

        if result.data and len(result.data) > 0:
            ticket = result.data[0]
            logger.info(
                "create_municipal_ticket SUCCESS: %s",
                ticket.get("tracking_number")
            )
            return {
                "id": ticket.get("id"),
                "tracking_number": ticket.get("tracking_number"),
                "status": ticket.get("status"),
                "category": ticket.get("category"),
                "severity": ticket.get("severity"),
            }

        return {
            "error": "Insert returned no data. Check RLS policies on tickets table."
        }

    except Exception as e:
        logger.error("create_municipal_ticket FAILED: %s", str(e), exc_info=True)
        return {"error": f"Failed to create ticket: {str(e)}"}


class CreateTicketInput(BaseModel):
    """Input schema for create_municipal_ticket."""
    category: str = Field(
        ...,
        description="Ticket category (water/roads/electricity/waste/sanitation/other)",
    )
    description: str = Field(
        ...,
        description="Detailed description of the issue (min 20 characters)",
    )
    user_id: str = Field(..., description="UUID of the reporting user")
    tenant_id: str = Field(..., description="UUID of the municipality tenant")
    language: str = Field(..., description="Language code (en/zu/af)")
    severity: str = Field(
        "medium",
        description="Issue severity (low/medium/high/critical)",
    )
    latitude: float | None = Field(None, description="Optional GPS latitude coordinate")
    longitude: float | None = Field(None, description="Optional GPS longitude coordinate")
    address: str | None = Field(None, description="Optional human-readable address")


class CreateMunicipalTicketTool(BaseTool):
    name: str = "create_municipal_ticket"
    description: str = (
        "Create a municipal service ticket in the database after collecting "
        "all required information from the citizen (category, description, location)."
    )
    args_schema: Type[BaseModel] = CreateTicketInput

    def _run(
        self,
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
        return _create_ticket_impl(
            category, description, user_id, tenant_id, language,
            severity, latitude, longitude, address,
        )


create_municipal_ticket = CreateMunicipalTicketTool()
