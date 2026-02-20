"""Message API endpoint for citizen reporting via WhatsApp and web portal.

This module provides the main entry point for citizen messages, orchestrating
the full pipeline: Authentication -> Guardrails -> Language Detection ->
Classification -> Crew Routing -> Ticket Creation.
"""
import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from src.api.deps import get_current_user, get_db
from src.middleware.rate_limit import SENSITIVE_READ_RATE_LIMIT, SENSITIVE_WRITE_RATE_LIMIT, limiter
from src.agents.flows.intake_flow import IntakeFlow
from src.agents.flows.state import IntakeState
from src.core.config import settings
from src.core.conversation import ConversationManager
from src.guardrails.engine import guardrails_engine
from src.models.user import User

logger = logging.getLogger(__name__)

# Create router with prefix and tags
router = APIRouter(prefix="/messages", tags=["messages"])


# Request/Response schemas
class MessageRequest(BaseModel):
    """Request schema for sending a message.

    Attributes:
        message: Citizen message content (1-5000 characters)
        session_id: Optional session ID for multi-turn conversations
    """

    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Citizen message content",
    )
    session_id: str | None = Field(
        default=None,
        description="Session ID for multi-turn conversations",
    )


class MessageResponse(BaseModel):
    """Response schema for message processing result.

    Attributes:
        response: Agent response to citizen
        session_id: Session ID for conversation tracking
        language: Detected language code (en/zu/af)
        category: Classified category (municipal/gbv) if determined
        ticket_id: Created ticket ID if intake complete
        tracking_number: Human-readable tracking number if ticket created
        is_complete: Whether intake is complete and ticket created
        blocked: Whether message was blocked by guardrails
    """

    response: str = Field(..., description="Agent response to citizen")
    session_id: str = Field(..., description="Session ID for conversation")
    language: str = Field(..., description="Detected language (en/zu/af)")
    category: str | None = Field(None, description="Category (municipal/gbv)")
    ticket_id: str | None = Field(None, description="Created ticket ID")
    tracking_number: str | None = Field(None, description="Tracking number")
    is_complete: bool = Field(False, description="Intake complete flag")
    blocked: bool = Field(False, description="Blocked by guardrails flag")


class SessionHistoryResponse(BaseModel):
    """Response schema for conversation session history.

    Attributes:
        session_id: Session identifier
        user_id: User identifier
        language: Conversation language
        category: Classified category if determined
        turns: List of conversation turns
        created_at: Session creation timestamp
    """

    session_id: str
    user_id: str
    language: str
    category: str | None
    turns: list[dict[str, Any]]
    created_at: float


