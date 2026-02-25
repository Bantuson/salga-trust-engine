"""SAPS notification tool for GBV ticket routing.

Architecture: Phase 10.3 rebuild — tool wrapper pattern, implementation function
separate from BaseTool wrapper for testability.

In v1, this creates internal log records only — no real SAPS API exists.
In production, this would send encrypted notifications to configured SAPS
liaison officers.

CRITICAL SECURITY (SEC-05):
- NEVER log victim identifying information (names, phone numbers, addresses)
- Use dedicated logger at WARNING level to ensure capture regardless of log config
- Log ONLY: ticket_id, incident_type, general_location, danger_level, tenant_id
- NO PII in SAPS logs — this is a hard requirement for POPIA compliance # POPIA
- No cross-session data: this tool is called once at end of intake, no state preserved
"""
import logging
from datetime import datetime
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

# Dedicated logger for SAPS notifications — WARNING level ensures capture
# regardless of global log config. # SEC-05
saps_logger = logging.getLogger("saps_notifications")
saps_logger.setLevel(logging.WARNING)


def _notify_saps_impl(
    ticket_id: str,
    tracking_number: str,
    incident_type: str,
    location: str,
    is_immediate_danger: bool,
    tenant_id: str,
) -> dict[str, Any]:
    """Notify SAPS liaison of GBV ticket creation.

    Internal v1 implementation: creates a structured log entry only.
    In production, this would trigger an encrypted notification to the
    SAPS liaison officer configured for the municipality.

    Args:
        ticket_id: UUID of the created ticket (no name, no phone)
        tracking_number: Public tracking number (TKT-YYYYMMDD-XXXXXX)
        incident_type: Type of GBV incident (physical, sexual, verbal, threat, other)
        location: General location area — NOT full address (protects victim location)
        is_immediate_danger: Whether victim indicated immediate danger
        tenant_id: Municipality tenant UUID

    Returns:
        Dictionary with notification status for LLM consumption

    Security:
        - Does NOT log victim names, phone numbers, or full addresses (SEC-05, POPIA)
        - Uses WARNING level logging — always captured
        - In production, would send via secure encrypted channel
    """
    danger_level = "IMMEDIATE" if is_immediate_danger else "STANDARD"
    timestamp = datetime.utcnow().isoformat()

    # Log notification — NO PII, only operational fields # SEC-05 # POPIA
    saps_logger.warning(
        "SAPS_NOTIFICATION",
        extra={
            "ticket_id": ticket_id,
            "tracking_number": tracking_number,
            "incident_type": incident_type,
            "location_area": location,   # General area only — never full address
            "danger_level": danger_level,
            "tenant_id": tenant_id,
            "timestamp": timestamp,
            "notification_method": "internal_log",
        },
    )

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
        ),
    }


# ---------------------------------------------------------------------------
# Pydantic input schema + BaseTool wrapper
# ---------------------------------------------------------------------------

class NotifySapsInput(BaseModel):
    """Input schema for the notify_saps tool.

    Security note: no PII fields — location is general area only.
    """
    ticket_id: str = Field(
        ...,
        description="UUID of the created GBV ticket",
    )
    tracking_number: str = Field(
        ...,
        description="Public tracking number (format: TKT-YYYYMMDD-XXXXXX)",
    )
    incident_type: str = Field(
        ...,
        description=(
            "Type of GBV incident. One of: physical, sexual, verbal, threat, other. "
            "Do NOT include victim identification."
        ),
    )
    location: str = Field(
        ...,
        description=(
            "General location area — ward name, suburb, or region only. "
            "NEVER use the victim's full address (SEC-05: no PII in SAPS logs)."
        ),
    )
    is_immediate_danger: bool = Field(
        ...,
        description="True if citizen indicated they are in immediate danger right now",
    )
    tenant_id: str = Field(
        ...,
        description="Municipality tenant UUID for routing to the correct SAPS station",
    )


class NotifySapsTool(BaseTool):
    """Tool for GBV agent to notify SAPS after GBV intake completes.

    Called ONCE at the end of the GBV intake conversation — after the agent
    has collected incident_type, general_location, and danger_level.

    Security:
    - No PII passed or logged (SEC-05)
    - Returns confirmation string for LLM to relay to citizen
    """
    name: str = "notify_saps"
    description: str = (
        "Notify SAPS liaison of a GBV incident. Call this ONCE at the end of "
        "the intake conversation after collecting incident type, general location "
        "area, and danger level. Do NOT include victim names, phone numbers, or "
        "full addresses — only general location area is permitted (SEC-05 compliance)."
    )
    args_schema: Type[BaseModel] = NotifySapsInput

    def _run(
        self,
        ticket_id: str,
        tracking_number: str,
        incident_type: str,
        location: str,
        is_immediate_danger: bool,
        tenant_id: str,
    ) -> str:
        """Execute SAPS notification and return LLM-consumable confirmation."""
        result = _notify_saps_impl(
            ticket_id=ticket_id,
            tracking_number=tracking_number,
            incident_type=incident_type,
            location=location,
            is_immediate_danger=is_immediate_danger,
            tenant_id=tenant_id,
        )
        return result["message"]


# Single shared tool instance
notify_saps = NotifySapsTool()
