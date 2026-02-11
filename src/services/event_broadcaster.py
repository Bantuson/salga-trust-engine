"""PostgreSQL pg_notify event broadcaster for Supabase Realtime integration.

Broadcasts ticket events (status changes, new assignments, SLA breaches)
via PostgreSQL NOTIFY mechanism. Supabase Realtime automatically forwards
pg_notify events to connected WebSocket clients.

Each municipality has its own channel: "ticket_updates:{municipality_id}".

Note: Database triggers automatically broadcast INSERT/UPDATE events.
This service provides programmatic publish for events not triggered by DB changes
(e.g., manual SLA breach notifications, assignment changes).
"""
import json
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db

logger = logging.getLogger(__name__)


class EventBroadcaster:
    """PostgreSQL pg_notify broadcaster for Supabase Realtime."""

    def __init__(self):
        """Initialize broadcaster (no persistent connections needed)."""
        pass

    async def publish(self, municipality_id: str, event: dict) -> None:
        """Publish event to municipality's channel via pg_notify.

        Args:
            municipality_id: Target municipality UUID string
            event: Event dict with 'type', 'data', optional 'ward_id'
                type: "ticket_updated", "ticket_created", "sla_breach", "assignment_changed"
                data: Event payload (ticket_id, status, category, etc.)
                ward_id: Ward identifier for WARD_COUNCILLOR filtering

        Note:
            Supabase Realtime automatically picks up pg_notify and broadcasts to
            WebSocket subscribers on channel "ticket_updates:{municipality_id}".
        """
        channel = f"ticket_updates:{municipality_id}"
        payload = json.dumps(event)

        # Use database connection to send pg_notify
        async for db in get_db():
            try:
                await db.execute(
                    text("SELECT pg_notify(:channel, :payload)"),
                    {"channel": channel, "payload": payload}
                )
                await db.commit()
                logger.debug(f"Published {event.get('type')} to {channel} via pg_notify")
            except Exception as e:
                logger.error(f"Failed to publish event to {channel}: {e}")
                await db.rollback()
            finally:
                break  # Only use first db session from generator

    async def close(self):
        """Close connections (no-op for pg_notify implementation).

        Database connections are managed by SQLAlchemy pool, not by this service.
        """
        pass