@router.post("/send", response_model=MessageResponse)
@limiter.limit(SENSITIVE_WRITE_RATE_LIMIT)
async def send_message(
    request: Request,
    message_body: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Process citizen message through AI agent pipeline.

    This endpoint orchestrates the complete message processing flow:
    1. Validate input through guardrails (prompt injection, sanitization)
    2. Get or create conversation session
    3. Create and run IntakeFlow (language detection -> classification -> crew)
    4. Sanitize output through guardrails (PII masking)
    5. Save updated conversation state
    6. Return structured response

    Args:
        message_body: Message request with content and optional session_id
        current_user: Authenticated user (from JWT token)
        db: Database session

    Returns:
        MessageResponse with agent response and metadata

    Raises:
        HTTPException: 401 if not authenticated
        HTTPException: 400 if tenant context missing
    """
    # Extract tenant_id from token (set by get_current_user)
    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required",
        )

    # Step 1: Validate input through guardrails
    input_result = await guardrails_engine.process_input(message_body.message)

    if not input_result.is_safe:
        # Input blocked - return error response
        return MessageResponse(
            response=input_result.blocked_reason or "Message blocked by safety filters",
            session_id=message_body.session_id or str(uuid.uuid4()),
            language="en",
            blocked=True,
        )

    # Step 2: Get or create conversation session
    session_id = message_body.session_id or str(uuid.uuid4())
    conversation_manager = ConversationManager(settings.REDIS_URL)

    try:
        # Try to get existing session
        conversation_state = await conversation_manager.get_state(
            user_id=str(current_user.id),
            session_id=session_id,
            is_gbv=False,  # We'll determine this from classification
        )

        # If session doesn't exist, create it
        if conversation_state is None:
            conversation_state = await conversation_manager.create_session(
                user_id=str(current_user.id),
                session_id=session_id,
                tenant_id=str(tenant_id),
                language="en",  # Will be detected by flow
                is_gbv=False,
            )

        # Step 3: Create IntakeFlow with state
        intake_state = IntakeState(
            message_id=str(uuid.uuid4()),
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            session_id=session_id,
            message=input_result.sanitized_message,
            language=conversation_state.language,
            turn_count=len(conversation_state.turns) + 1,
        )

        # Initialize flow
        flow = IntakeFlow(redis_url=settings.REDIS_URL, llm_model="gpt-4o")
        # Flow.state is a read-only @property backed by flow._state.
        # CrewAI 1.8.1 provides no public setter, so we assign directly.
        flow._state = intake_state

        # Step 4: Run flow (kickoff)
        try:
            # Flow will handle language detection, classification, and crew routing
            result = flow.kickoff()

            # Extract response from flow state
            agent_response = "Thank you for your report. We are processing your request."
            if flow.state.ticket_data:
                # Ticket was created
                agent_response = (
                    f"Your report has been received and logged. "
                    f"Category: {flow.state.category}. "
                    f"We will investigate this issue."
                )

            detected_language = flow.state.language
            category = flow.state.category
            is_complete = flow.state.is_complete
            ticket_id = flow.state.ticket_id

        except Exception as e:
            logger.error(f"Flow execution failed: {e}", exc_info=True)
            agent_response = (
                "I apologize, but I encountered an error processing your request. "
                "Please try again or contact support if the issue persists."
            )
            detected_language = conversation_state.language
            category = None
            is_complete = False
            ticket_id = None

        # Step 5: Sanitize output through guardrails
        output_result = await guardrails_engine.process_output(agent_response)

        # Step 6: Save updated conversation state
        await conversation_manager.append_turn(
            user_id=str(current_user.id),
            session_id=session_id,
            role="user",
            content=input_result.sanitized_message,
            is_gbv=(category == "gbv"),
        )

        await conversation_manager.append_turn(
            user_id=str(current_user.id),
            session_id=session_id,
            role="agent",
            content=output_result.sanitized_response,
            is_gbv=(category == "gbv"),
        )

        # Step 7: Return structured response
        return MessageResponse(
            response=output_result.sanitized_response,
            session_id=session_id,
            language=detected_language,
            category=category,
            ticket_id=ticket_id,
            tracking_number=None,  # Would be from ticket creation
            is_complete=is_complete,
            blocked=False,
        )

    finally:
        # Clean up Redis connection
        await conversation_manager.close()


@router.get("/session/{session_id}", response_model=SessionHistoryResponse)
@limiter.limit(SENSITIVE_READ_RATE_LIMIT)
async def get_session_history(
    request: Request,
    session_id: str,
    current_user: User = Depends(get_current_user),
) -> SessionHistoryResponse:
    """Get conversation history for a session.

    Args:
        session_id: Session identifier
        current_user: Authenticated user

    Returns:
        SessionHistoryResponse with conversation history

    Raises:
        HTTPException: 404 if session not found
    """
    conversation_manager = ConversationManager(settings.REDIS_URL)

    try:
        # Try municipal namespace first
        conversation_state = await conversation_manager.get_state(
            user_id=str(current_user.id),
            session_id=session_id,
            is_gbv=False,
        )

        # If not found, try GBV namespace (though GBV sessions are cleared)
        if conversation_state is None:
            conversation_state = await conversation_manager.get_state(
                user_id=str(current_user.id),
                session_id=session_id,
                is_gbv=True,
            )

        if conversation_state is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found",
            )

        return SessionHistoryResponse(
            session_id=conversation_state.session_id,
            user_id=conversation_state.user_id,
            language=conversation_state.language,
            category=conversation_state.category,
            turns=conversation_state.turns,
            created_at=conversation_state.created_at,
        )

    finally:
        await conversation_manager.close()
