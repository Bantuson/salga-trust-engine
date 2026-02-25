"""Flow state model for conversation state management.

IntakeState tracks conversation context across multiple turns for the
Flow-as-router architecture (Phase 10.3 rebuild).

Architecture notes:
- State is maintained by the caller (crew_server.py / ConversationManager),
  NOT via CrewAI built-in memory (memory=False on all Crews).
- Conversation history injected as formatted string in task description.
- All fields have defaults — required by CrewAI Flow state initialization.
"""
from pydantic import BaseModel


class IntakeState(BaseModel):
    """State model for the IntakeFlow orchestrator.

    Tracks: message content, citizen identity, language, routing intent,
    auth state, and conversation history across multi-turn conversations.

    Fields:
        message: Current citizen message text
        phone: Citizen WhatsApp phone number (E.164 format)
        language: Detected language ("en" | "zu" | "af")
        intent: Classified routing intent ("auth" | "municipal" | "ticket_status" | "gbv")
        routing_phase: Current routing phase ("manager" | "auth" | "municipal" | etc.)
        session_status: Auth session state ("none" | "active" | "expired" | "otp_pending")
        user_id: Authenticated user UUID (None if not yet authenticated)
        conversation_history: Formatted history string injected into task descriptions
        result: Dict output from the most recently invoked specialist Crew
        pending_intent: Carries citizen's original intent through auth handoff
    """
    message: str = ""
    phone: str = ""
    language: str = "en"
    intent: str = "unknown"  # "auth" | "municipal" | "ticket_status" | "gbv"
    routing_phase: str = "manager"
    session_status: str = "none"  # "none" | "active" | "expired" | "otp_pending"
    user_id: str | None = None
    conversation_history: str = "(none)"
    result: dict = {}
    pending_intent: str = ""  # Carries citizen's original intent through auth
