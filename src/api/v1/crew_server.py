"""Standalone FastAPI crew server for Streamlit dashboard integration.

API-first approach: All CrewAI features are accessible via documented REST
endpoints BEFORE Streamlit is built. This server runs as a separate process
from main.py, keeping the CrewAI lifecycle isolated from the production API.

Start with:
    uvicorn src.api.v1.crew_server:crew_app --port 8001
Or:
    python -m src.api.v1.crew_server

Endpoints:
    GET  /api/v1/health          — Server status check
    POST /api/v1/chat            — Main intake: phone detection + agent routing
    POST /api/v1/session/reset   — Clear conversation state for a phone number

Security:
    X-API-Key header validation (simple key check, not OAuth).
    If CREW_SERVER_API_KEY is empty, validation is skipped (dev mode).
    Server binds to localhost only (127.0.0.1) when started directly.

Phone routing:
    session_status == "active"  -> IntakeFlow (existing intake pipeline)
    session_status == "expired" -> AuthCrew (OTP re-authentication)
    session_status == "none"    -> AuthCrew (full registration)

GBV safety:
    Debug output for GBV scenarios NEVER includes conversation content.
    Only metadata: agent_name, turn_count, session_status (per Pitfall 6).

Multi-turn state:
    Full conversation history injected into each crew call as formatted string
    (per Pitfall 3 — state injection is the correct CrewAI multi-turn pattern).
"""
import asyncio
import os
import re

# CrewAI/LiteLLM requires OPENAI_API_KEY during import validation.
# Set a dummy value if not already configured. This MUST happen before
# any crewai imports occur (per research Pitfall 1).
os.environ.setdefault("OPENAI_API_KEY", "dummy-key-for-crewai-validation")

import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.core.config import settings
from src.core.conversation import ConversationManager, ConversationState
from src.core.language import language_detector


# ---------------------------------------------------------------------------
# In-memory conversation manager (fallback when Redis is unavailable)
# ---------------------------------------------------------------------------

class InMemoryConversationManager:
    """Drop-in replacement for ConversationManager that uses a dict.

    Used when Redis is not available (local dev/testing).
    Implements the same async interface as ConversationManager.
    """

    def __init__(self) -> None:
        self._store: dict[str, ConversationState] = {}

    def _key(self, user_id: str, session_id: str, is_gbv: bool = False) -> str:
        prefix = "gbv:" if is_gbv else "muni:"
        return f"{prefix}{user_id}:{session_id}"

    async def get_state(self, user_id: str, session_id: str, is_gbv: bool = False) -> ConversationState | None:
        return self._store.get(self._key(user_id, session_id, is_gbv))

    async def create_session(
        self, user_id: str, session_id: str, tenant_id: str, language: str, is_gbv: bool = False,
    ) -> ConversationState:
        import time
        state = ConversationState(
            user_id=user_id, session_id=session_id, tenant_id=tenant_id,
            language=language, turns=[], created_at=time.time(),
        )
        self._store[self._key(user_id, session_id, is_gbv)] = state
        return state

    async def append_turn(
        self, user_id: str, session_id: str, role: str, content: str, is_gbv: bool = False,
    ) -> ConversationState:
        import time
        key = self._key(user_id, session_id, is_gbv)
        state = self._store.get(key)
        if state is None:
            raise ValueError(f"No session for key {key}")
        if len(state.turns) >= state.max_turns:
            raise ValueError("Max turns exceeded")
        state.turns.append({"role": role, "content": content, "timestamp": time.time()})
        return state

    async def clear_session(self, user_id: str, session_id: str, is_gbv: bool = False) -> None:
        self._store.pop(self._key(user_id, session_id, is_gbv), None)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Request body for the /chat endpoint."""

    phone: str
    """Citizen phone number (raw or E.164 format — normalised internally)."""

    message: str
    """The citizen's message text."""

    language: str = "en"
    """Language hint from client (en / zu / af). Agent may override via detection."""

    municipality_id: str | None = None
    """Optional municipality UUID for multi-tenant routing."""

    session_override: str | None = None
    """Test-mode override: "expired" | "new" skips real DB detection."""


