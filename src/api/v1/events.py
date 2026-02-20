"""DEPRECATED: SSE endpoint for real-time dashboard updates.

This endpoint is deprecated in favor of Supabase Realtime WebSocket subscriptions.

MIGRATION NOTICE:
- Old: Redis Pub/Sub -> Server-Sent Events (this endpoint)
- New: PostgreSQL pg_notify -> Supabase Realtime WebSocket

Frontend clients should migrate to Supabase Realtime:
```javascript
const channel = supabase
  .channel(`ticket_updates:${municipalityId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'tickets',
    filter: `tenant_id=eq.${municipalityId}`
  }, (payload) => {
    // Handle ticket update
  })
  .subscribe();
```

This SSE endpoint remains for backward compatibility but may be removed in future versions.
"""
import asyncio
import json
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sse_starlette.sse import EventSourceResponse
from starlette.requests import Request

from src.api.deps import get_current_user
from src.middleware.rate_limit import limiter
from src.models.user import User, UserRole
from src.services.event_broadcaster import EventBroadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard", tags=["dashboard-events"])


@router.get("/events", deprecated=True)
@limiter.limit("30/minute")
async def stream_dashboard_events(
    request: Request,
    current_user: User = Depends(get_current_user),
    ward_id: str | None = Query(None, description="Ward filter for WARD_COUNCILLOR"),
):
    """DEPRECATED: SSE endpoint for real-time dashboard event streaming.

    This endpoint is deprecated. Please migrate to Supabase Realtime WebSocket:
    - Direct database change streaming via postgres_changes
    - Better scalability and lower server load
    - Native WebSocket reconnection handling

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

    async def event_generator():
        """
        DEPRECATED: This SSE implementation is kept for backward compatibility.

        New implementations should use Supabase Realtime WebSocket directly.
        This endpoint now only sends a deprecation notice and heartbeat.
        """
        try:
            # Send deprecation notice
            yield {
                "event": "connected",
                "data": json.dumps({
                    "status": "deprecated",
                    "message": "This SSE endpoint is deprecated. Please migrate to Supabase Realtime WebSocket.",
                    "municipality_id": municipality_id,
                    "migration_guide": "Use supabase.channel('ticket_updates:{municipality_id}').on('postgres_changes', {...})"
                }),
                "id": str(uuid4()),
            }

            # Keep connection alive with periodic heartbeats
            # Real events are now delivered via Supabase Realtime WebSocket
            while True:
                await asyncio.sleep(30)
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"timestamp": asyncio.get_event_loop().time()}),
                    "id": str(uuid4()),
                }
        except asyncio.CancelledError:
            logger.info(f"SSE client disconnected: {municipality_id}")

    return EventSourceResponse(event_generator())
