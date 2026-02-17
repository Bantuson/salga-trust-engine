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
from src.core.conversation import ConversationManager


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

_conversation_manager: ConversationManager | None = None


def _get_conversation_manager() -> ConversationManager:
    """Lazy-initialise the shared ConversationManager.

    Returns:
        Module-level ConversationManager connected to Redis.
    """
    global _conversation_manager
    if _conversation_manager is None:
        _conversation_manager = ConversationManager(settings.REDIS_URL)
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

    if request.session_override in ("expired", "new"):
        # Test mode: use the provided override directly
        session_status = "none" if request.session_override == "new" else "expired"
        detection_result = {
            "user_exists": request.session_override != "new",
            "session_status": session_status,
            "user_id": None,
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
            language=request.language,
            is_gbv=False,
        )

    conversation_history = _format_history(conv_state.turns)

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
            flow.state = IntakeState(
                message=request.message,
                user_id=detection_result.get("user_id") or phone,
                tenant_id=request.municipality_id or conv_state.tenant_id,
                session_id=session_id,
                language=request.language,
            )

            # Run the flow (synchronous kickoff in executor)
            loop = asyncio.get_event_loop()
            flow_result = await loop.run_in_executor(None, flow.kickoff)

            # Extract reply from flow state
            ticket_data = flow.state.ticket_data or {}
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

            auth_crew = AuthCrew(language=request.language)
            auth_context = {
                "phone": phone,
                "language": request.language,
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
        if any(
            keyword in error_str.lower()
            for keyword in ("deepseek", "api", "litellm", "openai", "timeout", "connection", "rate limit")
        ):
            reply = "DeepSeek API unavailable, please retry"
        else:
            reply = "An unexpected error occurred. Please try again."

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
            "municipality_id": request.municipality_id,
            "agent_result": agent_result,
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
