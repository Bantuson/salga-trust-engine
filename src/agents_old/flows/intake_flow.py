"""CrewAI Flow for message routing and orchestration.

This module implements the main intake flow that receives citizen messages,
detects language, and delegates all routing and classification to ManagerCrew.

Phase 6.9 refactor: keyword-based classify_message/route_to_crew chain has
been replaced by @start() + @listen() chain using CrewAI best practices.
ManagerCrew handles intent classification, auth checks, and specialist
delegation internally via Process.hierarchical.
"""
from typing import Any

from crewai.flow.flow import Flow, listen, start

from src.agents.flows.state import IntakeState
from src.agents.llm import get_crew_llm
from src.core.conversation import ConversationManager
from src.core.language import language_detector


class IntakeFlow(Flow[IntakeState]):
    """Main intake flow for message routing and orchestration.

    Three-step chain: detect_language -> route_to_crew -> finalize.

    ManagerCrew (Process.hierarchical) handles all intent classification,
    auth gate checking, and specialist delegation internally.
    """

    def __init__(self, redis_url: str, llm=None):
        """Initialize intake flow.

        Args:
            redis_url: Redis connection URL for conversation state
            llm: crewai.LLM object. Defaults to DeepSeek V3.2 via get_deepseek_llm().
        """
        super().__init__()
        self._conversation_manager = ConversationManager(redis_url)
        self._llm = llm or get_crew_llm()

    @start()
    async def detect_language(self) -> str:
        """Step 1: Language detection and state init.

        Returns:
            Detected language code (en/zu/af).
        """
        detected = language_detector.detect(
            self.state.message, fallback="en"
        )
        self.state.language = detected
        self.state.turn_count += 1
        return detected

    @listen(detect_language)
    async def route_to_crew(self, detected_language: str) -> dict:
        """Step 2: ManagerCrew kickoff with full context.

        Args:
            detected_language: Language code from detect_language step.

        Returns:
            Result dict from ManagerCrew with "message" and routing metadata.
        """
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
        return result

    @listen(route_to_crew)
    async def finalize(self, result: dict) -> dict:
        """Step 3: Persist result to state.

        Args:
            result: Dict from ManagerCrew with message and routing metadata.

        Returns:
            The same result dict (pass-through).
        """
        self.state.ticket_data = result
        self.state.is_complete = True
        return result

    async def receive_and_route(self) -> dict:
        """Backward compatibility alias for tests and callers.

        Runs the full 3-step chain: detect_language -> route_to_crew -> finalize.

        Returns:
            Result dict from ManagerCrew.
        """
        detected = await self.detect_language()
        result = await self.route_to_crew(detected)
        return await self.finalize(result)
