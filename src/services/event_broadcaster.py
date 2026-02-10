"""Redis Pub/Sub event broadcaster for real-time dashboard updates.

Broadcasts ticket events (status changes, new assignments, SLA breaches)
to all connected SSE clients via Redis Pub/Sub channels.
Each municipality has its own channel: "dashboard:{municipality_id}".
"""
import json
import logging
from typing import AsyncGenerator

import redis.asyncio as redis

from src.core.config import settings

logger = logging.getLogger(__name__)


class EventBroadcaster:
    """Redis Pub/Sub broadcaster for dashboard events."""

    def __init__(self):
        self._redis_client = None
        self._pubsub = None

    async def _get_redis(self):
        if self._redis_client is None:
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True
            )
        return self._redis_client

    async def publish(self, municipality_id: str, event: dict) -> int:
        """Publish event to municipality's dashboard channel.

        Args:
            municipality_id: Target municipality UUID string
            event: Event dict with 'type', 'data', optional 'ward_id'
                type: "ticket_updated", "ticket_created", "sla_breach", "assignment_changed"
                data: Event payload (ticket_id, status, category, etc.)
                ward_id: Ward identifier for WARD_COUNCILLOR filtering

        Returns:
            Number of subscribers that received the message
        """
        r = await self._get_redis()
        channel = f"dashboard:{municipality_id}"
        payload = json.dumps(event)
        count = await r.publish(channel, payload)
        logger.debug(f"Published {event.get('type')} to {channel} ({count} subscribers)")
        return count

    async def subscribe(self, municipality_id: str) -> AsyncGenerator[dict, None]:
        """Subscribe to municipality's dashboard channel and yield events.

        Args:
            municipality_id: Municipality UUID string

        Yields:
            Event dicts as they arrive
        """
        r = await self._get_redis()
        pubsub = r.pubsub()
        channel = f"dashboard:{municipality_id}"

        await pubsub.subscribe(channel)
        logger.info(f"Subscribed to {channel}")

        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        yield json.loads(message["data"])
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON in {channel}: {message['data']}")
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            logger.info(f"Unsubscribed from {channel}")

    async def close(self):
        """Close Redis connection."""
        if self._redis_client:
            await self._redis_client.close()
            self._redis_client = None
