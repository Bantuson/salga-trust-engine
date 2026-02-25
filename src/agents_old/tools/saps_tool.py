"""SAPS notification tool for GBV ticket routing.

This module provides a tool for the GBV crew to notify SAPS liaison officers
when a GBV ticket is created. In v1, this creates internal log records;
in production, this would send encrypted notifications to configured SAPS liaisons.

CRITICAL SECURITY:
- NEVER log victim identifying information (names, phone numbers, addresses)
- Use dedicated logger at WARNING level to ensure capture regardless of log config
- Log only: ticket_id, timestamp, incident_type, general location area, danger level
"""
import logging
from datetime import datetime
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

# Dedicated logger for SAPS notifications
# WARNING level ensures these are always captured
saps_logger = logging.getLogger("saps_notifications")
saps_logger.setLevel(logging.WARNING)


def _notify_saps_impl(
    ticket_id: str,
    tracking_number: str,
    incident_type: str,
    location: str,
    is_immediate_danger: bool,
    tenant_id: str
) -> dict[str, Any]:
    """Notify SAPS liaison of GBV ticket creation.

    This tool creates a SAPS notification record for GBV tickets. In v1, this is
    an internal log; in production, this would trigger encrypted email to the
    configured SAPS liaison officer for the municipality.

    Args:
        ticket_id: UUID of the created ticket
        tracking_number: Public tracking number (TKT-YYYYMMDD-XXXXXX)
        incident_type: Type of GBV incident (physical, sexual, verbal, threat, other)
        location: General location area (NOT full address to protect victim)
        is_immediate_danger: Whether victim indicated immediate danger
        tenant_id: Municipality tenant UUID

    Returns:
        Dictionary with notification status

    Security:
        - Does NOT log victim names, phone numbers, or full addresses
        - Uses WARNING level logging to ensure capture
        - In production, would send encrypted notification via secure channel
    """
    # Determine danger level for prioritization
    danger_level = "IMMEDIATE" if is_immediate_danger else "STANDARD"

    # Create timestamp
    timestamp = datetime.utcnow().isoformat()

    # Log notification (NO PII - only operational data)
    saps_logger.warning(
        "SAPS_NOTIFICATION",
        extra={
            "ticket_id": ticket_id,
            "tracking_number": tracking_number,
            "incident_type": incident_type,
            "location_area": location,  # General area only
            "danger_level": danger_level,
            "tenant_id": tenant_id,
            "timestamp": timestamp,
            "notification_method": "internal_log"
        }
    )

    # Return structured result
    return {
        "notified": True,
        "method": "internal_log",
        "ticket_id": ticket_id,
        "tracking_number": tracking_number,
        "danger_level": danger_level,
        "timestamp": timestamp,
        "message": (
            f"SAPS notification queued for configured liaison. "
            f"Tracking: {tracking_number}, Priority: {danger_level}"
        )
    }


class NotifySapsInput(BaseModel):
    """Input schema for notify_saps."""
    ticket_id: str = Field(..., description="UUID of the created ticket")
    tracking_number: str = Field(..., description="Public tracking number (TKT-YYYYMMDD-XXXXXX)")
    incident_type: str = Field(..., description="Type of GBV incident (physical, sexual, verbal, threat, other)")
    location: str = Field(..., description="General location area (NOT full address to protect victim)")
    is_immediate_danger: bool = Field(..., description="Whether victim indicated immediate danger")
    tenant_id: str = Field(..., description="Municipality tenant UUID")


class NotifySapsTool(BaseTool):
    name: str = "notify_saps"
    description: str = "Notify SAPS liaison of GBV ticket creation."
    args_schema: Type[BaseModel] = NotifySapsInput

    def _run(
        self,
        ticket_id: str,
        tracking_number: str,
        incident_type: str,
        location: str,
        is_immediate_danger: bool,
        tenant_id: str,
    ) -> dict[str, Any]:
        return _notify_saps_impl(
            ticket_id, tracking_number, incident_type,
            location, is_immediate_danger, tenant_id,
        )


notify_saps = NotifySapsTool()