class ChatResponse(BaseModel):
    """Response body from the /chat endpoint."""

    reply: str
    """Agent's response text to send back to the citizen."""

    agent_name: str
    """Which agent handled this turn: "auth_agent" | "municipal_intake" | "gbv_intake"."""

    session_status: str
    """Session state at time of routing: "active" | "expired" | "none" | "created"."""

    debug: dict
    """Metadata for Streamlit dashboard. GBV conversations only include safe metadata."""


class SessionResetRequest(BaseModel):
    """Request body for the /session/reset endpoint."""

    phone: str
    """Phone number whose conversation state should be cleared."""


class HealthResponse(BaseModel):
    """Response body from the /health endpoint."""

    status: str
    """Server health status ("ok")."""

    deepseek_configured: bool
    """True if DEEPSEEK_API_KEY is non-empty (does NOT call the API)."""

    version: str
    """API version string."""


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

crew_app = FastAPI(
    title="SALGA Crew Server",
    description=(
        "Standalone FastAPI server exposing CrewAI intake agents as REST endpoints. "
        "Designed for Streamlit dashboard integration and local testing."
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# Conversation manager (Redis-backed, shared across requests)
# ---------------------------------------------------------------------------

_conversation_manager: ConversationManager | InMemoryConversationManager | None = None


def _get_conversation_manager() -> ConversationManager | InMemoryConversationManager:
    """Lazy-initialise the shared ConversationManager.

    Tries Redis first; falls back to in-memory dict if Redis is unavailable.
    In-memory mode is logged once and is suitable for local testing.

    Returns:
        ConversationManager (Redis) or InMemoryConversationManager (dict).
    """
    global _conversation_manager
    if _conversation_manager is None:
        try:
            import redis as sync_redis
            r = sync_redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
            r.ping()
            r.close()
            _conversation_manager = ConversationManager(settings.REDIS_URL)
        except Exception:
            import logging
            logging.getLogger(__name__).warning(
                "Redis unavailable — using in-memory conversation state (testing mode)"
            )
            _conversation_manager = InMemoryConversationManager()
    return _conversation_manager


# ---------------------------------------------------------------------------
# Sync database engine (for phone detection — separate process from main.py)
# ---------------------------------------------------------------------------

_sync_engine = None


def _get_sync_engine():
    """Get or create a synchronous SQLAlchemy engine for phone detection.

    Converts async DATABASE_URL (psycopg / asyncpg) to sync format (psycopg2).
    Mirrors the pattern from ticket_tool.py.

    Returns:
        SQLAlchemy Engine for synchronous queries.
    """
    global _sync_engine

    if _sync_engine is None:
        sync_url = (
            settings.DATABASE_URL
            .replace("postgresql+psycopg://", "postgresql+psycopg2://")
            .replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        )
        _sync_engine = create_engine(sync_url, pool_pre_ping=True)

    return _sync_engine


# ---------------------------------------------------------------------------
# Security helper
# ---------------------------------------------------------------------------

def _validate_api_key(x_api_key: str | None) -> None:
    """Validate X-API-Key header against configured key.

    If CREW_SERVER_API_KEY is empty, validation is skipped (dev mode).
    This allows easy local development without generating a key, while
    still enforcing auth when the key is configured.

    Args:
        x_api_key: Value from the X-API-Key request header.

    Raises:
        HTTPException 401: Key is required but missing or incorrect.
    """
    expected = settings.CREW_SERVER_API_KEY
    if not expected:
        # Dev mode — skip validation
        return

    if x_api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key header.",
        )


# ---------------------------------------------------------------------------
# Conversation history formatting
# ---------------------------------------------------------------------------

def _format_history(turns: list[dict]) -> str:
    """Format conversation turns as a human-readable string for crew injection.

    Each turn is displayed as "User: ..." or "Agent: ...".
    This string is injected into crew task descriptions for multi-turn
    state continuity (per research Pitfall 3).

    Args:
        turns: List of turn dicts with keys: role, content, timestamp.

    Returns:
        Formatted conversation history string, or "(none)" if empty.
    """
    if not turns:
        return "(none)"

    lines = []
    for turn in turns:
        role = turn.get("role", "user").capitalize()
        content = turn.get("content", "")
        lines.append(f"{role}: {content}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Response sanitization — hide LLM internals from citizens
# ---------------------------------------------------------------------------

# Patterns that indicate LLM reasoning artifacts (not citizen-facing text)
_LLM_ARTIFACT_PATTERNS = [
    r"^Thought:.*$",          # CrewAI verbose reasoning
    r"^Action:.*$",           # CrewAI tool call declarations
    r"^Action Input:.*$",     # CrewAI tool input
    r"^Observation:.*$",      # CrewAI tool output markers
    r"^I need to .*$",        # LLM self-talk
    r"^Let me .*$",           # LLM self-talk
    r"^I'll .*call.*$",       # LLM tool-calling narration
    r"^I should .*$",         # LLM planning
    r"^Now I .*$",            # LLM sequencing
    r"^Based on the (?:tool|function) (?:result|output).*$",  # Tool result narration
    r"^The (?:tool|function) returned.*$",
    r"^Final Answer:?\s*",    # CrewAI final answer marker (strip prefix, keep content after it)
]

# Warm fallbacks when sanitization leaves nothing usable
_FALLBACK_REPLIES = {
    "auth_agent": {
        "en": "I'm Gugu from SALGA Trust Engine. I'm having a moment \u2014 could you please repeat that?",
        "zu": "NginguGugu we-SALGA Trust Engine. Ngicela uphinde \u2014 angizwanga kahle.",
        "af": "Ek is Gugu van SALGA Trust Engine. Ek het 'n oomblik \u2014 kan jy asseblief herhaal?",
    },
    "municipal_intake": {
        "en": "I'm Gugu from SALGA Trust Engine. Sorry, I didn't quite catch that \u2014 could you describe your issue again?",
        "zu": "NginguGugu we-SALGA Trust Engine. Ngiyaxolisa, angizwanga kahle \u2014 ungachaza inkinga yakho futhi?",
        "af": "Ek is Gugu van SALGA Trust Engine. Jammer, ek het dit nie gevang nie \u2014 kan jy jou probleem weer beskryf?",
    },
    "gbv_intake": {
        "en": "I'm here to help you. If you are in immediate danger, please call 10111 or the GBV Command Centre at 0800 150 150. Can you tell me what happened?",
        "zu": "Ngilapha ukukusiza. Uma usengozini, shayela i-10111 noma i-GBV Command Centre ku-0800 150 150. Ungangitshela ukuthi kwenzekeni?",
        "af": "Ek is hier om jou te help. As jy in onmiddellike gevaar is, skakel 10111 of die GBV Command Centre by 0800 150 150. Kan jy my vertel wat gebeur het?",
    },
    "error": {
        "en": "I'm Gugu from SALGA Trust Engine. Something went wrong on my side \u2014 please try again in a moment.",
        "zu": "NginguGugu we-SALGA Trust Engine. Kunenkinga ngasohlangothini lwami \u2014 ngicela uzame futhi ngemva kwesikhashana.",
        "af": "Ek is Gugu van SALGA Trust Engine. Iets het verkeerd gegaan aan my kant \u2014 probeer asseblief weer oor 'n oomblik.",
    },
}


def sanitize_reply(
    raw: str,
    agent_name: str = "auth_agent",
    language: str = "en",
) -> str:
    """Strip LLM reasoning artifacts from agent output for citizen display.

    Removes CrewAI verbose markers (Thought/Action/Observation), LLM self-talk,
    embedded JSON blobs, and tool result narration. Returns only the clean,
    citizen-facing message text.

    If sanitization strips everything (empty result), returns a warm Gugu-voiced
    fallback appropriate to the agent type and language.

    Args:
        raw: Raw agent output string (may contain LLM artifacts).
        agent_name: Agent type for fallback selection ("auth_agent", "municipal_intake", "gbv_intake").
        language: Language code for fallback ("en", "zu", "af").

    Returns:
        Clean, citizen-facing reply text.
    """
    if not raw or not raw.strip():
        return _get_fallback(agent_name, language)

    text = raw.strip()

    # 1. If "Final Answer:" marker exists, take everything AFTER it
    final_match = re.search(r"Final Answer:?\s*(.+)", text, re.DOTALL | re.IGNORECASE)
    if final_match:
        text = final_match.group(1).strip()

    # 2. Remove JSON blobs (tool call results embedded in text)
    text = re.sub(r'\{[^{}]*"(?:tracking_number|error|id|status)"[^{}]*\}', '', text)

    # 3. Remove LLM artifact lines
    lines = text.split("\n")
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Skip lines matching artifact patterns
        skip = False
        for pattern in _LLM_ARTIFACT_PATTERNS:
            if re.match(pattern, stripped, re.IGNORECASE):
                # Special case: "Final Answer:" prefix — keep content after it
                if pattern == r"^Final Answer:?\s*":
                    stripped = re.sub(r"^Final Answer:?\s*", "", stripped, flags=re.IGNORECASE)
                    if stripped:
                        clean_lines.append(stripped)
                skip = True
                break
        if not skip:
            clean_lines.append(line)

    text = "\n".join(clean_lines).strip()

    # 4. Remove any remaining raw Python exception traces
    text = re.sub(r"Traceback \(most recent call last\):.*?(?=\n\n|\Z)", "", text, flags=re.DOTALL)
    text = re.sub(r"(?:Error|Exception):.*?(?=\n\n|\Z)", "", text, flags=re.DOTALL)

    # 5. If nothing useful remains, use warm fallback
    if not text or len(text) < 10:
        return _get_fallback(agent_name, language)

    return text.strip()


def _get_fallback(agent_name: str, language: str) -> str:
    """Get a warm Gugu-voiced fallback message for the given agent and language."""
    lang = language if language in ("en", "zu", "af") else "en"
    agent = agent_name if agent_name in _FALLBACK_REPLIES else "error"
    return _FALLBACK_REPLIES[agent][lang]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@crew_app.get("/api/v1/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Check crew server health and configuration.

    Does NOT call the DeepSeek API — only checks if the key is non-empty.

    Returns:
        HealthResponse with status, deepseek_configured, and version.
    """
    return HealthResponse(
        status="ok",
        deepseek_configured=bool(settings.DEEPSEEK_API_KEY),
        version="1.0.0",
    )


@crew_app.post("/api/v1/session/reset")
async def reset_session(
    request: SessionResetRequest,
    x_api_key: str | None = Header(default=None),
) -> dict:
    """Clear conversation state for a phone number.

    Removes the phone's conversation history from Redis. Both municipal and
    GBV namespaces are cleared. Used for testing and conversation restart.

    Args:
        request: SessionResetRequest with phone number.
        x_api_key: X-API-Key header for authentication.

    Returns:
        Dict with success/error status.
    """
    _validate_api_key(x_api_key)

    manager = _get_conversation_manager()

    # Use phone as both user_id and session_id for crew server simplicity
    phone = request.phone.strip()
    session_id = f"crew:{phone}"

    try:
        # Clear both namespaces (we may not know which was active)
        await manager.clear_session(user_id=phone, session_id=session_id, is_gbv=False)
        await manager.clear_session(user_id=phone, session_id=session_id, is_gbv=True)

        return {"success": True, "phone": phone, "message": "Conversation state cleared."}

    except Exception as e:
        return {"success": False, "phone": phone, "error": str(e)}


@crew_app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    x_api_key: str | None = Header(default=None),
) -> ChatResponse:
    """Main intake endpoint — phone detection, agent routing, and response.

    Flow:
    1. Validate X-API-Key (skip if CREW_SERVER_API_KEY is empty).
    2. Determine session status:
       a. If session_override is set ("expired" | "new"), use that directly.
       b. Otherwise call detect_phone_session() for real DB lookup.
    3. Load conversation history from Redis (or create new session).
    4. Route based on session_status:
       - "active"  -> IntakeFlow
       - "expired" -> AuthCrew (OTP re-auth)
       - "none"    -> AuthCrew (full registration)
    5. Save agent reply to conversation history.
    6. Return ChatResponse with reply, agent_name, session_status, debug.

    On any DeepSeek API failure: returns fail-fast error reply per locked
    decision (no retry, no fallback model).

    Args:
        request: ChatRequest with phone, message, language, municipality_id,
                 session_override.
        x_api_key: X-API-Key header.

    Returns:
        ChatResponse with reply, agent_name, session_status, debug.
    """
    _validate_api_key(x_api_key)

    phone = request.phone.strip()
    session_id = f"crew:{phone}"
    manager = _get_conversation_manager()

    # ------------------------------------------------------------------
    # Step 1: Determine session status
    # ------------------------------------------------------------------

    if request.session_override in ("expired", "new", "active"):
        # Test mode: use the provided override directly
        if request.session_override == "new":
            session_status = "none"
        elif request.session_override == "expired":
            session_status = "expired"
        else:
            session_status = "active"

        # For active/expired overrides, look up real user UUID by phone
        # (the ticket FK requires a UUID, not a phone string)
        # Uses Supabase PostgREST — same working connection as auth tools
        resolved_user_id: str | None = None
        resolved_municipality_id: str | None = None
        if request.session_override in ("active", "expired"):
            try:
                from src.core.supabase import get_supabase_admin
                sb = get_supabase_admin()
                if sb:
                    normalized = phone.lstrip("+")
                    result = sb.table("users").select("id, municipality_id").eq(
                        "phone", normalized
                    ).limit(1).execute()
                    if result.data and len(result.data) > 0:
                        resolved_user_id = result.data[0]["id"]
                        resolved_municipality_id = result.data[0]["municipality_id"]
            except Exception:
                pass  # Fall back to phone if lookup fails

        detection_result = {
            "user_exists": request.session_override != "new",
            "session_status": session_status,
            "user_id": resolved_user_id or phone,
            "municipality_id": resolved_municipality_id,
        }
    else:
        # Production mode: real database lookup
        try:
            loop = asyncio.get_event_loop()
            engine = _get_sync_engine()

            def _detect():
                from src.services.phone_detection import detect_phone_session
                with Session(engine) as db_session:
                    return detect_phone_session(phone, db_session)

            detection_result = await loop.run_in_executor(None, _detect)
            session_status = detection_result["session_status"]

        except Exception as e:
            # Database unavailable — treat as new user (fail open for dev)
            detection_result = {
                "user_exists": False,
                "session_status": "none",
                "user_id": None,
            }
            session_status = "none"

    # ------------------------------------------------------------------
    # Step 1.5: Auto-detect language from citizen's message
    # ------------------------------------------------------------------
    # Override the static dashboard language hint with detected language.
    # Falls back to request.language if text is too short (<20 chars)
    # or detection confidence is below threshold (0.7).
    detected_language = language_detector.detect(
        request.message,
        fallback=request.language,
    )

    # ------------------------------------------------------------------
    # Step 2: Load / create conversation history
    # ------------------------------------------------------------------

    is_gbv = False  # Determined after routing; default to False for history lookup
    conv_state = await manager.get_state(
        user_id=phone,
        session_id=session_id,
        is_gbv=False,
    )

    if conv_state is None:
        # Create new session — use phone as user_id, empty string for tenant_id
        tenant_id = request.municipality_id or ""
        conv_state = await manager.create_session(
            user_id=phone,
            session_id=session_id,
            tenant_id=tenant_id,
            language=detected_language,
            is_gbv=False,
        )

    # Include the CURRENT user message in history so the agent can see it.
    # (Turns are only persisted to the store in Step 4, after the crew runs.
    #  Without this, the crew never sees what the user just typed.)
    history_turns = list(conv_state.turns) + [
        {"role": "user", "content": request.message}
    ]
    conversation_history = _format_history(history_turns)

    # ------------------------------------------------------------------
    # Step 3: Route to agent
    # ------------------------------------------------------------------

    agent_name: str
    reply: str
    agent_result: dict[str, Any] = {}

    try:
        if session_status == "active":
            # Active session -> IntakeFlow
            agent_name = "municipal_intake"

            from src.agents.flows.intake_flow import IntakeFlow
            from src.agents.flows.state import IntakeState

            flow = IntakeFlow(redis_url=settings.REDIS_URL)
            # Flow.state is a read-only @property backed by flow._state.
            # CrewAI 1.8.1 provides no public setter, so we assign the
            # private backing attribute directly.
            flow._state = IntakeState(
                message=request.message,
                user_id=detection_result.get("user_id") or phone,
                tenant_id=(
                    request.municipality_id
                    or detection_result.get("municipality_id")
                    or conv_state.tenant_id
                ),
                session_id=session_id,
                language=detected_language,
            )

            # Run the flow (synchronous kickoff in executor)
            loop = asyncio.get_event_loop()
            flow_result = await loop.run_in_executor(None, flow.kickoff)

            # Extract reply from flow state
            ticket_data = flow.state.ticket_data or {}

            # If the tool was called, ticket_data has tracking_number + message
            tracking = ticket_data.get("tracking_number")
            if tracking:
                reply = ticket_data.get(
                    "message",
                    f"Your report has been logged. Tracking number: {tracking}"
                )
            else:
                reply = ticket_data.get(
                    "message",
                    ticket_data.get("description", "Your report has been received.")
                )

            # Adjust agent name if GBV was detected
            if flow.state.category == "gbv":
                agent_name = "gbv_intake"
                is_gbv = True

            agent_result = {
                "category": flow.state.category,
                "subcategory": flow.state.subcategory,
                "routing_confidence": flow.state.routing_confidence,
                "is_complete": flow.state.is_complete,
                "ticket_data": ticket_data,
            }

        else:
            # New or expired session -> AuthCrew
            agent_name = "auth_agent"

            from src.agents.crews.auth_crew import AuthCrew

            auth_crew = AuthCrew(language=detected_language)
            auth_context = {
                "phone": phone,
                "language": detected_language,
                "user_exists": detection_result.get("user_exists", False),
                "session_status": session_status,
                "user_id": detection_result.get("user_id"),
                "conversation_history": conversation_history,
                "municipality_id": request.municipality_id,
            }

            auth_result = await auth_crew.kickoff(auth_context)

            reply = auth_result.get(
                "message",
                "Welcome! To submit a report, I'll need to verify your identity."
            )
            agent_result = auth_result
            session_status = auth_result.get("session_status", session_status)

    except Exception as e:
        # Fail fast on DeepSeek API errors — no retry, no fallback model
        error_str = str(e)
        error_lang = detected_language if "detected_language" in dir() else request.language
        reply = _get_fallback("error", error_lang)

        return ChatResponse(
            reply=reply,
            agent_name="error",
            session_status=session_status,
            debug={
                "error": error_str,
                "agent_name": "error",
                "turn_count": len(conv_state.turns),
                "session_status": session_status,
            },
        )

    # ------------------------------------------------------------------
    # Step 3.5: Sanitize reply — strip LLM artifacts for citizen-facing output
    # ------------------------------------------------------------------
    # Raw output is preserved in agent_result for Streamlit debug inspection.
    raw_reply = reply
    reply = sanitize_reply(reply, agent_name=agent_name, language=detected_language)

    # ------------------------------------------------------------------
    # Step 4: Save turn to conversation history
    # ------------------------------------------------------------------

    try:
        # Save the user message turn
        await manager.append_turn(
            user_id=phone,
            session_id=session_id,
            role="user",
            content=request.message,
            is_gbv=is_gbv,
        )

        # Save the agent reply turn
        conv_state = await manager.append_turn(
            user_id=phone,
            session_id=session_id,
            role="agent",
            content=reply,
            is_gbv=is_gbv,
        )
        turn_count = len(conv_state.turns)

    except ValueError:
        # Max turns exceeded or state not found — continue gracefully
        turn_count = len(conv_state.turns)

    # ------------------------------------------------------------------
    # Step 5: Build debug dict (GBV content redacted per Pitfall 6)
    # ------------------------------------------------------------------

    if is_gbv or agent_result.get("category") == "gbv":
        # GBV safety: NO conversation content in debug output
        debug: dict[str, Any] = {
            "agent_name": agent_name,
            "turn_count": turn_count,
            "session_status": session_status,
        }
    else:
        debug = {
            "agent_name": agent_name,
            "turn_count": turn_count,
            "session_status": session_status,
            "phone": phone,
            "language": request.language,
            "detected_language": detected_language,
            "municipality_id": request.municipality_id,
            "agent_result": agent_result,
            "raw_reply": raw_reply,
            "detection": {
                "user_exists": detection_result.get("user_exists"),
                "session_status": detection_result.get("session_status"),
            },
        }

    return ChatResponse(
        reply=reply,
        agent_name=agent_name,
        session_status=session_status,
        debug=debug,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(crew_app, host="127.0.0.1", port=8001)
