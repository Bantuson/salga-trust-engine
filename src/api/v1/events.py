"""SSE (Server-Sent Events) endpoint for real-time dashboard updates.

Streams ticket events to connected dashboard clients. Uses Redis Pub/Sub
to receive events published by other parts of the system (ticket updates,
SLA breaches, assignments). Filters events by user role:
- MANAGER/ADMIN: All events for their municipality
- WARD_COUNCILLOR: Only events matching their ward
"""
import asyncio
import json
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sse_starlette.sse import EventSourceResponse

from src.api.deps import get_current_user
from src.models.user import User, UserRole
from src.services.event_broadcaster import EventBroadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard-events"])


@router.get("/events")
async def stream_dashboard_events(
    current_user: User = Depends(get_current_user),
    ward_id: str | None = Query(None, description="Ward filter for WARD_COUNCILLOR"),
):
    """SSE endpoint for real-time dashboard event streaming.

    Streams events:
    - ticket_updated: Status or assignment changes
    - ticket_created: New ticket submitted
    - sla_breach: Ticket exceeded SLA deadline
    - assignment_changed: Ticket reassigned

    Auto-reconnects on disconnect (browser EventSource API).
    """
    # RBAC: Only dashboard users
    allowed_roles = [UserRole.MANAGER, UserRole.ADMIN, UserRole.WARD_COUNCILLOR]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dashboard access requires manager, admin, or ward councillor role"
        )

    municipality_id = str(current_user.tenant_id)
    broadcaster = EventBroadcaster()

    async def event_generator():
        try:
            # Send initial heartbeat
            yield {
                "event": "connected",
                "data": json.dumps({"status": "connected", "municipality_id": municipality_id}),
                "id": str(uuid4()),
            }

            async for event in broadcaster.subscribe(municipality_id):
                # RBAC: Ward councillor filtering
                if current_user.role == UserRole.WARD_COUNCILLOR:
                    event_ward = event.get("ward_id")
                    if ward_id and event_ward and event_ward != ward_id:
                        continue  # Skip events for other wards

                yield {
                    "event": event.get("type", "message"),
                    "data": json.dumps(event.get("data", {})),
                    "id": str(uuid4()),
                }
        except asyncio.CancelledError:
            logger.info(f"SSE client disconnected: {municipality_id}")
        finally:
            await broadcaster.close()

    return EventSourceResponse(event_generator())
