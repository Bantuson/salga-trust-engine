"""CrewAI Flow for message routing and orchestration.

This module implements the main intake flow that receives citizen messages,
detects language, and delegates all routing and classification to ManagerCrew.

Phase 6.9 refactor: keyword-based classify_message/route_to_crew chain has
been replaced by a single @start() method that calls ManagerCrew.kickoff().
ManagerCrew handles intent classification, auth checks, and specialist
delegation internally via Process.hierarchical.
"""
from typing import Any

from crewai.flow.flow import Flow, start

from src.agents.flows.state import IntakeState
from src.agents.llm import get_deepseek_llm
from src.core.conversation import ConversationManager
from src.core.language import language_detector


class IntakeFlow(Flow[IntakeState]):
    """Main intake flow for message routing and orchestration.

    Single entry point: detect language, delegate to ManagerCrew.

    ManagerCrew (Process.hierarchical) handles all intent classification,
    auth gate checking, and specialist delegation internally. This replaces
    the old keyword-based classify_message + route_to_crew chain.
    """

    def __init__(self, redis_url: str, llm=None):
        """Initialize intake flow.

        Args:
            redis_url: Redis connection URL for conversation state
            llm: crewai.LLM object. Defaults to DeepSeek V3.2 via get_deepseek_llm().
        """
        super().__init__()
        self._conversation_manager = ConversationManager(redis_url)
        self._llm = llm or get_deepseek_llm()

    @start()
    async def receive_and_route(self) -> dict:
        """Single entry point: detect language, run ManagerCrew.

        Replaces the keyword classification chain with LLM-based manager
        routing. The ManagerCrew handles intent classification, auth checks,
        and specialist delegation internally via Process.hierarchical.

        Returns:
            Result dict from ManagerCrew with "message" and routing metadata.
        """
        # Detect language using lingua-py (preserved from old flow)
        detected_language = language_detector.detect(
            self.state.message, fallback="en"
        )
        self.state.language = detected_language
        self.state.turn_count += 1

        # Build context for ManagerCrew
        from src.agents.crews.manager_crew import ManagerCrew

        manager_crew = ManagerCrew(language=detected_language, llm=self._llm)
        result = await manager_crew.kickoff({
            "message": self.state.message,
            "user_id": self.state.user_id,
            "tenant_id": self.state.tenant_id,
            "language": detected_language,
            "phone": self.state.phone,
            "session_status": self.state.session_status,
            "user_exists": str(self.state.user_exists),
            "conversation_history": self.state.conversation_history,
            "pending_intent": self.state.pending_intent or "none",
        })

        # Store result in state
        self.state.ticket_data = result
        self.state.is_complete = True

        return result
