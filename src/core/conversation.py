"""Redis-backed conversation state management for multi-turn citizen intake.

This module manages conversation state across multiple turns for WhatsApp and web
reporting channels. Uses Redis for persistence with TTL expiry and separate
namespaces for municipal vs GBV tickets (critical for security and routing).

Key decisions:
- GBV conversations use separate Redis namespace for security
- Max 20 turns per conversation (safety limit)
- Default 1 hour TTL (configurable)
- State cleared after GBV ticket creation (data minimization)
"""
import time
from typing import Any

import redis.asyncio as redis
from pydantic import BaseModel


class ConversationState(BaseModel):
    """Conversation state for multi-turn intake session.

    Tracks user context, language, category, conversation history, and
    partially collected ticket data as the agent gathers information.

    Phase 6.9 additions (multi-agent manager routing):
    - pending_intent: stores classified intent before auth handoff
    - pre_auth_message: original citizen message that triggered auth
    - routing_phase: tracks which handler owns the session for short-circuit
    """

    user_id: str
    session_id: str
    tenant_id: str
    language: str = "en"
    category: str | None = None  # "municipal" or "gbv"
    turns: list[dict] = []  # {"role": "user"|"agent", "content": str, "timestamp": float}
    collected_data: dict[str, Any] = {}  # Partial ticket data as it's gathered
    created_at: float
    max_turns: int = 20  # Safety limit per research (prevent infinite loops)

    # --- Phase 6.9: Cross-turn routing state for manager architecture ---
    pending_intent: str | None = None
    """Classified intent before auth handoff: 'municipal_report' | 'gbv_report' | 'ticket_status'.
    Cleared after routing to specialist. Allows direct specialist routing after auth
    without citizen repeating their request."""

    pre_auth_message: str | None = None
    """The original citizen message that triggered the auth handoff.
    Restored after auth completes so the specialist receives the original context."""

    routing_phase: str = "manager"
    """Tracks which handler owns the session:
    'manager' | 'auth' | 'municipal' | 'gbv' | 'ticket_status'.
    Used by crew_server.py to short-circuit manager re-entry for active specialist sessions."""


class ConversationManager:
    """Redis-backed conversation state manager with GBV/municipal namespace separation.

    Manages conversation lifecycle: create, get, update, clear.
    Enforces max turns safety limit and TTL expiry.
    """

    # Namespace prefixes for Redis keys
    MUNICIPAL_PREFIX = "conv:municipal:"
    GBV_PREFIX = "conv:gbv:"

    def __init__(self, redis_url: str, default_ttl: int = 3600):
        """Initialize conversation manager.

        Args:
            redis_url: Redis connection URL
            default_ttl: Default TTL in seconds (default: 1 hour)
        """
        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._default_ttl = default_ttl

    def _get_key(self, user_id: str, session_id: str, is_gbv: bool = False) -> str:
        """Generate Redis key with appropriate namespace.

        Args:
            user_id: User identifier
            session_id: Session identifier
            is_gbv: True for GBV conversations, False for municipal

        Returns:
            Redis key with namespace prefix
        """
        prefix = self.GBV_PREFIX if is_gbv else self.MUNICIPAL_PREFIX
        return f"{prefix}{user_id}:{session_id}"

    async def get_state(
        self,
        user_id: str,
        session_id: str,
        is_gbv: bool = False
    ) -> ConversationState | None:
        """Get conversation state from Redis.

        Args:
            user_id: User identifier
            session_id: Session identifier
            is_gbv: True for GBV conversations

        Returns:
            ConversationState if exists, None otherwise
        """
        key = self._get_key(user_id, session_id, is_gbv)
        data = await self._redis.get(key)

        if data is None:
            return None

        return ConversationState.model_validate_json(data)

    async def save_state(
        self,
        state: ConversationState,
        is_gbv: bool = False
    ) -> None:
        """Save conversation state to Redis with TTL.

        Args:
            state: Conversation state to save
            is_gbv: True for GBV conversations
        """
        key = self._get_key(state.user_id, state.session_id, is_gbv)
        data = state.model_dump_json()
        await self._redis.setex(key, self._default_ttl, data)

    async def append_turn(
        self,
        user_id: str,
        session_id: str,
        role: str,
        content: str,
        is_gbv: bool = False
    ) -> ConversationState:
        """Append a turn to conversation and return updated state.

        Args:
            user_id: User identifier
            session_id: Session identifier
            role: "user" or "agent"
            content: Message content
            is_gbv: True for GBV conversations

        Returns:
            Updated ConversationState

        Raises:
            ValueError: If max_turns exceeded
            ValueError: If conversation state not found
        """
        state = await self.get_state(user_id, session_id, is_gbv)

        if state is None:
            raise ValueError(f"Conversation state not found for user {user_id}, session {session_id}")

        # Check max turns safety limit
        if len(state.turns) >= state.max_turns:
            raise ValueError(
                f"Max turns ({state.max_turns}) exceeded for conversation {session_id}. "
                "This may indicate an infinite loop or stuck conversation."
            )

        # Append turn with timestamp
        turn = {
            "role": role,
            "content": content,
            "timestamp": time.time()
        }
        state.turns.append(turn)

        # Save updated state
        await self.save_state(state, is_gbv)

        return state

    async def clear_session(
        self,
        user_id: str,
        session_id: str,
        is_gbv: bool = False
    ) -> None:
        """Delete conversation state from Redis.

        Used after GBV ticket creation for data minimization (research Pitfall 3).

        Args:
            user_id: User identifier
            session_id: Session identifier
            is_gbv: True for GBV conversations
        """
        key = self._get_key(user_id, session_id, is_gbv)
        await self._redis.delete(key)

    async def create_session(
        self,
        user_id: str,
        session_id: str,
        tenant_id: str,
        language: str,
        is_gbv: bool = False
    ) -> ConversationState:
        """Create new conversation session.

        Args:
            user_id: User identifier
            session_id: Session identifier
            tenant_id: Municipality tenant identifier
            language: User's language (en/zu/af)
            is_gbv: True for GBV conversations

        Returns:
            New ConversationState
        """
        state = ConversationState(
            user_id=user_id,
            session_id=session_id,
            tenant_id=tenant_id,
            language=language,
            created_at=time.time()
        )

        await self.save_state(state, is_gbv)

        return state

    async def close(self) -> None:
        """Close Redis connection."""
        await self._redis.aclose()
