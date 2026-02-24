"""Ticket lookup tool for TicketStatusCrew.

Allows citizens to check the status of their own reports. All queries are
scoped to the requesting user_id — cross-user lookups are explicitly blocked.

Security model:
- SECURITY BOUNDARY: user_id assertion prevents cross-user ticket access.
  Defense-in-depth: admin client bypasses RLS so we enforce scope in code.
- GBV tickets (is_sensitive=True) return minimal info only — SEC-05 compliant.
  Citizens get status + emergency numbers. No location, no description.
"""
import logging
from typing import Any, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


def _lookup_ticket_impl(user_id: str, tracking_number: str = "") -> dict[str, Any]:
    """Look up ticket status for a citizen, scoped strictly to their own tickets.

    Args:
        user_id: The authenticated user's UUID. MANDATORY. Never empty.
        tracking_number: Optional tracking number (e.g. TKT-20260218-A1B2C3).
                         If provided, filters to that specific ticket only.
                         If empty, returns up to 10 most recent tickets.

    Returns:
        Dict with keys: tickets (list), count (int), total (int).
        On error: dict with keys: error (str), tickets ([]), count (0).

    Security:
        - user_id MUST be truthy — raises AssertionError if empty/None.
        - All queries include .eq("user_id", user_id) — no cross-user access.
        - GBV tickets (is_sensitive=True) return minimal info only.
    """
    # SECURITY: Assert user_id is truthy. Admin client bypasses RLS;
    # this is our defense-in-depth against cross-user ticket access.
    assert user_id, "user_id is required for ticket lookup — cannot look up tickets without authenticated user"

    logger.info(
        "lookup_ticket called: user_id=%s, tracking_number=%s",
        user_id,
        tracking_number or "(all)",
    )

    try:
        from src.core.supabase import get_supabase_admin

        client = get_supabase_admin()
        if client is None:
            return {
                "error": "Supabase admin client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
                "tickets": [],
                "count": 0,
            }

        # Build user-scoped query — ALWAYS scoped to user_id
        query = (
            client.table("tickets")
            .select(
                "tracking_number, category, status, severity, address, "
                "created_at, updated_at, resolved_at, is_sensitive, "
                "first_responded_at, escalated_at"
            )
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(10)
        )

        # Optionally filter to a specific tracking number
        if tracking_number and tracking_number.strip():
            query = query.eq("tracking_number", tracking_number.strip().upper())

        result = query.execute()

        if not result.data:
            return {"tickets": [], "count": 0, "total": 0}

        formatted_list = []
        for t in result.data:
            if t.get("is_sensitive"):
                # SEC-05: GBV / sensitive tickets — minimal info only
                # Consistent with citizen portal GBV card pattern (Phase 06.2-08 decision)
                formatted_list.append({
                    "tracking_number": t["tracking_number"],
                    "category": "sensitive report",
                    "status": t["status"],
                    "note": (
                        "For support: SAPS 10111 | GBV Helpline 0800 150 150"
                    ),
                })
            else:
                # Standard municipal ticket — full status fields
                formatted_list.append({
                    "tracking_number": t["tracking_number"],
                    "category": t.get("category"),
                    "status": t.get("status"),
                    "severity": t.get("severity"),
                    "address": t.get("address"),
                    "created_at": t.get("created_at"),
                    "updated_at": t.get("updated_at"),
                    "resolved_at": t.get("resolved_at"),
                    "first_responded_at": t.get("first_responded_at"),
                    "escalated_at": t.get("escalated_at"),
                })

        total = len(result.data)
        count = len(formatted_list)

        logger.info("lookup_ticket SUCCESS: user_id=%s, count=%d", user_id, count)
        return {"tickets": formatted_list, "count": count, "total": total}

    except AssertionError:
        raise  # Let security assertions propagate
    except Exception as e:
        logger.error("lookup_ticket FAILED: %s", str(e), exc_info=True)
        return {"error": str(e), "tickets": [], "count": 0}


class LookupTicketInput(BaseModel):
    """Input schema for lookup_ticket."""
    user_id: str = Field(..., description="The authenticated user's UUID. MANDATORY. Never empty.")
    tracking_number: str = Field("", description="Optional tracking number (e.g. TKT-20260218-A1B2C3). If empty, returns up to 10 most recent tickets.")


class LookupTicketTool(BaseTool):
    name: str = "lookup_ticket"
    description: str = "Look up ticket status for a citizen, scoped strictly to their own tickets."
    args_schema: Type[BaseModel] = LookupTicketInput

    def _run(self, user_id: str, tracking_number: str = "") -> dict[str, Any]:
        return _lookup_ticket_impl(user_id, tracking_number)


lookup_ticket = LookupTicketTool()
